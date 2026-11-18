import { expect, it } from "vitest";
import * as itemIcons from "../src/catalog/itemIcons.ts";

it("serves regular and high-density icons from the same origin", () => {
    expect(itemIcons.itemIconProps("T4_BAG", 32)).toEqual({
        src: "/item-icons/32/1/T4_BAG.png",
        srcSet: "/item-icons/64/1/T4_BAG.png 2x",
    });
    expect(itemIcons.itemIconProps("T4_BAG@2", 48, 4)).toEqual({
        src: "/item-icons/48/4/T4_BAG%402.png",
        srcSet: "/item-icons/96/4/T4_BAG%402.png 2x",
    });
});
