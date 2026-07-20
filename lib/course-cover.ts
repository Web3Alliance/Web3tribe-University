/**
 * Generates an official, on-brand course cover as an SVG string — no
 * canvas/sharp/native image library involved, since those are frequently
 * unreliable in serverless deploy environments (Netlify Functions included).
 * Browsers render SVG perfectly fine as a plain <img src>, which is exactly
 * how thumbnail_url is already used everywhere in this app.
 *
 * Deliberately uses system-safe font stacks (not a custom embedded font)
 * because external font loading is unreliable when an SVG is referenced as
 * an <img> src rather than inlined directly into HTML.
 *
 * Word-wrapping here is estimated by character count rather than measured
 * text width (no canvas/DOM available server-side to measure real glyph
 * widths) — conservative enough in practice for course titles, but not
 * pixel-perfect the way the one-off PNG generated with PIL/Pillow was.
 */

const GREEN = "#0B5E3A";
const GREEN_DARK = "#072B14";
const GOLD = "#B8860B";
const WHITE = "#FFFFFF";
const CREAM = "#FAF6E8";

const W = 1280;
const H = 720;

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function wrapByChars(text: string, maxCharsPerLine: number, maxLines = 3): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (test.length <= maxCharsPerLine) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);

  if (lines.length > maxLines) {
    // Collapse overflow into the last allowed line rather than silently
    // dropping words — a course with an unusually long title still gets
    // a readable (if tighter) cover instead of a truncated title.
    const kept = lines.slice(0, maxLines - 1);
    const rest = lines.slice(maxLines - 1).join(" ");
    kept.push(rest);
    return kept;
  }
  return lines;
}

export function generateCourseCoverSvg(title: string, categoryName: string | null): string {
  const safeTitle = escapeXml(title);
  const category = (categoryName ?? "Web3tribe University").toUpperCase();
  const safeCategory = escapeXml(category);

  // Font size steps down as line count grows, mirroring the PNG generator's
  // "shrink until it fits in 3 lines" behavior.
  let fontSize = 72;
  let lines = wrapByChars(safeTitle, 22);
  while (lines.length > 3 && fontSize > 44) {
    fontSize -= 6;
    lines = wrapByChars(safeTitle, Math.round(22 * (72 / fontSize)));
  }

  const lineHeight = Math.round(fontSize * 1.2);
  const badgeY = 250;
  const titleStartY = badgeY + 100;

  const titleTspans = lines
    .map((line, i) => `<tspan x="${W / 2}" y="${titleStartY + i * lineHeight}">${line}</tspan>`)
    .join("");

  const wordmark = "WEB3TRIBE UNIVERSITY";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <clipPath id="canvas-clip"><rect x="0" y="0" width="${W}" height="${H}"/></clipPath>
  </defs>
  <g clip-path="url(#canvas-clip)">
    <rect x="0" y="0" width="${W}" height="${H}" fill="${GREEN}"/>
    <g opacity="0.14" fill="${GREEN_DARK}">
      ${Array.from({ length: 8 }, (_, i) => {
        const x = (i - 2) * 220;
        return `<polygon points="${x},0 ${x + 120},0 ${x - 200},${H} ${x - 320},${H}"/>`;
      }).join("\n      ")}
    </g>
    <rect x="0" y="0" width="${W}" height="10" fill="${GOLD}"/>
    <text x="64" y="72" font-family="Arial Black, Arial, sans-serif" font-weight="700" font-size="28"
      letter-spacing="4" fill="${GOLD}">${escapeXml(wordmark)}</text>
    <rect x="${W / 2 - safeCategory.length * 7 - 28}" y="${badgeY}" width="${safeCategory.length * 14 + 56}" height="52"
      rx="26" fill="none" stroke="${GOLD}" stroke-width="2"/>
    <text x="${W / 2}" y="${badgeY + 34}" font-family="Arial, sans-serif" font-size="24"
      fill="${GOLD}" text-anchor="middle">${safeCategory}</text>
    <text font-family="Arial Black, Arial, sans-serif" font-weight="700" font-size="${fontSize}"
      fill="${WHITE}" text-anchor="middle">${titleTspans}</text>
    <line x1="64" y1="${H - 84}" x2="${W - 64}" y2="${H - 84}" stroke="${GOLD}" stroke-width="2"/>
    <text x="${W / 2}" y="${H - 44}" font-family="Arial, sans-serif" font-size="22"
      fill="${CREAM}" text-anchor="middle">Learn.  Build.  Earn.</text>
  </g>
</svg>`;
}