import { adminClient, usernameClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/** better-auth of `apps/api` at `/api/auth` on the same origin */
export const authClient = createAuthClient({
    plugins: [usernameClient(), adminClient()],
});

export const useSession = authClient.useSession;
