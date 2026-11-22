"use client";

import { useState } from "react";
import { ChevronDown, ClipboardList, GraduationCap } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    title: "Complete the paper or any section",
    body: "Attempt as much as you want. Everything is saved automatically, so you can stop and come back.",
  },
  {
    title: 'Open "Copy Q&A for Evaluation"',
    body: "Choose the scope and select a checking strictness — Strict mirrors board exams, Standard is fair, Lenient suits practice. Each mode prepends tailored examiner instructions.",
  },
  {
    title: "Paste into ChatGPT, Gemini or Claude",
    body: "Optionally attach the official marking scheme PDF. The evaluator prompt asks the model to follow it if present.",
  },
  {
    title: "Ask for the rubric breakdown",
    body: "You will get a score summary, a question-by-question table, writing rubrics and the top three recurring fixes.",
  },
];

export function EvaluationGuide({ defaultOpen = false, className }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={cn("rounded-xl border border-border bg-card", className)}
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm font-medium hover:bg-muted/40"
        >
          <span className="grid size-7 place-items-center rounded-lg bg-primary/10 text-primary">
            <GraduationCap className="size-4" />
          </span>
          <span className="flex-1">How to get evaluated</span>
          <span className="hidden text-xs font-normal text-muted-foreground sm:inline">
            4 steps
          </span>
          <ChevronDown
            className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-t border-border px-4 py-4">
          <ol className="space-y-3">
            {STEPS.map((step, index) => (
              <li key={step.title} className="flex gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-secondary text-[11px] font-semibold text-secondary-foreground">
                  {index + 1}
                </span>
                <div>
                  <p className="text-sm font-medium">{step.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-3 flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            <ClipboardList className="mt-0.5 size-3.5 shrink-0" />
            The export contains only your answers and the questions — never an answer
            key. The AI examiner does the grading.
          </p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
