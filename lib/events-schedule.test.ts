import { describe, expect, it } from "vitest";
import { getNextEvent } from "./events-schedule";

describe("getNextEvent", () => {
    it("returns the next scheduled event after the supplied date", () => {
        const event = getNextEvent(new Date(2026, 6, 21));

        expect(event?.id).toBe(2);
        expect(event?.date).toEqual(new Date(2026, 6, 27));
    });

    it("includes an event later on the same calendar day", () => {
        const event = getNextEvent(new Date(2026, 6, 20, 23, 59));

        expect(event?.id).toBe(1);
        expect(event?.date).toEqual(new Date(2026, 6, 20));
    });

    it("returns null when the supplied date is after every scheduled event", () => {
        expect(getNextEvent(new Date(2027, 5, 29))).toBeNull();
    });
});