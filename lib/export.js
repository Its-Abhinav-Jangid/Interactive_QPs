import {
  getChoiceFor,
  getItemValue,
  groupEntriesBySection,
  getQuestionItems,
  isValueAnswered,
  questionsForScope,
} from "@/lib/paper";
import { countWords, formatMarks, slugify } from "@/lib/utils";

export const EVALUATOR_PROMPT = `You are a strict, experienced CBSE / board examination examiner. I will paste my answers to an exam paper below. Evaluate them exactly the way a board examiner would.

SCORING RULES
1. Award marks only for the questions I actually attempted. Unattempted questions score 0.
2. Where a question says "Attempt any N", grade ONLY the first N attempted items in paper order. Mention any extra attempts in parentheses after the table and explicitly do not award marks for them.
3. For internal choice (OR) questions, grade ONLY the option marked as chosen. Ignore drafts of the other option.
4. Follow the official marking scheme if I attach one. If I do not attach one, use standard board value points and accepted alternatives.
5. Do not award marks for answers that miss the key value point, even if they are long. Do not award full marks for answers that only partially address the question.
6. For objective questions, mark correct or incorrect only — no partial credit.

OUTPUT FORMAT (Markdown)
Start with a one-line score summary: **Score: X / Y (Z%)**.
Then produce a table with exactly these columns:
| Q.No | My Answer (short) | Marks Awarded | Correct Answer / Value Points | Rule / Fix |
Keep "My Answer" brief — quote the first few words, do not repeat entire essays.

Then, for every writing / long-answer question, add a rubric breakdown with these rows:
- Format (if applicable)
- Content / Value points
- Organisation / Structure
- Accuracy / Fluency (grammar, spelling, expression)
Give each rubric row a mark and one sentence of justification.

Finish with:
**Top 3 recurring fixes**
1. ...
2. ...
3. ...

Be direct and specific. Do not rewrite my entire paper. Do not invent questions that are not in the export.`;

function formatWordTarget(wordTarget) {
  if (!wordTarget) return "";
  if (typeof wordTarget === "number") return `${wordTarget} words`;
  if (wordTarget.min && wordTarget.max) {
    return `${wordTarget.min}–${wordTarget.max} words`;
  }
  if (wordTarget.min) return `at least ${wordTarget.min} words`;
  if (wordTarget.max) return `up to ${wordTarget.max} words`;
  return "";
}

function formatItemAnswer(item, value) {
  if (!isValueAnswered(value, item)) return "_Not attempted_";

  if (item.type === "mcq") {
    const options = item.options || [];
    const index = options.findIndex((option) => option === value);
    if (index >= 0) {
      return `(${String.fromCharCode(65 + index)}) ${value}`;
    }
    return String(value);
  }

  if (item.type === "error_correction") {
    const error = String(value?.error || "").trim() || "—";
    const correction = String(value?.correction || "").trim() || "—";
    return `Error: ${error} | Correction: ${correction}`;
  }

  if (item.type === "long") {
    const text = String(value || "").trim();
    const words = countWords(text);
    const target = formatWordTarget(item.wordTarget);
    const suffix = target ? ` _(${words} words; target ${target})_` : ` _(${words} words)_`;
    return `${text}${suffix}`;
  }

  return String(value || "").trim();
}

function itemHeading(item) {
  const prefix = item.stemPrefix ? `${item.stemPrefix} ` : "";
  const suffix = item.stemSuffix ? ` ${item.stemSuffix}` : "";
  return `${prefix}${item.prompt}${suffix}`.replace(/\s+/g, " ").trim();
}

export function buildQAMarkdown({
  paper,
  responses,
  activeChoices,
  scope = "full",
  includePrompt = true,
  includeUnattempted = false,
}) {
  const entries = questionsForScope(paper, scope);
  const groups = groupEntriesBySection(entries);
  const lines = [];

  lines.push(`# ${paper.title}${paper.subtitle ? ` — ${paper.subtitle}` : ""}`);
  lines.push("");
  const meta = [
    paper.board ? `Board: ${paper.board}` : null,
    paper.subject ? `Subject: ${paper.subject}` : null,
    paper.durationMinutes ? `Duration: ${paper.durationMinutes} minutes` : null,
    paper.maxMarks ? `Maximum marks: ${formatMarks(paper.maxMarks)}` : null,
  ].filter(Boolean);
  if (meta.length) {
    lines.push(`_${meta.join(" · ")}_`);
    lines.push("");
  }

  if (includePrompt) {
    lines.push(EVALUATOR_PROMPT);
    lines.push("");
    lines.push("---");
    lines.push("");
    lines.push("## My answers");
    lines.push("");
  }

  groups.forEach(({ section, entries: sectionEntries }) => {
    lines.push(
      `## ${section.label}${section.title ? ` — ${section.title}` : ""} (${formatMarks(
        section.marks
      )} marks)`
    );
    lines.push("");

    sectionEntries.forEach(({ question }) => {
      const response = responses?.[question.id];
      const activeChoice = activeChoices?.[question.id];
      const choice = getChoiceFor(question, activeChoice);
      const items = getQuestionItems(question, activeChoice);
      const choiceKey = choice?.key || null;
      let answeredCount = 0;

      const itemLines = items.map((item) => {
        const value = getItemValue(response, choiceKey, item.id);
        const attempted = isValueAnswered(value, item);
        if (!attempted && !includeUnattempted) return null;
        let extra = false;
        if (attempted) {
          answeredCount += 1;
          extra = Boolean(
            question.attemptLimit && answeredCount > question.attemptLimit
          );
        }
        const block = [];
        block.push(`**${question.number}${items.length > 1 ? `(${item.id})` : ""}.** ${itemHeading(item)}`);
        if (item.quote) {
          block.push(`> ${String(item.quote).replace(/\n/g, "\n> ")}`);
        }
        block.push(`**My Answer:** ${formatItemAnswer(item, value)}`);
        if (extra) {
          block.push("_Extra attempt — not graded (attempt limit reached)._");
        }
        block.push("");
        return block.join("\n");
      });

      const filtered = itemLines.filter(Boolean);
      if (!filtered.length) return;

      const headingBits = [
        `### Q${question.number}`,
        `(${formatMarks(question.marks)} marks)`,
      ];
      if (choice) {
        headingBits.push(`— Option ${choice.key}${choice.label ? `: ${choice.label}` : ""} chosen`);
      }
      if (question.attemptLimit) {
        headingBits.push(`— attempt any ${question.attemptLimit} of ${items.length}`);
      }
      lines.push(headingBits.join(" "));
      lines.push("");
      if (question.instruction) {
        lines.push(`_${question.instruction}_`);
        lines.push("");
      }
      lines.push(filtered.join("\n"));
    });
  });

  lines.push("");
  lines.push("---");
  lines.push("_Exported from PaperDesk for AI / teacher evaluation._");
  lines.push("");

  return lines.join("\n");
}

export function exportFilename(paper, scope) {
  const base = slugify(paper?.title || "paper");
  const suffix = !scope || scope === "full" ? "full" : slugify(scope.replace(":", "-"));
  return `${base}-${suffix}-answers.txt`;
}
