import { Tooltip, buttonVariants } from "@heroui/react";
import { useTranslation } from "react-i18next";
import { Link, NavLink } from "react-router";
import { routes } from "../../routes";
import { calculators } from "../../sections";

export const Sidebar: React.FC = () => {
    const { t } = useTranslation();

    return (
        <aside className="flex h-full flex-col items-center gap-2 border-r border-separator px-3 py-5">
            <Link to={routes.home} className="mb-3">
                <img src="/favicon.png" alt="Albion Profit Calculator" className="w-10" />
            </Link>
            {calculators.map(({ route, key, Icon }) => (
                <Tooltip key={route} delay={0}>
                    <Tooltip.Trigger>
                        <NavLink
                            to={route}
                            aria-label={t(`sections.${key}`)}
                            className={({ isActive }) =>
                                buttonVariants({
                                    variant: isActive ? "primary" : "tertiary",
                                    size: "lg",
                                    isIconOnly: true,
                                })
                            }
                        >
                            <Icon />
                        </NavLink>
                    </Tooltip.Trigger>
                    <Tooltip.Content placement="right">
                        {t(`sections.${key}`)}
                    </Tooltip.Content>
                </Tooltip>
            ))}
        </aside>
    );
};
