/** Cities with a market, as `/api/prices` accepts them */
export const CITIES = [
    "Thetford",
    "Lymhurst",
    "Bridgewatch",
    "Martlock",
    "Fort Sterling",
    "Caerleon",
    "Brecilien",
    "Black Market",
] as const;

export type City = (typeof CITIES)[number];

export type CraftingCity = Exclude<City, "Black Market">;

/** Cities with crafting stations: the Black Market only buys */
export const CRAFTING_CITIES = CITIES.filter(
    (city): city is CraftingCity => city !== "Black Market",
);
