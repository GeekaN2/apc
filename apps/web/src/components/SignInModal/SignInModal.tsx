import { Button, Input, Label, Modal, Separator, TextField } from "@heroui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { authClient } from "../../api/auth";
import { DiscordIcon } from "../DiscordIcon/DiscordIcon";

interface SignInModalProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
}

/**
 * New users sign in with Discord; nickname and password are only for accounts
 * migrated from the old calculator
 */
export const SignInModal: React.FC<SignInModalProps> = ({ isOpen, onOpenChange }) => {
    const { t } = useTranslation();
    const [error, setError] = useState<string>();
    const [isSubmitting, setIsSubmitting] = useState(false);

    async function signInWithDiscord() {
        setError(undefined);

        const { error } = await authClient.signIn.social({
            provider: "discord",
            callbackURL: window.location.href,
        });

        if (error) {
            setError(t("auth.discordError"));
        }
    }

    async function signInWithPassword(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const form = new FormData(event.currentTarget);

        setError(undefined);
        setIsSubmitting(true);

        const { error } = await authClient.signIn.username({
            username: String(form.get("username")),
            password: String(form.get("password")),
        });

        setIsSubmitting(false);

        if (error) {
            setError(t("auth.error"));
        } else {
            onOpenChange(false);
        }
    }

    return (
        <Modal.Backdrop
            isOpen={isOpen}
            onOpenChange={(isOpen) => {
                setError(undefined);
                onOpenChange(isOpen);
            }}
        >
            <Modal.Container size="sm">
                <Modal.Dialog>
                    <Modal.CloseTrigger />
                    <Modal.Header>
                        <Modal.Heading>{t("auth.signInTitle")}</Modal.Heading>
                    </Modal.Header>
                    <Modal.Body className="flex flex-col gap-4">
                        <Button fullWidth onPress={signInWithDiscord}>
                            <DiscordIcon className="size-4" />
                            {t("auth.discord")}
                        </Button>
                        <div className="flex items-center gap-3 text-sm text-muted">
                            <Separator className="flex-1" />
                            {t("auth.or")}
                            <Separator className="flex-1" />
                        </div>
                        <form
                            className="flex flex-col gap-3"
                            onSubmit={signInWithPassword}
                        >
                            <p className="text-sm text-muted">{t("auth.legacyHint")}</p>
                            <TextField name="username" isRequired autoComplete="username">
                                <Label>{t("auth.nickname")}</Label>
                                <Input />
                            </TextField>
                            <TextField
                                name="password"
                                type="password"
                                isRequired
                                autoComplete="current-password"
                            >
                                <Label>{t("auth.password")}</Label>
                                <Input />
                            </TextField>
                            {error && (
                                <p role="alert" className="text-sm text-danger">
                                    {error}
                                </p>
                            )}
                            <Button
                                type="submit"
                                variant="secondary"
                                fullWidth
                                isPending={isSubmitting}
                            >
                                {t("auth.submit")}
                            </Button>
                        </form>
                    </Modal.Body>
                </Modal.Dialog>
            </Modal.Container>
        </Modal.Backdrop>
    );
};
