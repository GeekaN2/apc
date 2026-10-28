import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "light" | "dark";

interface ThemeState {
    theme: Theme;
    setTheme: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeState>()(
    persist(
        (set) => ({
            theme: "dark",
            setTheme: (theme) => set({ theme }),
        }),
        { name: "apc-theme" },
    ),
);

/** HeroUI reads the theme from the class and data-theme attribute on <html> */
function applyTheme(theme: Theme) {
    const root = document.documentElement;

    root.classList.remove("light", "dark");
    root.classList.add(theme);
    root.dataset.theme = theme;
}

// persist with localStorage hydrates synchronously, so the stored theme is already here
applyTheme(useThemeStore.getState().theme);
useThemeStore.subscribe((state) => applyTheme(state.theme));
