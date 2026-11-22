"use client";

import { memo, useEffect, useRef } from "react";
import { Check, Eraser } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { cn, countWords } from "@/lib/utils";

const OPTION_LETTERS = "ABCDEFGHIJ";

function wordTargetLabel(wordTarget) {
  if (!wordTarget) return "";
  if (typeof wordTarget === "number") return `≈${wordTarget} words`;
  if (wordTarget.min && wordTarget.max) return `${wordTarget.min}–${wordTarget.max} words`;
  if (wordTarget.min) return `at least ${wordTarget.min} words`;
  if (wordTarget.max) return `up to ${wordTarget.max} words`;
  return "";
}

function wordTargetBounds(wordTarget) {
  if (!wordTarget) return null;
  if (typeof wordTarget === "number") {
    return { min: Math.round(wordTarget * 0.9), max: Math.round(wordTarget * 1.1) };
  }
  return { min: wordTarget.min || 0, max: wordTarget.max || Number.MAX_SAFE_INTEGER };
}

function Prompt({ item }) {
  return <p className="text-sm font-medium leading-relaxed">{item.prompt}</p>;
}

function Quote({ children }) {
  if (!children) return null;
  return (
    <blockquote className="mt-2 rounded-r-md border-l-2 border-primary/40 bg-muted/40 px-3 py-2 text-sm italic leading-relaxed text-foreground/90">
      {children}
    </blockquote>
  );
}

function ExtraBadge({ isExtra }) {
  if (!isExtra) return null;
  return (
    <Badge variant="warning" className="mt-2">
      Extra attempt — will not be graded
    </Badge>
  );
}

function McqWidget({ item, value, onChange }) {
  const options = item.options || [];
  const selectedIndex = options.findIndex((option) => option === value);

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <Prompt item={item} />
        {selectedIndex >= 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 px-2 text-xs text-muted-foreground"
            onClick={() => onChange(null)}
          >
            <Eraser className="size-3.5" />
            Clear
          </Button>
        )}
      </div>
      <Quote>{item.quote}</Quote>
      <div
        className="mt-2.5 grid gap-2"
        role="group"
        aria-label={item.prompt}
      >
        {options.map((option, index) => {
          const selected = index === selectedIndex;
          return (
            <button
              key={`${option}-${index}`}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(selected ? null : option)}
              className={cn(
                "flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                selected
                  ? "border-primary bg-primary/8 shadow-sm ring-1 ring-primary/30"
                  : "border-border bg-card hover:border-primary/40 hover:bg-accent/50"
              )}
            >
              <span
                className={cn(
                  "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border text-[11px] font-semibold",
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground"
                )}
              >
                {selected ? <Check className="size-3" strokeWidth={3} /> : OPTION_LETTERS[index]}
              </span>
              <span className="leading-relaxed">{option}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ShortWidget({ item, value, onChange }) {
  const ref = useRef(null);
  const inline = item.stemPrefix || item.stemSuffix;
  const stringValue = typeof value === "string" ? value : "";

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.max(72, element.scrollHeight)}px`;
  }, [stringValue]);

  return (
    <div>
      <Prompt item={item} />
      <Quote>{item.quote}</Quote>
      {inline ? (
        <div className="mt-2.5 flex flex-wrap items-start gap-x-2 gap-y-2 text-sm leading-relaxed">
          {item.stemPrefix && <span className="mt-2">{item.stemPrefix}</span>}
          <Textarea
            ref={ref}
            value={stringValue}
            onChange={(event) => onChange(event.target.value)}
            aria-label={`Answer for ${item.prompt}`}
            className="min-h-[72px] min-w-[10rem] flex-1 resize-none leading-relaxed"
            placeholder="Your answer"
          />
          {item.stemSuffix && <span className="mt-2">{item.stemSuffix}</span>}
        </div>
      ) : (
        <Textarea
          ref={ref}
          value={stringValue}
          onChange={(event) => onChange(event.target.value)}
          aria-label={`Answer for ${item.prompt}`}
          className="mt-2.5 min-h-[72px] resize-none leading-relaxed"
          placeholder="Type your answer"
        />
      )}
    </div>
  );
}

function ErrorCorrectionWidget({ item, value, onChange }) {
  const objectValue = value && typeof value === "object" ? value : {};
  const error = objectValue.error || "";
  const correction = objectValue.correction || "";

  return (
    <div>
      <Prompt item={item} />
      <Quote>{item.quote}</Quote>
      <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">
            Error
          </span>
          <Input
            value={error}
            onChange={(event) => onChange({ ...objectValue, error: event.target.value })}
            placeholder="Incorrect word / phrase"
            className="border-destructive/40 focus-visible:ring-destructive/40"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">
            Correction
          </span>
          <Input
            value={correction}
            onChange={(event) =>
              onChange({ ...objectValue, correction: event.target.value })
            }
            placeholder="Corrected word / phrase"
            className="border-success/40 focus-visible:ring-success/40"
          />
        </label>
      </div>
    </div>
  );
}

function LongWidget({ item, value, onChange }) {
  const ref = useRef(null);
  const text = typeof value === "string" ? value : "";
  const words = countWords(text);
  const bounds = wordTargetBounds(item.wordTarget);
  const target = wordTargetLabel(item.wordTarget);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.max(132, element.scrollHeight)}px`;
  }, [text]);

  let tone = "muted";
  if (words > 0 && bounds) {
    tone = words >= bounds.min && words <= bounds.max ? "success" : "warning";
  }

  return (
    <div>
      <Prompt item={item} />
      <Quote>{item.quote}</Quote>
      <Textarea
        ref={ref}
        value={text}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Write your answer here…"
        className="mt-2.5 min-h-[132px] resize-none leading-relaxed"
        aria-label={`Answer for ${item.prompt}`}
      />
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{target ? `Target: ${target}` : "Write as much as the question needs."}</span>
        <Badge variant={tone}>
          {words} {words === 1 ? "word" : "words"}
        </Badge>
      </div>
    </div>
  );
}

export const ItemWidget = memo(function ItemWidget({
  item,
  value,
  onChange,
  label,
  isExtra = false,
  compact = false,
}) {
  return (
    <div
      className={cn(
        compact && "rounded-lg border border-border bg-card p-3",
        isExtra && "rounded-lg border border-warning/40 bg-warning/5 p-3"
      )}
    >
      <div className="flex items-start gap-2.5">
        {label && (
          <span className="mt-0.5 shrink-0 text-xs font-semibold text-muted-foreground">
            {label}
          </span>
        )}
        <div className="min-w-0 flex-1">
          {item.type === "mcq" && (
            <McqWidget item={item} value={value} onChange={onChange} />
          )}
          {item.type === "short" && (
            <ShortWidget item={item} value={value} onChange={onChange} />
          )}
          {item.type === "error_correction" && (
            <ErrorCorrectionWidget item={item} value={value} onChange={onChange} />
          )}
          {item.type === "long" && (
            <LongWidget item={item} value={value} onChange={onChange} />
          )}
          <ExtraBadge isExtra={isExtra} />
        </div>
      </div>
    </div>
  );
});
