import { Label, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { useTranslation } from "react-i18next";
import { CITIES, CRAFTING_CITIES } from "../../catalog/catalog";
import { useTreeStore } from "../../store/tree";
import { CitySelect, NumberInput, Toggle } from "../SettingsControls/SettingsControls";

const QUALITIES = ["1", "2", "3", "4", "5"] as const;

export const TreeSettingsPanel: React.FC = () => {
    const { t } = useTranslation();
    const { settings, update, setCity } = useTreeStore();
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
                    cities={CITIES}
                    onChange={(city) => setCity("sell", city)}
                />
            ) : (
                <>
                    <CitySelect
                        label={t("profit.sellCity")}
                        value={cities.sell}
                        cities={CITIES}
                        onChange={(city) => setCity("sell", city)}
                    />
                    <CitySelect
                        label={t("profit.craftCity")}
                        value={cities.craft}
                        cities={CRAFTING_CITIES}
                        onChange={(city) => setCity("craft", city)}
                    />
                    <CitySelect
                        label={t("tree.resourcesCity")}
                        value={cities.resources}
                        cities={CRAFTING_CITIES}
                        onChange={(city) => setCity("resources", city)}
                    />
                    <CitySelect
                        label={t("tree.componentsCity")}
                        value={cities.components}
                        cities={CRAFTING_CITIES}
                        onChange={(city) => setCity("components", city)}
                    />
                    {settings.useJournals && (
                        <CitySelect
                            label={t("tree.journalsCity")}
                            value={cities.journals}
                            cities={CRAFTING_CITIES}
                            onChange={(city) => setCity("journals", city)}
                        />
                    )}
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
            <Toggle
                label={t("profit.useJournals")}
                isSelected={settings.useJournals}
                onChange={(useJournals) => update({ useJournals })}
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
            <div className="flex flex-col gap-1.5">
                <Label>{t("profit.qualities")}</Label>
                <ToggleButtonGroup
                    aria-label={t("profit.qualities")}
                    selectionMode="multiple"
                    disallowEmptySelection
                    selectedKeys={settings.qualities.map(String)}
                    onSelectionChange={(keys) =>
                        update({ qualities: [...keys].map(Number).sort() })
                    }
                    className="flex-wrap"
                >
                    {QUALITIES.map((quality) => (
                        <ToggleButton
                            key={quality}
                            id={quality}
                            size="sm"
                            aria-label={t(`profit.qualityNames.${quality}`)}
                        >
                            {quality}
                        </ToggleButton>
                    ))}
                </ToggleButtonGroup>
            </div>
        </section>
    );
};
