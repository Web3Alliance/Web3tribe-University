/**
 * Course documents live in the PRIVATE "course-documents" storage bucket (migration 0024).
 * The database stores the file's original public-style URL; this turns it into a link to our
 * own download route, which checks the visitor is entitled to the file and then redirects to a
 * short-lived signed link. URLs for any other bucket/host are returned unchanged.
 */
const MARKER = "/storage/v1/object/public/course-documents/";

/** Returns the object path inside the bucket (e.g. "<uid>/123-abc.pdf"), or null if not one of ours. */
export function courseDocumentPath(fileUrl: string | null | undefined): string | null {
  if (!fileUrl) return null;
  const i = fileUrl.indexOf(MARKER);
  if (i === -1) return null;
  const raw = fileUrl.slice(i + MARKER.length).split("?")[0];
  try {
    const path = decodeURIComponent(raw);
    if (!path || path.includes("..") || path.startsWith("/")) return null;
    return path;
  } catch {
    return null;
  }
}

export function documentHref(fileUrl: string): string {
  const path = courseDocumentPath(fileUrl);
  return path ? `/api/files/document?path=${encodeURIComponent(path)}` : fileUrl;
}
