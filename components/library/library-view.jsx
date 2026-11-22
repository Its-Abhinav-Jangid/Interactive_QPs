"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpenCheck,
  CheckCircle2,
  Clock3,
  Copy,
  Download,
  FileJson,
  FileText,
  Filter,
  Globe2,
  GraduationCap,
  Link2,
  Loader2,
  Lock,
  MoreHorizontal,
  Play,
  Plus,
  RotateCcw,
  Search,
  Share2,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  deletePaper,
  duplicatePaper,
  loadDemoPapers,
  resetAttempt,
} from "@/app/actions/papers";
import { SiteHeader } from "@/components/layout/site-header";
import { ShareDialog } from "@/components/library/share-dialog";
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
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TooltipProvider } from "@/components/ui/tooltip";
import { clearLocalAttempt, attemptStorageKey } from "@/lib/storage";
import {
  downloadTextFile,
  formatClock,
  formatDate,
  formatDuration,
  formatMarks,
  pluralize,
  slugify,
} from "@/lib/utils";

const STATUS_LABELS = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Completed",
};

function statusOf(paper) {
  if (!paper.attempt) return "not_started";
  return paper.attempt.status === "completed" ? "completed" : "in_progress";
}

function StatusBadge({ paper }) {
  const status = statusOf(paper);
  if (status === "completed") {
    return (
      <Badge variant="success">
        <CheckCircle2 /> Completed
      </Badge>
    );
  }
  if (status === "in_progress") {
    return (
      <Badge variant="warning">
        <Clock3 /> In progress
      </Badge>
    );
  }
  return <Badge variant="muted">Not started</Badge>;
}

function VisibilityBadge({ visibility }) {
  if (visibility === "public") {
    return (
      <Badge variant="outline">
        <Globe2 /> Public
      </Badge>
    );
  }
  if (visibility === "unlisted") {
    return (
      <Badge variant="outline">
        <Link2 /> Shared link
      </Badge>
    );
  }
  return (
    <Badge variant="outline">
      <Lock /> Private
    </Badge>
  );
}

function PaperCard({ paper, onShare, onReset, onDelete, onDuplicate, busy }) {
  const status = statusOf(paper);
  const resumeLabel =
    status === "not_started" ? "Start test" : status === "completed" ? "Review" : "Resume";

  return (
    <Card className="group flex h-full flex-col overflow-hidden transition-shadow hover:shadow-lg">
      <div
        aria-hidden
        className="h-1 w-full bg-gradient-to-r from-primary/70 via-primary/30 to-transparent"
      />
      <CardContent className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="secondary">{paper.subject}</Badge>
              {paper.board && <Badge variant="outline">{paper.board}</Badge>}
              <VisibilityBadge visibility={paper.visibility} />
            </div>
            <h3 className="mt-2.5 line-clamp-2 text-base font-semibold leading-snug tracking-tight">
              {paper.title}
            </h3>
            {paper.subtitle && (
              <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                {paper.subtitle}
              </p>
            )}
          </div>
          <StatusBadge paper={paper} />
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <FileText className="size-3.5" />
            {formatMarks(paper.max_marks)} marks
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock3 className="size-3.5" />
            {formatDuration(paper.duration_minutes)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <BookOpenCheck className="size-3.5" />
            {pluralize(paper.stats.questions, "question")}
          </span>
        </div>

        {paper.attempt ? (
          <div className="rounded-xl border border-border/80 bg-muted/40 p-3">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-medium">
                {formatMarks(paper.attempt.attemptedMarks)} /{" "}
                {formatMarks(paper.attempt.maxMarks)} marks attempted
              </span>
              <span className="text-muted-foreground">
                {paper.attempt.status === "completed"
                  ? "Submitted"
                  : `${formatClock(paper.attempt.remaining_seconds)} left`}
              </span>
            </div>
            <Progress
              value={paper.attempt.percent}
              className="mt-2 h-1.5"
              indicatorClassName={
                paper.attempt.status === "completed" ? "bg-success" : undefined
              }
            />
            <p className="mt-2 text-[11px] text-muted-foreground">
              {paper.attempt.attemptedQuestions} of {paper.stats.questions} questions
              touched · saved {formatDate(paper.attempt.updated_at)}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-muted/20 p-3 text-xs text-muted-foreground">
            {paper.stats.sections} sections · {pluralize(paper.stats.items, "answer")} ·
            auto-saves as you type
          </div>
        )}

        <div className="mt-auto flex items-center gap-2">
          <Link href={`/exam/${paper.id}`} className="flex-1">
            <Button className="w-full" variant={status === "not_started" ? "default" : "secondary"}>
              <Play className="size-4" />
              {resumeLabel}
            </Button>
          </Link>
          <Button
            variant="outline"
            size="icon"
            aria-label="Share test"
            onClick={() => onShare(paper)}
          >
            <Share2 className="size-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="More actions">
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <MoreHorizontal className="size-4" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>{paper.title}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => onShare(paper)}>
                <Share2 /> Share link
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onDuplicate(paper)}>
                <Copy /> Duplicate paper
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() =>
                  downloadTextFile(
                    `${slugify(paper.title)}.json`,
                    JSON.stringify(paper.content, null, 2),
                    "application/json"
                  )
                }
              >
                <FileJson /> Download JSON
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {paper.attempt && (
                <DropdownMenuItem onSelect={() => onReset(paper)}>
                  <RotateCcw /> Reset attempt
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => onDelete(paper)}
              >
                <Trash2 /> Delete paper
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}

