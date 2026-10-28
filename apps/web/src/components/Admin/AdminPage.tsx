import { Button, Chip, Input, ListBox, Select, Spinner } from "@heroui/react";
import {
    keepPreviousData,
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";
import { useDeferredValue, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate } from "react-router";
import { authClient, useSession } from "../../api/auth";
import { api } from "../../api/client";
import { formatAge, formatNumber } from "../ProfitTable/format";

const ROLES = ["user", "supporter", "admin"] as const;
const PAGE = 50;

/** Orders and averages per server: an old last order means the ingest is stuck */
const DataStatus: React.FC = () => {
    const { t, i18n } = useTranslation();
    const stats = useQuery({
        queryKey: ["admin", "stats"],
        queryFn: async () => {
            const response = await api.admin.stats.$get();

            if (!response.ok) {
                throw new Error(String(response.status));
            }

            return response.json();
        },
        refetchInterval: 60_000,
    });
    const now = stats.dataUpdatedAt;
    const age = (iso: string | null, staleAfter: number) =>
        iso === null ? (
            <span className="text-danger">{t("admin.never")}</span>
        ) : (
            <span
                className={now - Date.parse(iso) > staleAfter ? "text-danger" : undefined}
            >
                {formatAge(new Date(iso), now, i18n.language)}
            </span>
        );

    return (
        <section className="flex flex-col gap-3">
            <h2 className="text-lg font-medium">{t("admin.data")}</h2>
            {stats.isPending ? (
                <Spinner size="sm" />
            ) : (
                <div className="overflow-x-auto rounded-xl border border-separator">
                    <table className="w-full border-collapse text-sm whitespace-nowrap">
                        <thead>
                            <tr className="border-b border-separator text-muted">
                                <th className="px-3 py-2 text-left font-normal">
                                    {t("admin.server")}
                                </th>
                                <th className="px-3 py-2 text-right font-normal">
                                    {t("admin.orders")}
                                </th>
                                <th className="px-3 py-2 text-right font-normal">
                                    {t("admin.lastOrder")}
                                </th>
                                <th className="px-3 py-2 text-right font-normal">
                                    {t("admin.averages")}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats.data?.map((server) => (
                                <tr
                                    key={server.id}
                                    className="border-b border-separator last:border-0"
                                >
                                    <td className="px-3 py-2">
                                        {server.name}{" "}
                                        <span className="text-muted">· {server.id}</span>
                                    </td>
                                    <td className="px-3 py-2 text-right tabular-nums">
                                        {formatNumber(
                                            server.liveOrders,
                                            i18n.language,
                                            0,
                                        )}
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                        {age(server.lastOrderAt, 15 * 60_000)}
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                        {age(server.averagesAt, 2 * 24 * 60 * 60_000)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
};

interface AdminUser {
    id: string;
    name: string;
    username?: string | null;
    displayUsername?: string | null;
    role?: string | null;
    banned?: boolean | null;
}

const UserRow: React.FC<{ user: AdminUser; onChange: () => void }> = ({
    user,
    onChange,
}) => {
    const { t } = useTranslation();
    const [password, setPassword] = useState("");
    const [done, setDone] = useState<string>();
    const run = useMutation({
        mutationFn: async (
            action: () => Promise<{ error: { message?: string } | null }>,
        ) => {
            const { error } = await action();

            if (error) {
                throw new Error(error.message ?? "Error");
            }
        },
        onSuccess: onChange,
        onError: (error) => setDone(error.message),
    });
    const role = (user.role ?? "user") as (typeof ROLES)[number];

    return (
        <li className="flex flex-col gap-2 border-b border-separator py-3 last:border-0 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
                <span className="font-medium">
                    {user.displayUsername || user.username || user.name}
                </span>
                {user.banned && (
                    <Chip size="sm" color="danger" className="ms-2">
                        {t("admin.banned")}
                    </Chip>
                )}
                {done && <span className="ms-2 text-xs text-muted">{done}</span>}
            </div>
            <Select
                aria-label={t("admin.role")}
                value={role}
                onChange={(key) =>
                    key !== null &&
                    run.mutate(() =>
                        authClient.admin.setRole({
                            userId: user.id,
                            role: key as "user" | "admin",
                        }),
                    )
                }
                className="w-40"
            >
                <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                    <ListBox>
                        {ROLES.map((id) => (
                            <ListBox.Item
                                key={id}
                                id={id}
                                textValue={t(`auth.roles.${id}`)}
                            >
                                {t(`auth.roles.${id}`)}
                                <ListBox.ItemIndicator />
                            </ListBox.Item>
                        ))}
                    </ListBox>
                </Select.Popover>
            </Select>
            <form
                className="flex gap-1"
                onSubmit={(event) => {
                    event.preventDefault();
                    run.mutate(async () => {
                        const result = await authClient.admin.setUserPassword({
                            userId: user.id,
                            newPassword: password,
                        });

                        if (!result.error) {
                            setPassword("");
                            setDone(t("admin.passwordSet"));
                        }

                        return result;
                    });
                }}
            >
                <Input
                    aria-label={t("admin.password")}
                    placeholder={t("admin.password")}
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-36"
                />
                <Button
                    type="submit"
                    size="sm"
                    variant="tertiary"
                    isPending={run.isPending}
                >
                    {t("admin.setPassword")}
                </Button>
            </form>
            <Button
                size="sm"
                variant={user.banned ? "tertiary" : "danger-soft"}
                onPress={() =>
                    run.mutate(() =>
                        user.banned
                            ? authClient.admin.unbanUser({ userId: user.id })
                            : authClient.admin.banUser({ userId: user.id }),
                    )
                }
            >
                {user.banned ? t("admin.unban") : t("admin.ban")}
            </Button>
        </li>
    );
};

const Users: React.FC = () => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const [search, setSearch] = useState("");
    const [limit, setLimit] = useState(PAGE);
    const query = useDeferredValue(search.trim());
    const users = useQuery({
        queryKey: ["admin", "users", query, limit],
        placeholderData: keepPreviousData,
        queryFn: async () => {
            const { data, error } = await authClient.admin.listUsers({
                query: {
                    limit,
                    sortBy: "createdAt",
                    sortDirection: "desc",
                    ...(query
                        ? {
                              searchValue: query,
                              searchField: "name",
                              searchOperator: "contains",
                          }
                        : {}),
                },
            });

            if (error) {
                throw new Error(error.message);
            }

            return data as { users: AdminUser[]; total: number };
        },
    });

    return (
        <section className="flex flex-col gap-3">
            <h2 className="text-lg font-medium">
                {t("admin.users")}
                {users.data && (
                    <span className="ms-2 text-muted">{users.data.total}</span>
                )}
            </h2>
            <Input
                aria-label={t("admin.search")}
                placeholder={t("admin.search")}
                value={search}
                onChange={(event) => {
                    setSearch(event.target.value);
                    setLimit(PAGE);
                }}
                className="w-full sm:w-72"
            />
            {users.error && <p className="text-sm text-danger">{users.error.message}</p>}
            {users.data?.users.length === 0 && (
                <p className="text-muted">{t("admin.nothing")}</p>
            )}
            <ul className="flex flex-col">
                {users.data?.users.map((user) => (
                    <UserRow
                        key={user.id}
                        user={user}
                        onChange={() =>
                            queryClient.invalidateQueries({
                                queryKey: ["admin", "users"],
                            })
                        }
                    />
                ))}
            </ul>
            {users.data && users.data.users.length < users.data.total && (
                <Button variant="tertiary" onPress={() => setLimit((l) => l + PAGE)}>
                    {t("admin.more")}
                </Button>
            )}
        </section>
    );
};

export const AdminPage: React.FC = () => {
    const { t } = useTranslation();
    const { data: session, isPending } = useSession();

    if (isPending) {
        return <Spinner size="sm" />;
    }

    if ((session?.user as { role?: string } | undefined)?.role !== "admin") {
        return <Navigate to="/" replace />;
    }

    return (
        <div className="flex max-w-4xl flex-col gap-8">
            <h1 className="text-2xl font-semibold">🛡️ {t("admin.title")}</h1>
            <DataStatus />
            <Users />
        </div>
    );
};
