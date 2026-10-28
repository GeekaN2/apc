export const routes = {
    home: "/",
    profitTree: "/tree",
    transportations: "/transportations",
    refining: "/refining",
    foodAndPotions: "/food-and-potions",
    transmutations: "/transmutations",
    artifactFoundry: "/artifact-foundry",
    servers: "/servers",
    faq: "/faq",
    admin: "/admin",
} as const;

export type Route = (typeof routes)[keyof typeof routes];

/** Routes of the calculators and helper pages */
export type SectionRoute = Exclude<Route, typeof routes.home | typeof routes.admin>;
