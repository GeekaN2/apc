import { Outlet } from "react-router";
import { Header } from "../Header/Header";
import { Sidebar } from "../Sidebar/Sidebar";

export const AppLayout: React.FC = () => (
    <div className="flex h-full">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
            <Header />
            <main className="flex-1 overflow-auto p-6">
                <Outlet />
            </main>
        </div>
    </div>
);
