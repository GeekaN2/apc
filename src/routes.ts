export const routes = {
    home: "/",
    profitTree: "/tree",
    transporatations: "/transporttations",
    refining: "/refining",
    foodAndPotions: "/food-and-potions",
    transmutations: "/transmutations",
    artifactFoundry: "/artifact-foundry",
} as const;

export type Route = (typeof routes)[keyof typeof routes];
