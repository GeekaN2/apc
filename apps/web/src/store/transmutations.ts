import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CraftingCity } from "../catalog/cities";

export const TRANSMUTED_RESOURCES = ["ORE", "WOOD", "HIDE", "FIBER", "ROCK"] as const;

export type TransmutedResource = (typeof TRANSMUTED_RESOURCES)[number];

export interface TransmutationSettings {
    sameCity: boolean;
    cities: { buy: CraftingCity; sell: CraftingCity };
    premium: boolean;
    /** Station fee per 100 nutrition */
    fee: number;
    /**
     * Cost of T4.3 → T4.4 seen in the game. The game discounts transmutation silver
     * globally and the dumps don't have the discount, so it is calibrated by this.
     */
    observedCost?: number;
}

interface TransmutationState {
    resource: TransmutedResource;
    settings: TransmutationSettings;
    select: (resource: TransmutedResource) => void;
    update: (settings: Partial<TransmutationSettings>) => void;
    setCity: (role: "buy" | "sell", city: CraftingCity) => void;
}

export const useTransmutationStore = create<TransmutationState>()(
    persist(
        (set) => ({
            resource: "ORE",
            settings: {
                sameCity: true,
                cities: { buy: "Caerleon", sell: "Caerleon" },
                premium: true,
                fee: 800,
                observedCost: undefined,
            },
            select: (resource) => set({ resource }),
            update: (settings) =>
                set((state) => ({ settings: { ...state.settings, ...settings } })),
            setCity: (role, city) =>
                set(({ settings }) => ({
                    settings: {
                        ...settings,
                        cities: settings.sameCity
                            ? { buy: city, sell: city }
                            : { ...settings.cities, [role]: city },
                    },
                })),
        }),
        {
            name: "apc-transmutations",
            partialize: ({ resource, settings }) => ({ resource, settings }),
        },
    ),
);
