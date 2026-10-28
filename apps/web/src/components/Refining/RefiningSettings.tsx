import { Label, ListBox, NumberField, Select, Switch } from "@heroui/react";
import { useTranslation } from "react-i18next";
import { CRAFTING_CITIES, type CraftingCity } from "../../catalog/catalog";
import { type RefiningCities, useRefiningStore } from "../../store/refining";

const CitySelect: React.FC<{ role: keyof RefiningCities; label: string }> = ({
    role,
    label,
}) => {
    const { t } = useTranslation();
    const city = useRefiningStore((state) => state.cities[role]);
    const setCity = useRefiningStore((state) => state.setCity);

    return (
        <Select
            value={city}
            onChange={(key) => {
                if (key !== null) {
                    setCity(role, key as CraftingCity);
                }
            }}
            fullWidth
        >
            <Label>{label}</Label>
            <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
                <ListBox>
                    {CRAFTING_CITIES.map((id) => (
                        <ListBox.Item key={id} id={id} textValue={t(`cities.${id}`)}>
                            {t(`cities.${id}`)}
                            <ListBox.ItemIndicator />
                        </ListBox.Item>
                    ))}
                </ListBox>
            </Select.Popover>
        </Select>
    );
};

const Toggle: React.FC<{
    label: string;
    isSelected: boolean;
    onChange: (isSelected: boolean) => void;
}> = ({ label, isSelected, onChange }) => (
    <Switch isSelected={isSelected} onChange={onChange}>
        <Switch.Content>
            <Switch.Control>
                <Switch.Thumb />
            </Switch.Control>
            <Label>{label}</Label>
        </Switch.Content>
    </Switch>
);

const NumberInput: React.FC<{
    label: string;
    value: number;
    onChange: (value: number) => void;
    maxValue?: number;
    step?: number;
}> = ({ label, value, onChange, maxValue, step = 1 }) => (
    <NumberField
        value={value}
        onChange={(value) => onChange(Number.isNaN(value) ? 0 : value)}
        minValue={0}
        maxValue={maxValue}
        step={step}
        fullWidth
    >
        <Label>{label}</Label>
        <NumberField.Group>
            <NumberField.DecrementButton />
            <NumberField.Input />
            <NumberField.IncrementButton />
        </NumberField.Group>
    </NumberField>
);

export const RefiningSettings: React.FC = () => {
    const { t } = useTranslation();
    const settings = useRefiningStore();
    const { update } = settings;

    return (
        <section className="flex flex-col gap-4" aria-label={t("refining.settings")}>
            <Toggle
                label={t("refining.sameCity")}
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
                <CitySelect role="refine" label={t("refining.city")} />
            ) : (
                <>
                    <CitySelect role="refine" label={t("refining.refineCity")} />
                    <CitySelect role="buyRaw" label={t("refining.buyRawCity")} />
                    <CitySelect
                        role="buyMaterials"
                        label={t("refining.buyMaterialsCity")}
                    />
                    <CitySelect role="sell" label={t("refining.sellCity")} />
                </>
            )}
            <Toggle
                label={t("refining.focus")}
                isSelected={settings.useFocus}
                onChange={(useFocus) => update({ useFocus })}
            />
            <Toggle
                label={t("refining.premium")}
                isSelected={settings.premium}
                onChange={(premium) => update({ premium })}
            />
            <NumberInput
                label={t("refining.fee")}
                value={settings.fee}
                onChange={(fee) => update({ fee })}
                step={50}
            />
            <Toggle
                label={t("refining.ownReturnRate")}
                isSelected={settings.ownReturnRate !== undefined}
                onChange={(on) => update({ ownReturnRate: on ? 15.2 : undefined })}
            />
            {settings.ownReturnRate !== undefined && (
                <NumberInput
                    label={t("refining.returnRate")}
                    value={settings.ownReturnRate}
                    onChange={(ownReturnRate) => update({ ownReturnRate })}
                    maxValue={99}
                    step={0.1}
                />
            )}
        </section>
    );
};
