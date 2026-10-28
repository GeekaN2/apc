import { itemIconUrl } from "../../catalog/catalog";

export interface IconOption<T extends string> {
    id: T;
    /** Market id of the item whose icon stands for the option */
    icon: string;
    label: string;
}

/** A row of item icons with one selected */
export function IconPicker<T extends string>({
    label,
    options,
    value,
    onChange,
    size = "md",
}: {
    label: string;
    options: readonly IconOption<T>[];
    value: T | undefined;
    onChange: (id: T) => void;
    size?: "sm" | "md";
}) {
    const iconSize = size === "sm" ? "size-9" : "size-11";

    return (
        <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1">
            {options.map((option) => {
                const selected = option.id === value;

                return (
                    <button
                        key={option.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        aria-label={option.label}
                        title={option.label}
                        onClick={() => onChange(option.id)}
                        className={`rounded-lg p-0.5 outline-offset-1 transition-colors focus-visible:outline-2 ${
                            selected
                                ? "bg-accent-soft ring-2 ring-accent"
                                : "opacity-80 hover:bg-default hover:opacity-100"
                        }`}
                    >
                        <img
                            src={itemIconUrl(option.icon, 64)}
                            alt=""
                            loading="lazy"
                            className={iconSize}
                        />
                    </button>
                );
            })}
        </div>
    );
}
