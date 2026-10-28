import { Moon, Sun } from "@gravity-ui/icons";
import { Switch } from "@heroui/react";
import { useTranslation } from "react-i18next";
import { useThemeStore } from "../../store/theme";

export const ThemeSwitch: React.FC = () => {
    const { t } = useTranslation();
    const theme = useThemeStore((state) => state.theme);
    const setTheme = useThemeStore((state) => state.setTheme);

    return (
        <Switch
            aria-label={t("theme.dark")}
            isSelected={theme === "dark"}
            onChange={(isSelected) => setTheme(isSelected ? "dark" : "light")}
        >
            {({ isSelected }) => (
                <Switch.Content>
                    <Switch.Control>
                        <Switch.Thumb>
                            <Switch.Icon>
                                {isSelected ? (
                                    <Moon className="size-3" />
                                ) : (
                                    <Sun className="size-3" />
                                )}
                            </Switch.Icon>
                        </Switch.Thumb>
                    </Switch.Control>
                </Switch.Content>
            )}
        </Switch>
    );
};
