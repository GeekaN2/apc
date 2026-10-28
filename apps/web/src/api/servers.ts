import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useServerStore } from "../store/server";
import { useSession } from "./auth";
import { api } from "./client";

/** Public servers and private ones of the signed in user */
export function useServers() {
    const { data: session } = useSession();

    return useQuery({
        queryKey: ["servers", session?.user.id ?? null],
        queryFn: async () => {
            const response = await api.servers.$get();

            if (!response.ok) {
                throw new Error(`Failed to load servers: ${response.status}`);
            }

            return response.json();
        },
    });
}

/**
 * Selected server; falls back to the first visible one when nothing is selected
 * or the selected private server is no longer visible
 */
export function useCurrentServer() {
    const { data: servers } = useServers();
    const serverId = useServerStore((state) => state.serverId);
    const setServerId = useServerStore((state) => state.setServerId);
    const server = servers?.find(({ id }) => id === serverId) ?? servers?.[0];

    useEffect(() => {
        if (server && server.id !== serverId) {
            setServerId(server.id);
        }
    }, [server, serverId, setServerId]);

    return server;
}
