"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Cloud,
  CloudOff,
  Flag,
  Loader2,
  MoreHorizontal,
  RotateCcw,
  Share2,
  ShieldCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { EvaluationGuide } from "@/components/exam/evaluation-guide";
import { ExamTimer } from "@/components/exam/timer";
import { ExportDialog } from "@/components/exam/export-dialog";
import { QuestionCard } from "@/components/exam/question-card";
import { ShareDialog } from "@/components/library/share-dialog";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  clearLocalAttempt,
  attemptStorageKey,
  readLocalAttempt,
  readPreference,
  writeLocalAttempt,
  writePreference,
} from "@/lib/storage";
import {
  computeProgress,
  countAttemptedItems,
  flattenQuestions,
  normalizeTimerSeconds,
} from "@/lib/paper";
import {
  cn,
  formatDuration,
  formatMarks,
  pluralize,
} from "@/lib/utils";

function withDefaultChoices(paper, activeChoices) {
  const next = { ...(activeChoices || {}) };
  flattenQuestions(paper).forEach(({ question }) => {
    if (question.choices?.length && !next[question.id]) {
      next[question.id] = "A";
    }
  });
  return next;
}

function responsesHaveWork(paper, responses, activeChoices) {
  return flattenQuestions(paper).some(({ question }) => {
    return (
      countAttemptedItems(
        question,
        responses?.[question.id],
        activeChoices?.[question.id]
      ) > 0
    );
  });
}

function SyncIndicator({ state, lastSavedAt, mode }) {
  if (mode === "shared") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] text-muted-foreground">
        <CloudOff className="size-3.5" />
        <span className="hidden sm:inline">Saved locally</span>
      </span>
    );
  }

  const map = {
    idle: { icon: Cloud, label: "Ready", className: "text-muted-foreground" },
    saving: { icon: Loader2, label: "Saving…", className: "text-primary", spin: true },
    "saved-cloud": {
      icon: Cloud,
      label: "Saved to cloud",
      className: "text-success",
    },
    "saved-local": {
      icon: CloudOff,
      label: "Saved locally",
      className: "text-warning-foreground dark:text-warning",
    },
    local: { icon: CloudOff, label: "Saved locally", className: "text-muted-foreground" },
  };
  const entry = map[state] || map.idle;
  const Icon = entry.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px]",
        entry.className
      )}
      title={lastSavedAt ? `Last saved ${new Date(lastSavedAt).toLocaleTimeString()}` : undefined}
      aria-live="polite"
    >
      <Icon className={cn("size-3.5", entry.spin && "animate-spin")} />
      <span className="hidden sm:inline">{entry.label}</span>
    </span>
  );
}

