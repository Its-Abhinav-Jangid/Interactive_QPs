"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ClipboardPaste,
  Copy,
  Download,
  FileJson,
  FileUp,
  Loader2,
  Save,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { saveImportedPaper } from "@/app/actions/papers";
import { SiteHeader } from "@/components/layout/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { DEMO_PAPERS } from "@/lib/demo-papers";
import { formatPaperIssues, paperSchema } from "@/lib/schemas/paper";
import { getPaperStats } from "@/lib/paper";
import { PROMPT_WORKFLOW, buildExtractionPrompt } from "@/lib/prompt";
import {
  copyToClipboard,
  downloadTextFile,
  formatMarks,
  pluralize,
  slugify,
} from "@/lib/utils";

function stripCodeFences(value) {
  let text = String(value || "").trim();
  const fullFence = text.match(/^```(?:json|JSON)?\s*([\s\S]*?)\s*```$/);
  if (fullFence) {
    text = fullFence[1].trim();
  } else {
    text = text
      .replace(/^```(?:json|JSON)?\s*/i, "")
      .replace(/```\s*$/, "")
      .trim();
  }
  return text;
}

function findSuspiciousKeys(value, path = [], found = []) {
  if (!value || typeof value !== "object") return found;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => findSuspiciousKeys(entry, [...path, index], found));
    return found;
  }
  Object.entries(value).forEach(([key, entry]) => {
    if (/^(answer|answers|answer_key|answerKey|solution|solutions|correct|correctOption|correct_option|hint|hints|markingScheme|marking_scheme|valuePoints|value_points)$/i.test(key)) {
      found.push([...path, key].join(" → "));
    }
    findSuspiciousKeys(entry, [...path, key], found);
  });
  return found;
}

function paperWarnings(paper) {
  const warnings = [];
  const totalSectionMarks = (paper.sections || []).reduce(
    (total, section) => total + Number(section.marks || 0),
    0
  );
  (paper.sections || []).forEach((section) => {
    const sum = (section.questions || []).reduce(
      (total, question) => total + Number(question.marks || 0),
      0
    );
    if (Math.abs(sum - Number(section.marks || 0)) > 0.01) {
      warnings.push(
        `${section.label}: section marks are ${formatMarks(section.marks)} but its questions add up to ${formatMarks(sum)}.`
      );
    }
  });
  if (Math.abs(totalSectionMarks - Number(paper.maxMarks || 0)) > 0.01) {
    warnings.push(
      `Section marks add up to ${formatMarks(totalSectionMarks)} but the paper's maximum is ${formatMarks(paper.maxMarks)}.`
    );
  }
  return warnings;
}

