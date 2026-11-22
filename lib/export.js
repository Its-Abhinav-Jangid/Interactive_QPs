import {
  getChoiceFor,
  getItemValue,
  groupEntriesBySection,
  getQuestionItems,
  isValueAnswered,
  questionsForScope,
} from "@/lib/paper";
import { countWords, formatMarks, slugify } from "@/lib/utils";

export const STRICTNESS_MODES = [
  {
    value: "strict",
    label: "Strict",
    description:
      "Board-exact: no partial credit on objective Qs, every value point checked",
    prompt: `You are a strict, experienced CBSE / board examination examiner. I will paste my answers below. Evaluate them EXACTLY the way a board examiner would — apply the marking scheme rigorously.

SCORING RULES
1. Award marks only for questions I actually attempted. Unattempted questions score 0.
2. Where a question says "Attempt any N", grade ONLY the first N attempted items in paper order. Note extra attempts but do not award marks for them.
3. For internal choice (OR) questions, grade ONLY the option marked as chosen. Ignore drafts of the other option.
4. Follow the official marking scheme if I attach one; otherwise use standard board value points and accepted alternatives.
5. Do not award marks for answers that miss the key value point, even if they are long or well-written.
6. Do not award full marks for answers that only partially address the question.
7. For objective / MCQ questions, mark correct or incorrect only — no partial credit under any circumstances.
8. For short / long answers, partial credit is only allowed when the marking scheme explicitly subdivides marks.
9. Grammar and spelling errors in short / long answers should reduce scores under "Accuracy / Fluency" unless the rubric says otherwise.

OUTPUT FORMAT (Markdown)
Start with: **Score: X / Y (Z%)**
Produce a table:
| Q.No | My Answer (short) | Marks Awarded | Correct Answer / Value Points | Rule / Fix |
Keep "My Answer" to the first few words — do not repeat whole essays.

For every long / writing question add a rubric breakdown:
- Format (if applicable)
- Content / Value points
- Organisation / Structure
- Accuracy / Fluency (grammar, spelling, expression)
Give each row a mark and one sentence of justification.

Finish with:
**Top 3 recurring fixes**
1. ...
2. ...
3. ...

Be direct and specific. Do not rewrite my paper. Do not invent questions.`,
  },
  {
    value: "standard",
    label: "Standard",
    description: "Fair board standard: rewards key ideas, allows minor slips",
    prompt: `You are an experienced CBSE / board examination examiner evaluating my answers fairly, the way a reasonable board examiner would.

SCORING RULES
1. Award marks only for questions I actually attempted. Unattempted questions score 0.
2. Where a question says "Attempt any N", grade ONLY the first N attempted items in paper order.
3. For internal choice (OR) questions, grade ONLY the option marked as chosen.
4. Follow the official marking scheme if I attach one; otherwise use standard board value points.
5. Award full marks when the key value point is clearly communicated, even if the wording differs from the marking scheme.
6. Award partial credit wherever the marking scheme allows subdivision, or where the student has demonstrated partial understanding.
7. For objective / MCQ questions, mark correct or incorrect only.
8. For short / long answers, treat minor grammatical slips and spelling mistakes as a small deduction under "Accuracy / Fluency", not as a reason to withhold content marks.
9. Do not penalise for style differences as long as content is accurate and coherent.

OUTPUT FORMAT (Markdown)
Start with: **Score: X / Y (Z%)**
Produce a table:
| Q.No | My Answer (short) | Marks Awarded | Correct Answer / Value Points | Rule / Fix |

For every long / writing question add a rubric breakdown:
- Format (if applicable)
- Content / Value points
- Organisation / Structure
- Accuracy / Fluency (grammar, spelling, expression)

Finish with:
**Top 3 recurring fixes**
1. ...
2. ...
3. ...

Be constructive and specific. Do not rewrite my paper. Do not invent questions.`,
  },
  {
    value: "lenient",
    label: "Lenient",
    description:
      "Practice-friendly: gives benefit of the doubt, focuses on learning",
    prompt: `You are a supportive teacher evaluating my exam answers in a practice / self-study setting. Your goal is to help me learn, not to replicate exam-hall harshness.

SCORING RULES
1. Award marks only for questions I actually attempted. Unattempted questions score 0.
2. Where a question says "Attempt any N", grade ONLY the first N attempted items in paper order.
3. For internal choice (OR) questions, grade ONLY the option marked as chosen.
4. Award full marks when the student's answer captures the essential idea, even if phrasing, spelling or minor facts differ.
5. Give the benefit of the doubt when the student's intent is clear but wording is imprecise.
6. For objective / MCQ questions, mark correct or incorrect. Award partial credit only if the student provided a clear written justification alongside a wrong choice.
7. Ignore minor spelling and grammatical errors unless they change the meaning.
8. For long / writing tasks, focus feedback on improving ideas and structure rather than penalising errors.

OUTPUT FORMAT (Markdown)
Start with: **Score: X / Y (Z%)** — and add a brief one-sentence encouragement.
Produce a table:
| Q.No | My Answer (short) | Marks Awarded | Key Points | Suggestion |

For every long / writing question add a brief rubric:
- Content / Ideas
- Organisation
- Language

Finish with:
**Top 3 things to work on**
1. ...
2. ...
3. ...

Be encouraging and specific. Do not rewrite my paper. Do not invent questions.`,
  },
  {
    value: "none",
    label: "No prompt",
    description: "Export answers only — bring your own instructions",
    prompt: null,
  },
];

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
    const suffix = target
      ? ` _(${words} words; target ${target})_`
      : ` _(${words} words)_`;
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
  strictnessMode = "standard",
  includeUnattempted = false,
}) {
  const modeEntry = STRICTNESS_MODES.find((m) => m.value === strictnessMode);
  const evaluatorPrompt = modeEntry?.prompt ?? null;
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

  if (evaluatorPrompt) {
    lines.push(evaluatorPrompt);
    lines.push("");
    lines.push("---");
    lines.push("");
    lines.push("## My answers");
    lines.push("");
  }

  groups.forEach(({ section, entries: sectionEntries }) => {
    lines.push(
      `## ${section.label}${section.title ? ` — ${section.title}` : ""} (${formatMarks(
        section.marks,
      )} marks)`,
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
            question.attemptLimit && answeredCount > question.attemptLimit,
          );
        }
        const block = [];
        block.push(
          `**${question.number}${items.length > 1 ? `(${item.id})` : ""}.** ${itemHeading(item)}`,
        );
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
        headingBits.push(
          `— Option ${choice.key}${choice.label ? `: ${choice.label}` : ""} chosen`,
        );
      }
      if (question.attemptLimit) {
        headingBits.push(
          `— attempt any ${question.attemptLimit} of ${items.length}`,
        );
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
  const suffix =
    !scope || scope === "full" ? "full" : slugify(scope.replace(":", "-"));
  return `${base}-${suffix}-answers.txt`;
}
