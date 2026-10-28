import { useCallback } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useCurrentServer } from "../api/servers";

interface ManualPricesState {
    /** Own price per unit by `${serverId}|${marketId}` */
    prices: Record<string, number>;
    setPrice: (serverId: string, marketId: string, price: number | undefined) => void;
    clear: (serverId: string, marketIds: readonly string[]) => void;
}

function key(serverId: string, marketId: string): string {
    return `${serverId}|${marketId}`;
}

/** Prices typed in by the user; they don't depend on the city */
export const useManualPricesStore = create<ManualPricesState>()(
    persist(
        (set) => ({
            prices: {},
            setPrice: (serverId, marketId, price) =>
                set(({ prices }) => {
                    const next = { ...prices };

                    if (price !== undefined && price > 0) {
                        next[key(serverId, marketId)] = price;
                    } else {
                        delete next[key(serverId, marketId)];
                    }

                    return { prices: next };
                }),
            clear: (serverId, marketIds) =>
                set(({ prices }) => {
                    const next = { ...prices };

                    for (const marketId of marketIds) {
                        delete next[key(serverId, marketId)];
                    }

                    return { prices: next };
                }),
        }),
        { name: "apc-manual-prices" },
    ),
);

/** Own prices on the selected server */
export function useManualPrices() {
    const serverId = useCurrentServer()?.id;
    const prices = useManualPricesStore((state) => state.prices);

    return useCallback(
        (marketId: string): number | undefined =>
            serverId === undefined ? undefined : prices[key(serverId, marketId)],
        [serverId, prices],
    );
}
