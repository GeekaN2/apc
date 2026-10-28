import { EQUIPMENT_CATEGORIES, craftableFamilies, recipeVariantCount } from "@apc/calc";
import { useMemo } from "react";
import { useEquipmentCatalog, useNames } from "../../catalog/catalog";
import { useTreeStore } from "../../store/tree";
import { useFamilyCraft } from "../Craft/useFamilyCraft";

export function useTree() {
    const { family: familyKey, variant, settings } = useTreeStore();
    const catalog = useEquipmentCatalog();
    const names = useNames();
    const families = useMemo(
        () => (catalog.data ? craftableFamilies(catalog.data, EQUIPMENT_CATEGORIES) : []),
        [catalog.data],
    );
    const family = families.find((f) => f.key === familyKey);
    const variants = family ? recipeVariantCount(family) : 1;
    const recipeVariant = Math.min(variant, variants - 1);
    const craft = useFamilyCraft(
        catalog.data,
        family,
        recipeVariant,
        settings,
        settings.cities,
    );

    return {
        ...craft,
        catalog: catalog.data,
        names: names.data,
        families,
        family,
        variants,
        recipeVariant,
        isCatalogPending: catalog.isPending || names.isPending,
    };
}
