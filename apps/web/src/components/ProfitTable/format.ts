import { PRICE_FRESHNESS_MS } from "@apc/calc";

export function formatSilver(value: number, language: string): string {
    return new Intl.NumberFormat(language, { maximumFractionDigits: 0 }).format(value);
}

export function formatNumber(value: number, language: string, digits: number): string {
    return new Intl.NumberFormat(language, { maximumFractionDigits: digits }).format(
        value,
    );
}

export function formatPercent(value: number, language: string): string {
    return new Intl.NumberFormat(language, {
        maximumFractionDigits: 1,
        signDisplay: "exceptZero",
    }).format(value);
}

/** "3 hr. ago", the largest whole unit */
export function formatAge(date: Date, now: number, language: string): string {
    const minutes = Math.max(0, Math.round((now - date.getTime()) / 60_000));
    const format = new Intl.RelativeTimeFormat(language, { style: "narrow" });

    // −0 minutes would read "in 0 min."
    if (minutes === 0) {
        return new Intl.RelativeTimeFormat(language, { numeric: "auto" }).format(
            0,
            "second",
        );
    }

    if (minutes < 60) {
        return format.format(-minutes, "minute");
    }

    if (minutes < 60 * 24) {
        return format.format(-Math.floor(minutes / 60), "hour");
    }

    return format.format(-Math.floor(minutes / 60 / 24), "day");
}

export function isStale(date: Date, now: number): boolean {
    return now - date.getTime() >= PRICE_FRESHNESS_MS;
}
