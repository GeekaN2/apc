/** Pins dumps.json to the latest ao-bin-dumps commit */
import { z } from "zod";
import { readPin, writePin } from "../dumps.ts";

const commitResponse = z.object({
    sha: z.string(),
    commit: z.object({ committer: z.object({ date: z.string() }) }),
});

const pin = await readPin();
const response = await fetch(
    `https://api.github.com/repos/${pin.repository}/commits/HEAD`,
    {
        headers: { Accept: "application/vnd.github+json" },
    },
);

if (!response.ok) {
    throw new Error(`GitHub API responded with ${response.status}`);
}

const latest = commitResponse.parse(await response.json());

if (latest.sha === pin.commit) {
    console.log(`Already at the latest commit ${pin.commit} (${pin.date})`);
} else {
    await writePin({ ...pin, commit: latest.sha, date: latest.commit.committer.date });
    console.log(
        `Pinned ${latest.sha} (${latest.commit.committer.date}), was ${pin.commit}`,
    );
    console.log("Run `pnpm data:build` to regenerate the catalog");
}
