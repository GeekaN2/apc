import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
    plugins: [react(), tailwindcss()],
    server: {
        // The API is served from the same origin, so auth cookies are first-party
        proxy: {
            "/api": process.env.API_URL ?? "http://127.0.0.1:4000",
        },
    },
});
