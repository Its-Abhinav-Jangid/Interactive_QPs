"use client";

import { memo } from "react";
import { AlertTriangle, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ItemWidget } from "@/components/exam/item-widget";
import { StimulusPane } from "@/components/exam/stimulus";
import { getChoiceFor, getItemValue, isValueAnswered } from "@/lib/paper";
import { cn, formatMarks } from "@/lib/utils";

const ITEM_LETTERS = "abcdefghijklmnop";

export const QuestionCard = memo(function QuestionCard({
  question,
  response,
  activeChoice,
  attemptedCount,
  onItemChange,
  onChoiceChange,
  fontScale,
  onFontScaleChange,
}) {
  const hasStimulus = Boolean(question.stimulus?.length);
  const hasChoices = Boolean(question.choices?.length);
  const choice = getChoiceFor(question, activeChoice);
  const items = hasChoices ? choice?.items || [] : question.items || [];
  const choiceKey = choice?.key || null;
  const limit = question.attemptLimit;
  const overLimit = Boolean(limit && attemptedCount > limit);
  const isSplit = question.layout === "split" && hasStimulus;
  const isGrid = question.layout === "grid" && !hasChoices;

  let answeredSeen = 0;
  const extraFlags = items.map((item) => {
    const answered = isValueAnswered(
      getItemValue(response, choiceKey, item.id),
      item,
    );
    if (!answered) return false;
    answeredSeen += 1;
    return Boolean(limit && answeredSeen > limit);
  });

  const answerBlock = (
    <div className="min-w-0">
      {hasChoices && (
        <div className="mb-4">
          <div
            className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1"
            role="group"
            aria-label="Choose an internal option"
          >
            {question.choices.map((entry) => {
              const active = entry.key === (choiceKey || "A");
              return (
                <button
                  key={entry.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChoiceChange(question.id, entry.key)}
                  className={cn(
                    "rounded-md px-3 py-2 text-left text-sm transition-colors",
                    active
                      ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                      : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
                  )}
                >
                  <span className="block text-xs font-semibold uppercase tracking-wide">
                    Option {entry.key}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {entry.label || `Choice ${entry.key}`}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Both drafts are kept. Only the selected option is counted, exported
            and graded.
          </p>
        </div>
      )}

      {hasChoices && choice?.stimulus?.length > 0 && (
        <StimulusPane
          blocks={choice.stimulus}
          fontScale={fontScale}
          onFontScaleChange={onFontScaleChange}
          className="mb-4"
          showControls={false}
        />
      )}

      <div className={cn(isGrid ? "grid gap-3 " : "space-y-4")}>
        {items.map((item, index) => (
          <ItemWidget
            key={item.id}
            item={item}
            value={getItemValue(response, choiceKey, item.id)}
            onChange={(value) =>
              onItemChange(question.id, choiceKey, item.id, value)
            }
            label={
              items.length > 1 ? `(${ITEM_LETTERS[index] || index + 1})` : null
            }
            isExtra={extraFlags[index]}
            compact={isGrid}
          />
        ))}
      </div>
    </div>
  );

  return (
    <Card
      className="overflow-hidden scroll-mt-44"
      id={`question-${question.id}`}
    >
      <div className="border-b border-border bg-muted/20 px-4 py-3.5 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2.5">
            <span className="mt-0.5 grid min-w-10 shrink-0 place-items-center rounded-md bg-primary/10 px-1.5 py-1 text-xs font-semibold text-primary">
              Q{question.number}
            </span>
            <div className="min-w-0">
              {question.title && (
                <h3 className="text-sm font-medium leading-relaxed">
                  {question.title}
                </h3>
              )}
              {question.instruction && (
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {question.instruction}
                </p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {limit && (
              <Badge variant={overLimit ? "warning" : "secondary"}>
                Attempted {attemptedCount} / {limit}
              </Badge>
            )}
            <Badge variant="outline">{formatMarks(question.marks)} marks</Badge>
          </div>
        </div>

        {overLimit && (
          <div className="mt-2.5 flex gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs leading-relaxed">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-foreground dark:text-warning" />
            <span>
              You have attempted {attemptedCount} of the {limit} allowed items.
              Board examiners strictly grade only the first {limit} attempts;
              the extra ones are kept in your export but marked ungraded.
            </span>
          </div>
        )}
      </div>

      <div
        className={cn(
          "p-4 sm:p-5",
          isSplit &&
            "lg:grid lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-start lg:gap-5",
        )}
      >
        {isSplit && (
          <>
            <div className="hidden lg:block">
              <div className="lg:sticky lg:top-40">
                <div className="max-h-[calc(100vh-11rem)] overflow-y-auto pr-1 scrollbar-thin">
                  <StimulusPane
                    blocks={question.stimulus}
                    fontScale={fontScale}
                    onFontScaleChange={onFontScaleChange}
                  />
                </div>
              </div>
            </div>
            <div className="mb-3 lg:hidden">
              <Sheet>
                <SheetTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-between"
                  >
                    <span className="inline-flex items-center gap-2">
                      <BookOpen className="size-4" />
                      Read the passage / data
                    </span>
                    <span className="text-xs text-muted-foreground">Open</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle>Reading material</SheetTitle>
                  </SheetHeader>
                  <StimulusPane
                    blocks={question.stimulus}
                    fontScale={fontScale}
                    onFontScaleChange={onFontScaleChange}
                    className="border-0 p-0 shadow-none"
                  />
                </SheetContent>
              </Sheet>
            </div>
          </>
        )}

        {!isSplit && hasStimulus && (
          <div className="mb-4">
            <StimulusPane
              blocks={question.stimulus}
              fontScale={fontScale}
              onFontScaleChange={onFontScaleChange}
            />
          </div>
        )}

        {answerBlock}
      </div>
    </Card>
  );
});
