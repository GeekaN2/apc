import {
    Arrows3RotateLeft,
    Car,
    CircleQuestion,
    Circles5Random,
    Flask,
    FolderTree,
    Gear,
    TriangleUp,
} from "@gravity-ui/icons";
import type { ComponentType, SVGProps } from "react";
import { routes, type Route } from "./routes";

export interface Section {
    route: Route;
    title: string;
    emoji: string;
    Icon: ComponentType<SVGProps<SVGSVGElement>>;
}

/** Calculators: shown on the main page and in the sidebar */
export const calculators: Section[] = [
    { route: routes.profitTree, title: "Profit tree", emoji: "🌳", Icon: FolderTree },
    { route: routes.transportations, title: "Transportations", emoji: "🐗", Icon: Car },
    { route: routes.refining, title: "Refining", emoji: "♻️", Icon: Arrows3RotateLeft },
    { route: routes.foodAndPotions, title: "Food & potions", emoji: "🍲", Icon: Flask },
    {
        route: routes.transmutations,
        title: "Transmutations",
        emoji: "🧪",
        Icon: Circles5Random,
    },
    {
        route: routes.artifactFoundry,
        title: "Artifact foundry",
        emoji: "🗿",
        Icon: TriangleUp,
    },
];

/** Helper pages: shown on the main page only */
export const helpers: Section[] = [
    { route: routes.servers, title: "Servers", emoji: "⚙️", Icon: Gear },
    { route: routes.faq, title: "FAQ", emoji: "❓", Icon: CircleQuestion },
];

export const sections = [...calculators, ...helpers];
