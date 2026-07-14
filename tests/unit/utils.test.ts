import { describe, it, expect } from "vitest";
import { slugify, initials, formatW3TR } from "@/lib/utils";

describe("slugify", () => {
  it("converts a title to a URL-safe slug", () => {
    expect(slugify("Introduction to Artificial Intelligence")).toBe("introduction-to-artificial-intelligence");
  });

  it("strips special characters", () => {
    expect(slugify("Node.js & React: The Complete Guide!")).toBe("nodejs-react-the-complete-guide");
  });

  it("collapses multiple spaces and trims hyphens", () => {
    expect(slugify("  Hello   World  ")).toBe("hello-world");
  });
});

describe("initials", () => {
  it("returns two-letter initials for a full name", () => {
    expect(initials("Ada Lovelace")).toBe("AL");
  });

  it("returns a fallback for null or undefined names", () => {
    expect(initials(null)).toBe("??");
    expect(initials(undefined)).toBe("??");
  });

  it("handles a single-word name", () => {
    expect(initials("Cher")).toBe("C");
  });
});

describe("formatW3TR", () => {
  it("formats a numeric amount with thousands separators", () => {
    expect(formatW3TR(1234)).toBe("1,234");
  });

  it("accepts a string amount", () => {
    expect(formatW3TR("500")).toBe("500");
  });

  it("rounds to at most 2 decimal places", () => {
    expect(formatW3TR(10.5678)).toBe("10.57");
  });
});
