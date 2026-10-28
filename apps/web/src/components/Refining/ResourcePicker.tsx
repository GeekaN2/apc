import { REFINED_RESOURCES, type RefinedResource } from "@apc/calc";
import { ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { useTranslation } from "react-i18next";
import { itemIconUrl } from "../../catalog/catalog";
import { useRefiningStore } from "../../store/refining";

const resources = Object.keys(REFINED_RESOURCES) as RefinedResource[];

export const ResourcePicker: React.FC = () => {
    const { t } = useTranslation();
    const resource = useRefiningStore((state) => state.resource);
    const update = useRefiningStore((state) => state.update);

    return (
        <ToggleButtonGroup
            aria-label={t("refining.resource")}
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={[resource]}
            onSelectionChange={(keys) => {
                const [key] = keys;

                if (key) {
                    update({ resource: key as RefinedResource });
                }
            }}
            className="flex-wrap"
        >
            {resources.map((id) => (
                <ToggleButton key={id} id={id} className="gap-2">
                    <img
                        src={itemIconUrl(`T4_${id}`, 40)}
                        alt=""
                        loading="lazy"
                        className="size-7"
                    />
                    {t(`resources.${id}`)}
                </ToggleButton>
            ))}
        </ToggleButtonGroup>
    );
};
