import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { SUPPORTED_LOCALES, type SupportedLocale } from "./locales";

/**
 * Deliberately NOT using next-intl's locale-prefixed routing (e.g. /ha/...,
 * /yo/...) here — this app already has ~50 routes and many internal links
 * built as plain string paths (`href="/student/courses"` etc.), so adopting
 * prefixed routing would mean restructuring every route under app/[locale]/
 * and updating every internal link to be locale-aware, which is a large,
 * error-prone refactor on its own. Reading the locale from a cookie instead
 * gets language switching working without touching existing routes/links,
 * at the cost of URLs not being language-specific (a real tradeoff worth
 * revisiting later if per-language SEO becomes a priority).
 */
export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("w3u_locale")?.value;
  const locale = SUPPORTED_LOCALES.includes(cookieLocale as SupportedLocale) ? (cookieLocale as SupportedLocale) : "en";

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});