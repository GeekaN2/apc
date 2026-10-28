import { Outlet } from "react-router";
import { Sidebar } from "../Sidebar/Sidebar";

export const AppLayout: React.FC = () => (
    <div className="flex h-full">
        <Sidebar />
        <main className="flex-1 overflow-auto p-6">
            <Outlet />
        </main>
    </div>
);
