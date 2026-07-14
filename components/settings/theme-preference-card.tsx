"use client";
import { useTheme } from "next-themes";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export function ThemePreferenceCard() {
  const { theme, setTheme } = useTheme();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>Choose how Web3tribe University looks on this device.</CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup value={theme} onValueChange={setTheme} className="grid grid-cols-3 gap-2">
          {["light", "dark", "system"].map((t) => (
            <label
              key={t}
              className="flex cursor-pointer items-center gap-2 rounded-md border border-input px-3 py-2 text-sm capitalize has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-secondary"
            >
              <RadioGroupItem value={t} id={t} />
              {t}
            </label>
          ))}
        </RadioGroup>
      </CardContent>
    </Card>
  );
}
