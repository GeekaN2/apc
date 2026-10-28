import { defineProject } from "vitest/config";

export default defineProject({
    // PGlite starts slowly on loaded machines and CI runners
    test: { testTimeout: 30_000, hookTimeout: 30_000 },
});
