export const SUPPORTED_LOCALES = ["en", "ha", "yo", "ig"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const LOCALE_LABELS: Record<SupportedLocale, string> = {
  en: "English",
  ha: "Hausa",
  yo: "Yorùbá",
  ig: "Igbo",
};

export const LOCALE_COOKIE_NAME = "w3u_locale";