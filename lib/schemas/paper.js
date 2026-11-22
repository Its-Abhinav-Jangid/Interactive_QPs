import { z } from "zod";

const nonEmpty = (label) => z.string().trim().min(1, `${label} is required`);

const wordTargetSchema = z
  .union([
    z.number().int().positive(),
    z
      .object({
        min: z.number().int().positive(),
        max: z.number().int().positive(),
      })
      .refine((value) => value.max >= value.min, {
        message: "wordTarget.max must be greater than or equal to min",
        path: ["max"],
      }),
  ])
  .nullish();

const baseItem = {
  id: nonEmpty("Item id"),
  prompt: nonEmpty("Prompt"),
  quote: z.string().nullish(),
};

export const mcqItemSchema = z.object({
  ...baseItem,
  type: z.literal("mcq"),
  options: z.array(nonEmpty("Option")).min(2, "At least two options are required"),
});

export const shortItemSchema = z.object({
  ...baseItem,
  type: z.literal("short"),
  stemPrefix: z.string().nullish(),
  stemSuffix: z.string().nullish(),
});

export const errorCorrectionItemSchema = z.object({
  ...baseItem,
  type: z.literal("error_correction"),
});

export const longItemSchema = z.object({
  ...baseItem,
  type: z.literal("long"),
  wordTarget: wordTargetSchema,
});

export const itemSchema = z.discriminatedUnion("type", [
  mcqItemSchema,
  shortItemSchema,
  errorCorrectionItemSchema,
  longItemSchema,
]);

export const passageBlockSchema = z.object({
  type: z.literal("passage"),
  heading: z.string().nullish(),
  paragraphs: z.array(nonEmpty("Paragraph")).min(1, "At least one paragraph is required"),
  footnote: z.string().nullish(),
});

export const extractBlockSchema = z.object({
  type: z.literal("extract"),
  heading: z.string().nullish(),
  source: z.string().nullish(),
  text: nonEmpty("Extract text"),
});

export const tableBlockSchema = z.object({
  type: z.literal("table"),
  caption: z.string().nullish(),
  headers: z.array(z.string()).min(1, "At least one header is required"),
  rows: z.array(z.array(z.string())).min(1, "At least one row is required"),
});

export const swotBlockSchema = z.object({
  type: z.literal("swot"),
  title: z.string().nullish(),
  strengths: z.array(z.string()).default([]),
  weaknesses: z.array(z.string()).default([]),
  opportunities: z.array(z.string()).default([]),
  threats: z.array(z.string()).default([]),
});

export const bulletsBlockSchema = z.object({
  type: z.literal("bullets"),
  heading: z.string().nullish(),
  items: z.array(nonEmpty("Bullet")).min(1, "At least one bullet is required"),
});

export const chartBlockSchema = z
  .object({
    type: z.literal("chart"),
    chartType: z.enum(["bar", "line", "pie"]),
    title: z.string().nullish(),
    unit: z.string().nullish(),
    yMax: z.number().positive().nullish(),
    categories: z.array(nonEmpty("Category")).min(1, "At least one category is required"),
    series: z
      .array(
        z.object({
          name: nonEmpty("Series name"),
          values: z.array(z.number()).min(1),
        })
      )
      .min(1, "At least one series is required"),
    altText: z.string().nullish(),
  })
  .superRefine((chart, ctx) => {
    chart.series.forEach((series, index) => {
      if (series.values.length !== chart.categories.length) {
        ctx.addIssue({
          code: "custom",
          path: ["series", index, "values"],
          message: `Series "${series.name}" has ${series.values.length} values but ${chart.categories.length} categories`,
        });
      }
    });
  });

export const stimulusBlockSchema = z.discriminatedUnion("type", [
  passageBlockSchema,
  extractBlockSchema,
  tableBlockSchema,
  swotBlockSchema,
  bulletsBlockSchema,
  chartBlockSchema,
]);

