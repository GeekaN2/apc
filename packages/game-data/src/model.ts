/**
 * Catalog model. Mirrors ao-bin-dumps `items.json`: element and attribute names are kept,
 * only converted to camelCase. Numbers and booleans are parsed from strings, elements
 * that can be a single object or an array are always arrays, and fields that don't
 * matter for the economy (spells, sounds, combat stats, visuals) are dropped.
 */

/** Section of `items.json` the item comes from */
export const ITEM_KINDS = [
    "trackingitem",
    "farmableitem",
    "simpleitem",
    "consumableitem",
    "rewardtoken",
    "consumablefrominventoryitem",
    "trashitem",
    "equipmentitem",
    "weapon",
    "mount",
    "furnitureitem",
    "journalitem",
    "labourercontract",
    "transformationweapon",
    "crystalleagueitem",
    "siegebanner",
    "killtrophy",
] as const;

export type ItemKind = (typeof ITEM_KINDS)[number];

/** Sections without economy: mount skins have no tier and no marketplace category */
export const IGNORED_ITEM_SECTIONS = ["mountskin"] as const;

/** `craftresource` */
export interface CraftResource {
    uniqueName: string;
    count: number;
    enchantmentLevel?: number;
    /** 0 means the resource is never returned by the resource return rate */
    maxReturnAmount?: number;
    preserveQuality?: boolean;
}

/** `currency`, e.g. faction points */
export interface Currency {
    uniqueName: string;
    amount: number;
}

/** One `craftingrequirements` element: a recipe variant */
export interface CraftingRequirement {
    silver?: number;
    gold?: number;
    time?: number;
    craftingFocus?: number;
    amountCrafted?: number;
    forceSingleCraft?: boolean;
    swapTransaction?: boolean;
    returnProductNotResource?: boolean;
    /** Recipe kind for non-crafting buttons, e.g. `@CRAFTBUILDING_ITEM_DETAILS_BUTTON_REFINE` */
    craftButtonLocaOverride?: string;
    buildingFilter?: string;
    craftResource: CraftResource[];
    currency: Currency[];
}

/** `upgraderesource`: resources to upgrade the previous enchantment level to this one */
export interface UpgradeResource {
    uniqueName: string;
    count: number;
}

/** `enchantments.enchantment` */
export interface Enchantment {
    enchantmentLevel: number;
    itemPower?: number;
    craftingRequirements: CraftingRequirement[];
    upgradeRequirements?: {
        upgradeResource: UpgradeResource[];
    };
}

/** `famefillingmissions.craftitemfame` / `gatherfame` of a journal */
export interface FameFillingMission {
    minTier: number;
    value: number;
    validItem: string[];
}

export interface Item {
    uniqueName: string;
    kind: ItemKind;
    tier: number;
    /** Set on separate enchanted items, e.g. `T4_METALBAR_LEVEL1` */
    enchantmentLevel?: number;

    shopCategory: string;
    shopSubcategory1: string;
    shopSubcategory2?: string;
    shopSubcategory3?: string;
    craftingCategory?: string;

    itemValue?: number;
    itemPower?: number;
    weight?: number;
    maxStackSize?: number;
    maxQualityLevel?: number;
    slotType?: string;
    twoHanded?: boolean;
    resourceType?: string;
    foodCategory?: string;
    nutrition?: number;
    fameValue?: number;
    fastTravelFactor?: number;
    destinyAndJournalCraftFameFactor?: number;
    /** Journals: fame needed to fill */
    maxFame?: number;
    baseLootAmount?: number;

    salvageable?: boolean;
    tradable?: boolean;
    showInMarketplace?: boolean;
    unlockedToCraft?: boolean;
    hideFromPlayerOnContext?: string;

    craftingRequirements: CraftingRequirement[];
    enchantments: Enchantment[];
    fameFillingMissions?: {
        craftItemFame?: FameFillingMission;
        gatherFame?: FameFillingMission;
    };
}

/** `shopcategories`: shopcategory → shopsubcategory → shopsubcategory2 → shopsubcategory3 */
export interface ShopCategory {
    id: string;
    /** Sort order in the game marketplace */
    value: number;
    children: ShopCategory[];
}

/** Item names and category names for one game locale */
export interface Names {
    /** By market id; an `@N` id is listed only when its name differs from the base id */
    items: Record<string, string>;
    categories: Record<string, string>;
}

/** `craftingmodifier`: production bonus for items of a `craftingcategory` */
export interface CraftingModifier {
    name: string;
    value: number;
}

export interface CraftingBonus {
    value: number;
    islandValue?: number;
}

/**
 * `craftingmodifiers.craftinglocation`: production bonuses of a city cluster
 * (`clusterId`) or of an Outlands zone (`continent`, `biome`, `clusterQuality`)
 */
export interface CraftingLocation {
    clusterId?: string;
    /** From `formatted/world.json` */
    clusterName?: string;
    continent?: string;
    biome?: string;
    clusterQuality?: string;
    craftingBonus?: CraftingBonus;
    refiningBonus?: CraftingBonus;
    craftingModifier: CraftingModifier[];
}

/** `craftingmodifiers.json` */
export interface CraftingModifiers {
    /** `craftingcategory` values that are refined rather than crafted */
    refiningCategory: string[];
    craftingLocation: CraftingLocation[];
}

/** Economy constants from `gamedata.json` */
export interface GameConstants {
    /** `MarketPlace.TaxValues.TaxFactor`; `transactionTax` is the rate without premium */
    marketPlace: {
        setupFee: number;
        transactionTax: number;
        smugglerSetupFee: number;
        smugglerTransactionTax: number;
    };
    /** `ItemValueToNutrition`: nutrition a craft uses per unit of item value */
    itemValueToNutrition: number;
    /** `ActionFocus.CraftingEfficiency`: production bonus of crafting with focus */
    focusCraftingEfficiencyBonus: number;
    /** `FameGainFactors.CraftItem` */
    craftItemFameFactor: number;
}

export interface CatalogMeta {
    dumps: {
        repository: string;
        commit: string;
        date: string;
    };
    locales: string[];
    itemCounts: Partial<Record<ItemKind, number>>;
}
