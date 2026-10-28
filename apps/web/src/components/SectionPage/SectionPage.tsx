import { useTranslation } from "react-i18next";
import type { Section } from "../../sections";

/** Placeholder until the section is ported from the old calculator */
export const SectionPage: React.FC<{ section: Section }> = ({ section }) => {
    const { t } = useTranslation();

    return (
        <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold">
                {section.emoji} {t(`sections.${section.key}`)}
            </h1>
            <p className="text-muted">{t("comingSoon")}</p>
        </div>
    );
};
