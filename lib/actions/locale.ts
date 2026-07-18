"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { LOCALE_COOKIE_NAME, SUPPORTED_LOCALES, type SupportedLocale } from "@/i18n/locales";

export async function setLocaleAction(locale: string) {
  if (!SUPPORTED_LOCALES.includes(locale as SupportedLocale)) {
    return { error: "Unsupported language." };
  }
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE_NAME, locale, {
    maxAge: 60 * 60 * 24 * 365, // 1 year
    path: "/",
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
  return { error: null };
}