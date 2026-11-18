import { itemIconProps } from "../../catalog/itemIcons";

export const RecipeCount: React.FC<{ children: string }> = ({ children }) => (
    <span className="block px-1 text-xs leading-tight font-semibold whitespace-nowrap tabular-nums">
        {children}
    </span>
);

export const RecipeIcon: React.FC<{
    marketId: string;
    amount: string;
    name?: string;
}> = ({ marketId, amount, name = marketId }) => (
    <span className="inline-flex flex-col items-center" title={`${name} ${amount}`}>
        <img {...itemIconProps(marketId, 32)} alt={name} className="size-7" />
        <RecipeCount>{amount}</RecipeCount>
    </span>
);
