/**
 * Zod schemas for the raw ao-bin-dumps files. They validate only the fields the catalog
 * keeps and transform them into the catalog model; unknown fields are stripped.
 */
import { z } from "zod";
import type {
    CraftResource,
    CraftingBonus,
    CraftingLocation,
    CraftingModifier,
    CraftingRequirement,
    Currency,
    Enchantment,
    FameFillingMission,
    Item,
    ItemKind,
    ShopCategory,
    UpgradeResource,
} from "./model.ts";

const str = z.string();
const num = z
    .string()
    .refine((s) => s.trim() !== "" && Number.isFinite(Number(s)), "Expected a number")
    .transform(Number);
const bool = z.enum(["true", "false"]).transform((s) => s === "true");

/** XML-to-JSON gives an object for one child element and an array for several */
function oneOrMany<T extends z.ZodType>(schema: T) {
    return z
        .union([z.array(schema), schema])
        .transform((value) => (Array.isArray(value) ? value : [value]) as z.output<T>[]);
}

const craftResource = z
    .object({
        "@uniquename": str,
        "@count": num,
        "@enchantmentlevel": num.optional(),
        "@maxreturnamount": num.optional(),
        "@preservequality": bool.optional(),
    })
    .transform((r): CraftResource => ({
        uniqueName: r["@uniquename"],
        count: r["@count"],
        enchantmentLevel: r["@enchantmentlevel"],
        maxReturnAmount: r["@maxreturnamount"],
        preserveQuality: r["@preservequality"],
    }));

const currency = z
    .object({ "@uniquename": str, "@amount": num })
    .transform((c): Currency => ({ uniqueName: c["@uniquename"], amount: c["@amount"] }));

const craftingRequirement = z
    .object({
        "@silver": num.optional(),
        "@gold": num.optional(),
        "@time": num.optional(),
        "@craftingfocus": num.optional(),
        "@amountcrafted": num.optional(),
        "@forcesinglecraft": bool.optional(),
        "@swaptransaction": bool.optional(),
        "@returnproductnotresource": bool.optional(),
        "@craftbuttonlocaoverride": str.optional(),
        "@buildingfilter": str.optional(),
        craftresource: oneOrMany(craftResource).optional(),
        currency: oneOrMany(currency).optional(),
    })
    .transform((r): CraftingRequirement => ({
        silver: r["@silver"],
        gold: r["@gold"],
        time: r["@time"],
        craftingFocus: r["@craftingfocus"],
        amountCrafted: r["@amountcrafted"],
        forceSingleCraft: r["@forcesinglecraft"],
        swapTransaction: r["@swaptransaction"],
        returnProductNotResource: r["@returnproductnotresource"],
        craftButtonLocaOverride: r["@craftbuttonlocaoverride"],
        buildingFilter: r["@buildingfilter"],
        craftResource: r.craftresource ?? [],
        currency: r.currency ?? [],
    }));

const upgradeResource = z
    .object({ "@uniquename": str, "@count": num })
    .transform((r): UpgradeResource => ({
        uniqueName: r["@uniquename"],
        count: r["@count"],
    }));

const enchantment = z
    .object({
        "@enchantmentlevel": num,
        "@itempower": num.optional(),
        craftingrequirements: oneOrMany(craftingRequirement).optional(),
        upgraderequirements: z
            .object({ upgraderesource: oneOrMany(upgradeResource) })
            .optional(),
    })
    .transform((e): Enchantment => ({
        enchantmentLevel: e["@enchantmentlevel"],
        itemPower: e["@itempower"],
        craftingRequirements: e.craftingrequirements ?? [],
        upgradeRequirements: e.upgraderequirements && {
            upgradeResource: e.upgraderequirements.upgraderesource,
        },
    }));

