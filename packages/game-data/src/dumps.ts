import { execFileSync } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream } from "node:stream/web";
import { z } from "zod";

export const PACKAGE_ROOT = path.resolve(import.meta.dirname, "..");

const PIN_FILE = path.join(PACKAGE_ROOT, "dumps.json");
const CACHE_DIR = path.join(PACKAGE_ROOT, ".cache");

export const DUMP_FILES = [
    "items.json",
    "formatted/items.json",
    "localization.json",
    "craftingmodifiers.json",
    "formatted/world.json",
] as const;

export type DumpFile = (typeof DUMP_FILES)[number];

const dumpsPin = z.object({
    repository: z.string(),
    commit: z.string().regex(/^[0-9a-f]{40}$/),
    date: z.string(),
});

/** ao-bin-dumps commit the catalog is built from */
export type DumpsPin = z.infer<typeof dumpsPin>;

export async function readPin(): Promise<DumpsPin> {
    return dumpsPin.parse(JSON.parse(await readFile(PIN_FILE, "utf8")));
}

export async function writePin(pin: DumpsPin) {
    await writeFile(PIN_FILE, `${JSON.stringify(pin, null, 4)}\n`);
}

/** A local ao-bin-dumps clone must be checked out at the pinned commit */
function checkLocalClone(dir: string, pin: DumpsPin) {
    let head: string;

    try {
        head = execFileSync("git", ["-C", dir, "rev-parse", "HEAD"], {
            encoding: "utf8",
        }).trim();
    } catch {
        throw new Error(`AO_BIN_DUMPS_DIR=${dir} is not a git repository`);
    }

    if (head !== pin.commit) {
        throw new Error(
            `AO_BIN_DUMPS_DIR=${dir} is at ${head}, but dumps.json pins ${pin.commit}. ` +
                `Check out the pinned commit or unset AO_BIN_DUMPS_DIR.`,
        );
    }
}

async function download(pin: DumpsPin, file: DumpFile, target: string) {
    const url = `https://raw.githubusercontent.com/${pin.repository}/${pin.commit}/${file}`;
    const response = await fetch(url);

    if (!response.ok || !response.body) {
        throw new Error(`Failed to download ${url}: ${response.status}`);
    }

    await mkdir(path.dirname(target), { recursive: true });

    const partial = `${target}.partial`;

    await pipeline(
        Readable.fromWeb(response.body as ReadableStream),
        createWriteStream(partial),
    );
    await rename(partial, target);
}

/**
 * Directory with the pinned dump files: a local clone from AO_BIN_DUMPS_DIR,
 * or `.cache/<commit>` with files downloaded from GitHub
 */
export async function resolveDumpsDir(
    pin: DumpsPin,
    log: (message: string) => void = console.log,
): Promise<string> {
    const local = process.env.AO_BIN_DUMPS_DIR;

    if (local) {
        checkLocalClone(local, pin);

        return local;
    }

    const dir = path.join(CACHE_DIR, pin.commit);

    for (const file of DUMP_FILES) {
        const target = path.join(dir, file);

        if (!existsSync(target)) {
            log(`Downloading ${file}...`);
            await download(pin, file, target);
        }
    }

    return dir;
}

export async function readDump(dir: string, file: DumpFile): Promise<unknown> {
    return JSON.parse(await readFile(path.join(dir, file), "utf8"));
}
