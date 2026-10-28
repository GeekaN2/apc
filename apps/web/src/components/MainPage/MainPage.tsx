import { buttonVariants } from "@heroui/react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { calculators, helpers, type Section } from "../../sections";
import { HeaderControls } from "../Header/Header";
import { Footer } from "./Footer/Footer";

const SectionLink: React.FC<{ section: Section; className: string }> = ({
    section,
    className,
}) => {
    const { t } = useTranslation();

    return (
        <Link
            to={section.route}
            className={buttonVariants({
                variant: "tertiary",
                size: "lg",
                fullWidth: true,
                className,
            })}
        >
            {section.emoji} {t(`sections.${section.key}`)}
        </Link>
    );
};

export const MainPage: React.FC = () => (
    <div className="relative flex h-full flex-col items-center justify-center gap-6 px-4">
        <div className="absolute top-0 right-0 p-5">
            <HeaderControls />
        </div>
        <header className="flex items-center gap-3">
            <img src="/favicon.png" alt="" className="h-12" />
            <h1 className="text-4xl font-semibold sm:text-5xl">
                Albion Profit Calculator
            </h1>
        </header>
        <nav className="grid w-full max-w-3xl grid-cols-2 gap-2 sm:grid-cols-6">
            {calculators.map((section) => (
                <SectionLink
                    key={section.route}
                    section={section}
                    className="sm:col-span-2"
                />
            ))}
            {helpers.map((section) => (
                <SectionLink
                    key={section.route}
                    section={section}
                    className="sm:col-span-3"
                />
            ))}
        </nav>
        <Footer />
    </div>
);
