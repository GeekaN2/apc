/** The item icon cache provides both standard and 2× resolutions. */
export function itemIconProps(marketId: string, size: 32 | 48 = 48, quality = 1) {
    const image = `${quality}/${encodeURIComponent(marketId)}.png`;

    return {
        src: `/item-icons/${size}/${image}`,
        srcSet: `/item-icons/${size * 2}/${image} 2x`,
    };
}
