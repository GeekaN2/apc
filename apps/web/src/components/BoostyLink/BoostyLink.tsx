import { Heart } from "@gravity-ui/icons";
import { buttonVariants } from "@heroui/react";
import { useTranslation } from "react-i18next";

export const BoostyLink: React.FC<{ iconOnly?: boolean }> = ({ iconOnly }) => {
    const { t } = useTranslation();
    const label = t("supportOnBoosty");

    return (
        <a
            href="https://boosty.to/geekan"
            target="_blank"
            rel="noopener noreferrer"
            aria-label={label}
            title={iconOnly ? label : undefined}
            className={buttonVariants({
                variant: "tertiary",
                size: iconOnly ? "lg" : "sm",
                isIconOnly: iconOnly,
            })}
        >
            <Heart className={iconOnly ? "size-5" : "size-4"} aria-hidden="true" />
            {!iconOnly && <span>Boosty</span>}
        </a>
    );
};
