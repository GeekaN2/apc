import { createBrowserRouter } from "react-router";
import { AppLayout } from "./components/AppLayout/AppLayout";
import { MainPage } from "./components/MainPage/MainPage";
import { type SectionRoute, routes } from "./routes";
import { sections } from "./sections";

/** Ported sections, each in its own chunk with the game data it needs */
const lazySections: Record<SectionRoute, () => Promise<{ Component: React.FC }>> = {
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
    [routes.faq]: async () => ({
        Component: (await import("./components/Faq/FaqPage")).FaqPage,
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
        children: [
            ...sections.map((section) => ({
                path: section.route,
                lazy: lazySections[section.route],
            })),
            {
                path: routes.admin,
                lazy: async () => ({
                    Component: (await import("./components/Admin/AdminPage")).AdminPage,
                }),
            },
        ],
    },
]);
