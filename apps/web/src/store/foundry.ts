import type { FragmentType } from "@apc/calc";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CraftingCity } from "../catalog/cities";

export interface FoundryCities {
    sell: CraftingCity;
    /** Where fragments are bought and melded */
    buy: CraftingCity;
}

export interface FoundrySettings {
    sameCity: boolean;
    cities: FoundryCities;
    premium: boolean;
    /** Station fee per 100 nutrition */
    fee: number;
    /** Return rate in percent; melding returns nothing by default */
    ownReturnRate?: number;
}

/** A cell of the table: a branch, "ALL" or "OTHER" at a tier */
export interface FoundryCell {
    row: string;
    tier: number;
}

interface FoundryState {
    fragment: FragmentType;
    cell?: FoundryCell;
    settings: FoundrySettings;
    select: (selection: { fragment?: FragmentType; cell?: FoundryCell }) => void;
    update: (settings: Partial<FoundrySettings>) => void;
    setCity: (role: keyof FoundryCities, city: CraftingCity) => void;
}

export const useFoundryStore = create<FoundryState>()(
    persist(
        (set) => ({
            fragment: "RUNE",
            cell: undefined,
            settings: {
                sameCity: true,
                cities: { sell: "Caerleon", buy: "Caerleon" },
                premium: true,
                fee: 500,
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
                            ? { sell: city, buy: city }
                            : { ...settings.cities, [role]: city },
                    },
                })),
        }),
        {
            name: "apc-foundry",
            partialize: ({ fragment, cell, settings }) => ({ fragment, cell, settings }),
        },
    ),
);
