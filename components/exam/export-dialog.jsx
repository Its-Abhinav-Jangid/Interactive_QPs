"use client";

import { useMemo, useState } from "react";
import { Check, ClipboardList, Copy, Download, FileText } from "lucide-react";
import { toast } from "sonner";
import { EvaluationGuide } from "@/components/exam/evaluation-guide";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { buildQAMarkdown, exportFilename } from "@/lib/export";
import {
  countAttemptedItems,
  getExportScopes,
  questionsForScope,
} from "@/lib/paper";
import { copyToClipboard, downloadTextFile, pluralize } from "@/lib/utils";

export function ExportDialog({
  paper,
  responses,
  activeChoices,
  open,
  onOpenChange,
}) {
  const [scope, setScope] = useState("full");
  const [includePrompt, setIncludePrompt] = useState(true);
  const [includeUnattempted, setIncludeUnattempted] = useState(false);
  const [copied, setCopied] = useState(false);

  const scopes = useMemo(() => getExportScopes(paper), [paper]);

  const attemptedInScope = useMemo(() => {
    return questionsForScope(paper, scope).reduce((total, { question }) => {
      return (
        total +
        countAttemptedItems(
          question,
          responses?.[question.id],
          activeChoices?.[question.id]
        )
      );
    }, 0);
  }, [paper, scope, responses, activeChoices]);

  const markdown = useMemo(
    () =>
      buildQAMarkdown({
        paper,
        responses,
        activeChoices,
        scope,
        includePrompt,
        includeUnattempted,
      }),
    [paper, responses, activeChoices, scope, includePrompt, includeUnattempted]
  );

  async function handleCopy() {
    const ok = await copyToClipboard(markdown);
    if (ok) {
      setCopied(true);
      toast.success("Q&A copied. Paste it into your AI tool with the evaluator prompt.");
      setTimeout(() => setCopied(false), 2200);
    } else {
      toast.error("Could not copy. Select the preview text and copy it manually.");
    }
  }

  function handleDownload() {
    downloadTextFile(exportFilename(paper, scope), markdown);
    toast.success("Answer file downloaded.");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="size-5 text-primary" />
            Copy Q&A for evaluation
          </DialogTitle>
          <DialogDescription>
            Export clean Markdown with your active OR choices, then paste it into any AI
            examiner. No answer key is included.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="export-scope">Scope</Label>
            <Select value={scope} onValueChange={setScope}>
              <SelectTrigger id="export-scope">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {scopes.map((entry) => (
                  <SelectItem key={entry.value} value={entry.value}>
                    {entry.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {pluralize(attemptedInScope, "answer")} in this scope.
            </p>
          </div>

          <div className="space-y-3 rounded-lg border border-border p-3">
            <label className="flex cursor-pointer items-start justify-between gap-3">
              <span>
                <span className="block text-sm font-medium">Strict evaluator prompt</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  First-N scoring, score table and rubric rows.
                </span>
              </span>
              <Switch
                checked={includePrompt}
                onCheckedChange={setIncludePrompt}
                aria-label="Prepend strict evaluator prompt"
              />
            </label>
            <label className="flex cursor-pointer items-start justify-between gap-3">
              <span>
                <span className="block text-sm font-medium">Include unattempted questions</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Useful for a full-paper review.
                </span>
              </span>
              <Switch
                checked={includeUnattempted}
                onCheckedChange={setIncludeUnattempted}
                aria-label="Include unattempted questions"
              />
            </label>
          </div>
        </div>

        {attemptedInScope === 0 && !includeUnattempted && (
          <div className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-foreground dark:text-warning">
            You have not attempted anything in this scope yet. Turn on “Include
            unattempted questions” if you want a blank paper to review.
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Preview</Label>
            <Badge variant="outline">
              <FileText /> {markdown.length.toLocaleString()} chars
            </Badge>
          </div>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/30 p-3 font-mono text-[11px] leading-relaxed">
            {markdown}
          </pre>
        </div>

        <EvaluationGuide />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button variant="outline" onClick={handleDownload}>
            <Download className="size-4" />
            Download .txt
          </Button>
          <Button onClick={handleCopy}>
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? "Copied" : "Copy to clipboard"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
