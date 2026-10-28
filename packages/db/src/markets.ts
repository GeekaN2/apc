/**
 * Market locations of cities, as Albion Online Data reports them. Names of the clusters
 * are in ao-bin-dumps `formatted/world.json` ("Thetford Market", "Thetford Portal");
 * the Black Market is cluster 3003, which world.json names just "Caerleon".
 */
export const MARKETS = {
    Thetford: ["0007", "0301"],
    Lymhurst: ["1002", "1301"],
    Bridgewatch: ["2004", "2301"],
    Martlock: ["3008", "3301"],
    "Fort Sterling": ["4002", "4301"],
    Caerleon: ["3005"],
    "Black Market": ["3003"],
    Brecilien: ["5003"],
} as const;

export type City = keyof typeof MARKETS;

export const CITIES = Object.keys(MARKETS) as City[];

const cityByLocation = new Map<string, City>(
    CITIES.flatMap((city) => MARKETS[city].map((id) => [id, city] as const)),
);

/** NATS sends location ids as numbers: 7 → 0007 */
export function normalizeLocationId(locationId: number | string): string {
    return String(locationId).padStart(4, "0");
}

export function cityOfLocation(locationId: string): City | undefined {
    return cityByLocation.get(locationId);
}
