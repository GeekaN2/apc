/**
 * Import of users, settings and private servers from the old calculator's MongoDB
 * (database `albion`: `users`, `user_settings`, `servers`).
 */
import type { PgTable } from "drizzle-orm/pg-core";
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
        // Public servers were Albion Online Data, seeded separately, and the old
        // calculator's own relays, which are gone
        if (legacy.state === "public") {
            result.skipped.push(`server ${legacy.id}: public`);
            continue;
        }

        const ownerId = legacy.creatorId && hex(legacy.creatorId);

        result.servers.push({
            id: legacy.id,
            name: legacy.name ?? legacy.id,
            description: legacy.description ?? null,
            natsUrl: legacy.natsUrl,
            apiUrl: null,
            isPublic: false,
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
/** Rows per insert: one statement for thousands of users overflows the query builder */
const IMPORT_BATCH = 500;

export async function importLegacyData(db: Db, data: LegacyImport): Promise<void> {
    await db.transaction(async (tx) => {
        async function insert<T extends PgTable>(table: T, rows: T["$inferInsert"][]) {
            for (let start = 0; start < rows.length; start += IMPORT_BATCH) {
                await tx
                    .insert(table)
                    .values(rows.slice(start, start + IMPORT_BATCH))
                    .onConflictDoNothing();
            }
        }

        await insert(user, data.users);
        await insert(account, data.accounts);
        await insert(userSettings, data.settings);
        await insert(servers, data.servers);
        await insert(serverAccess, data.access);
    });
}
