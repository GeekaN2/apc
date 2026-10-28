import type { RefinedResource } from "@apc/calc";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CraftingCity } from "../catalog/catalog";

export interface RefiningCities {
    /** Where resources are refined: the city bonus */
    refine: CraftingCity;
    buyRaw: CraftingCity;
    /** Where the refined resource of the tier below is bought */
    buyMaterials: CraftingCity;
    sell: CraftingCity;
}

export interface RefiningSettings {
    resource: RefinedResource;
    /** One city for buying, refining and selling */
    sameCity: boolean;
    cities: RefiningCities;
    useFocus: boolean;
    premium: boolean;
    /** Station fee per 100 nutrition */
    fee: number;
    /** Return rate in percent instead of the one from the city and focus */
    ownReturnRate?: number;
}

interface RefiningState extends RefiningSettings {
    update: (settings: Partial<RefiningSettings>) => void;
    setCity: (role: keyof RefiningCities, city: CraftingCity) => void;
}

export const useRefiningStore = create<RefiningState>()(
    persist(
        (set) => ({
            resource: "METALBAR",
            sameCity: true,
            cities: {
                refine: "Thetford",
                buyRaw: "Thetford",
                buyMaterials: "Thetford",
                sell: "Thetford",
            },
            useFocus: false,
            premium: true,
            fee: 800,
            ownReturnRate: undefined,
            update: (settings) => set(settings),
            setCity: (role, city) =>
                set((state) => {
                    if (state.sameCity) {
                        return {
                            cities: {
                                refine: city,
                                buyRaw: city,
                                buyMaterials: city,
                                sell: city,
                            },
                        };
                    }

                    return { cities: { ...state.cities, [role]: city } };
                }),
        }),
        {
            name: "apc-refining",
            partialize: (state): RefiningSettings => ({
                resource: state.resource,
                sameCity: state.sameCity,
                cities: state.cities,
                useFocus: state.useFocus,
                premium: state.premium,
                fee: state.fee,
                ownReturnRate: state.ownReturnRate,
            }),
        },
    ),
);
