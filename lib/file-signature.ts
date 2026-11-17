/**
 * Upload content checks. The browser-declared MIME type (File.type) is just a string the sender
 * chooses, so a hostile file can claim to be a PDF. We read the file's first bytes ("magic
 * bytes"), work out what it really is, and only accept it when that matches what the bucket
 * allows. The type we store and serve is the DETECTED one, never the declared one.
 */
export type DetectedType = { mime: string; ext: string };

const startsWith = (b: Uint8Array, sig: number[], offset = 0) => sig.every((v, i) => b[offset + i] === v);
const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.slice(from, to));

function looksLikeText(b: Uint8Array): boolean {
  const n = Math.min(b.length, 4096);
  for (let i = 0; i < n; i++) {
    const c = b[i];
    if (c === 0) return false;
    if (c < 9 || (c > 13 && c < 32)) return false;
  }
  return true;
}

/** Returns the real type for the formats the platform accepts, or null when unrecognised. */
export function detectFileType(bytes: Uint8Array): DetectedType | null {
  if (bytes.length < 4) return null;
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46])) return { mime: "application/pdf", ext: "pdf" };
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) return { mime: "image/png", ext: "png" };
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return { mime: "image/jpeg", ext: "jpg" };
  if (ascii(bytes, 0, 4) === "GIF8") return { mime: "image/gif", ext: "gif" };
  if (ascii(bytes, 0, 4) === "RIFF" && bytes.length >= 12) {
    const kind = ascii(bytes, 8, 12);
    if (kind === "WEBP") return { mime: "image/webp", ext: "webp" };
    if (kind === "WAVE") return { mime: "audio/wav", ext: "wav" };
    if (kind === "AVI ") return { mime: "video/x-msvideo", ext: "avi" };
  }
  if (bytes.length >= 12 && ascii(bytes, 4, 8) === "ftyp") {
    const brand = ascii(bytes, 8, 12);
    if (brand === "qt  ") return { mime: "video/quicktime", ext: "mov" };
    if (brand.startsWith("M4A")) return { mime: "audio/mp4", ext: "m4a" };
    return { mime: "video/mp4", ext: "mp4" };
  }
  if (startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3])) return { mime: "video/webm", ext: "webm" };
  if (ascii(bytes, 0, 4) === "OggS") return { mime: "audio/ogg", ext: "ogg" };
  if (ascii(bytes, 0, 3) === "ID3" || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)) return { mime: "audio/mpeg", ext: "mp3" };
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) return { mime: "application/zip", ext: "zip" }; // zip and OOXML (docx/xlsx/pptx)
  if (startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0])) return { mime: "application/x-ole-storage", ext: "doc" }; // legacy .doc/.xls/.ppt
  const head = looksLikeText(bytes) ? new TextDecoder("utf-8", { fatal: false }).decode(bytes.slice(0, 4096)).trimStart().toLowerCase() : null;
  if (head !== null) {
    if (head.startsWith("<svg") || (head.startsWith("<?xml") && head.includes("<svg"))) return { mime: "image/svg+xml", ext: "svg" };
    if (head.startsWith("<!doctype html") || head.startsWith("<html") || head.includes("<script")) return { mime: "text/html", ext: "html" };
    return { mime: "text/plain", ext: "txt" };
  }
  return null;
}

/** SVG can carry script. Only accept SVG with no active content at all. */
export function svgIsSafe(text: string): boolean {
  const t = text.toLowerCase();
  return !(/<script|<foreignobject|<iframe|<object|<embed|javascript:|data:text\/html|\son[a-z]+\s*=/.test(t));
}

export type UploadBucket = "course-videos" | "course-documents" | "course-images" | "avatars" | "assignments";

const DOC_TYPES = ["application/pdf", "application/zip", "application/x-ole-storage", "text/plain"];
const ALLOWED_DETECTED: Record<UploadBucket, string[]> = {
  "course-videos": ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo", "audio/mpeg", "audio/mp4", "audio/ogg", "audio/wav"],
  "course-documents": DOC_TYPES,
  "course-images": ["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"],
  avatars: ["image/png", "image/jpeg", "image/gif", "image/webp"],
  assignments: [...DOC_TYPES, "image/png", "image/jpeg"],
};

export type UploadCheck = { ok: true; mime: string; ext: string } | { ok: false; reason: string };

/**
 * @param head the first bytes of the file (a few KB is enough)
 * @param fullTextForSvg only needed for SVG: the file as text, to check it has no active content
 */
export function checkUpload(bucket: UploadBucket, head: Uint8Array, fullTextForSvg?: string): UploadCheck {
  const detected = detectFileType(head);
  if (!detected) return { ok: false, reason: "We couldn't recognise this file type." };
  if (detected.mime === "text/html") return { ok: false, reason: "HTML files can't be uploaded." };
  if (!ALLOWED_DETECTED[bucket].includes(detected.mime)) {
    return { ok: false, reason: `This kind of file (${detected.ext.toUpperCase()}) isn't allowed here.` };
  }
  if (detected.mime === "image/svg+xml" && !svgIsSafe(fullTextForSvg ?? "")) {
    return { ok: false, reason: "This SVG contains scripts or active content and can't be uploaded." };
  }
  return { ok: true, mime: detected.mime === "application/x-ole-storage" ? "application/msword" : detected.mime, ext: detected.ext };
}
