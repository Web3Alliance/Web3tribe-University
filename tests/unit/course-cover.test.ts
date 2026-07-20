import { describe, it, expect } from "vitest";
import { generateCourseCoverSvg } from "@/lib/course-cover";

describe("generateCourseCoverSvg", () => {
  it("produces well-formed SVG with the correct dimensions", () => {
    const svg = generateCourseCoverSvg("Introduction to Artificial Intelligence", "Artificial Intelligence");
    expect(svg).toContain('width="1280"');
    expect(svg).toContain('height="720"');
    expect(svg.trim().startsWith("<svg")).toBe(true);
    expect(svg.trim().endsWith("</svg>")).toBe(true);
  });

  it("includes the course title text somewhere in the output", () => {
    const svg = generateCourseCoverSvg("Introduction to Artificial Intelligence", "Artificial Intelligence");
    // Wrapped across tspans, so check for a substring rather than the exact phrase
    expect(svg).toContain("Introduction");
    expect(svg).toContain("Intelligence");
  });

  it("uppercases and includes the category badge text", () => {
    const svg = generateCourseCoverSvg("Some Course", "Cybersecurity");
    expect(svg).toContain("CYBERSECURITY");
  });

  it("falls back to a platform label when no category is provided", () => {
    const svg = generateCourseCoverSvg("Some Course", null);
    expect(svg).toContain("WEB3TRIBE UNIVERSITY");
  });

  it("escapes XML-unsafe characters in the title so the SVG stays well-formed", () => {
    const svg = generateCourseCoverSvg('Learn "AI" & <Machine Learning>', "AI");
    expect(svg).not.toContain('"AI"');
    expect(svg).not.toContain("<Machine");
    expect(svg).toContain("&amp;");
    expect(svg).toContain("&quot;");
    expect(svg).toContain("&lt;Machine");
  });

  it("handles a very long title without throwing, and keeps it within 3 lines", () => {
    const longTitle =
      "An Extremely Long And Detailed Course Title About Advanced Machine Learning Techniques For Enterprise Applications In Nigeria";
    expect(() => generateCourseCoverSvg(longTitle, "AI")).not.toThrow();
    const svg = generateCourseCoverSvg(longTitle, "AI");
    const tspanCount = (svg.match(/<tspan/g) ?? []).length;
    expect(tspanCount).toBeLessThanOrEqual(3);
  });

  it("wraps a short title onto a single line", () => {
    const svg = generateCourseCoverSvg("Python Basics", "Software Development");
    const tspanCount = (svg.match(/<tspan/g) ?? []).length;
    expect(tspanCount).toBe(1);
  });
});