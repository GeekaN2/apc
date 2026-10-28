import { createBrowserRouter } from "react-router";
import { AppLayout } from "./components/AppLayout/AppLayout";
import { MainPage } from "./components/MainPage/MainPage";
import { SectionPage } from "./components/SectionPage/SectionPage";
import { routes } from "./routes";
import { sections } from "./sections";

/** Ported sections, each in its own chunk with the game data it needs */
const lazySections: Partial<Record<string, () => Promise<{ Component: React.FC }>>> = {
    [routes.refining]: async () => ({
        Component: (await import("./components/Refining/RefiningPage")).RefiningPage,
    }),
    [routes.profitTree]: async () => ({
        Component: (await import("./components/Tree/TreePage")).TreePage,
    }),
    [routes.foodAndPotions]: async () => ({
        Component: (await import("./components/Food/FoodPage")).FoodPage,
    }),
    [routes.transportations]: async () => ({
        Component: (await import("./components/Transport/TransportPage")).TransportPage,
    }),
    [routes.servers]: async () => ({
        Component: (await import("./components/Servers/ServersPage")).ServersPage,
    }),
    [routes.transmutations]: async () => ({
        Component: (await import("./components/Transmutations/TransmutationsPage"))
            .TransmutationsPage,
    }),
    [routes.artifactFoundry]: async () => ({
        Component: (await import("./components/Foundry/FoundryPage")).FoundryPage,
    }),
};

export const router = createBrowserRouter([
    {
        path: routes.home,
        element: <MainPage />,
    },
    {
        element: <AppLayout />,
        children: sections.map((section) => {
            const lazy = lazySections[section.route];

            return lazy
                ? { path: section.route, lazy }
                : { path: section.route, element: <SectionPage section={section} /> };
        }),
    },
]);
