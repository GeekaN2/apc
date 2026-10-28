import { Tooltip, buttonVariants } from "@heroui/react";
import { Link, NavLink } from "react-router";
import { routes } from "../../routes";
import { calculators } from "../../sections";
import { ThemeSwitch } from "../ThemeSwitch/ThemeSwitch";

export const Sidebar: React.FC = () => (
    <aside className="flex h-full flex-col items-center gap-2 border-r border-separator px-3 py-5">
        <Link to={routes.home} className="mb-3">
            <img src="/favicon.png" alt="Albion Profit Calculator" className="w-10" />
        </Link>
        {calculators.map(({ route, title, Icon }) => (
            <Tooltip key={route} delay={0}>
                <Tooltip.Trigger>
                    <NavLink
                        to={route}
                        aria-label={title}
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
                <Tooltip.Content placement="right">{title}</Tooltip.Content>
            </Tooltip>
        ))}
        <div className="mt-auto">
            <ThemeSwitch />
        </div>
    </aside>
);
