import { Theme } from "@gravity-ui/uikit";
import { makeAutoObservable } from "mobx";

const THEME_KEY = 'apc_theme';


export class UserStore {
    theme: Theme = localStorage.getItem(THEME_KEY) ?? 'dark';

    constructor() {
        makeAutoObservable(this);
    }

    setTheme(theme: Theme) {
        this.theme = theme;

        localStorage.setItem(THEME_KEY, theme);
    }
}