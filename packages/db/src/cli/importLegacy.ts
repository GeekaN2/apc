/**
 * Imports users, settings and private servers of the old calculator:
 * MONGO_URI=mongodb://... DATABASE_URL=postgres://... pnpm --filter @apc/db db:import-legacy
 */
import { MongoClient } from "mongodb";
import { createDb } from "../client.ts";
import {
    type LegacyServer,
    type LegacyUser,
    type LegacyUserSettings,
    importLegacyData,
    mapLegacyData,
} from "../legacy.ts";

const mongoUri = process.env.MONGO_URI;
const databaseUrl = process.env.DATABASE_URL;

if (!mongoUri || !databaseUrl) {
    throw new Error("MONGO_URI and DATABASE_URL are required");
}

const mongo = await MongoClient.connect(mongoUri);
const albion = mongo.db(process.env.MONGO_DB ?? "albion");
const { db, close } = createDb(databaseUrl);

try {
    const data = mapLegacyData(
        {
            users: await albion.collection<LegacyUser>("users").find().toArray(),
            settings: await albion
                .collection<LegacyUserSettings>("user_settings")
                .find()
                .toArray(),
            servers: await albion.collection<LegacyServer>("servers").find().toArray(),
        },
        new Date(),
    );

    await importLegacyData(db, data);

    console.log(
        `Imported ${data.users.length} users, ${data.settings.length} settings, ` +
            `${data.servers.length} private servers, ${data.access.length} server accesses`,
    );

    for (const reason of data.skipped) {
        console.log(`Skipped ${reason}`);
    }
} finally {
    await mongo.close();
    await close();
}
