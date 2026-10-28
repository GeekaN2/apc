import { Copy, Pencil, TrashBin } from "@gravity-ui/icons";
import {
    Alert,
    Button,
    Chip,
    Description,
    Input,
    Label,
    Modal,
    TextArea,
    TextField,
} from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSession } from "../../api/auth";
import { api } from "../../api/client";
import { useServers } from "../../api/servers";

interface PrivateServer {
    id: string;
    name: string;
    description: string | null;
    natsUrl: string;
    access: string[];
}

const SERVER_ROLES = ["supporter", "admin"];

/** A command or an address with a copy button */
const CopyLine: React.FC<{ text: string }> = ({ text }) => {
    const { t } = useTranslation();
    const [copied, setCopied] = useState(false);

    return (
        <div className="flex items-center gap-2 rounded-lg bg-default px-3 py-1.5">
            <code className="min-w-0 flex-1 truncate text-sm" title={text}>
                {text}
            </code>
            <Button
                size="sm"
                variant="tertiary"
                isIconOnly
                aria-label={copied ? t("serversPage.copied") : t("serversPage.copy")}
                onPress={() => {
                    void navigator.clipboard.writeText(text);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                }}
            >
                <Copy />
            </Button>
        </div>
    );
};

async function errorOf(response: Response): Promise<string> {
    const body = (await response.json().catch(() => ({}))) as { error?: unknown };

    return typeof body.error === "string" ? body.error : `${response.status}`;
}

/** Create or edit a private server */
const ServerForm: React.FC<{
    server?: PrivateServer;
    onDone: (unknown: string[]) => void;
    onCancel: () => void;
}> = ({ server, onDone, onCancel }) => {
    const { t } = useTranslation();
    const [error, setError] = useState<string>();
    const save = useMutation({
        mutationFn: async (form: FormData) => {
            const input = {
                name: String(form.get("name")),
                description: String(form.get("description") ?? "") || null,
                natsUrl: String(form.get("natsUrl")),
                access: String(form.get("access") ?? "")
                    .split(/[\s,]+/)
                    .filter(Boolean),
            };
            const response = server
                ? await api.servers[":id"].$put({ param: { id: server.id }, json: input })
                : await api.servers.$post({
                      json: { ...input, id: String(form.get("id")) },
                  });

            if (!response.ok) {
                throw new Error(await errorOf(response));
            }

            return ((await response.json()) as { unknown: string[] }).unknown;
        },
        onSuccess: onDone,
        onError: (e) => setError(e.message),
    });

    return (
        <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
                event.preventDefault();
                setError(undefined);
                save.mutate(new FormData(event.currentTarget));
            }}
        >
            {!server && (
                <TextField name="id" isRequired>
                    <Label>{t("serversPage.id")}</Label>
                    <Input pattern="[a-z0-9][a-z0-9\-]{2,31}" autoComplete="off" />
                    <Description>{t("serversPage.idHint")}</Description>
                </TextField>
            )}
            <TextField name="name" isRequired defaultValue={server?.name}>
                <Label>{t("serversPage.name")}</Label>
                <Input maxLength={64} />
            </TextField>
            <TextField name="description" defaultValue={server?.description ?? ""}>
                <Label>{t("serversPage.description")}</Label>
                <Input maxLength={500} />
            </TextField>
            <TextField name="natsUrl" isRequired defaultValue={server?.natsUrl}>
                <Label>{t("serversPage.natsUrl")}</Label>
                <Input placeholder="nats://user:password@host:4222" autoComplete="off" />
            </TextField>
            <TextField name="access" defaultValue={server?.access.join(", ")}>
                <Label>{t("serversPage.access")}</Label>
                <TextArea rows={2} />
                <Description>{t("serversPage.accessHint")}</Description>
            </TextField>
            {error && (
                <p role="alert" className="text-sm text-danger">
                    {error}
                </p>
            )}
            <div className="flex justify-end gap-2">
                <Button variant="tertiary" onPress={onCancel}>
                    {t("serversPage.cancel")}
                </Button>
                <Button type="submit" isPending={save.isPending}>
                    {t("serversPage.save")}
                </Button>
            </div>
        </form>
    );
};