export function ExamShell({
  paper,
  initialAttempt = null,
  mode = "owner",
  shareSlug = null,
  senderNote = null,
  shareMeta = null,
}) {
  const durationSeconds = Math.round((Number(paper.durationMinutes) || 0) * 60);
  const storageKey = attemptStorageKey(
    mode === "shared" ? shareSlug : paper.id,
    mode
  );

  const [responses, setResponses] = useState(initialAttempt?.responses || {});
  const [activeChoices, setActiveChoices] = useState(() =>
    withDefaultChoices(paper, initialAttempt?.active_choices)
  );
  const [remainingSeconds, setRemainingSeconds] = useState(() =>
    normalizeTimerSeconds(paper, initialAttempt?.remaining_seconds)
  );
  const [status, setStatus] = useState(initialAttempt?.status || "in_progress");
  const [running, setRunning] = useState(false);
  const [sectionFilter, setSectionFilter] = useState("all");
  const [fontScale, setFontScale] = useState(1);
  const [syncState, setSyncState] = useState(
    mode === "shared" ? "local" : initialAttempt ? "saved-cloud" : "idle"
  );
  const [lastSavedAt, setLastSavedAt] = useState(initialAttempt?.updated_at || null);
  const [showExport, setShowExport] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [showNote, setShowNote] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const stateRef = useRef({ responses, activeChoices, remainingSeconds, status });

  useEffect(() => {
    stateRef.current = { responses, activeChoices, remainingSeconds, status };
  }, [responses, activeChoices, remainingSeconds, status]);

  const dirtyRef = useRef(false);
  const suppressSaveRef = useRef(false);
  const initialSaveCheckedRef = useRef(false);

  const persistLocal = useCallback(() => {
    writeLocalAttempt(storageKey, {
      ...stateRef.current,
      savedAt: new Date().toISOString(),
    });
  }, [storageKey]);

  const saveToCloud = useCallback(
    async (override) => {
      if (mode !== "owner") return;
      if (!dirtyRef.current) return;
      dirtyRef.current = false;
      setSyncState("saving");
      try {
        const payload = override || stateRef.current;
        const response = await fetch("/api/attempts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paperId: paper.id, ...payload }),
        });
        if (!response.ok) throw new Error("save failed");
        const data = await response.json();
        setLastSavedAt(data.attempt?.updated_at || new Date().toISOString());
        setSyncState("saved-cloud");
      } catch {
        dirtyRef.current = true;
        setSyncState("saved-local");
      }
    },
    [mode, paper.id]
  );

  // Reconcile the local mirror with the server copy once on mount. Deferred to
  // a task so the initial server render and the first client render match.
  useEffect(() => {
    const timeout = setTimeout(() => {
      const local = readLocalAttempt(storageKey);
      if (local) {
        const localTime = new Date(local.savedAt || 0).getTime();
        const serverTime = initialAttempt?.updated_at
          ? new Date(initialAttempt.updated_at).getTime()
          : 0;
        if (mode === "shared" || localTime > serverTime) {
          setResponses(local.responses || {});
          setActiveChoices(withDefaultChoices(paper, local.activeChoices));
          setRemainingSeconds(normalizeTimerSeconds(paper, local.remainingSeconds));
          setStatus(local.status === "completed" ? "completed" : "in_progress");
          if (mode === "owner" && localTime > serverTime) {
            dirtyRef.current = true;
          }
        }
      }
      setFontScale(readPreference("fontScale", 1));
      setHydrated(true);
    }, 0);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writePreference("fontScale", fontScale);
  }, [fontScale, hydrated]);

  useEffect(() => {
    if (!running || status === "completed") return;
    const interval = setInterval(() => {
      dirtyRef.current = true;
      setRemainingSeconds((previous) => Math.max(0, previous - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [running, status]);

  useEffect(() => {
    if (!hydrated) return;
    if (remainingSeconds > 0 || status === "completed") return;
    const timeout = setTimeout(() => {
      setRunning(false);
      setStatus("completed");
      toast.info("Time is up. Your attempt has been marked complete.");
    }, 0);
    return () => clearTimeout(timeout);
  }, [remainingSeconds, status, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    persistLocal();
  }, [remainingSeconds, hydrated, persistLocal]);

  useEffect(() => {
    if (!hydrated) return;
    persistLocal();
    if (mode !== "owner") return;
    if (suppressSaveRef.current) {
      suppressSaveRef.current = false;
      return;
    }
    if (!initialSaveCheckedRef.current) {
      initialSaveCheckedRef.current = true;
      const hasWork =
        responsesHaveWork(paper, responses, activeChoices) ||
        status === "completed" ||
        remainingSeconds !== durationSeconds;
      if (!hasWork) return;
    }
    dirtyRef.current = true;
    setSyncState("saving");
    const timeout = setTimeout(() => saveToCloud(), 1000);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [responses, activeChoices, status, hydrated, persistLocal, saveToCloud]);

  useEffect(() => {
    if (!hydrated || mode !== "owner") return;
    const interval = setInterval(() => {
      if (dirtyRef.current) saveToCloud();
    }, 15000);
    return () => clearInterval(interval);
  }, [hydrated, mode, saveToCloud]);

  useEffect(() => {
    const handleOnline = () => {
      if (dirtyRef.current) saveToCloud();
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [saveToCloud]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") persistLocal();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [persistLocal]);

  const handleItemChange = useCallback((questionId, choiceKey, itemId, value) => {
    setResponses((previous) => {
      const current = previous[questionId] || {};
      const next = { ...current };
      if (choiceKey) {
        const choices = { ...(current.choices || {}) };
        choices[choiceKey] = { ...(choices[choiceKey] || {}), [itemId]: value };
        next.choices = choices;
      } else {
        next.direct = { ...(current.direct || {}), [itemId]: value };
      }
      return { ...previous, [questionId]: next };
    });
    if (choiceKey) {
      setActiveChoices((previous) =>
        previous[questionId]
          ? previous
          : { ...previous, [questionId]: choiceKey }
      );
    }
  }, []);

  const handleChoiceChange = useCallback((questionId, key) => {
    setActiveChoices((previous) => ({ ...previous, [questionId]: key }));
  }, []);

  const progress = useMemo(
    () => computeProgress(paper, responses, activeChoices),
    [paper, responses, activeChoices]
  );

  const attemptedByQuestion = useMemo(() => {
    const map = {};
    flattenQuestions(paper).forEach(({ question }) => {
      map[question.id] = countAttemptedItems(
        question,
        responses[question.id],
        activeChoices[question.id]
      );
    });
    return map;
  }, [paper, responses, activeChoices]);

  const visibleSections =
    sectionFilter === "all"
      ? paper.sections
      : paper.sections.filter((section) => section.id === sectionFilter);

  function handleTimerToggle() {
    if (status === "completed") return;
    setRunning((previous) => !previous);
  }

  function handleTimerReset() {
    setRemainingSeconds(durationSeconds);
    setRunning(false);
    toast.info("Timer reset to the full duration.");
  }

  async function handleFinish() {
    if (status === "completed" || finishing) return;
    setFinishing(true);
    const snapshot = { ...stateRef.current, status: "completed" };
    setRunning(false);
    setStatus("completed");
    dirtyRef.current = true;
    await saveToCloud(snapshot);
    setFinishing(false);
    setShowExport(true);
    toast.success("Attempt marked complete. Export your answers to get them evaluated.");
  }

  async function handleReset() {
    setShowReset(false);
    setRunning(false);
    if (mode === "owner") {
      try {
        const response = await fetch(
          `/api/attempts?paperId=${encodeURIComponent(paper.id)}`,
          { method: "DELETE" }
        );
        if (!response.ok) throw new Error("delete failed");
      } catch {
        toast.error("Could not clear the cloud attempt. Clearing this device instead.");
      }
    }
    suppressSaveRef.current = true;
    dirtyRef.current = false;
    clearLocalAttempt(storageKey);
    setResponses({});
    setActiveChoices(withDefaultChoices(paper, {}));
    setRemainingSeconds(durationSeconds);
    setStatus("in_progress");
    setSyncState(mode === "owner" ? "idle" : "local");
    setLastSavedAt(null);
    toast.success("Attempt reset. You can start fresh.");
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 border-b border-border bg-background/92 backdrop-blur-xl no-print">
          <div className="mx-auto max-w-[1500px] px-3 sm:px-5">
            <div className="flex flex-wrap items-center gap-2 py-2.5">
              {mode === "owner" ? (
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/" aria-label="Back to paper library">
                    <ArrowLeft className="size-4" />
                    <span className="hidden sm:inline">Library</span>
                  </Link>
                </Button>
              ) : (
                <Badge variant="secondary" className="shrink-0">
                  <ShieldCheck /> Shared test
                </Badge>
              )}

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold leading-tight">
                  {paper.title}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {paper.subject}
                  {paper.board ? ` · ${paper.board}` : ""} ·{" "}
                  {formatMarks(paper.maxMarks)} marks · {formatDuration(paper.durationMinutes)}
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                <SyncIndicator state={syncState} lastSavedAt={lastSavedAt} mode={mode} />
                <ThemeToggle />
                <ExamTimer
                  seconds={remainingSeconds}
                  running={running}
                  completed={status === "completed"}
                  onToggle={handleTimerToggle}
                  onReset={handleTimerReset}
                />
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setShowExport(true)}
                  className="hidden sm:inline-flex"
                >
                  <ClipboardList className="size-4" />
                  Copy Q&A
                </Button>
                <Button
                  variant="default"
                  size="icon"
                  onClick={() => setShowExport(true)}
                  className="sm:hidden"
                  aria-label="Copy Q&A for evaluation"
                >
                  <ClipboardList className="size-4" />
                </Button>
                {mode === "owner" && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setShowShare(true)}
                    aria-label="Share test"
                  >
                    <Share2 className="size-4" />
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" aria-label="More exam actions">
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>{paper.title}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => setShowExport(true)}>
                      <ClipboardList /> Copy Q&A for evaluation
                    </DropdownMenuItem>
                    {mode === "owner" && (
                      <DropdownMenuItem onSelect={() => setShowShare(true)}>
                        <Share2 /> Share test
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onSelect={handleFinish} disabled={status === "completed"}>
                      <Flag /> Mark as complete
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onSelect={() => setShowReset(true)}
                    >
                      <RotateCcw /> Reset attempt
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pb-2.5">
              <div
                className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto no-scrollbar"
                role="group"
                aria-label="Filter by section"
              >
                <button
                  type="button"
                  aria-pressed={sectionFilter === "all"}
                  onClick={() => setSectionFilter("all")}
                  className={cn(
                    "shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                    sectionFilter === "all"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  View all
                </button>
                {paper.sections.map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    aria-pressed={sectionFilter === section.id}
                    onClick={() => setSectionFilter(section.id)}
                    className={cn(
                      "shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                      sectionFilter === section.id
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                    title={section.title || section.label}
                  >
                    {section.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2.5">
                <div className="hidden w-44 flex-col sm:flex">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>
                      {progress.attemptedQuestions}/{progress.totalQuestions} questions
                    </span>
                    <span className="tabular-nums">
                      {formatMarks(progress.attemptedMarks)}/{formatMarks(progress.maxMarks)}
                    </span>
                  </div>
                  <Progress value={progress.percent} className="mt-1 h-1.5" />
                </div>
                <Button
                  size="sm"
                  variant={status === "completed" ? "secondary" : "default"}
                  onClick={handleFinish}
                  disabled={status === "completed" || finishing}
                >
                  {finishing ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="size-4" />
                  )}
                  {status === "completed" ? "Completed" : "Finish"}
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1500px] px-3 py-5 sm:px-5">
          <Card className="overflow-hidden">
            <div className="border-b border-border bg-gradient-to-r from-primary/8 via-transparent to-transparent px-5 py-5 sm:px-6">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="secondary">{paper.subject}</Badge>
                {paper.board && <Badge variant="outline">{paper.board}</Badge>}
                <Badge variant="outline">{formatMarks(paper.maxMarks)} marks</Badge>
                <Badge variant="outline">{formatDuration(paper.durationMinutes)}</Badge>
                <Badge variant="outline">
                  {pluralize(progress.totalQuestions, "question")}
                </Badge>
                {status === "completed" && (
                  <Badge variant="success">
                    <CheckCircle2 /> Completed
                  </Badge>
                )}
              </div>
              <h1 className="mt-2.5 text-xl font-semibold tracking-tight sm:text-2xl">
                {paper.title}
              </h1>
              {paper.subtitle && (
                <p className="mt-1 text-sm text-muted-foreground">{paper.subtitle}</p>
              )}

              <div className="mt-4 rounded-xl border border-border bg-background/60 p-3 sm:hidden">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">
                    Attempted {formatMarks(progress.attemptedMarks)} /{" "}
                    {formatMarks(progress.maxMarks)}
                  </span>
                  <span className="text-muted-foreground">
                    {Math.round(progress.percent)}%
                  </span>
                </div>
                <Progress value={progress.percent} className="mt-2 h-1.5" />
              </div>

              {paper.instructions?.length > 0 && (
                <details className="group mt-4 rounded-lg border border-border/70 bg-background/50">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-xs font-medium">
                    <span>Instructions ({paper.instructions.length})</span>
                    <span className="text-muted-foreground group-open:hidden">Show</span>
                    <span className="hidden text-muted-foreground group-open:inline">
                      Hide
                    </span>
                  </summary>
                  <ol className="list-decimal space-y-1 border-t border-border/70 px-7 py-3 text-xs leading-relaxed text-muted-foreground">
                    {paper.instructions.map((instruction, index) => (
                      <li key={index}>{instruction}</li>
                    ))}
                  </ol>
                </details>
              )}
            </div>
          </Card>

          {mode === "shared" && senderNote && showNote && (
            <div className="mt-3 flex items-start gap-3 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3">
              <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <Share2 className="size-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                  Note from the sender
                </p>
                <p className="mt-0.5 whitespace-pre-line text-sm leading-relaxed">
                  {senderNote}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setShowNote(false)}
                aria-label="Dismiss sender note"
              >
                <X className="size-4" />
              </Button>
            </div>
          )}

          {mode === "shared" && (
            <EvaluationGuide className="mt-3" defaultOpen={false} />
          )}

          {progress.overLimit.length > 0 && (
            <div className="mt-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-xs leading-relaxed text-warning-foreground dark:text-warning">
              You have exceeded the attempt limit on{" "}
              {pluralize(progress.overLimit.length, "question")}. Only the first allowed
              attempts will be graded — extras are marked ungraded in your export.
            </div>
          )}

          <div className="mt-5 space-y-8">
            {visibleSections.map((section) => (
              <section
                key={section.id}
                id={`section-${section.id}`}
                className="scroll-mt-44"
                aria-labelledby={`section-${section.id}-heading`}
              >
                <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                      {section.label}
                    </p>
                    <h2
                      id={`section-${section.id}-heading`}
                      className="text-lg font-semibold tracking-tight"
                    >
                      {section.title || section.label}
                    </h2>
                  </div>
                  <Badge variant="secondary">
                    {formatMarks(section.marks)} marks
                  </Badge>
                </div>
                <div className="space-y-4">
                  {section.questions.map((question) => (
                    <QuestionCard
                      key={question.id}
                      question={question}
                      response={responses[question.id]}
                      activeChoice={activeChoices[question.id]}
                      attemptedCount={attemptedByQuestion[question.id] || 0}
                      onItemChange={handleItemChange}
                      onChoiceChange={handleChoiceChange}
                      fontScale={fontScale}
                      onFontScaleChange={setFontScale}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>

          <footer className="mt-8 flex flex-col items-start justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3.5 sm:flex-row sm:items-center">
            <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
              {mode === "shared"
                ? "Your answers are saved in this browser only. Export them before clearing your browser data."
                : "Answers auto-save to your account and to this browser. No answer keys are stored in the student view."}
            </p>
            <div className="flex shrink-0 gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowExport(true)}>
                <ClipboardList className="size-4" />
                Copy Q&A
              </Button>
              <Button
                size="sm"
                onClick={handleFinish}
                disabled={status === "completed" || finishing}
              >
                <CheckCircle2 className="size-4" />
                {status === "completed" ? "Completed" : "Finish attempt"}
              </Button>
            </div>
          </footer>
        </main>

        <ExportDialog
          paper={paper}
          responses={responses}
          activeChoices={activeChoices}
          open={showExport}
          onOpenChange={setShowExport}
        />

        {mode === "owner" && shareMeta && showShare && (
          <ShareDialog
            paper={shareMeta}
            open
            onOpenChange={(open) => !open && setShowShare(false)}
          />
        )}

        <AlertDialog open={showReset} onOpenChange={setShowReset}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset this attempt?</AlertDialogTitle>
              <AlertDialogDescription>
                All answers, drafts of both OR options, and the timer will be cleared.
                The paper stays available. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep my answers</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleReset}
              >
                <RotateCcw className="size-4" />
                Reset attempt
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
