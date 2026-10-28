/**
 * Aggregation of the old average data worker, transcribed from
 * albion-profit-calculator-api: src/modules/worker/averageDataWorker.js
 * (collectDataForOneItem without the request). The old worker asked for one item at a time.
 */

interface Chart {
    location: string;
    item_id: string;
    data: { timestamps: string[]; prices_avg: number[]; item_count: number[] };
}

const cities = [
    "Black Market",
    "Bridgewatch",
    "Caerleon",
    "Fort Sterling",
    "Lymhurst",
    "Martlock",
    "Thetford",
    "Brecilien",
];

export function legacyCollectDataForOneItem(itemName: string, data: Chart[]) {
    const collectedData: Record<
        string,
        {
            amountOfItems: number;
            sumCost: number;
            averagePrice: number;
            averageItems: number;
            days: Set<string>;
        }
    > = {};

    for (const city of cities) {
        collectedData[city] = {
            amountOfItems: 0,
            sumCost: 0,
            averagePrice: 0,
            averageItems: 0,
            days: new Set(),
        };
    }

    for (const chart of data.filter((c) => c.item_id === itemName)) {
        const current = collectedData[chart.location]!;
        const chartData = chart.data;

        for (let i = 0; i < chartData.timestamps.length; i++) {
            const cost = chartData.prices_avg[i]! * chartData.item_count[i]!;

            current.days.add(chartData.timestamps[i]!);
            current.amountOfItems += chartData.item_count[i]!;
            current.sumCost += cost;
        }
    }

    for (const city in collectedData) {
        const current = collectedData[city]!;

        current.averagePrice = current.sumCost / current.amountOfItems;
        current.averageItems = current.amountOfItems / current.days.size;
    }

    return collectedData;
}
