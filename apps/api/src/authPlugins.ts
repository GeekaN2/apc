import { USERNAME_MAX_LENGTH } from "@apc/db";
import { admin, username } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements, userAc } from "better-auth/plugins/admin/access";

/** Permissions on top of the admin plugin: supporters run private NATS servers */
export const statement = {
    ...defaultStatements,
    server: ["create", "update"],
} as const;

export const ac = createAccessControl(statement);

export const roles = {
    user: ac.newRole({ ...userAc.statements }),
    supporter: ac.newRole({ ...userAc.statements, server: ["create", "update"] }),
    admin: ac.newRole({ ...adminAc.statements, server: ["create", "update"] }),
};

export type Role = keyof typeof roles;

/** Plugins shared by the API and the schema generation config */
export function authPlugins() {
    return [
        // Nicknames of migrated users can be anything the old site accepted
        username({
            minUsernameLength: 1,
            maxUsernameLength: USERNAME_MAX_LENGTH,
            usernameValidator: (name) => name.trim().length > 0,
        }),
        admin({ ac, roles, defaultRole: "user", adminRoles: ["admin"] }),
    ];
}
