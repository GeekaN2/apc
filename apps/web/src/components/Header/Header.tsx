import { Heart } from "@gravity-ui/icons";
import { buttonVariants } from "@heroui/react";
import { useTranslation } from "react-i18next";
import { LanguageSwitch } from "../LanguageSwitch/LanguageSwitch";
import { ServerSelect } from "../ServerSelect/ServerSelect";
import { ThemeSwitch } from "../ThemeSwitch/ThemeSwitch";
import { UserMenu } from "../UserMenu/UserMenu";

/** Controls shared by all pages; the server select only matters for calculators */
export const HeaderControls: React.FC<{ withServer?: boolean }> = ({ withServer }) => {
    const { t } = useTranslation();

    return (
        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
            {withServer && <ServerSelect />}
            <LanguageSwitch />
            <ThemeSwitch />
            <a
                href="https://boosty.to/geekan"
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t("supportOnBoosty")}
                className={buttonVariants({ variant: "tertiary", size: "sm" })}
            >
                <Heart className="size-4" />
                <span>Boosty</span>
            </a>
            <UserMenu />
        </div>
    );
};

export const Header: React.FC = () => (
    <header className="flex shrink-0 items-center justify-end border-b border-separator px-4 py-3 sm:px-6">
        <HeaderControls withServer />
    </header>
);
