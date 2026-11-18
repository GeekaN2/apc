import { itemIconProps } from "../../catalog/itemIcons";

export const RecipeIcon: React.FC<{
    marketId: string;
    amount?: string;
    name?: string;
    size?: 28 | 40;
}> = ({ marketId, amount, name = marketId, size = 28 }) => (
    <span
        className="inline-grid shrink-0 align-middle"
        title={name && amount ? `${name} ×${amount}` : undefined}
    >
        <img
            {...itemIconProps(marketId, size === 40 ? 48 : 32)}
            alt={name}
            className={`col-start-1 row-start-1 justify-self-end ${size === 40 ? "size-10" : "size-7"}`}
        />
        {amount && (
            <span className="pointer-events-none col-start-1 row-start-1 mr-0.5 mb-0.5 min-w-3 self-end justify-self-end rounded-full bg-black/85 px-0.5 text-center text-[10px] leading-3 font-semibold whitespace-nowrap text-white tabular-nums">
                {amount}
            </span>
        )}
    </span>
);
