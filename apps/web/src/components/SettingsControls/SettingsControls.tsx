import { Label, ListBox, NumberField, Select, Switch } from "@heroui/react";
import { useTranslation } from "react-i18next";
import type { City } from "../../catalog/catalog";

export function CitySelect<C extends City>({
    label,
    value,
    cities,
    onChange,
}: {
    label: string;
    value: C;
    cities: readonly C[];
    onChange: (city: C) => void;
}) {
    const { t } = useTranslation();

    return (
        <Select
            value={value}
            onChange={(key) => {
                if (key !== null) {
                    onChange(key as C);
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
                    {cities.map((id) => (
                        <ListBox.Item key={id} id={id} textValue={t(`cities.${id}`)}>
                            {t(`cities.${id}`)}
                            <ListBox.ItemIndicator />
                        </ListBox.Item>
                    ))}
                </ListBox>
            </Select.Popover>
        </Select>
    );
}

export const Toggle: React.FC<{
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

export const NumberInput: React.FC<{
    label: string;
    value: number;
    onChange: (value: number) => void;
    minValue?: number;
    maxValue?: number;
    step?: number;
}> = ({ label, value, onChange, minValue = 0, maxValue, step = 1 }) => (
    <NumberField
        value={value}
        onChange={(value) => onChange(Number.isNaN(value) ? minValue : value)}
        minValue={minValue}
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
