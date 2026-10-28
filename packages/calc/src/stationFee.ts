/**
 * Silver paid to the crafting station
 *
 * @param itemValue - item value of the craft, see `craftItemValue`
 * @param feePer100Nutrition - station fee set by its owner
 * @param itemValueToNutrition - nutrition per unit of item value, from game constants
 */
export function stationFee(
    itemValue: number,
    feePer100Nutrition: number,
    itemValueToNutrition: number,
): number {
    return (itemValue * itemValueToNutrition * feePer100Nutrition) / 100;
}
