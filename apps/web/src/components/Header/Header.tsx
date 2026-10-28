import { LanguageSwitch } from "../LanguageSwitch/LanguageSwitch";
import { ServerSelect } from "../ServerSelect/ServerSelect";
import { ThemeSwitch } from "../ThemeSwitch/ThemeSwitch";
import { UserMenu } from "../UserMenu/UserMenu";

/** Controls shared by all pages; the server select only matters for calculators */
export const HeaderControls: React.FC<{ withServer?: boolean }> = ({ withServer }) => (
    <div className="flex items-center gap-3">
        {withServer && <ServerSelect />}
        <LanguageSwitch />
        <ThemeSwitch />
        <UserMenu />
    </div>
);

export const Header: React.FC = () => (
    <header className="flex shrink-0 items-center justify-end border-b border-separator px-6 py-3">
        <HeaderControls withServer />
    </header>
);