export function ImportWorkspace({ user, profile }) {
  const router = useRouter();
  const fileInputRef = useRef(null);
  const [fields, setFields] = useState({
    paperName: "",
    subject: "English",
    board: "CBSE",
    classLevel: "Class 10",
    sourcePages: "",
    durationMinutes: 180,
    maxMarks: 80,
    notes: "",
  });
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [rawText, setRawText] = useState("");
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState(null);
  const [issues, setIssues] = useState([]);
  const [parsedPaper, setParsedPaper] = useState(null);
  const [draftForLabels, setDraftForLabels] = useState(null);
  const [suspicious, setSuspicious] = useState([]);
  const [visibility, setVisibility] = useState("private");
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);

  const prompt = useMemo(() => buildExtractionPrompt(fields), [fields]);
  const stats = useMemo(
    () => (parsedPaper ? getPaperStats(parsedPaper) : null),
    [parsedPaper]
  );
  const warnings = useMemo(
    () => (parsedPaper ? paperWarnings(parsedPaper) : []),
    [parsedPaper]
  );

  function updateField(key, value) {
    setFields((previous) => ({ ...previous, [key]: value }));
  }

  async function handleCopyPrompt() {
    const ok = await copyToClipboard(prompt);
    if (ok) {
      setCopiedPrompt(true);
      toast.success("Extraction prompt copied.");
      setTimeout(() => setCopiedPrompt(false), 2000);
    } else {
      toast.error("Could not copy. Select the prompt text and copy it manually.");
    }
  }

  function resetValidation() {
    setParseError(null);
    setIssues([]);
    setParsedPaper(null);
    setDraftForLabels(null);
    setSuspicious([]);
  }

  function validateText(text) {
    resetValidation();
    if (!text.trim()) {
      setParseError("Paste a JSON paper or drop a .json file first.");
      return null;
    }

    const cleaned = stripCodeFences(text);
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (error) {
      setParseError(
        `This is not valid JSON yet. ${error.message}. Check for trailing commas, missing quotes or an unfinished AI response.`
      );
      return null;
    }

    const result = paperSchema.safeParse(parsed);
    if (!result.success) {
      setDraftForLabels(parsed);
      setIssues(formatPaperIssues(result.error.issues, parsed));
      setParseError(null);
      return null;
    }

    setParsedPaper(result.data);
    setSuspicious(findSuspiciousKeys(parsed));
    return result.data;
  }

  function handleValidate() {
    const paper = validateText(rawText);
    if (paper) toast.success("Paper is valid. Review the summary and save it.");
  }

  async function handleFile(file) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("That file is larger than 2 MB. Please import a smaller paper.");
      return;
    }
    const text = await file.text();
    setFileName(file.name);
    setRawText(text);
    validateText(text);
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) handleFile(file);
  }

  async function handlePasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        toast.error("Your clipboard is empty.");
        return;
      }
      setRawText(text);
      setFileName("");
      validateText(text);
    } catch {
      toast.error("Clipboard access was blocked. Paste into the box instead.");
    }
  }

  function loadSample(id) {
    const sample = DEMO_PAPERS.find((entry) => entry.id === id);
    if (!sample) return;
    const text = JSON.stringify(sample.paper, null, 2);
    setRawText(text);
    setFileName(`${id}.json`);
    validateText(text);
  }

  async function handleSave() {
    if (!parsedPaper) {
      toast.error("Validate the JSON before saving.");
      return;
    }
    setSaving(true);
    const result = await saveImportedPaper({
      content: parsedPaper,
      visibility,
    });
    setSaving(false);

    if (!result.ok) {
      if (result.issues) {
        setIssues(formatPaperIssues(result.issues, parsedPaper));
      }
      toast.error(result.error || "Could not save the paper.");
      return;
    }

    toast.success("Paper saved to your library.");
    router.push(`/exam/${result.id}`);
    router.refresh();
  }

  const totalChars = prompt.length;

  return (
    <div className="min-h-screen">
      <SiteHeader user={user} profile={profile} />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <p className="text-sm font-medium text-primary">Import studio</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            Turn a static paper into an interactive test
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Generate a zero-spoiler extraction prompt for your AI tool, then paste the
            JSON back here. Every field is validated before anything is saved.
          </p>
        </div>

        <Tabs defaultValue="prompt">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="prompt">
              <Wand2 className="mr-1.5 size-3.5" />
              AI prompt studio
            </TabsTrigger>
            <TabsTrigger value="importer">
              <FileJson className="mr-1.5 size-3.5" />
              JSON importer
            </TabsTrigger>
          </TabsList>

          <TabsContent value="prompt" className="mt-5">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Paper details</CardTitle>
                  <CardDescription>
                    These values are injected into the prompt so the AI labels the
                    output correctly.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="paper-name">Target paper name</Label>
                    <Input
                      id="paper-name"
                      value={fields.paperName}
                      onChange={(event) => updateField("paperName", event.target.value)}
                      placeholder="CBSE Class 10 English — Sample Paper 2026"
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="subject">Subject</Label>
                      <Input
                        id="subject"
                        value={fields.subject}
                        onChange={(event) => updateField("subject", event.target.value)}
                        placeholder="English"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="board">Board</Label>
                      <Input
                        id="board"
                        value={fields.board}
                        onChange={(event) => updateField("board", event.target.value)}
                        placeholder="CBSE"
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="class-level">Class</Label>
                      <Input
                        id="class-level"
                        value={fields.classLevel}
                        onChange={(event) => updateField("classLevel", event.target.value)}
                        placeholder="Class 10"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="duration">Duration (min)</Label>
                      <Input
                        id="duration"
                        type="number"
                        min={1}
                        max={600}
                        value={fields.durationMinutes}
                        onChange={(event) =>
                          updateField("durationMinutes", event.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="max-marks">Max marks</Label>
                      <Input
                        id="max-marks"
                        type="number"
                        min={1}
                        value={fields.maxMarks}
                        onChange={(event) => updateField("maxMarks", event.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="source-pages">Source pages / notes</Label>
                    <Input
                      id="source-pages"
                      value={fields.sourcePages}
                      onChange={(event) => updateField("sourcePages", event.target.value)}
                      placeholder="Pages 1–8 of the attached PDF, including the marking scheme (to be ignored)"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Extra instructions (optional)</Label>
                    <Textarea
                      id="notes"
                      value={fields.notes}
                      onChange={(event) => updateField("notes", event.target.value)}
                      placeholder="e.g. Q3 is 'attempt any 10 of 12'. Keep the grammar questions as one question with 12 items."
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="flex flex-col">
                <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
                  <div>
                    <CardTitle className="text-base">Generated prompt</CardTitle>
                    <CardDescription>
                      {totalChars.toLocaleString()} characters · schema, chart rules and
                      zero-spoiler policy included
                    </CardDescription>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button variant="outline" size="sm" onClick={handleCopyPrompt}>
                      {copiedPrompt ? (
                        <Check className="size-4" />
                      ) : (
                        <Copy className="size-4" />
                      )}
                      {copiedPrompt ? "Copied" : "Copy"}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      aria-label="Download prompt"
                      onClick={() =>
                        downloadTextFile(
                          `${slugify(fields.paperName || "paper")}-extraction-prompt.txt`,
                          prompt
                        )
                      }
                    >
                      <Download className="size-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col">
                  <Textarea
                    readOnly
                    value={prompt}
                    aria-label="Generated extraction prompt"
                    className="h-[460px] flex-1 resize-none bg-muted/30 font-mono text-[11px] leading-relaxed"
                  />
                </CardContent>
              </Card>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {PROMPT_WORKFLOW.map((step, index) => (
                <div
                  key={step.title}
                  className="rounded-xl border border-border bg-card p-4"
                >
                  <span className="grid size-7 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {index + 1}
                  </span>
                  <h3 className="mt-3 text-sm font-semibold">{step.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {step.body}
                  </p>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="importer" className="mt-5">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Paste or drop paper JSON</CardTitle>
                  <CardDescription>
                    Markdown fences from ChatGPT or Claude are stripped automatically.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={handleDrop}
                    className={`rounded-xl border-2 border-dashed p-4 transition-colors ${
                      dragging
                        ? "border-primary bg-primary/5"
                        : "border-border bg-muted/20"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm">
                        <FileUp className="size-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          Drag a <code className="text-xs">.json</code> file here, or
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          Choose file
                        </Button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".json,application/json"
                          className="hidden"
                          onChange={(event) => handleFile(event.target.files?.[0])}
                        />
                      </div>
                      <Button variant="ghost" size="sm" onClick={handlePasteFromClipboard}>
                        <ClipboardPaste className="size-4" />
                        Paste
                      </Button>
                    </div>
                    {fileName && (
                      <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <FileJson className="size-3.5" />
                        {fileName}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="paper-json">Paper JSON</Label>
                      <div className="flex items-center gap-1.5">
                        {DEMO_PAPERS.map((sample) => (
                          <Button
                            key={sample.id}
                            variant="ghost"
                            size="sm"
                            onClick={() => loadSample(sample.id)}
                          >
                            <Sparkles className="size-3.5" />
                            {sample.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <Textarea
                      id="paper-json"
                      value={rawText}
                      onChange={(event) => {
                        setRawText(event.target.value);
                        if (parseError || issues.length || parsedPaper) resetValidation();
                      }}
                      placeholder={'{\n  "title": "…",\n  "subject": "…",\n  "durationMinutes": 180,\n  "maxMarks": 80,\n  "sections": []\n}'}
                      className="h-[360px] resize-y font-mono text-[11px] leading-relaxed"
                      spellCheck={false}
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button onClick={handleValidate} disabled={!rawText.trim()}>
                      <CheckCircle2 className="size-4" />
                      Validate & preview
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setRawText("");
                        setFileName("");
                        resetValidation();
                      }}
                      disabled={!rawText}
                    >
                      <X className="size-4" />
                      Clear
                    </Button>
                  </div>

                  {parseError && (
                    <div
                      role="alert"
                      className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                    >
                      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                      <span>{parseError}</span>
                    </div>
                  )}

                  {issues.length > 0 && (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                      <p className="flex items-center gap-2 text-sm font-medium text-destructive">
                        <AlertTriangle className="size-4" />
                        {pluralize(issues.length, "validation error")}
                      </p>
                      <ul className="mt-2 max-h-64 space-y-1.5 overflow-y-auto text-xs">
                        {issues.map((issue, index) => (
                          <li
                            key={`${issue.label}-${index}`}
                            className="rounded-md bg-background/70 px-2.5 py-1.5"
                          >
                            <span className="font-medium text-foreground">
                              {issue.label}
                            </span>
                            <span className="text-muted-foreground"> — {issue.message}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {parsedPaper && (
                    <div className="rounded-lg border border-success/30 bg-success/5 p-3">
                      <p className="flex items-center gap-2 text-sm font-medium text-success">
                        <CheckCircle2 className="size-4" />
                        Valid paper — ready to save
                      </p>
                      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                        <div>
                          <dt className="text-muted-foreground">Sections</dt>
                          <dd className="font-medium">{stats.sections}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">Questions</dt>
                          <dd className="font-medium">{stats.questions}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">Answer items</dt>
                          <dd className="font-medium">{stats.items}</dd>
                        </div>
                      </dl>
                    </div>
                  )}

                  {warnings.length > 0 && (
                    <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs">
                      <p className="flex items-center gap-2 font-medium text-warning-foreground dark:text-warning">
                        <AlertTriangle className="size-4" />
                        Non-blocking consistency checks
                      </p>
                      <ul className="mt-1.5 list-inside list-disc space-y-1 text-muted-foreground">
                        {warnings.map((warning) => (
                          <li key={warning}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {suspicious.length > 0 && (
                    <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs">
                      <p className="font-medium text-warning-foreground dark:text-warning">
                        Answer-like fields detected
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        Unknown fields are stripped when the paper is saved, but check
                        that no answer key is embedded in a supported field:{" "}
                        {suspicious.slice(0, 4).join(", ")}
                        {suspicious.length > 4 ? "…" : ""}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="h-fit">
                <CardHeader>
                  <CardTitle className="text-base">Save to library</CardTitle>
                  <CardDescription>
                    The paper is stored as JSONB. You can edit sharing and attempts
                    later from the dashboard.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {parsedPaper ? (
                    <div className="rounded-xl border border-border bg-muted/30 p-4">
                      <h3 className="text-sm font-semibold">{parsedPaper.title}</h3>
                      {parsedPaper.subtitle && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {parsedPaper.subtitle}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Badge variant="secondary">{parsedPaper.subject}</Badge>
                        {parsedPaper.board && (
                          <Badge variant="outline">{parsedPaper.board}</Badge>
                        )}
                        <Badge variant="outline">
                          {formatMarks(parsedPaper.maxMarks)} marks
                        </Badge>
                        <Badge variant="outline">
                          {parsedPaper.durationMinutes} min
                        </Badge>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Validate a paper to see its summary here.
                    </p>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="import-visibility">Initial visibility</Label>
                    <Select value={visibility} onValueChange={setVisibility}>
                      <SelectTrigger id="import-visibility">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="private">Private — only you</SelectItem>
                        <SelectItem value="unlisted">Shared link — anyone with the link</SelectItem>
                        <SelectItem value="public">Public — listed in the library</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    className="w-full"
                    onClick={handleSave}
                    disabled={!parsedPaper || saving}
                  >
                    {saving ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Save className="size-4" />
                    )}
                    Save paper and open it
                  </Button>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Saving re-validates on the server. Student views never receive
                    answer keys, hints or marking schemes.
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
