import type { TransportSort } from "@apc/calc";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { City, CraftingCity } from "../catalog/cities";

/** Any city: the cheapest to buy in or the best to sell in */
export const ANY = "ANY";

export interface TransportSettings {
    from: CraftingCity | typeof ANY;
    to: City | typeof ANY;
    sort: Exclude<TransportSort, "freshPrices">;
    premium: boolean;
    /** Only routes whose both prices are less than a day old */
    freshOnly: boolean;
    /** Marketplace category or all */
    category: string;
    minSoldPerDay: number;
}

interface TransportState extends TransportSettings {
    update: (settings: Partial<TransportSettings>) => void;
}

export const useTransportStore = create<TransportState>()(
    persist(
        (set) => ({
            from: "Lymhurst",
            to: "Black Market",
            sort: "profitVolume",
            premium: true,
            freshOnly: true,
            category: ANY,
            minSoldPerDay: 0,
            update: (settings) => set(settings),
        }),
        {
            name: "apc-transport",
            partialize: (state): TransportSettings => ({
                from: state.from,
                to: state.to,
                sort: state.sort,
                premium: state.premium,
                freshOnly: state.freshOnly,
                category: state.category,
                minSoldPerDay: state.minSoldPerDay,
            }),
        },
    ),
);
