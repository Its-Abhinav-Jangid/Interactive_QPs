import englishSample from "@/seed/english-10-sample.json";
import scienceSample from "@/seed/science-10-sample.json";

export const DEMO_PAPERS = [
  {
    id: "english-10-sample",
    label: "Class 10 English",
    description:
      "Reading passage, poetry extract, 12-item grammar task with an attempt limit, internal-choice writing and literature questions.",
    paper: englishSample,
  },
  {
    id: "science-10-sample",
    label: "Class 10 Science",
    description:
      "Objective set, case-based table and line chart, experiment bullets with a pie chart, SWOT analysis and long-answer choices.",
    paper: scienceSample,
  },
];

export function getDemoPaper(id) {
  return DEMO_PAPERS.find((entry) => entry.id === id)?.paper || null;
}
