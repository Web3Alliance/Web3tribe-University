import { describe, it, expect } from "vitest";
import { resolveVideoEmbed } from "@/lib/media-embed";

describe("resolveVideoEmbed — Google Drive", () => {
  it("resolves a standard /file/d/.../view share link", () => {
    const result = resolveVideoEmbed(
      "https://drive.google.com/file/d/1A2B3C4D5E6F7G8H9I0J/view?usp=sharing"
    );
    expect(result.type).toBe("google-drive");
    expect(result.embedUrl).toBe("https://drive.google.com/file/d/1A2B3C4D5E6F7G8H9I0J/preview");
  });

  it("resolves an /open?id= link", () => {
    const result = resolveVideoEmbed("https://drive.google.com/open?id=1A2B3C4D5E6F7G8H9I0J");
    expect(result.type).toBe("google-drive");
    expect(result.embedUrl).toBe("https://drive.google.com/file/d/1A2B3C4D5E6F7G8H9I0J/preview");
  });

  it("resolves a /uc?id= download link", () => {
    const result = resolveVideoEmbed("https://drive.google.com/uc?export=download&id=1A2B3C4D5E6F7G8H9I0J");
    expect(result.type).toBe("google-drive");
    expect(result.embedUrl).toBe("https://drive.google.com/file/d/1A2B3C4D5E6F7G8H9I0J/preview");
  });

  it("passes through an already-formed /preview embed URL unchanged", () => {
    const result = resolveVideoEmbed("https://drive.google.com/file/d/1A2B3C4D5E6F7G8H9I0J/preview");
    expect(result.type).toBe("google-drive");
    expect(result.embedUrl).toBe("https://drive.google.com/file/d/1A2B3C4D5E6F7G8H9I0J/preview");
  });
});

describe("resolveVideoEmbed — YouTube", () => {
  it("resolves a standard watch?v= URL", () => {
    const result = resolveVideoEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(result.type).toBe("youtube");
    expect(result.embedUrl).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ");
  });

  it("resolves a youtu.be short link", () => {
    const result = resolveVideoEmbed("https://youtu.be/dQw4w9WgXcQ");
    expect(result.type).toBe("youtube");
    expect(result.embedUrl).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ");
  });

  it("resolves a watch URL with extra query params (e.g. a playlist/timestamp)", () => {
    const result = resolveVideoEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s&list=PL123");
    expect(result.type).toBe("youtube");
    expect(result.embedUrl).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ");
  });

  it("resolves a Shorts URL", () => {
    const result = resolveVideoEmbed("https://www.youtube.com/shorts/dQw4w9WgXcQ");
    expect(result.type).toBe("youtube");
    expect(result.embedUrl).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ");
  });

  it("passes through an already-formed embed URL", () => {
    const result = resolveVideoEmbed("https://www.youtube.com/embed/dQw4w9WgXcQ");
    expect(result.type).toBe("youtube");
    expect(result.embedUrl).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ");
  });
});

describe("resolveVideoEmbed — Vimeo", () => {
  it("resolves a standard Vimeo URL", () => {
    const result = resolveVideoEmbed("https://vimeo.com/123456789");
    expect(result.type).toBe("vimeo");
    expect(result.embedUrl).toBe("https://player.vimeo.com/video/123456789");
  });
});

describe("resolveVideoEmbed — direct video files", () => {
  it("resolves a direct .mp4 URL", () => {
    const result = resolveVideoEmbed("https://example.com/videos/lesson1.mp4");
    expect(result.type).toBe("direct");
    expect(result.embedUrl).toBe("https://example.com/videos/lesson1.mp4");
  });

  it("resolves a Supabase Storage URL even without a recognizable extension", () => {
    const result = resolveVideoEmbed(
      "https://abcxyz.supabase.co/storage/v1/object/public/course-videos/abc123-def456.mp4"
    );
    expect(result.type).toBe("direct");
  });

  it("resolves a .webm URL with query params", () => {
    const result = resolveVideoEmbed("https://example.com/lesson.webm?token=abc123");
    expect(result.type).toBe("direct");
  });
});

describe("resolveVideoEmbed — edge cases", () => {
  it("returns unknown type with null embedUrl for empty input", () => {
    expect(resolveVideoEmbed("")).toEqual({ type: "unknown", embedUrl: null });
  });

  it("returns unknown type with null embedUrl for null/undefined", () => {
    expect(resolveVideoEmbed(null)).toEqual({ type: "unknown", embedUrl: null });
    expect(resolveVideoEmbed(undefined)).toEqual({ type: "unknown", embedUrl: null });
  });

  it("falls back to 'unknown' but still returns the URL for an unrecognized link", () => {
    const result = resolveVideoEmbed("https://example.com/some-random-page");
    expect(result.type).toBe("unknown");
    expect(result.embedUrl).toBe("https://example.com/some-random-page");
  });

  it("trims whitespace before matching", () => {
    const result = resolveVideoEmbed("   https://youtu.be/dQw4w9WgXcQ   ");
    expect(result.type).toBe("youtube");
  });
});