/** Private servers of a supporter, every one for admins */
const MyServers: React.FC = () => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const [editing, setEditing] = useState<PrivateServer | "new">();
    const [unknown, setUnknown] = useState<string[]>([]);
    const mine = useQuery({
        queryKey: ["servers", "private"],
        queryFn: async () => {
            const response = await api.servers.private.$get();

            if (!response.ok) {
                throw new Error(await errorOf(response));
            }

            return (await response.json()) as PrivateServer[];
        },
    });
    const refresh = () => queryClient.invalidateQueries({ queryKey: ["servers"] });
    const remove = useMutation({
        mutationFn: async (id: string) => {
            await api.servers[":id"].$delete({ param: { id } });
        },
        onSuccess: refresh,
    });

    return (
        <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-medium">{t("serversPage.mine")}</h2>
                <Button size="sm" onPress={() => setEditing("new")}>
                    {t("serversPage.add")}
                </Button>
            </div>
            {unknown.length > 0 && (
                <Alert status="warning">
                    <Alert.Content>
                        <Alert.Description>
                            {t("serversPage.unknown", { names: unknown.join(", ") })}
                        </Alert.Description>
                    </Alert.Content>
                </Alert>
            )}
            {mine.data?.length === 0 && (
                <p className="text-muted">{t("serversPage.none")}</p>
            )}
            {mine.data?.map((server) => (
                <div
                    key={server.id}
                    className="flex flex-col gap-2 rounded-xl border border-separator p-4"
                >
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="font-medium">
                                {server.name}{" "}
                                <span className="text-muted">· {server.id}</span>
                            </div>
                            {server.description && (
                                <p className="text-sm text-muted">{server.description}</p>
                            )}
                        </div>
                        <div className="flex shrink-0 gap-1">
                            <Button
                                size="sm"
                                variant="tertiary"
                                isIconOnly
                                aria-label={t("serversPage.edit")}
                                onPress={() => setEditing(server)}
                            >
                                <Pencil />
                            </Button>
                            <Button
                                size="sm"
                                variant="tertiary"
                                isIconOnly
                                aria-label={t("serversPage.delete")}
                                onPress={() => {
                                    if (
                                        window.confirm(
                                            t("serversPage.deleteConfirm", {
                                                name: server.name,
                                            }),
                                        )
                                    ) {
                                        remove.mutate(server.id);
                                    }
                                }}
                            >
                                <TrashBin />
                            </Button>
                        </div>
                    </div>
                    <CopyLine text={server.natsUrl} />
                    {server.access.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                            {server.access.map((nickname) => (
                                <Chip key={nickname} size="sm">
                                    {nickname}
                                </Chip>
                            ))}
                        </div>
                    )}
                </div>
            ))}
            <Modal.Backdrop
                isOpen={editing !== undefined}
                onOpenChange={(open) => !open && setEditing(undefined)}
            >
                <Modal.Container size="sm">
                    <Modal.Dialog>
                        <Modal.CloseTrigger />
                        <Modal.Header>
                            <Modal.Heading>
                                {editing === "new"
                                    ? t("serversPage.add")
                                    : t("serversPage.edit")}
                            </Modal.Heading>
                        </Modal.Header>
                        <Modal.Body>
                            {editing !== undefined && (
                                <ServerForm
                                    server={editing === "new" ? undefined : editing}
                                    onCancel={() => setEditing(undefined)}
                                    onDone={(names) => {
                                        setUnknown(names);
                                        setEditing(undefined);
                                        void refresh();
                                    }}
                                />
                            )}
                        </Modal.Body>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </section>
    );
};

export const ServersPage: React.FC = () => {
    const { t } = useTranslation();
    const { data: session } = useSession();
    const { data: servers = [] } = useServers();
    const role = (session?.user as { role?: string } | undefined)?.role;
    const privateUrls = servers.flatMap((server) =>
        "natsUrl" in server && server.natsUrl ? [server.natsUrl] : [],
    );

    return (
        <div className="flex max-w-3xl flex-col gap-8">
            <h1 className="text-2xl font-semibold">⚙️ {t("sections.servers")}</h1>
            <section className="flex flex-col gap-3">
                <h2 className="text-lg font-medium">{t("serversPage.available")}</h2>
                <p className="text-sm text-muted">{t("serversPage.availableHint")}</p>
                <ul className="flex flex-col">
                    {servers.map((server) => (
                        <li
                            key={server.id}
                            className="flex items-center justify-between gap-3 border-b border-separator py-2 last:border-0"
                        >
                            <span>{server.name}</span>
                            <Chip
                                size="sm"
                                color={server.isPublic ? "default" : "accent"}
                            >
                                {server.isPublic
                                    ? t("serversPage.public")
                                    : t("serversPage.private")}
                            </Chip>
                        </li>
                    ))}
                </ul>
            </section>
            {privateUrls.length > 0 && (
                <section className="flex flex-col gap-3">
                    <h2 className="text-lg font-medium">{t("serversPage.client")}</h2>
                    <p className="text-sm text-muted">{t("serversPage.clientHint")}</p>
                    <CopyLine text={`albiondata-client -i ${privateUrls.join(",")}`} />
                </section>
            )}
            {SERVER_ROLES.includes(role ?? "") ? (
                <MyServers />
            ) : (
                <p className="text-sm text-muted">{t("serversPage.supportersOnly")}</p>
            )}
        </div>
    );
};
