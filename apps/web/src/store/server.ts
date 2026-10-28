import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ServerState {
    /** Id of the selected price server, see `/api/servers` */
    serverId: string | undefined;
    setServerId: (serverId: string) => void;
}

export const useServerStore = create<ServerState>()(
    persist(
        (set) => ({
            serverId: undefined,
            setServerId: (serverId) => set({ serverId }),
        }),
        { name: "apc-server" },
    ),
);