const fameFillingMission = z
    .object({
        "@mintier": num,
        "@value": num,
        validitem: oneOrMany(z.object({ "@id": str })).optional(),
    })
    .transform((m): FameFillingMission => ({
        minTier: m["@mintier"],
        value: m["@value"],
        validItem: (m.validitem ?? []).map((item) => item["@id"]),
    }));

const rawItem = z.object({
    "@uniquename": str,
    "@tier": num,
    "@enchantmentlevel": num.optional(),
    "@shopcategory": str,
    "@shopsubcategory1": str,
    "@shopsubcategory2": str.optional(),
    "@shopsubcategory3": str.optional(),
    "@craftingcategory": str.optional(),
    "@itemvalue": num.optional(),
    "@itempower": num.optional(),
    "@weight": num.optional(),
    "@maxstacksize": num.optional(),
    "@maxqualitylevel": num.optional(),
    "@slottype": str.optional(),
    "@twohanded": bool.optional(),
    "@resourcetype": str.optional(),
    "@foodcategory": str.optional(),
    "@nutrition": num.optional(),
    "@famevalue": num.optional(),
    "@fasttravelfactor": num.optional(),
    "@destinyandjournalcraftfamefactor": num.optional(),
    "@maxfame": num.optional(),
    "@baselootamount": num.optional(),
    "@salvageable": bool.optional(),
    "@tradable": bool.optional(),
    "@showinmarketplace": bool.optional(),
    "@unlockedtocraft": bool.optional(),
    "@hidefromplayeroncontext": str.optional(),
    craftingrequirements: oneOrMany(craftingRequirement).optional(),
    enchantments: z.object({ enchantment: oneOrMany(enchantment) }).optional(),
    famefillingmissions: z
        .object({
            craftitemfame: fameFillingMission.optional(),
            gatherfame: fameFillingMission.optional(),
        })
        .optional(),
});

/** Schema for one item of the given `items.json` section */
export function itemSchema(kind: ItemKind) {
    return rawItem.transform((i): Item => ({
        uniqueName: i["@uniquename"],
        kind,
        tier: i["@tier"],
        enchantmentLevel: i["@enchantmentlevel"],
        shopCategory: i["@shopcategory"],
        shopSubcategory1: i["@shopsubcategory1"],
        shopSubcategory2: i["@shopsubcategory2"],
        shopSubcategory3: i["@shopsubcategory3"],
        craftingCategory: i["@craftingcategory"],
        itemValue: i["@itemvalue"],
        itemPower: i["@itempower"],
        weight: i["@weight"],
        maxStackSize: i["@maxstacksize"],
        maxQualityLevel: i["@maxqualitylevel"],
        slotType: i["@slottype"],
        twoHanded: i["@twohanded"],
        resourceType: i["@resourcetype"],
        foodCategory: i["@foodcategory"],
        nutrition: i["@nutrition"],
        fameValue: i["@famevalue"],
        fastTravelFactor: i["@fasttravelfactor"],
        destinyAndJournalCraftFameFactor: i["@destinyandjournalcraftfamefactor"],
        maxFame: i["@maxfame"],
        baseLootAmount: i["@baselootamount"],
        salvageable: i["@salvageable"],
        tradable: i["@tradable"],
        showInMarketplace: i["@showinmarketplace"],
        unlockedToCraft: i["@unlockedtocraft"],
        hideFromPlayerOnContext: i["@hidefromplayeroncontext"],
        craftingRequirements: i.craftingrequirements ?? [],
        enchantments: i.enchantments?.enchantment ?? [],
        fameFillingMissions: i.famefillingmissions && {
            craftItemFame: i.famefillingmissions.craftitemfame,
            gatherFame: i.famefillingmissions.gatherfame,
        },
    }));
}

function byValue(a: ShopCategory, b: ShopCategory) {
    return a.value - b.value;
}

function category(
    children: ShopCategory[] | undefined,
    c: { "@id": string; "@value": number },
) {
    return { id: c["@id"], value: c["@value"], children: (children ?? []).sort(byValue) };
}

