import { REFINED_RESOURCES, type RefinedResource } from "@apc/calc";
import { useTranslation } from "react-i18next";
import { useRefiningStore } from "../../store/refining";
import { IconPicker } from "../IconPicker/IconPicker";

const resources = Object.keys(REFINED_RESOURCES) as RefinedResource[];

export const ResourcePicker: React.FC = () => {
    const { t } = useTranslation();
    const resource = useRefiningStore((state) => state.resource);
    const update = useRefiningStore((state) => state.update);

    return (
        <div className="flex flex-col gap-1">
            <IconPicker
                label={t("refining.resource")}
                options={resources.map((id) => ({
                    id,
                    icon: `T4_${id}`,
                    label: t(`resources.${id}`),
                }))}
                value={resource}
                onChange={(resource) => update({ resource })}
            />
            <p className="text-sm text-muted">{t(`resources.${resource}`)}</p>
        </div>
    );
};
