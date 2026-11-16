import { describe, expect, it } from "vitest";
import { courseDocumentPath, documentHref } from "@/lib/document-links";

const BASE = "https://x.supabase.co/storage/v1/object/public/course-documents";

describe("course document links", () => {
  it("extracts the object path from a stored public-style URL", () => {
    expect(courseDocumentPath(`${BASE}/u1/123-abc.pdf`)).toBe("u1/123-abc.pdf");
    expect(courseDocumentPath(`${BASE}/u1/my%20notes.pdf?t=1`)).toBe("u1/my notes.pdf");
  });
  it("rejects other buckets, traversal and empties", () => {
    expect(courseDocumentPath("https://x.supabase.co/storage/v1/object/public/avatars/u1/a.png")).toBeNull();
    expect(courseDocumentPath(`${BASE}/../secret`)).toBeNull();
    expect(courseDocumentPath(`${BASE}/`)).toBeNull();
    expect(courseDocumentPath(null)).toBeNull();
  });
  it("routes course documents through the download endpoint and leaves other links alone", () => {
    expect(documentHref(`${BASE}/u1/a b.pdf`)).toBe("/api/files/document?path=u1%2Fa%20b.pdf");
    expect(documentHref("https://example.com/file.pdf")).toBe("https://example.com/file.pdf");
  });
});