export const choiceSchema = z.object({
  key: z.enum(["A", "B"]),
  label: z.string().nullish(),
  stimulus: z.array(stimulusBlockSchema).nullish(),
  items: z.array(itemSchema).min(1, "A choice needs at least one item"),
});

const questionBaseSchema = z.object({
  id: nonEmpty("Question id"),
  number: z.union([z.string(), z.number()]).transform((value) => String(value)),
  title: z.string().nullish(),
  instruction: z.string().nullish(),
  marks: z.number().positive("Marks must be greater than zero"),
  layout: z.enum(["split", "stack", "grid"]).default("stack"),
  attemptLimit: z.number().int().positive().nullish(),
  exportGroup: z.string().nullish(),
  stimulus: z.array(stimulusBlockSchema).nullish(),
  items: z.array(itemSchema).nullish(),
  choices: z.array(choiceSchema).nullish(),
});

export const questionSchema = questionBaseSchema.superRefine((question, ctx) => {
  const items = question.items || [];
  const choices = question.choices || [];
  const hasItems = items.length > 0;
  const hasChoices = choices.length > 0;

  if (hasItems === hasChoices) {
    ctx.addIssue({
      code: "custom",
      path: ["items"],
      message:
        "Provide exactly one of `items` or `choices` (and leave the other empty or null)",
    });
  }

  if (hasChoices) {
    if (choices.length !== 2) {
      ctx.addIssue({
        code: "custom",
        path: ["choices"],
        message: "Internal choice questions need exactly two choices (A and B)",
      });
    }
    const keys = new Set(choices.map((choice) => choice.key));
    if (keys.size !== choices.length) {
      ctx.addIssue({
        code: "custom",
        path: ["choices"],
        message: "Choice keys must be unique",
      });
    }
    if (question.attemptLimit) {
      choices.forEach((choice, index) => {
        if (choice.items.length < question.attemptLimit) {
          ctx.addIssue({
            code: "custom",
            path: ["choices", index, "items"],
            message: `attemptLimit is ${question.attemptLimit} but this choice only has ${choice.items.length} items`,
          });
        }
      });
    }
  }

  if (hasItems && question.attemptLimit && items.length < question.attemptLimit) {
    ctx.addIssue({
      code: "custom",
      path: ["attemptLimit"],
      message: `attemptLimit is ${question.attemptLimit} but the question only has ${items.length} items`,
    });
  }

  if (question.layout === "split" && !(question.stimulus || []).length) {
    ctx.addIssue({
      code: "custom",
      path: ["layout"],
      message: "A split layout needs at least one stimulus block",
    });
  }

  if (question.choices?.some((choice) => (choice.items || []).length === 0)) {
    ctx.addIssue({
      code: "custom",
      path: ["choices"],
      message: "Each choice needs at least one item",
    });
  }
});

export const sectionSchema = z.object({
  id: nonEmpty("Section id"),
  label: nonEmpty("Section label"),
  title: z.string().nullish(),
  marks: z.number().positive("Section marks must be greater than zero"),
  questions: z.array(questionSchema).min(1, "A section needs at least one question"),
});

