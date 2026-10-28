import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
    { ignores: ["**/dist", "**/coverage"] },
    js.configs.recommended,
    tseslint.configs.recommended,
    {
        files: ["apps/web/**/*.{ts,tsx}"],
        languageOptions: { globals: globals.browser },
        plugins: { "react-refresh": reactRefresh },
        extends: [reactHooks.configs.flat.recommended],
        rules: {
            "react-refresh/only-export-components": [
                "warn",
                { allowConstantExport: true },
            ],
        },
    },
    {
        files: ["*.{js,ts}", "packages/**/*.ts", "apps/*/vite.config.ts"],
        languageOptions: { globals: globals.node },
    },
    prettier,
);
