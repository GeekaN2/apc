import type { AppType } from "@apc/api";
import { QueryClient } from "@tanstack/react-query";
import { hc } from "hono/client";

/** Typed client of `apps/api`, served from the same origin under `/api` */
export const api = hc<AppType>(window.location.origin, {
    init: { credentials: "include" },
}).api;

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: { staleTime: 60_000, refetchOnWindowFocus: false },
    },
});
