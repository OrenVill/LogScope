import { describe, expect, it } from "vitest";
import { shouldReadLandingForHour } from "../landingHour.js";

describe("shouldReadLandingForHour", () => {
  it("reads landing when includeLanding is on and no compacted objects exist", () => {
    expect(
      shouldReadLandingForHour({
        includeLanding: true,
        hasInfoObject: false,
        hasDurableObject: false,
      })
    ).toBe(true);
  });

  it("skips landing when an info object exists for the hour", () => {
    expect(
      shouldReadLandingForHour({
        includeLanding: true,
        hasInfoObject: true,
        hasDurableObject: false,
      })
    ).toBe(false);
  });

  it("skips landing when a durable object exists for the hour", () => {
    expect(
      shouldReadLandingForHour({
        includeLanding: true,
        hasInfoObject: false,
        hasDurableObject: true,
      })
    ).toBe(false);
  });

  it("skips landing when includeLanding is false", () => {
    expect(
      shouldReadLandingForHour({
        includeLanding: false,
        hasInfoObject: false,
        hasDurableObject: false,
      })
    ).toBe(false);
  });
});
