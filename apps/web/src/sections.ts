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
import type en from "./i18n/locales/en.json";
import { routes, type Route } from "./routes";

export interface Section {
    route: Route;
    /** Key of the title in `sections` of the translations */
    key: keyof typeof en.sections;
    emoji: string;
    Icon: ComponentType<SVGProps<SVGSVGElement>>;
}

/** Calculators: shown on the main page and in the sidebar */
export const calculators: Section[] = [
    { route: routes.profitTree, key: "profitTree", emoji: "🌳", Icon: FolderTree },
    { route: routes.transportations, key: "transportations", emoji: "🐗", Icon: Car },
    { route: routes.refining, key: "refining", emoji: "♻️", Icon: Arrows3RotateLeft },
    { route: routes.foodAndPotions, key: "foodAndPotions", emoji: "🍲", Icon: Flask },
    {
        route: routes.transmutations,
        key: "transmutations",
        emoji: "🧪",
        Icon: Circles5Random,
    },
    {
        route: routes.artifactFoundry,
        key: "artifactFoundry",
        emoji: "🗿",
        Icon: TriangleUp,
    },
];

/** Helper pages: shown on the main page only */
export const helpers: Section[] = [
    { route: routes.servers, key: "servers", emoji: "⚙️", Icon: Gear },
    { route: routes.faq, key: "faq", emoji: "❓", Icon: CircleQuestion },
];

export const sections = [...calculators, ...helpers];
