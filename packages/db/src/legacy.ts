/**
 * Import of users, settings and private servers from the old calculator's MongoDB
 * (database `albion`: `users`, `user_settings`, `servers`).
 */
import type { Db } from "./client.ts";
import { account, serverAccess, servers, user, userSettings } from "./schema.ts";

/** Mongo ObjectId or its hex string */
type LegacyId = string | { toHexString(): string };

export interface LegacyUser {
    _id: LegacyId;
    nickname: string;
    /** bcrypt hash */
    password: string;
    role?: string;
    dtCreated?: Date | string;
}

export interface LegacyUserSettings {
    userId: LegacyId;
    treeSettings?: unknown;
}

export interface LegacyServer {
    id: string;
    name?: string;
    description?: string;
    natsUrl: string;
    state?: string;
    creatorId?: LegacyId;
    access?: { type: string; nickname: string }[];
}

export interface LegacyData {
    users: LegacyUser[];
    settings: LegacyUserSettings[];
    servers: LegacyServer[];
}

export interface LegacyImport {
    users: (typeof user.$inferInsert)[];
    accounts: (typeof account.$inferInsert)[];
    settings: (typeof userSettings.$inferInsert)[];
    servers: (typeof servers.$inferInsert)[];
    access: (typeof serverAccess.$inferInsert)[];
    /** Why some records were not imported */
    skipped: string[];
}

/** The old site took any non-empty nickname; sign-in accepts the same */
export const USERNAME_MAX_LENGTH = 64;

/** Old roles: tester was a trial of user */
const ROLES: Record<string, string> = {
    tester: "user",
    user: "user",
    supporter: "supporter",
    admin: "admin",
};

function hex(id: LegacyId): string {
    return typeof id === "string" ? id : id.toHexString();
}

/**
 * Maps old records to new rows. Old ids are kept as user ids, nicknames become
 * usernames (lowercase, like better-auth stores them), and the bcrypt hashes go
 * into credential accounts as is. Emails are placeholders: the old site had none.
 */
export function mapLegacyData(data: LegacyData, now: Date): LegacyImport {
    const result: LegacyImport = {
        users: [],
        accounts: [],
        settings: [],
        servers: [],
        access: [],
        skipped: [],
    };
    const userIds = new Set<string>();
    const idByUsername = new Map<string, string>();

    for (const legacy of data.users) {
        const id = hex(legacy._id);
        const username = legacy.nickname.trim().toLowerCase();

        if (!username || !legacy.password) {
            result.skipped.push(`user ${id}: no nickname or password`);
            continue;
        }

        if (username.length > USERNAME_MAX_LENGTH) {
            result.skipped.push(`user ${id}: nickname ${legacy.nickname} is too long`);
            continue;
        }

        if (idByUsername.has(username)) {
            result.skipped.push(`user ${id}: nickname ${legacy.nickname} is taken`);
            continue;
        }

        const createdAt = legacy.dtCreated ? new Date(legacy.dtCreated) : now;

        userIds.add(id);
        idByUsername.set(username, id);
        result.users.push({
            id,
            name: legacy.nickname,
            email: `${id}@legacy.invalid`,
            emailVerified: false,
            username,
            displayUsername: legacy.nickname,
            role: ROLES[legacy.role ?? "user"] ?? "user",
            createdAt,
            updatedAt: now,
        });
        result.accounts.push({
            id: `legacy-${id}`,
            accountId: id,
            providerId: "credential",
            userId: id,
            password: legacy.password,
            createdAt,
            updatedAt: now,
        });
    }

    for (const settings of data.settings) {
        const userId = hex(settings.userId);

        if (userIds.has(userId) && settings.treeSettings !== undefined) {
            result.settings.push({
                userId,
                treeSettings: settings.treeSettings,
                updatedAt: now,
            });
        }
    }

    for (const legacy of data.servers) {
        // Public Albion Online Data servers are seeded separately
        if (legacy.natsUrl.includes("albion-online-data.com")) {
            continue;
        }

        const ownerId = legacy.creatorId && hex(legacy.creatorId);

        result.servers.push({
            id: legacy.id,
            name: legacy.name ?? legacy.id,
            description: legacy.description ?? null,
            natsUrl: legacy.natsUrl,
            apiUrl: null,
            isPublic: legacy.state === "public",
            ownerId: ownerId && userIds.has(ownerId) ? ownerId : null,
        });

        for (const access of legacy.access ?? []) {
            const userId = idByUsername.get(access.nickname.trim().toLowerCase());

            if (access.type === "user" && userId) {
                result.access.push({ serverId: legacy.id, userId });
            } else {
                result.skipped.push(`server ${legacy.id}: no user ${access.nickname}`);
            }
        }
    }

    return result;
}

/** Writes mapped rows in one transaction; existing users and servers are left as they are */
export async function importLegacyData(db: Db, data: LegacyImport): Promise<void> {
    await db.transaction(async (tx) => {
        if (data.users.length > 0) {
            await tx.insert(user).values(data.users).onConflictDoNothing();
            await tx.insert(account).values(data.accounts).onConflictDoNothing();
        }

        if (data.settings.length > 0) {
            await tx.insert(userSettings).values(data.settings).onConflictDoNothing();
        }

        if (data.servers.length > 0) {
            await tx.insert(servers).values(data.servers).onConflictDoNothing();
        }

        if (data.access.length > 0) {
            await tx.insert(serverAccess).values(data.access).onConflictDoNothing();
        }
    });
}
