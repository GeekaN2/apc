import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CraftingCity } from "../catalog/cities";
import {
    DEFAULT_TREE_SETTINGS,
    type TreeCities,
    type TreeSettings,
} from "./treeSettings";

/** What is shown: marketplace category, subcategory and item family */
export interface TreeSelection {
    category: string;
    subcategory?: string;
    family?: string;
    /** Recipe variant of the family */
    variant: number;
}

interface TreeState extends TreeSelection {
    settings: TreeSettings;
    select: (selection: Partial<TreeSelection>) => void;
    update: (settings: Partial<TreeSettings>) => void;
    setCity: <R extends keyof TreeCities>(role: R, city: TreeCities[R]) => void;
}

export const useTreeStore = create<TreeState>()(
    persist(
        (set) => ({
            category: "weapons",
            subcategory: undefined,
            family: undefined,
            variant: 0,
            settings: DEFAULT_TREE_SETTINGS,
            select: (selection) => set(selection),
            update: (settings) =>
                set((state) => ({ settings: { ...state.settings, ...settings } })),
            setCity: (role, city) =>
                set(({ settings }) => {
                    if (settings.sameCity) {
                        // The Black Market only buys: craft and buy in Caerleon next to it
                        const local: CraftingCity =
                            city === "Black Market" ? "Caerleon" : city;

                        return {
                            settings: {
                                ...settings,
                                cities: {
                                    sell: city,
                                    craft: local,
                                    resources: local,
                                    components: local,
                                    journals: local,
                                },
                            },
                        };
                    }

                    return {
                        settings: {
                            ...settings,
                            cities: { ...settings.cities, [role]: city },
                        },
                    };
                }),
        }),
        {
            name: "apc-tree",
            partialize: (state) => ({
                category: state.category,
                subcategory: state.subcategory,
                family: state.family,
                variant: state.variant,
                settings: state.settings,
            }),
        },
    ),
);
