import { ArrowRightFromSquare, ArrowRightToSquare, Shield } from "@gravity-ui/icons";
import { Avatar, Button, Dropdown, Label, Skeleton } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { routes } from "../../routes";
import { authClient, useSession } from "../../api/auth";
import type en from "../../i18n/locales/en.json";
import { DiscordIcon } from "../DiscordIcon/DiscordIcon";
import { SignInModal } from "../SignInModal/SignInModal";

type Role = keyof typeof en.auth.roles;

/** Sign-in button for guests, profile menu for signed in users */
export const UserMenu: React.FC = () => {
    const { t } = useTranslation();
    const { data: session, isPending } = useSession();
    const navigate = useNavigate();
    const [isSignInOpen, setIsSignInOpen] = useState(false);
    const userId = session?.user.id;
    const { data: accounts } = useQuery({
        queryKey: ["accounts", userId],
        queryFn: async () => (await authClient.listAccounts()).data ?? [],
        enabled: userId !== undefined,
    });

    if (isPending) {
        return <Skeleton className="size-8 rounded-full" />;
    }

    if (!session) {
        return (
            <>
                <Button
                    size="sm"
                    variant="secondary"
                    onPress={() => setIsSignInOpen(true)}
                >
                    <ArrowRightToSquare />
                    {t("auth.signIn")}
                </Button>
                <SignInModal isOpen={isSignInOpen} onOpenChange={setIsSignInOpen} />
            </>
        );
    }

    const { user } = session;
    const name = user.displayUsername || user.username || user.name;
    const role = (user.role ?? "user") as Role;
    const hasDiscord = accounts?.some((account) => account.providerId === "discord");

    function onAction(key: React.Key) {
        if (key === "link-discord") {
            void authClient.linkSocial({
                provider: "discord",
                callbackURL: window.location.href,
            });
        } else if (key === "admin") {
            void navigate(routes.admin);
        } else if (key === "sign-out") {
            void authClient.signOut();
        }
    }

    return (
        <Dropdown>
            <Dropdown.Trigger aria-label={name} className="inline-flex rounded-full">
                <Avatar size="sm">
                    {user.image && <Avatar.Image src={user.image} alt="" />}
                    <Avatar.Fallback>{name.slice(0, 1).toUpperCase()}</Avatar.Fallback>
                </Avatar>
            </Dropdown.Trigger>
            <Dropdown.Popover placement="bottom end" className="min-w-52">
                <div className="flex flex-col px-3 pt-3 pb-1">
                    <span className="font-medium">{name}</span>
                    <span className="text-sm text-muted">
                        {t(`auth.roles.${role}`, { defaultValue: role })}
                    </span>
                </div>
                <Dropdown.Menu aria-label={name} onAction={onAction}>
                    {hasDiscord === false ? (
                        <Dropdown.Item
                            id="link-discord"
                            textValue={t("auth.linkDiscord")}
                        >
                            <DiscordIcon className="size-4" />
                            <Label>{t("auth.linkDiscord")}</Label>
                        </Dropdown.Item>
                    ) : null}
                    {role === "admin" ? (
                        <Dropdown.Item id="admin" textValue={t("admin.menu")}>
                            <Shield className="size-4" />
                            <Label>{t("admin.menu")}</Label>
                        </Dropdown.Item>
                    ) : null}
                    <Dropdown.Item
                        id="sign-out"
                        textValue={t("auth.signOut")}
                        variant="danger"
                    >
                        <ArrowRightFromSquare className="size-4" />
                        <Label>{t("auth.signOut")}</Label>
                    </Dropdown.Item>
                </Dropdown.Menu>
            </Dropdown.Popover>
        </Dropdown>
    );
};
