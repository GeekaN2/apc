import { type Db, promoteToSupporter } from "@apc/db";

/** Discord server whose roles give site roles */
export interface DiscordRoles {
    guildId: string;
    /** Roles of supporters, e.g. patrons */
    supporterRoleIds: string[];
}

/** Scope for reading one's own roles on a server, see `syncDiscordRole` */
export const DISCORD_MEMBER_SCOPE = "guilds.members.read";

interface DiscordAccount {
    providerId: string;
    userId: string;
    accessToken?: string | null;
}

/**
 * Makes a user a supporter when they have a supporter role on the Discord
 * server. Roles are only raised: supporters from the old calculator may have no
 * Discord role, and admins stay admins. Returns whether the role changed.
 */
export async function syncDiscordRole(
    db: Db,
    account: DiscordAccount,
    roles: DiscordRoles,
    fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
    if (account.providerId !== "discord" || !account.accessToken) {
        return false;
    }

    const response = await fetchImpl(
        `https://discord.com/api/v10/users/@me/guilds/${roles.guildId}/member`,
        { headers: { Authorization: `Bearer ${account.accessToken}` } },
    );

    // 404: not on the server; 401/403: the token lacks the scope
    if (!response.ok) {
        return false;
    }

    const member = (await response.json()) as { roles?: string[] };

    if (!member.roles?.some((role) => roles.supporterRoleIds.includes(role))) {
        return false;
    }

    return promoteToSupporter(db, account.userId);
}
