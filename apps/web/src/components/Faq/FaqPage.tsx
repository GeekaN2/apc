import { Accordion, buttonVariants } from "@heroui/react";
import { useTranslation } from "react-i18next";
import { DiscordIcon } from "../DiscordIcon/DiscordIcon";

const QUESTIONS = [
    "prices",
    "dash",
    "red",
    "taxes",
    "return",
    "own",
    "account",
    "servers",
    "contact",
] as const;

const DISCORD_URL = "https://discord.gg/2AM2twM";

export const FaqPage: React.FC = () => {
    const { t } = useTranslation();

    return (
        <div className="flex max-w-3xl flex-col gap-5">
            <h1 className="text-2xl font-semibold">❓ {t("faq.title")}</h1>
            <Accordion allowsMultipleExpanded>
                {QUESTIONS.map((id) => (
                    <Accordion.Item key={id} id={id}>
                        <Accordion.Heading>
                            <Accordion.Trigger>
                                {t(`faq.questions.${id}.q`)}
                                <Accordion.Indicator />
                            </Accordion.Trigger>
                        </Accordion.Heading>
                        <Accordion.Panel>
                            <Accordion.Body className="text-muted">
                                {t(`faq.questions.${id}.a`)}
                            </Accordion.Body>
                        </Accordion.Panel>
                    </Accordion.Item>
                ))}
            </Accordion>
            <a
                href={DISCORD_URL}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({
                    variant: "tertiary",
                    className: "w-fit gap-2",
                })}
            >
                <DiscordIcon className="size-4" />
                {t("faq.discord")}
            </a>
        </div>
    );
};
