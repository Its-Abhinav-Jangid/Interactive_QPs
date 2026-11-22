import { clamp } from "@/lib/utils";

export function flattenQuestions(paper) {
  const entries = [];
  (paper?.sections || []).forEach((section, sectionIndex) => {
    (section.questions || []).forEach((question, questionIndex) => {
      entries.push({ section, question, sectionIndex, questionIndex });
    });
  });
  return entries;
}

export function getQuestionItems(question, activeChoice) {
  if (!question) return [];
  if (question.choices?.length) {
    const choice =
      question.choices.find((entry) => entry.key === activeChoice) ||
      question.choices[0];
    return choice?.items || [];
  }
  return question.items || [];
}

export function getChoiceFor(question, activeChoice) {
  if (!question?.choices?.length) return null;
  return (
    question.choices.find((entry) => entry.key === activeChoice) ||
    question.choices[0] ||
    null
  );
}

export function getItemValue(response, choiceKey, itemId) {
  if (!response) return undefined;
  if (choiceKey) {
    return response.choices?.[choiceKey]?.[itemId];
  }
  return response.direct?.[itemId];
}

export function isValueAnswered(value, item) {
  if (value == null) return false;
  if (item?.type === "error_correction") {
    if (typeof value !== "object") return false;
    return Boolean(
      String(value.error || "").trim() || String(value.correction || "").trim()
    );
  }
  if (typeof value === "string") return value.trim().length > 0;
  return Boolean(value);
}

export function countAttemptedItems(question, response, activeChoice) {
  if (!question || !response) return 0;
  const items = getQuestionItems(question, activeChoice);
  const choiceKey = question.choices?.length
    ? getChoiceFor(question, activeChoice)?.key
    : null;
  return items.reduce((total, item) => {
    const value = getItemValue(response, choiceKey, item.id);
    return total + (isValueAnswered(value, item) ? 1 : 0);
  }, 0);
}

export function isQuestionAttempted(question, response, activeChoice) {
  return countAttemptedItems(question, response, activeChoice) > 0;
}

export function questionContribution(question, response, activeChoice) {
  const attempted = countAttemptedItems(question, response, activeChoice);
  if (!attempted) return 0;
  const limit = question.attemptLimit;
  if (limit) {
    return (Math.min(attempted, limit) / limit) * question.marks;
  }
  const items = getQuestionItems(question, activeChoice);
  if (items.length > 1) {
    return (attempted / items.length) * question.marks;
  }
  return question.marks;
}

export function computeProgress(paper, responses, activeChoices) {
  const entries = flattenQuestions(paper);
  let attemptedMarks = 0;
  let attemptedItems = 0;
  let attemptedQuestions = 0;
  const overLimit = [];

  entries.forEach(({ question }) => {
    const response = responses?.[question.id];
    const activeChoice = activeChoices?.[question.id];
    const count = countAttemptedItems(question, response, activeChoice);
    attemptedItems += count;
    if (count > 0) attemptedQuestions += 1;
    attemptedMarks += questionContribution(question, response, activeChoice);

    if (question.attemptLimit && count > question.attemptLimit) {
      overLimit.push({
        question,
        attempted: count,
        limit: question.attemptLimit,
      });
    }
  });

  const maxMarks = Number(paper?.maxMarks) || 0;
  const cappedMarks = Math.min(attemptedMarks, maxMarks);
  const percent = maxMarks > 0 ? clamp((cappedMarks / maxMarks) * 100, 0, 100) : 0;

  return {
    attemptedMarks: Math.round(cappedMarks * 10) / 10,
    maxMarks,
    attemptedItems,
    attemptedQuestions,
    totalQuestions: entries.length,
    overLimit,
    percent,
  };
}

export function getPaperStats(paper) {
  const entries = flattenQuestions(paper);
  let items = 0;
  entries.forEach(({ question }) => {
    if (question.choices?.length) {
      items += question.choices.reduce(
        (total, choice) => total + (choice.items?.length || 0),
        0
      );
    } else {
      items += question.items?.length || 0;
    }
  });
  return {
    sections: paper?.sections?.length || 0,
    questions: entries.length,
    items,
  };
}

export function getExportScopes(paper) {
  const scopes = [{ value: "full", label: "Full Paper", type: "full" }];

  (paper?.sections || []).forEach((section) => {
    scopes.push({
      value: `section:${section.id}`,
      label: `${section.label}${section.title ? ` — ${section.title}` : ""}`,
      type: "section",
      sectionId: section.id,
    });
  });

  const groups = [];
  const seen = new Set();
  flattenQuestions(paper).forEach(({ question }) => {
    const group = question.exportGroup?.trim();
    if (group && !seen.has(group)) {
      seen.add(group);
      groups.push(group);
    }
  });

  groups.forEach((group) => {
    scopes.push({
      value: `group:${group}`,
      label: group,
      type: "group",
      group,
    });
  });

  return scopes;
}

export function questionsForScope(paper, scope) {
  const entries = flattenQuestions(paper);
  if (!scope || scope === "full") return entries;
  if (scope.startsWith("section:")) {
    const id = scope.slice("section:".length);
    return entries.filter(({ section }) => section.id === id);
  }
  if (scope.startsWith("group:")) {
    const group = scope.slice("group:".length);
    return entries.filter(({ question }) => question.exportGroup === group);
  }
  return entries;
}

export function groupEntriesBySection(entries) {
  const groups = [];
  const map = new Map();
  entries.forEach((entry) => {
    const key = entry.section.id;
    if (!map.has(key)) {
      const group = { section: entry.section, entries: [] };
      map.set(key, group);
      groups.push(group);
    }
    map.get(key).entries.push(entry);
  });
  return groups;
}

export function paperFromRow(row) {
  if (!row) return null;
  const content = row.content || {};
  return {
    ...content,
    id: row.id ?? content.id,
    slug: row.slug ?? content.slug,
    shareSlug: row.share_slug ?? content.shareSlug,
    visibility: row.visibility ?? content.visibility,
    title: row.title || content.title,
    subtitle: row.subtitle ?? content.subtitle,
    subject: row.subject || content.subject,
    board: row.board ?? content.board,
    durationMinutes:
      row.duration_minutes ?? row.durationMinutes ?? content.durationMinutes,
    maxMarks: Number(row.max_marks ?? row.maxMarks ?? content.maxMarks),
    instructions: content.instructions || [],
    sections: content.sections || [],
  };
}

export function emptyResponseMap(paper) {
  const responses = {};
  flattenQuestions(paper).forEach(({ question }) => {
    responses[question.id] = {};
  });
  return responses;
}

export function isItemComplete(item, value) {
  if (item?.type === "error_correction") {
    if (!value || typeof value !== "object") return false;
    return Boolean(
      String(value.error || "").trim() && String(value.correction || "").trim()
    );
  }
  return isValueAnswered(value, item);
}

export function normalizeTimerSeconds(paper, value) {
  const fallback = Math.max(0, Math.round((Number(paper?.durationMinutes) || 0) * 60));
  if (value == null) return fallback;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return fallback;
  return Math.min(Math.round(number), 24 * 60 * 60);
}
