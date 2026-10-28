/** Nutrition a craft uses per unit of its item value */
export const NUTRITION_PER_ITEM_VALUE = 0.1125;

/**
 * Silver paid to the crafting station
 *
 * @param itemValue - item value of the craft, see `recipeItemValue`
 * @param feePer100Nutrition - station fee set by its owner
 */
export function stationFee(itemValue: number, feePer100Nutrition: number): number {
    return (itemValue * NUTRITION_PER_ITEM_VALUE * feePer100Nutrition) / 100;
}
