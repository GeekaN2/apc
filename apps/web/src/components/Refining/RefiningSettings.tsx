import { useTranslation } from "react-i18next";
import { CRAFTING_CITIES } from "../../catalog/catalog";
import { type RefiningCities, useRefiningStore } from "../../store/refining";
import { CitySelect, NumberInput, Toggle } from "../SettingsControls/SettingsControls";

const RefiningCitySelect: React.FC<{ role: keyof RefiningCities; label: string }> = ({
    role,
    label,
}) => {
    const city = useRefiningStore((state) => state.cities[role]);
    const setCity = useRefiningStore((state) => state.setCity);

    return (
        <CitySelect
            label={label}
            value={city}
            cities={CRAFTING_CITIES}
            onChange={(city) => setCity(role, city)}
        />
    );
};

export const RefiningSettings: React.FC = () => {
    const { t } = useTranslation();
    const settings = useRefiningStore();
    const { update } = settings;

    return (
        <section className="flex flex-col gap-4" aria-label={t("profit.settings")}>
            <Toggle
                label={t("profit.sameCity")}
                isSelected={settings.sameCity}
                onChange={(sameCity) => {
                    const city = settings.cities.refine;

                    update(
                        sameCity
                            ? {
                                  sameCity,
                                  cities: {
                                      refine: city,
                                      buyRaw: city,
                                      buyMaterials: city,
                                      sell: city,
                                  },
                              }
                            : { sameCity },
                    );
                }}
            />
            {settings.sameCity ? (
                <RefiningCitySelect role="refine" label={t("profit.city")} />
            ) : (
                <>
                    <RefiningCitySelect role="refine" label={t("refining.refineCity")} />
                    <RefiningCitySelect role="buyRaw" label={t("refining.buyRawCity")} />
                    <RefiningCitySelect
                        role="buyMaterials"
                        label={t("refining.buyMaterialsCity")}
                    />
                    <RefiningCitySelect role="sell" label={t("refining.sellCity")} />
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
