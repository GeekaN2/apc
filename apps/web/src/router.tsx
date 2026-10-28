import { createBrowserRouter } from "react-router";
import { AppLayout } from "./components/AppLayout/AppLayout";
import { MainPage } from "./components/MainPage/MainPage";
import { SectionPage } from "./components/SectionPage/SectionPage";
import { routes } from "./routes";
import { sections } from "./sections";

export const router = createBrowserRouter([
    {
        path: routes.home,
        element: <MainPage />,
    },
    {
        element: <AppLayout />,
        children: sections.map((section) => ({
            path: section.route,
            element: <SectionPage section={section} />,
        })),
    },
]);
