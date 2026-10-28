import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CraftingCity } from "../catalog/cities";

export type FoodGroup = "food" | "potions";

export interface FoodCities {
    sell: CraftingCity;
    /** Where food and potions are made: the city bonus */
    craft: CraftingCity;
    /** Crops, meat, fish sauce, extracts and the rest */
    buy: CraftingCity;
}

export interface FoodSettings {
    /** One city for buying, cooking and selling */
    sameCity: boolean;
    cities: FoodCities;
    useFocus: boolean;
    premium: boolean;
    /** Station fee per 100 nutrition */
    fee: number;
    crafts: number;
    /** Return rate in percent instead of the one from the city and focus */
    ownReturnRate?: number;
}

interface FoodState {
    group: FoodGroup;
    family?: string;
    settings: FoodSettings;
    select: (selection: { group?: FoodGroup; family?: string }) => void;
    update: (settings: Partial<FoodSettings>) => void;
    setCity: (role: keyof FoodCities, city: CraftingCity) => void;
}

export const useFoodStore = create<FoodState>()(
    persist(
        (set) => ({
            group: "food",
            family: undefined,
            settings: {
                sameCity: true,
                cities: { sell: "Caerleon", craft: "Caerleon", buy: "Caerleon" },
                useFocus: false,
                premium: true,
                fee: 800,
                crafts: 1,
                ownReturnRate: undefined,
            },
            select: (selection) => set(selection),
            update: (settings) =>
                set((state) => ({ settings: { ...state.settings, ...settings } })),
            setCity: (role, city) =>
                set(({ settings }) => ({
                    settings: {
                        ...settings,
                        cities: settings.sameCity
                            ? { sell: city, craft: city, buy: city }
                            : { ...settings.cities, [role]: city },
                    },
                })),
        }),
        {
            name: "apc-food",
            partialize: ({ group, family, settings }) => ({ group, family, settings }),
        },
    ),
);
