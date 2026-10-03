import { afterEach, describe, expect, it, vi } from "vitest";
import { applyTheme, THEME_STORAGE_KEY } from "./themes";

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("applyTheme", () => {
    it("clears the active and stored theme when selecting aurora", () => {
        const dataset: { theme?: string } = { theme: "matrix" };
        const removeItem = vi.fn();

        vi.stubGlobal("document", { documentElement: { dataset } });
        vi.stubGlobal("localStorage", { removeItem });

        applyTheme("aurora");

        expect(dataset.theme).toBeUndefined();
        expect(removeItem).toHaveBeenCalledWith(THEME_STORAGE_KEY);
    });
});