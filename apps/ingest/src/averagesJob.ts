import { type Db, type Server, upsertAveragePrices } from "@apc/db";
import { aggregateCharts, chartsUrl, idBatches } from "./averages.ts";

/** Albion Online Data throttles hard, one request at a time with a pause */
export const REQUEST_DELAY_MS = 2000;
const MAX_ATTEMPTS = 3;
const DEFAULT_RETRY_MS = 60 * 1000;

export interface AveragesJobOptions {
    fetch?: typeof fetch;
    sleep?: (ms: number) => Promise<void>;
    now?: () => Date;
    log?: (message: string) => void;
    delayMs?: number;
}

export interface AveragesJobResult {
    requests: number;
    rows: number;
    failedBatches: number;
}

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Waits until `ratelimit-reset` (unix seconds) on 429 and tries again */
async function fetchJson(
    url: string,
    options: Required<Pick<AveragesJobOptions, "fetch" | "sleep" | "now">>,
): Promise<unknown> {
    for (let attempt = 1; ; attempt++) {
        // fetch asks for gzip itself; the API throttles uncompressed clients
        const response = await options.fetch(url);

        if (response.ok) {
            return response.json();
        }

        if (response.status !== 429 || attempt >= MAX_ATTEMPTS) {
            throw new Error(`${response.status} ${await response.text()}`);
        }

        const reset = Number(response.headers.get("ratelimit-reset"));
        const waitMs = reset
            ? Math.max(reset * 1000 - options.now().getTime(), 0) + 1000
            : DEFAULT_RETRY_MS;

        await options.sleep(waitMs);
    }
}

/** Downloads 30 day averages of items for a server in batches */
export async function updateAverages(
    db: Db,
    server: Server,
    itemIds: string[],
    {
        fetch: fetchFn = fetch,
        sleep = realSleep,
        now = () => new Date(),
        log = console.log,
        delayMs = REQUEST_DELAY_MS,
    }: AveragesJobOptions = {},
): Promise<AveragesJobResult> {
    const result: AveragesJobResult = { requests: 0, rows: 0, failedBatches: 0 };

    if (!server.apiUrl) {
        return result;
    }

    for (const [index, batch] of idBatches(itemIds).entries()) {
        if (index > 0) {
            await sleep(delayMs);
        }

        try {
            const json = await fetchJson(chartsUrl(server.apiUrl, batch, now()), {
                fetch: fetchFn,
                sleep,
                now,
            });
            const rows = aggregateCharts(server.id, json, now());

            await upsertAveragePrices(db, rows);
            result.rows += rows.length;
        } catch (error) {
            result.failedBatches++;
            log(`[${server.id}] averages batch ${index} failed: ${String(error)}`);
        }

        result.requests++;
    }

    return result;
}
