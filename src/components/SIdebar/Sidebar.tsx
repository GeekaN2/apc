import React, { PropsWithChildren } from "react";

import styles from "./Sidebar.module.css";
import { Button, Icon } from "@gravity-ui/uikit";
import {
    TriangleUp,
    FolderTree,
    Flask,
    Car,
    Arrows3RotateLeft,
    Circles5Random,
} from "@gravity-ui/icons";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Route, routes } from "../../routes";

interface NavigationButtonProps {
    route: Route;
    icon: React.ReactNode;
}

const NavigationButton: React.FC<NavigationButtonProps> = ({ route, icon }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const isSelected = route === location.pathname;

    return (
        <Button
            view={isSelected ? "outlined-action" : "outlined"}
            size="l"
            href=""
            onClick={() => {
                navigate(route);
            }}
        >
            {icon}
        </Button>
    );
};

export const Sidebar: React.FC<PropsWithChildren> = ({ children }) => {
    return (
        <div className={styles.container}>
            <div className={styles.sidebar}>
                <NavLink to="/">
                    <img className={styles.logo} src="/public/favicon.png" />
                </NavLink>
                <NavigationButton
                    icon={<Icon data={FolderTree}></Icon>}
                    route={routes.profitTree}
                />
                <NavigationButton
                    icon={<Icon data={Car}></Icon>}
                    route={routes.transporatations}
                />
                <NavigationButton
                    icon={<Icon data={Arrows3RotateLeft}></Icon>}
                    route={routes.refining}
                />
                <NavigationButton
                    icon={<Icon data={Flask}></Icon>}
                    route={routes.foodAndPotions}
                />
                <NavigationButton
                    icon={<Icon data={Circles5Random}></Icon>}
                    route={routes.transmutations}
                />
                <NavigationButton
                    icon={<Icon data={TriangleUp}></Icon>}
                    route={routes.artifactFoundry}
                />
            </div>
            {children}
        </div>
    );
};