export const paperSchema = z
  .object({
    title: nonEmpty("Title"),
    subtitle: z.string().nullish(),
    subject: nonEmpty("Subject"),
    board: z.string().nullish(),
    durationMinutes: z
      .number()
      .int()
      .positive("Duration must be greater than zero")
      .max(600, "Duration looks too long"),
    maxMarks: z.number().positive("Max marks must be greater than zero"),
    instructions: z.array(z.string()).default([]),
    sections: z.array(sectionSchema).min(1, "At least one section is required"),
  })
  .superRefine((paper, ctx) => {
    const sectionIds = new Set();
    const questionIds = new Set();
    const itemIds = new Set();

    paper.sections.forEach((section, sectionIndex) => {
      if (sectionIds.has(section.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["sections", sectionIndex, "id"],
          message: `Duplicate section id "${section.id}"`,
        });
      }
      sectionIds.add(section.id);

      section.questions.forEach((question, questionIndex) => {
        if (questionIds.has(question.id)) {
          ctx.addIssue({
            code: "custom",
            path: ["sections", sectionIndex, "questions", questionIndex, "id"],
            message: `Duplicate question id "${question.id}"`,
          });
        }
        questionIds.add(question.id);

        const registerItems = (items, pathPrefix) => {
          (items || []).forEach((item, itemIndex) => {
            if (itemIds.has(item.id)) {
              ctx.addIssue({
                code: "custom",
                path: [...pathPrefix, "items", itemIndex, "id"],
                message: `Duplicate item id "${item.id}"`,
              });
            }
            itemIds.add(item.id);
          });
        };

        registerItems(question.items, [
          "sections",
          sectionIndex,
          "questions",
          questionIndex,
        ]);

        (question.choices || []).forEach((choice, choiceIndex) => {
          registerItems(choice.items, [
            "sections",
            sectionIndex,
            "questions",
            questionIndex,
            "choices",
            choiceIndex,
          ]);
        });
      });
    });
  });

export const attemptPayloadSchema = z.object({
  paperId: z.string().uuid("Invalid paper id"),
  responses: z.record(z.string(), z.any()).default({}),
  activeChoices: z.record(z.string(), z.enum(["A", "B"])).default({}),
  remainingSeconds: z
    .number()
    .int()
    .min(0)
    .max(24 * 60 * 60, "Timer value is out of range"),
  status: z.enum(["in_progress", "completed"]).default("in_progress"),
});

export const shareSettingsSchema = z.object({
  paperId: z.string().uuid("Invalid paper id"),
  visibility: z.enum(["private", "unlisted", "public"]),
  senderNote: z
    .string()
    .trim()
    .max(1000, "Sender note must be 1000 characters or fewer")
    .nullish(),
});

export function validatePaper(input) {
  const result = paperSchema.safeParse(input);
  return result;
}

export function pathToLabel(path, draft) {
  if (!path || path.length === 0) return "Paper";
  const parts = [];
  let node = draft;

  for (let index = 0; index < path.length; index += 1) {
    const segment = path[index];

    if (segment === "sections") {
      const next = path[index + 1];
      if (typeof next === "number") {
        index += 1;
        node = node?.sections?.[next];
        parts.push(`Section ${node?.label || next + 1}`);
        continue;
      }
    }

    if (segment === "questions") {
      const next = path[index + 1];
      if (typeof next === "number") {
        index += 1;
        node = node?.questions?.[next];
        parts.push(`Q${node?.number ?? next + 1}`);
        continue;
      }
    }

    if (segment === "items") {
      const next = path[index + 1];
      if (typeof next === "number") {
        index += 1;
        node = node?.items?.[next];
        parts.push(`item ${next + 1}`);
        continue;
      }
    }

    if (segment === "choices") {
      const next = path[index + 1];
      if (typeof next === "number") {
        index += 1;
        node = node?.choices?.[next];
        parts.push(`Option ${node?.key || next + 1}`);
        continue;
      }
    }

    if (segment === "stimulus") {
      const next = path[index + 1];
      if (typeof next === "number") {
        index += 1;
        node = node?.stimulus?.[next];
        parts.push(`stimulus ${next + 1}`);
        continue;
      }
    }

    if (segment === "series") {
      const next = path[index + 1];
      if (typeof next === "number") {
        index += 1;
        parts.push(`series ${next + 1}`);
        continue;
      }
    }

    parts.push(String(segment));
  }

  return parts.join(" → ");
}

export function formatPaperIssues(issues, draft) {
  return (issues || []).map((issue) => ({
    path: Array.isArray(issue.path) ? issue.path : [],
    label: pathToLabel(issue.path, draft),
    message: issue.message,
  }));
}
