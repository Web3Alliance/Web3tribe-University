"use client";
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Languages } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { setLocaleAction } from "@/lib/actions/locale";
import { SUPPORTED_LOCALES, LOCALE_LABELS, type SupportedLocale } from "@/i18n/locales";

export function LanguageSwitcher() {
  const locale = useLocale() as SupportedLocale;
  const t = useTranslations("languageSwitcher");
  const [isPending, startTransition] = React.useTransition();

  function handleSelect(next: SupportedLocale) {
    if (next === locale) return;
    startTransition(async () => {
      await setLocaleAction(next);
      // A full reload (rather than router.refresh()) ensures every already
      // -rendered Server Component on the page picks up the new locale's
      // messages immediately, rather than only newly-navigated ones.
      window.location.reload();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" disabled={isPending} aria-label={t("label")}>
          <Languages className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {SUPPORTED_LOCALES.map((code) => (
          <DropdownMenuItem
            key={code}
            onClick={() => handleSelect(code)}
            className={code === locale ? "font-semibold text-primary" : ""}
          >
            {LOCALE_LABELS[code]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}