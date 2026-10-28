import { Database } from "@gravity-ui/icons";
import { ListBox, Select } from "@heroui/react";
import { useTranslation } from "react-i18next";
import { useCurrentServer, useServers } from "../../api/servers";
import { useServerStore } from "../../store/server";

/** Server whose prices all calculators use */
export const ServerSelect: React.FC = () => {
    const { t } = useTranslation();
    const { data: servers = [], isPending } = useServers();
    const server = useCurrentServer();
    const setServerId = useServerStore((state) => state.setServerId);

    return (
        <Select
            aria-label={t("server.label")}
            placeholder={isPending ? t("server.loading") : t("server.label")}
            isDisabled={isPending}
            value={server?.id ?? null}
            onChange={(key) => {
                if (key !== null) {
                    setServerId(String(key));
                }
            }}
            className="w-44"
        >
            <Select.Trigger>
                <Database className="size-4 shrink-0 text-muted" />
                <Select.Value />
                <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
                <ListBox>
                    {servers.map(({ id, name, isPublic }) => (
                        <ListBox.Item key={id} id={id} textValue={name}>
                            {name}
                            {!isPublic && (
                                <span className="text-xs text-muted">
                                    {t("server.private")}
                                </span>
                            )}
                            <ListBox.ItemIndicator />
                        </ListBox.Item>
                    ))}
                </ListBox>
            </Select.Popover>
        </Select>
    );
};
