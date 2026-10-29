import { and, eq, isNull, or } from "drizzle-orm";
import { user } from "./authSchema.ts";
import type { Db } from "./client.ts";

/** Makes a regular user a supporter; admins and supporters stay as they are */
export async function promoteToSupporter(db: Db, userId: string): Promise<boolean> {
    const updated = await db
        .update(user)
        .set({ role: "supporter" })
        .where(and(eq(user.id, userId), or(isNull(user.role), eq(user.role, "user"))))
        .returning({ id: user.id });

    return updated.length > 0;
}
