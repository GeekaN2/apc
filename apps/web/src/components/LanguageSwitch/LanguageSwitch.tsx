import { Globe } from "@gravity-ui/icons";
import { Dropdown, Label, buttonVariants } from "@heroui/react";
import { useTranslation } from "react-i18next";
import { type Language, languages, useLanguageStore } from "../../i18n/i18n";

export const LanguageSwitch: React.FC = () => {
    const { t } = useTranslation();
    const language = useLanguageStore((state) => state.language);
    const setLanguage = useLanguageStore((state) => state.setLanguage);

    return (
        <Dropdown>
            <Dropdown.Trigger
                aria-label={t("language")}
                // dropdown__trigger is inline-block and would break the button's flex row
                className={buttonVariants({
                    variant: "tertiary",
                    size: "sm",
                    className: "inline-flex items-center gap-1.5 whitespace-nowrap",
                })}
            >
                <Globe className="size-4" />
                {languages[language].short}
            </Dropdown.Trigger>
            <Dropdown.Popover placement="bottom end">
                <Dropdown.Menu
                    aria-label={t("language")}
                    selectionMode="single"
                    selectedKeys={[language]}
                    onAction={(key) => setLanguage(key as Language)}
                >
                    {Object.entries(languages).map(([id, { label }]) => (
                        <Dropdown.Item key={id} id={id} textValue={label}>
                            <Label>{label}</Label>
                            <Dropdown.ItemIndicator />
                        </Dropdown.Item>
                    ))}
                </Dropdown.Menu>
            </Dropdown.Popover>
        </Dropdown>
    );
};
