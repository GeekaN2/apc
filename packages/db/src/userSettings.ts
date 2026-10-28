import { eq, sql } from "drizzle-orm";
import type { Db } from "./client.ts";
import { userSettings } from "./schema.ts";

export async function getTreeSettings(db: Db, userId: string): Promise<unknown> {
    const [row] = await db
        .select({ treeSettings: userSettings.treeSettings })
        .from(userSettings)
        .where(eq(userSettings.userId, userId));

    return row?.treeSettings ?? null;
}

export async function saveTreeSettings(db: Db, userId: string, treeSettings: unknown) {
    await db
        .insert(userSettings)
        .values({ userId, treeSettings, updatedAt: new Date() })
        .onConflictDoUpdate({
            target: userSettings.userId,
            set: {
                treeSettings: sql`excluded.tree_settings`,
                updatedAt: sql`excluded.updated_at`,
            },
        });
}
