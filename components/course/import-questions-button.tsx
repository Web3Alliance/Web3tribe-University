"use client";
import * as React from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { FileSpreadsheet, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { importQuizQuestionsAction, type ImportedQuestionRow } from "@/lib/actions/quiz-builder";

interface ParsedRow {
  "Question Type"?: string;
  "Question Text"?: string;
  "Option A"?: string;
  "Option B"?: string;
  "Option C"?: string;
  "Option D"?: string;
  "Correct Answer"?: string;
}

/**
 * Entirely client-side parsing — the uploaded file never leaves the
 * browser except as the already-normalized rows sent to the server action.
 * Bad individual rows don't block the good ones; the server action itself
 * validates each row again and reports back exactly which ones it skipped
 * and why, so this component just needs to get the file into that shape.
 */
export function ImportQuestionsButton({ courseId, quizId }: { courseId: string; quizId: string }) {
  const [isPending, startTransition] = React.useTransition();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheet = workbook.Sheets["Questions"];
        if (!sheet) {
          toast.error('Could not find a "Questions" sheet in this file. Use the downloaded template.');
          return;
        }
        const rows = XLSX.utils.sheet_to_json<ParsedRow>(sheet, { defval: "" });

        const importedRows: ImportedQuestionRow[] = [];
        rows.forEach((row, i) => {
          const rowNumber = i + 2; // header is row 1
          const type = String(row["Question Type"] || "").trim();
          const questionText = String(row["Question Text"] || "").trim();
          if (!type && !questionText) return; // silently skip fully blank rows

          if (type === "Subjective") {
            importedRows.push({
              rowNumber,
              questionType: "short_answer",
              questionText,
              correctTextAnswer: String(row["Correct Answer"] || "").trim(),
            });
          } else {
            // Treat anything else (including "Multiple Choice" or a blank/
            // mistyped cell) as multiple choice — the server re-validates
            // properly and will report a clear per-row reason if it's wrong,
            // rather than this client silently discarding the row.
            const letterToId: Record<string, string> = { A: "a", B: "b", C: "c", D: "d" };
            const options = (["Option A", "Option B", "Option C", "Option D"] as const)
              .map((col, idx) => ({ id: ["a", "b", "c", "d"][idx], text: String(row[col] || "").trim() }))
              .filter((o) => o.text.length > 0);
            const correctLetter = String(row["Correct Answer"] || "").trim().toUpperCase();
            importedRows.push({
              rowNumber,
              questionType: "single_choice",
              questionText,
              options,
              correctOptionId: letterToId[correctLetter] ?? correctLetter.toLowerCase(),
            });
          }
        });

        if (importedRows.length === 0) {
          toast.error("No question rows found in the file.");
          return;
        }

        startTransition(async () => {
          const res = await importQuizQuestionsAction(courseId, quizId, importedRows);
          if (res.error) {
            toast.error(res.error);
            return;
          }
          const summaryParts = [`${res.imported} question${res.imported === 1 ? "" : "s"} imported`];
          if (res.skipped.length > 0) summaryParts.push(`${res.skipped.length} skipped`);
          toast.success(summaryParts.join(", "), {
            description:
              res.skipped.length > 0
                ? res.skipped.map((s) => `Row ${s.rowNumber}: ${s.reason}`).join("\n")
                : undefined,
            duration: res.skipped.length > 0 ? 12000 : 4000,
          });
        });
      } catch {
        toast.error("Couldn't read that file. Make sure it's a .xlsx file based on the downloaded template.");
      }
    };
    reader.readAsBinaryString(file);
  }

  return (
    <div className="flex items-center gap-1.5">
      <Button size="sm" variant="ghost" asChild>
        <a href="/templates/Web3tribe_Quiz_Upload_Template.xlsx" download>
          <Download className="h-3.5 w-3.5" /> Template
        </a>
      </Button>
      <Button size="sm" variant="outline" disabled={isPending} onClick={() => fileInputRef.current?.click()}>
        <FileSpreadsheet className="h-3.5 w-3.5" /> {isPending ? "Importing…" : "Import from Excel"}
      </Button>
      <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />
    </div>
  );
}
