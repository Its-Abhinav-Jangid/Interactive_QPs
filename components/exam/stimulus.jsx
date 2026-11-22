"use client";

import { Minus, Plus, Type } from "lucide-react";
import { ChartBlock } from "@/components/exam/charts";
import { Button } from "@/components/ui/button";
import { cn, clamp } from "@/lib/utils";

function PassageBlock({ block }) {
  return (
    <section className="space-y-3">
      {block.heading && <h3 className="font-semibold leading-snug">{block.heading}</h3>}
      <div className="exam-serif space-y-3 leading-7">
        {(block.paragraphs || []).map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>
      {block.footnote && (
        <p className="text-[0.78em] italic text-muted-foreground">{block.footnote}</p>
      )}
    </section>
  );
}

function ExtractBlock({ block }) {
  return (
    <section className="space-y-2">
      {block.heading && <h3 className="font-semibold leading-snug">{block.heading}</h3>}
      <div className="exam-serif whitespace-pre-line rounded-lg border-l-2 border-primary/50 bg-muted/30 px-4 py-3 leading-8">
        {block.text}
      </div>
      {block.source && (
        <p className="text-right text-[0.82em] italic text-muted-foreground">
          {block.source}
        </p>
      )}
    </section>
  );
}

function TableBlock({ block }) {
  const headers = block.headers || [];
  return (
    <section className="space-y-2">
      {block.caption && <h3 className="font-semibold leading-snug">{block.caption}</h3>}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[320px] border-collapse text-[0.86em]">
          <thead>
            <tr className="bg-muted/70">
              {headers.map((header, index) => (
                <th
                  key={`${header}-${index}`}
                  scope="col"
                  className="border-b border-border px-3 py-2 text-left font-semibold"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(block.rows || []).map((row, rowIndex) => (
              <tr key={rowIndex} className="odd:bg-card even:bg-muted/20">
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className="border-b border-border/70 px-3 py-2 align-top last:border-r-0"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SwotBlock({ block }) {
  const quadrants = [
    {
      key: "strengths",
      label: "Strengths",
      values: block.strengths,
      className: "border-t-success bg-success/5",
      heading: "text-success",
    },
    {
      key: "weaknesses",
      label: "Weaknesses",
      values: block.weaknesses,
      className: "border-t-destructive bg-destructive/5",
      heading: "text-destructive",
    },
    {
      key: "opportunities",
      label: "Opportunities",
      values: block.opportunities,
      className: "border-t-primary bg-primary/5",
      heading: "text-primary",
    },
    {
      key: "threats",
      label: "Threats",
      values: block.threats,
      className: "border-t-warning bg-warning/10",
      heading: "text-warning-foreground dark:text-warning",
    },
  ];

  return (
    <section className="space-y-2">
      {block.title && <h3 className="font-semibold leading-snug">{block.title}</h3>}
      <div className="grid gap-2 sm:grid-cols-2">
        {quadrants.map((quadrant) => (
          <div
            key={quadrant.key}
            className={cn("rounded-lg border border-border border-t-2 p-3", quadrant.className)}
          >
            <h4 className={cn("text-[0.8em] font-semibold uppercase tracking-wide", quadrant.heading)}>
              {quadrant.label}
            </h4>
            <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[0.86em] leading-relaxed">
              {(quadrant.values || []).map((value, index) => (
                <li key={index}>{value}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function BulletsBlock({ block }) {
  return (
    <section className="space-y-2">
      {block.heading && <h3 className="font-semibold leading-snug">{block.heading}</h3>}
      <ul className="list-disc space-y-1.5 pl-5 leading-relaxed">
        {(block.items || []).map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

export function StimulusContent({ blocks }) {
  return (blocks || []).map((block, index) => {
    if (block.type === "passage") return <PassageBlock key={index} block={block} />;
    if (block.type === "extract") return <ExtractBlock key={index} block={block} />;
    if (block.type === "table") return <TableBlock key={index} block={block} />;
    if (block.type === "swot") return <SwotBlock key={index} block={block} />;
    if (block.type === "bullets") return <BulletsBlock key={index} block={block} />;
    if (block.type === "chart") return <ChartBlock key={index} block={block} />;
    return null;
  });
}

export function StimulusPane({
  blocks,
  fontScale,
  onFontScaleChange,
  className,
  showControls = true,
}) {
  if (!blocks?.length) return null;

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-paper p-4 shadow-sm sm:p-5",
        className
      )}
    >
      {showControls && (
        <div className="mb-3 flex items-center justify-between gap-2 border-b border-border/70 pb-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            <Type className="size-3.5" />
            Reading material
          </span>
          <div className="flex items-center gap-0.5" role="group" aria-label="Reading text size">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Decrease reading text size"
              onClick={() => onFontScaleChange?.(clamp(fontScale - 0.1, 0.85, 1.4))}
              disabled={fontScale <= 0.85}
            >
              <Minus className="size-3.5" />
            </Button>
            <span className="min-w-9 text-center text-[11px] tabular-nums text-muted-foreground">
              {Math.round(fontScale * 100)}%
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Increase reading text size"
              onClick={() => onFontScaleChange?.(clamp(fontScale + 0.1, 0.85, 1.4))}
              disabled={fontScale >= 1.4}
            >
              <Plus className="size-3.5" />
            </Button>
          </div>
        </div>
      )}
      <div
        className="space-y-5 leading-relaxed"
        style={{ fontSize: `${Math.round(16 * fontScale)}px` }}
      >
        <StimulusContent blocks={blocks} />
      </div>
    </div>
  );
}