export function LibraryView({ papers, user, profile }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("all");
  const [board, setBoard] = useState("all");
  const [status, setStatus] = useState("all");
  const [sharePaper, setSharePaper] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [, startTransition] = useTransition();

  const subjects = useMemo(
    () => [...new Set(papers.map((paper) => paper.subject).filter(Boolean))].sort(),
    [papers]
  );
  const boards = useMemo(
    () => [...new Set(papers.map((paper) => paper.board).filter(Boolean))].sort(),
    [papers]
  );

  const counts = useMemo(() => {
    const result = { total: papers.length, in_progress: 0, completed: 0 };
    papers.forEach((paper) => {
      const value = statusOf(paper);
      if (value === "in_progress") result.in_progress += 1;
      if (value === "completed") result.completed += 1;
    });
    return result;
  }, [papers]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return papers.filter((paper) => {
      if (subject !== "all" && paper.subject !== subject) return false;
      if (board !== "all" && paper.board !== board) return false;
      if (status !== "all" && statusOf(paper) !== status) return false;
      if (!query) return true;
      return [paper.title, paper.subtitle, paper.subject, paper.board]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [papers, search, subject, board, status]);

  const hasFilters =
    search.trim() || subject !== "all" || board !== "all" || status !== "all";

  function clearFilters() {
    setSearch("");
    setSubject("all");
    setBoard("all");
    setStatus("all");
  }

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function handleDuplicate(paper) {
    setBusyId(paper.id);
    const result = await duplicatePaper(paper.id);
    setBusyId(null);
    if (!result.ok) return toast.error(result.error || "Could not duplicate paper.");
    toast.success("Paper duplicated into your library.");
    refresh();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    const result = await deletePaper(deleteTarget.id);
    setBusyId(null);
    if (!result.ok) return toast.error(result.error || "Could not delete paper.");
    toast.success("Paper deleted.");
    setDeleteTarget(null);
    refresh();
  }

  async function handleReset() {
    if (!resetTarget) return;
    setBusyId(resetTarget.id);
    const result = await resetAttempt(resetTarget.id);
    setBusyId(null);
    if (!result.ok) return toast.error(result.error || "Could not reset attempt.");
    clearLocalAttempt(attemptStorageKey(resetTarget.id, "owner"));
    toast.success("Attempt cleared. The paper is ready to start again.");
    setResetTarget(null);
    refresh();
  }

  async function handleLoadDemo() {
    setLoadingDemo(true);
    const result = await loadDemoPapers();
    setLoadingDemo(false);
    if (!result.ok) return toast.error(result.error || "Could not load demo papers.");
    if (result.inserted === 0) {
      toast.info("Demo papers are already in your library.");
    } else {
      toast.success(
        `Added ${pluralize(result.inserted, "demo paper")}${
          result.skipped ? `, skipped ${result.skipped} already present` : ""
        }.`
      );
    }
    refresh();
  }

  const firstName = (profile?.display_name || user.email || "there").split(" ")[0];

  return (
    <TooltipProvider delayDuration={150}>
      <div className="min-h-screen">
        <SiteHeader user={user} profile={profile} />

        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full bg-primary/10 blur-3xl"
            />
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-medium text-primary">Your paper library</p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
                  Good to see you, {firstName}.
                </h1>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                  Resume a timed attempt, import a new board paper, or share a clean
                  student link. Every answer is saved as you work.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" onClick={handleLoadDemo} disabled={loadingDemo}>
                  {loadingDemo ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                  Load demo papers
                </Button>
                <Link href="/import">
                  <Button>
                    <Plus className="size-4" />
                    Import paper
                  </Button>
                </Link>
              </div>
            </div>

            <div className="relative mt-6 grid gap-3 sm:grid-cols-3">
              {[
                { label: "Papers in library", value: counts.total, icon: FileText },
                { label: "Attempts in progress", value: counts.in_progress, icon: Clock3 },
                { label: "Completed papers", value: counts.completed, icon: CheckCircle2 },
              ].map((stat) => {
                const Icon = stat.icon;
                return (
                  <div
                    key={stat.label}
                    className="flex items-center gap-3 rounded-xl border border-border/70 bg-background/60 px-4 py-3"
                  >
                    <span className="grid size-9 place-items-center rounded-lg bg-secondary text-secondary-foreground">
                      <Icon className="size-4" />
                    </span>
                    <div>
                      <p className="text-xl font-semibold leading-none">{stat.value}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{stat.label}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="mt-6 flex flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-sm sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search papers by title, subject or board…"
                className="pl-9"
                aria-label="Search papers"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger className="w-full sm:w-36" aria-label="Filter by subject">
                  <SelectValue placeholder="Subject" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All subjects</SelectItem>
                  {subjects.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={board} onValueChange={setBoard}>
                <SelectTrigger className="w-full sm:w-32" aria-label="Filter by board">
                  <SelectValue placeholder="Board" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All boards</SelectItem>
                  {boards.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-full sm:w-36" aria-label="Filter by status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="not_started">Not started</SelectItem>
                  <SelectItem value="in_progress">In progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="size-4" />
                  Clear
                </Button>
              )}
            </div>
          </section>

          {papers.length === 0 ? (
            <section className="mt-6 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-16 text-center">
              <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
                <GraduationCap className="size-7" />
              </span>
              <h2 className="mt-4 text-xl font-semibold">Your library is empty</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                Load the two demo papers to explore every question type, or import
                your own board paper JSON. You can also generate a zero-spoiler
                extraction prompt from scratch.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <Button onClick={handleLoadDemo} disabled={loadingDemo}>
                  {loadingDemo ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                  Load demo papers
                </Button>
                <Link href="/import">
                  <Button variant="outline">
                    <Upload className="size-4" />
                    Import a paper
                  </Button>
                </Link>
              </div>
            </section>
          ) : filtered.length === 0 ? (
            <section className="mt-6 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-14 text-center">
              <Filter className="mx-auto size-8 text-muted-foreground" />
              <h2 className="mt-3 text-lg font-semibold">No papers match those filters</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Try a different subject, board or status.
              </p>
              <Button variant="outline" className="mt-4" onClick={clearFilters}>
                Clear filters
              </Button>
            </section>
          ) : (
            <section className="mt-6">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-medium text-muted-foreground">
                  {pluralize(filtered.length, "paper")}
                  {hasFilters ? " matching your filters" : ""}
                </h2>
                <span className="text-xs text-muted-foreground">
                  Sorted by recently updated
                </span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map((paper) => (
                  <PaperCard
                    key={paper.id}
                    paper={paper}
                    busy={busyId === paper.id}
                    onShare={setSharePaper}
                    onReset={setResetTarget}
                    onDelete={setDeleteTarget}
                    onDuplicate={handleDuplicate}
                  />
                ))}
              </div>
            </section>
          )}
        </main>
      </div>

      {sharePaper && (
        <ShareDialog
          paper={sharePaper}
          open
          onOpenChange={(open) => !open && setSharePaper(null)}
          onSaved={refresh}
        />
      )}

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this paper?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleteTarget?.title}” and its attempt will be permanently removed.
              Any active share link will stop working. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              <Trash2 className="size-4" />
              Delete paper
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(resetTarget)} onOpenChange={(open) => !open && setResetTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset this attempt?</AlertDialogTitle>
            <AlertDialogDescription>
              All answers, the timer and the saved progress for “{resetTarget?.title}”
              will be cleared. The paper itself stays in your library.
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
    </TooltipProvider>
  );
}
