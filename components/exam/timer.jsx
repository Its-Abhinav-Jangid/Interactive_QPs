"use client";

import { Pause, Play, RotateCcw, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn, formatClock } from "@/lib/utils";

export function ExamTimer({ seconds, running, completed, onToggle, onReset }) {
  const warning = seconds <= 15 * 60;
  const critical = seconds <= 5 * 60;

  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-lg border px-1.5 py-1 transition-colors",
        critical
          ? "border-destructive/50 bg-destructive/10 text-destructive"
          : warning
            ? "border-warning/50 bg-warning/10 text-warning-foreground dark:text-warning"
            : "border-border bg-card text-foreground"
      )}
      title={
        completed
          ? "Attempt submitted"
          : running
            ? "Timer running"
            : "Timer paused"
      }
    >
      <Timer className="ml-1 size-3.5 shrink-0 opacity-70" aria-hidden />
      <span
        role="timer"
        aria-label={`Time remaining ${formatClock(seconds)}`}
        className="min-w-[4.6rem] px-1 text-center font-mono text-sm font-semibold tabular-nums"
      >
        {formatClock(seconds)}
      </span>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-7"
            onClick={onToggle}
            disabled={completed}
            aria-label={running ? "Pause timer" : "Start timer"}
          >
            {running ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{completed ? "Attempt submitted" : running ? "Pause" : "Start"}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-7"
            onClick={onReset}
            disabled={completed}
            aria-label="Reset timer to the full duration"
          >
            <RotateCcw className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Reset timer</TooltipContent>
      </Tooltip>
    </div>
  );
}
