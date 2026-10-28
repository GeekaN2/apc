/**
 * Transportations and price selection of the old calculator, transcribed from
 * albion-profit-calculator-api: src/modules/transportations/index.js (the /sort route)
 * and src/modules/worker/utils.js (normalizedPriceAndDate). `Date.now()` is a parameter.
 */

export interface LegacyQuote {
    itemId: string;
    sellPriceMin: number;
    sellPriceMinDate: number;
    buyPriceMax: number;
    buyPriceMaxDate: number;
    averageItems: number;
}

export interface LegacyRoute {
    from: LegacyQuote;
    to: LegacyQuote;
}

export type LegacySort =
    "BY_PERCENTAGE_PROFIT" | "BY_PROFIT" | "BY_LAST_TIME_CHECKED" | "BY_PROFIT_VOLUME";

/** transportations/index.js: the /sort route without the HTTP and Mongo parts */
export function legacySortRoutes(routes: LegacyRoute[], sort: LegacySort[], now: number) {
    const isOutdated = (date: number) => {
        const oneDayBefore = now - 24 * 60 * 60 * 1000;

        return new Date(date).valueOf() <= oneDayBefore;
    };

    const getFromItemPrice = (route: LegacyRoute) => route.from.sellPriceMin;
    const getToItemPrice = (route: LegacyRoute) => {
        const marketFee = 6.5;

        return (route.to.sellPriceMin * (100 - marketFee)) / 100;
    };
    const isNotValidTransportation = (route: LegacyRoute) =>
        route.from.sellPriceMin === 0;
    const getOudationValue = (route: LegacyRoute) => {
        if (isNotValidTransportation(route)) {
            return -Infinity;
        }

        return (
            Number(!isOutdated(route.from.sellPriceMinDate)) +
            Number(!isOutdated(route.to.sellPriceMinDate))
        );
    };
    const getRealProfit = (route: LegacyRoute) => {
        if (isNotValidTransportation(route)) {
            return -Infinity;
        }

        return getToItemPrice(route) - getFromItemPrice(route);
    };
    const getPercentageProfit = (route: LegacyRoute) => {
        if (isNotValidTransportation(route)) {
            return -Infinity;
        }

        return (getRealProfit(route) / getFromItemPrice(route)) * 100;
    };
    const getProfitVolume = (route: LegacyRoute) => {
        if (isNotValidTransportation(route)) {
            return -Infinity;
        }

        return getRealProfit(route) * route.to.averageItems;
    };

    const sorted = [...routes].sort((items1, items2) => {
        if (sort.includes("BY_LAST_TIME_CHECKED")) {
            if (getOudationValue(items1) < getOudationValue(items2)) {
                return 1;
            } else if (getOudationValue(items1) > getOudationValue(items2)) {
                return -1;
            }
        }

        if (sort.includes("BY_PERCENTAGE_PROFIT")) {
            return getPercentageProfit(items2) - getPercentageProfit(items1);
        }

        if (sort.includes("BY_PROFIT")) {
            return getRealProfit(items2) - getRealProfit(items1);
        }

        if (sort.includes("BY_PROFIT_VOLUME")) {
            return getProfitVolume(items2) - getProfitVolume(items1);
        }

        return 0;
    });

    return sorted.map((route) => ({
        itemId: route.from.itemId,
        profit: getRealProfit(route),
        percentageProfit: getPercentageProfit(route),
        profitVolume: getProfitVolume(route),
        freshness: getOudationValue(route),
    }));
}

/** worker/utils.js: normalizedPriceAndDate, which side of the market to use */
export function legacyNormalizedPrice(item: LegacyQuote, now: number) {
    const previousDay = new Date(now - 24 * 60 * 60 * 1000);
    const sellPriceRespone = { price: item.sellPriceMin, kind: "sellOrder" as const };
    const buyPriceResponse = { price: item.buyPriceMax, kind: "buyOrder" as const };

    if (item.sellPriceMin != 0 && item.buyPriceMax == 0) {
        return sellPriceRespone;
    }

    if (item.sellPriceMin == 0 && item.buyPriceMax != 0) {
        return buyPriceResponse;
    }

    if (item.sellPriceMin == 0 && item.buyPriceMax == 0) {
        return buyPriceResponse;
    }

    if (
        new Date(item.sellPriceMinDate) >= previousDay &&
        new Date(item.buyPriceMaxDate) <= previousDay
    ) {
        return sellPriceRespone;
    }

    if (
        new Date(item.sellPriceMinDate) <= previousDay &&
        new Date(item.buyPriceMaxDate) >= previousDay
    ) {
        return buyPriceResponse;
    }

    // Compare prices with fee,
    if (item.buyPriceMax * 0.97 > item.sellPriceMin * 0.955) {
        return buyPriceResponse;
    }

    return sellPriceRespone;
}
