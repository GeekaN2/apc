import { ThemeSwitch } from "../../ThemeSwitch/ThemeSwitch";

export const Footer: React.FC = () => (
    <footer className="absolute bottom-0 flex w-full max-w-3xl items-center justify-between p-5 text-sm text-muted">
        <span>&copy; GeekaN</span>
        <ThemeSwitch />
    </footer>
);
