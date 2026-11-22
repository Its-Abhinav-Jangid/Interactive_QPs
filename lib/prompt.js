export const PROMPT_SCHEMA_SKELETON = `{
  "title": "Exact paper title",
  "subtitle": "e.g. Language & Literature (184)",
  "subject": "English",
  "board": "CBSE",
  "durationMinutes": 180,
  "maxMarks": 80,
  "instructions": ["1. All questions are compulsory.", "2. This paper has 4 sections."],
  "sections": [
    {
      "id": "A",
      "label": "Section A",
      "title": "Reading Skills",
      "marks": 20,
      "questions": [
        {
          "id": "q1",
          "number": "1",
          "title": "Read the passage and answer the questions.",
          "instruction": "Attempt all questions.",
          "marks": 10,
          "layout": "split",
          "attemptLimit": null,
          "exportGroup": null,
          "stimulus": [
            { "type": "passage", "heading": "1. Read the following passage:", "paragraphs": ["Paragraph one…", "Paragraph two…"], "footnote": null },
            { "type": "extract", "heading": "Poem extract", "source": "— Robert Frost", "text": "Two roads diverged in a yellow wood,\\nAnd sorry I could not travel both" },
            { "type": "table", "caption": "Table 1", "headers": ["Year", "Value"], "rows": [["2021", "42"], ["2022", "57"]] },
            { "type": "swot", "title": "SWOT analysis", "strengths": ["…"], "weaknesses": ["…"], "opportunities": ["…"], "threats": ["…"] },
            { "type": "bullets", "heading": "Key points", "items": ["Point one", "Point two"] },
            { "type": "chart", "chartType": "bar", "title": "Enrolment by year", "unit": "students", "yMax": 600, "categories": ["2021", "2022", "2023"], "series": [{ "name": "Enrolment", "values": [420, 510, 580] }], "altText": "Bar chart showing enrolment rising from 420 to 580." }
          ],
          "items": [
            { "id": "q1a", "type": "mcq", "prompt": "The tone of the passage is…", "options": ["critical", "nostalgic", "angry", "neutral"] },
            { "id": "q1b", "type": "short", "prompt": "Complete the sentence:", "quote": "The writer compares the two roads to…", "stemPrefix": "The writer compares the two roads to", "stemSuffix": "because…" },
            { "id": "q1c", "type": "error_correction", "prompt": "Identify the error and write the correction.", "quote": "Each of the students have submitted the assignment." },
            { "id": "q1d", "type": "long", "prompt": "Write a letter to the editor…", "wordTarget": { "min": 120, "max": 150 } }
          ],
          "choices": null
        }
      ]
    }
  ]
}`;

export function buildExtractionPrompt(fields = {}) {
  const paperName = fields.paperName?.trim() || "the attached examination paper";
  const subject = fields.subject?.trim() || "the paper's subject";
  const board = fields.board?.trim() || "CBSE";
  const classLevel = fields.classLevel?.trim() || "Class 10";
  const sourcePages = fields.sourcePages?.trim() || "all pages of the attached paper";
  const duration = fields.durationMinutes ? `${fields.durationMinutes} minutes` : "the duration printed on the paper";
  const maxMarks = fields.maxMarks ? String(fields.maxMarks) : "the maximum marks printed on the paper";
  const notes = fields.notes?.trim();

  return `You are converting a static board examination paper into structured JSON for an interactive exam app. Work carefully and output JSON ONLY — no commentary, no Markdown fences.

TARGET PAPER
- Name: ${paperName}
- Subject: ${subject}
- Board / class: ${board}, ${classLevel}
- Source: ${sourcePages}
- Duration: ${duration}
- Maximum marks: ${maxMarks}
${notes ? `- Special instructions from the teacher: ${notes}\n` : ""}
ZERO-SPOILER POLICY (CRITICAL)
- Never include answers, answer keys, hints, marking schemes, value points, or explanations anywhere in the JSON.
- Do not add fields such as "answer", "solution", "correctOption", "hint", or "markingScheme".
- Do not mark the correct MCQ option in any way.
- If the source paper includes answers, ignore them completely.

WHAT TO EXTRACT
1. Preserve the paper's numbering, section order, marks, instructions and wording. Do not rewrite, summarise or "improve" the questions.
2. Keep line breaks inside poems, drama extracts and letters using \\n inside the JSON string.
3. Preserve tables exactly. Keep every header and cell as a string.
4. If a question has a shared reading passage, table, chart or other stimulus, put it in "stimulus" and set layout to "split" (sticky reading pane) or "stack".
5. Use layout "grid" only for compact 2-column card questions (typically objective questions with no shared stimulus).
6. For internal choice (OR), use "choices" with exactly two entries keyed "A" and "B". Put the shared OR stem in the question and each option's own content in its choice. Drafts must not be mixed.
7. For "Attempt any N of M" instructions, set "attemptLimit": N on that question and list all M sub-questions in "items". Each item should be one scorable answer. Do not create a separate question per sub-item.
8. Set "exportGroup" when a question belongs to a named export slice, e.g. "Grammar Only (Q3)" or "Writing Only (Q4–Q5)". Otherwise use null.
9. MCQ options must be plain strings in display order. Include True/False and Assertion–Reason options as plain strings.
10. For fill-in-the-blank questions use "short" with "stemPrefix" and "stemSuffix" around the blank, and put the full sentence in "quote" only if it helps the student.
11. For grammar error questions use "error_correction". For long writing tasks use "long" with "wordTarget" as { "min": N, "max": M }.
12. Charts: "chartType" must be "bar", "line" or "pie". Every series must have exactly one value per category. Always provide "altText" describing the data in one or two sentences for visually impaired students. Use "yMax" only when the source specifies an axis maximum.
13. Use stable lowercase ids: question ids "q1", "q2"…, item ids "q1a", "q1b"…, section ids "A", "B"…. Ids must be unique across the whole paper.
14. Every question must have exactly one of "items" or "choices" — never both and never neither.
15. Numbers: marks, durationMinutes, maxMarks, yMax and chart values are JSON numbers, not strings.

EXACT OUTPUT SHAPE
${PROMPT_SCHEMA_SKELETON}

FINAL CHECK BEFORE YOU ANSWER
- JSON parses with no trailing commas and no comments.
- Section labels and question numbers match the source paper.
- Total marks are consistent with the source (sum of section marks ≈ maxMarks).
- No answer key or hint appears anywhere.
- Every stimulus block uses one of the allowed "type" values.
- Every chart series length equals the number of categories.
- Output starts with { and ends with }.

Return only the JSON object.`;
}

export const PROMPT_WORKFLOW = [
  {
    title: "Upload the paper",
    body: "Attach the board paper PDF or photos to ChatGPT, Gemini or Claude. Include the marking scheme only if you want it ignored — the prompt enforces a zero-spoiler export.",
  },
  {
    title: "Fill the builder and copy",
    body: "Set the paper name, subject, board, duration and marks, then copy the generated prompt. Paste it with the paper into your AI tool.",
  },
  {
    title: "Paste the JSON here",
    body: "Drop the AI response into the Importer tab. Markdown fences are stripped automatically and every field is validated before saving.",
  },
  {
    title: "Fix, preview, save",
    body: "Field-level errors point to the exact section, question and item. Fix them inline, check the preview summary, then save to your library.",
  },
];
