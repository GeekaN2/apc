import { useEffect } from "react";
import { useSession } from "../api/auth";
import { api } from "../api/client";
import { useTreeStore } from "./tree";
import { treeSettingsFromServer, treeSettingsToServer } from "./treeSettings";

const SAVE_DELAY_MS = 1_000;

/**
 * Keeps tree settings of a signed in user on the server: loads them after sign-in,
 * the old calculator's format included, and saves changes after a short pause
 */
export function useTreeSettingsSync() {
    const { data: session } = useSession();
    const userId = session?.user.id;

    useEffect(() => {
        if (!userId) {
            return;
        }

        let loaded = false;
        let cancelled = false;
        let timer: ReturnType<typeof setTimeout> | undefined;

        void (async () => {
            const response = await api.settings.tree.$get();

            if (cancelled || !response.ok) {
                return;
            }

            const { treeSettings } = await response.json();
            const settings = treeSettingsFromServer(treeSettings);

            if (settings) {
                useTreeStore.setState({ settings });
            }

            loaded = true;
        })();

        const unsubscribe = useTreeStore.subscribe((state, previous) => {
            if (!loaded || state.settings === previous.settings) {
                return;
            }

            clearTimeout(timer);
            timer = setTimeout(() => {
                void api.settings.tree.$put({
                    json: treeSettingsToServer(state.settings),
                });
            }, SAVE_DELAY_MS);
        });

        return () => {
            cancelled = true;
            clearTimeout(timer);
            unsubscribe();
        };
    }, [userId]);
}
