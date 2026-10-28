import { type ItemFamily, craftableFamilies, recipeVariantCount } from "@apc/calc";
import { Spinner } from "@heroui/react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { CRAFTING_CITIES, useConsumablesCatalog, useNames } from "../../catalog/catalog";
import { type FoodGroup, useFoodStore } from "../../store/food";
import { CraftResult } from "../Craft/CraftResult";
import { familyIcon, familyName } from "../Craft/familyName";
import { useFamilyCraft } from "../Craft/useFamilyCraft";
import { IconPicker } from "../IconPicker/IconPicker";
import { CitySelect, NumberInput, Toggle } from "../SettingsControls/SettingsControls";

const GROUP_ICONS: Record<FoodGroup, string> = {
    food: "T5_MEAL_SOUP",
    potions: "T6_POTION_HEAL",
};

/** Alcohol is a farming product in the dumps but is brewed like potions */
function groupOf(family: ItemFamily): FoodGroup | undefined {
    if (family.shopCategory === "consumables" && family.shopSubcategory1 === "food") {
        return "food";
    }

    return family.shopSubcategory1 === "potions" || family.key === "ALCOHOL"
        ? "potions"
        : undefined;
}

const FoodSettingsPanel: React.FC = () => {
    const { t } = useTranslation();
    const { settings, update, setCity } = useFoodStore();
    const { cities } = settings;

    return (
        <section className="flex flex-col gap-4" aria-label={t("profit.settings")}>
            <Toggle
                label={t("profit.sameCity")}
                isSelected={settings.sameCity}
                onChange={(sameCity) => {
                    update({ sameCity });

                    if (sameCity) {
                        setCity("sell", cities.sell);
                    }
                }}
            />
            {settings.sameCity ? (
                <CitySelect
                    label={t("profit.city")}
                    value={cities.sell}
                    cities={CRAFTING_CITIES}
                    onChange={(city) => setCity("sell", city)}
                />
            ) : (
                <>
                    <CitySelect
                        label={t("profit.sellCity")}
                        value={cities.sell}
                        cities={CRAFTING_CITIES}
                        onChange={(city) => setCity("sell", city)}
                    />
                    <CitySelect
                        label={t("food.cookCity")}
                        value={cities.craft}
                        cities={CRAFTING_CITIES}
                        onChange={(city) => setCity("craft", city)}
                    />
                    <CitySelect
                        label={t("food.buyCity")}
                        value={cities.buy}
                        cities={CRAFTING_CITIES}
                        onChange={(city) => setCity("buy", city)}
                    />
                </>
            )}
            <Toggle
                label={t("profit.focus")}
                isSelected={settings.useFocus}
                onChange={(useFocus) => update({ useFocus })}
            />
            <Toggle
                label={t("profit.premium")}
                isSelected={settings.premium}
                onChange={(premium) => update({ premium })}
            />
            <NumberInput
                label={t("profit.fee")}
                value={settings.fee}
                onChange={(fee) => update({ fee })}
                step={50}
            />
            <NumberInput
                label={t("profit.crafts")}
                value={settings.crafts}
                onChange={(crafts) => update({ crafts: Math.max(1, Math.round(crafts)) })}
                minValue={1}
            />
            <Toggle
                label={t("profit.ownReturnRate")}
                isSelected={settings.ownReturnRate !== undefined}
                onChange={(on) => update({ ownReturnRate: on ? 15.2 : undefined })}
            />
            {settings.ownReturnRate !== undefined && (
                <NumberInput
                    label={t("profit.returnRate")}
                    value={settings.ownReturnRate}
                    onChange={(ownReturnRate) => update({ ownReturnRate })}
                    maxValue={99}
                    step={0.1}
                />
            )}
        </section>
    );
};

export const FoodPage: React.FC = () => {
    const { t } = useTranslation();
    const { group, family: familyKey, settings, select } = useFoodStore();
    const catalog = useConsumablesCatalog();
    const names = useNames();
    const families = useMemo(
        () =>
            catalog.data
                ? craftableFamilies(catalog.data, ["consumables", "farming"]).filter(
                      (family) => groupOf(family) !== undefined,
                  )
                : [],
        [catalog.data],
    );
    const inGroup = families.filter((f) => groupOf(f) === group);
    const family = inGroup.find((f) => f.key === familyKey);
    const variants = family ? recipeVariantCount(family) : 1;
    const { sell, craft, buy } = settings.cities;
    const result = useFamilyCraft(
        catalog.data,
        family,
        0,
        { ...settings, useJournals: false, qualities: [1] },
        { sell, craft, resources: buy, components: buy, journals: buy },
    );

    return (
        <div className="flex flex-col gap-5">
            <h1 className="text-2xl font-semibold">🍲 {t("sections.foodAndPotions")}</h1>
            {catalog.isPending || names.isPending ? (
                <div className="flex items-center gap-2 text-sm text-muted">
                    <Spinner size="sm" /> {t("profit.loadingCatalog")}
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    <IconPicker
                        label={t("tree.category")}
                        options={(["food", "potions"] as const).map((id) => ({
                            id,
                            icon: GROUP_ICONS[id],
                            label: t(`food.groups.${id}`),
                        }))}
                        value={group}
                        onChange={(group) => select({ group })}
                    />
                    <IconPicker
                        label={t("tree.item")}
                        options={inGroup.map((f) => ({
                            id: f.key,
                            icon: familyIcon(f),
                            label: familyName(f, names.data?.items),
                        }))}
                        value={family?.key}
                        onChange={(key) => select({ family: key })}
                    />
                    <p className="text-sm text-muted">
                        {[
                            t(`food.groups.${group}`),
                            family && familyName(family, names.data?.items),
                        ]
                            .filter(Boolean)
                            .join(" › ")}
                    </p>
                </div>
            )}
            <div className="grid items-start gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
                <FoodSettingsPanel />
                <div className="flex min-w-0 flex-col gap-3">
                    {family && catalog.data ? (
                        <CraftResult
                            catalog={catalog.data}
                            family={family}
                            names={names.data}
                            variants={variants}
                            variant={0}
                            onVariantChange={() => {}}
                            crafts={settings.crafts}
                            craft={result}
                        />
                    ) : (
                        !catalog.isPending && (
                            <p className="text-muted">{t("tree.chooseItem")}</p>
                        )
                    )}
                </div>
            </div>
        </div>
    );
};
