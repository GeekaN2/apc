import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const itemIconPath =
    /^\/item-icons\/(32|48|64|96)\/([1-5])\/([A-Z0-9_]{1,100}(?:(?:@|%40)[0-9])?)\.png(?:\?.*)?$/;

// https://vite.dev/config/
export default defineConfig({
    plugins: [react(), tailwindcss()],
    server: {
        // The API is served from the same origin, so auth cookies are first-party
        proxy: {
            "/api": process.env.API_URL ?? "http://127.0.0.1:4000",
            "/item-icons/": {
                target: "https://render.albiononline.com",
                changeOrigin: true,
                bypass: (request) => {
                    if (
                        !itemIconPath.test(request.url ?? "") ||
                        (request.method !== "GET" && request.method !== "HEAD")
                    ) {
                        return false;
                    }
                },
                rewrite: (url) =>
                    url.replace(itemIconPath, "/v1/item/$3.png?size=$1&quality=$2"),
            },
        },
    },
});
