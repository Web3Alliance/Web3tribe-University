import { describe, expect, it } from "vitest";
import { checkUpload, detectFileType, svgIsSafe } from "@/lib/file-signature";

const bytes = (...n: number[]) => new Uint8Array([...n, 0, 0, 0, 0, 0, 0, 0, 0]);
const text = (s: string) => new TextEncoder().encode(s);

describe("detectFileType", () => {
  it("recognises common formats by their first bytes", () => {
    expect(detectFileType(text("%PDF-1.7 ..."))?.mime).toBe("application/pdf");
    expect(detectFileType(bytes(0x89, 0x50, 0x4e, 0x47))?.mime).toBe("image/png");
    expect(detectFileType(bytes(0xff, 0xd8, 0xff, 0xe0))?.mime).toBe("image/jpeg");
    expect(detectFileType(bytes(0x50, 0x4b, 0x03, 0x04))?.mime).toBe("application/zip");
  });
  it("recognises HTML and SVG text", () => {
    expect(detectFileType(text("<!DOCTYPE html><html></html>"))?.mime).toBe("text/html");
    expect(detectFileType(text("<svg xmlns='http://www.w3.org/2000/svg'></svg>"))?.mime).toBe("image/svg+xml");
    expect(detectFileType(text("just some notes"))?.mime).toBe("text/plain");
  });
  it("returns null for unknown binary", () => {
    expect(detectFileType(bytes(0x01, 0x02, 0x03, 0x04))).toBeNull();
  });
});

describe("checkUpload", () => {
  it("accepts a real PDF in documents, rejects it as an avatar", () => {
    expect(checkUpload("course-documents", text("%PDF-1.4 hello")).ok).toBe(true);
    expect(checkUpload("avatars", text("%PDF-1.4 hello")).ok).toBe(false);
  });
  it("rejects HTML wherever it is declared as something else", () => {
    const html = text("<html><script>alert(1)</script></html>");
    for (const b of ["course-documents", "assignments", "course-images", "avatars"] as const) {
      expect(checkUpload(b, html).ok).toBe(false);
    }
  });
  it("rejects an executable pretending to be an image", () => {
    expect(checkUpload("course-images", bytes(0x4d, 0x5a, 0x90, 0x00)).ok).toBe(false);
  });
  it("accepts clean SVG for course images only, and refuses SVG with scripts", () => {
    const clean = "<svg xmlns='http://www.w3.org/2000/svg'><rect width='1' height='1'/></svg>";
    expect(checkUpload("course-images", text(clean), clean).ok).toBe(true);
    expect(checkUpload("avatars", text(clean), clean).ok).toBe(false);
    const evil = "<svg xmlns='http://www.w3.org/2000/svg' onload='alert(1)'><script>1</script></svg>";
    expect(checkUpload("course-images", text(evil), evil).ok).toBe(false);
    expect(svgIsSafe(evil)).toBe(false);
  });
  it("returns the detected type and extension, not what the sender claimed", () => {
    const r = checkUpload("course-images", bytes(0x89, 0x50, 0x4e, 0x47));
    expect(r).toEqual({ ok: true, mime: "image/png", ext: "png" });
  });
});
