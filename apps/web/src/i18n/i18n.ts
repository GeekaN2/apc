import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import en from "./locales/en.json";
import ru from "./locales/ru.json";

/** UI languages; item names come from `@apc/game-data` in the matching game locale */
export const languages = {
    en: { label: "English", short: "EN", gameLocale: "en-US" },
    ru: { label: "Русский", short: "RU", gameLocale: "ru-RU" },
} as const;

export type Language = keyof typeof languages;

function isLanguage(value: string): value is Language {
    return value in languages;
}

/** Browser language on the first visit, English otherwise */
function detectLanguage(): Language {
    const browserLanguage = navigator.language.split("-")[0] ?? "";

    return isLanguage(browserLanguage) ? browserLanguage : "en";
}

interface LanguageState {
    language: Language;
    setLanguage: (language: Language) => void;
}

export const useLanguageStore = create<LanguageState>()(
    persist(
        (set) => ({
            language: detectLanguage(),
            setLanguage: (language) => set({ language }),
        }),
        { name: "apc-language" },
    ),
);

declare module "i18next" {
    interface CustomTypeOptions {
        resources: { translation: typeof en };
    }
}

// persist with localStorage hydrates synchronously, so the stored language is already here
const { language } = useLanguageStore.getState();

void i18n.use(initReactI18next).init({
    resources: { en: { translation: en }, ru: { translation: ru } },
    lng: language,
    fallbackLng: "en",
    interpolation: { escapeValue: false },
});

document.documentElement.lang = language;
useLanguageStore.subscribe((state) => {
    void i18n.changeLanguage(state.language);
    document.documentElement.lang = state.language;
});
