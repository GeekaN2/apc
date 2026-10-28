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
} as const;

export type Route = (typeof routes)[keyof typeof routes];