const categoryAttributes = { "@id": str, "@value": num };

const shopSubcategory3 = z
    .object(categoryAttributes)
    .transform((c): ShopCategory => category([], c));
const shopSubcategory2 = z
    .object({
        ...categoryAttributes,
        shopsubcategory3: oneOrMany(shopSubcategory3).optional(),
    })
    .transform((c): ShopCategory => category(c.shopsubcategory3, c));
const shopSubcategory = z
    .object({
        ...categoryAttributes,
        shopsubcategory2: oneOrMany(shopSubcategory2).optional(),
    })
    .transform((c): ShopCategory => category(c.shopsubcategory2, c));
const shopCategory = z
    .object({
        ...categoryAttributes,
        shopsubcategory: oneOrMany(shopSubcategory).optional(),
    })
    .transform((c): ShopCategory => category(c.shopsubcategory, c));

export const shopCategories = z
    .object({ shopcategory: oneOrMany(shopCategory) })
    .transform((c) => c.shopcategory.sort(byValue));

/** Root of `items.json`: sections are validated one by one in `buildItems` */
export const itemsFile = z.object({
    items: z.looseObject({ shopcategories: z.unknown() }),
});

/** `formatted/items.json` */
export const formattedItemsFile = z.array(
    z.object({
        UniqueName: str,
        LocalizedNames: z.record(str, str).nullish(),
    }),
);

/** `localization.json`: entries are validated after filtering by key in `buildNames` */
export const localizationFile = z.object({
    tmx: z.object({
        body: z.object({
            tu: z.array(z.looseObject({ "@tuid": str })),
        }),
    }),
});

export const localizationEntry = z.object({
    "@tuid": str,
    tuv: oneOrMany(z.object({ "@xml:lang": str, seg: str.optional() })),
});

const craftingBonus = z
    .object({ "@value": num, "@islandvalue": num.optional() })
    .transform((b): CraftingBonus => ({
        value: b["@value"],
        islandValue: b["@islandvalue"],
    }));

const craftingLocation = z
    .object({
        "@clusterid": str.optional(),
        "@continent": str.optional(),
        "@biome": str.optional(),
        "@clusterquality": str.optional(),
        craftingbonus: craftingBonus.optional(),
        refiningbonus: craftingBonus.optional(),
        craftingmodifier: oneOrMany(
            z
                .object({ "@name": str, "@value": num })
                .transform((m): CraftingModifier => ({
                    name: m["@name"],
                    value: m["@value"],
                })),
        ).optional(),
    })
    .transform((l): Omit<CraftingLocation, "clusterName"> => ({
        clusterId: l["@clusterid"],
        continent: l["@continent"],
        biome: l["@biome"],
        clusterQuality: l["@clusterquality"],
        craftingBonus: l.craftingbonus,
        refiningBonus: l.refiningbonus,
        craftingModifier: l.craftingmodifier ?? [],
    }));

/** `craftingmodifiers.json`; cluster names are added in `buildCraftingModifiers` */
export const craftingModifiersFile = z.object({
    craftingmodifiers: z.object({
        refiningcategory: z.object({
            item: oneOrMany(z.object({ "@category": str })),
        }),
        craftinglocation: oneOrMany(craftingLocation),
    }),
});

/** `formatted/world.json` */
export const formattedWorldFile = z.array(z.object({ Index: str, UniqueName: str }));

const factor = z.object({ "@factor": num });

/** `gamedata.json`: only the economy sections are validated */
export const gameDataFile = z.object({
    "AO-GameData": z.object({
        MarketPlace: z.object({
            TaxValues: z.object({
                TaxFactor: oneOrMany(z.object({ "@name": str, "@value": num })),
            }),
        }),
        ItemValueToNutrition: factor,
        ActionFocus: z.object({
            CraftingEfficiency: z.object({ "@bonus": num }),
        }),
        FameGainFactors: z.object({
            CraftItem: factor,
        }),
    }),
});
