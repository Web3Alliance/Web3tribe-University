/**
 * Detects the video source type of a lesson's content_url and produces an
 * embeddable URL so it plays inline (in an iframe or native <video>) instead
 * of just linking out.
 *
 * Supported sources:
 *   - Google Drive share links (several URL shapes Drive can produce)
 *   - YouTube (watch, youtu.be, shorts, already-embed URLs)
 *   - Vimeo
 *   - Direct video files (our own Supabase Storage uploads, or any other
 *     direct .mp4/.webm/.ogg/.mov URL) — rendered with a native <video> tag
 *
 * Google Drive caveat (documented here rather than hidden in a comment
 * nobody reads): the file must be shared as "Anyone with the link" or the
 * embedded iframe will show Drive's access-denied screen instead of the
 * video. Drive also isn't a dedicated video CDN — it can throttle heavily
 * viewed files — so direct Supabase Storage uploads remain the more
 * reliable option for anything watched by large numbers of students.
 */

export type VideoEmbedType = "google-drive" | "youtube" | "vimeo" | "direct" | "unknown";

export interface VideoEmbedInfo {
  type: VideoEmbedType;
  /** The URL to actually put in an <iframe src> or <video src>. Null if we
   * couldn't confidently resolve one — callers should fall back to a plain
   * "Open link" button in that case rather than an empty/broken embed. */
  embedUrl: string | null;
}

export function resolveVideoEmbed(url: string | null | undefined): VideoEmbedInfo {
  if (!url) return { type: "unknown", embedUrl: null };
  const trimmed = url.trim();

  // --- Google Drive -------------------------------------------------------
  // Shape 1: https://drive.google.com/file/d/FILE_ID/view?usp=sharing
  let m = trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return { type: "google-drive", embedUrl: `https://drive.google.com/file/d/${m[1]}/preview` };

  // Shape 2: https://drive.google.com/open?id=FILE_ID
  m = trimmed.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
  if (m) return { type: "google-drive", embedUrl: `https://drive.google.com/file/d/${m[1]}/preview` };

  // Shape 3: https://drive.google.com/uc?id=FILE_ID&export=download (or similar)
  m = trimmed.match(/drive\.google\.com\/uc\?(?:export=[a-z]+&)?id=([a-zA-Z0-9_-]+)/);
  if (m) return { type: "google-drive", embedUrl: `https://drive.google.com/file/d/${m[1]}/preview` };

  // Shape 4: already an embed/preview URL — pass through as-is
  m = trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)\/preview/);
  if (m) return { type: "google-drive", embedUrl: trimmed };

  // --- YouTube --------------------------------------------------------------
  m = trimmed.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{6,})/
  );
  if (m) return { type: "youtube", embedUrl: `https://www.youtube.com/embed/${m[1]}` };

  // --- Vimeo ------------------------------------------------------------
  m = trimmed.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (m) return { type: "vimeo", embedUrl: `https://player.vimeo.com/video/${m[1]}` };

  // --- Direct video file (our own Supabase Storage uploads, or any other
  // direct link ending in a common video extension) ----------------------
  if (/\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(trimmed) || /supabase\.co\/storage\//.test(trimmed)) {
    return { type: "direct", embedUrl: trimmed };
  }

  return { type: "unknown", embedUrl: trimmed };
}