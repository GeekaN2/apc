import React, { PropsWithChildren } from "react";

import styles from "./Sidebar.module.css";
import { Button, Icon } from "@gravity-ui/uikit";
import { TriangleUp } from "@gravity-ui/icons";
import { NavLink } from "react-router-dom";

interface NavigationButtonProps {
    isSelected?: boolean;
}

const NavigationButton: React.FC<NavigationButtonProps> = ({ isSelected }) => {
    return (
        <Button view={isSelected ? "outlined-action" : "outlined"} size="l">
            <Icon data={TriangleUp}></Icon>
        </Button>
    );
};

export const Sidebar: React.FC<PropsWithChildren> = ({ children }) => {
    return (
        <div className={styles.container}>
            <div className={styles.sidebar}>
                <NavLink to="/">
                    <img
                        className={styles.logo}
                        src="/public/favicon.png"
                    ></img>
                </NavLink>
                <NavigationButton isSelected={true} />
                <NavigationButton />
                <NavigationButton />
                <NavigationButton />
                <NavigationButton />
                <NavigationButton />
            </div>
            {children}
        </div>
    );
};
