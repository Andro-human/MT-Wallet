import { describe, it, expect } from "vitest";
import {
  canonicalMerchantCasing,
  normalizeMerchant,
} from "@/lib/merchantCanonical";

describe("normalizeMerchant", () => {
  it("lowercases and trims", () => {
    expect(normalizeMerchant("  Swiggy  ")).toBe("swiggy");
    expect(normalizeMerchant("SWIGGY")).toBe("swiggy");
  });
});

describe("canonicalMerchantCasing", () => {
  it("returns typed input unchanged when existing list is empty", () => {
    expect(canonicalMerchantCasing("swiggy", [])).toBe("swiggy");
  });

  it("picks the most-common existing casing", () => {
    const existing = ["Swiggy", "Swiggy", "Swiggy", "swiggy"];
    expect(canonicalMerchantCasing("swiggy", existing)).toBe("Swiggy");
  });

  it("falls through to typed input when no normalized match exists", () => {
    const existing = ["Amazon", "Zomato"];
    expect(canonicalMerchantCasing("swiggy", existing)).toBe("swiggy");
  });

  it("matches case-insensitively (input casing doesn't matter)", () => {
    expect(canonicalMerchantCasing("SWIGGY", ["Swiggy"])).toBe("Swiggy");
    expect(canonicalMerchantCasing("Swiggy", ["swiggy"])).toBe("swiggy");
  });

  it("ignores surrounding whitespace in existing entries", () => {
    expect(canonicalMerchantCasing("swiggy", ["  Swiggy  "])).toBe("Swiggy");
  });

  it("breaks ties by first-encountered casing (stable)", () => {
    const existing = ["Swiggy", "swiggy"];
    const result = canonicalMerchantCasing("swiggy", existing);
    expect(["Swiggy", "swiggy"]).toContain(result);
  });

  it("trims the typed input before fallback", () => {
    expect(canonicalMerchantCasing("  swiggy  ", [])).toBe("swiggy");
  });

  it("returns original input when it is only whitespace", () => {
    expect(canonicalMerchantCasing("   ", [])).toBe("   ");
  });
});
