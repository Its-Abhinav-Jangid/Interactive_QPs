"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { paperSchema, shareSettingsSchema } from "@/lib/schemas/paper";
import { DEMO_PAPERS } from "@/lib/demo-papers";
import { uniqueSlug } from "@/lib/utils";

const visibilitySchema = z.enum(["private", "unlisted", "public"]);

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { supabase, user: null, error: "Please sign in again." };
  }
  return { supabase, user, error: null };
}

function paperRow(paper, userId, visibility) {
  return {
    slug: uniqueSlug(paper.title),
    owner_id: userId,
    title: paper.title,
    subtitle: paper.subtitle || null,
    subject: paper.subject,
    board: paper.board || null,
    duration_minutes: paper.durationMinutes,
    max_marks: paper.maxMarks,
    content: paper,
    visibility,
  };
}

export async function saveImportedPaper(input) {
  const { supabase, user, error } = await requireUser();
  if (!user) return { ok: false, error };

  const visibilityResult = visibilitySchema.safeParse(input?.visibility);
  const visibility = visibilityResult.success ? visibilityResult.data : "private";

  const parsed = paperSchema.safeParse(input?.content);
  if (!parsed.success) {
    return {
      ok: false,
      error: "The paper did not pass validation.",
      issues: parsed.error.issues,
    };
  }

  const { data, error: insertError } = await supabase
    .from("papers")
    .insert(paperRow(parsed.data, user.id, visibility))
    .select("id")
    .single();

  if (insertError) {
    return { ok: false, error: insertError.message };
  }

  revalidatePath("/");
  return { ok: true, id: data.id };
}

export async function loadDemoPapers() {
  const { supabase, user, error } = await requireUser();
  if (!user) return { ok: false, error };

  const titles = DEMO_PAPERS.map((entry) => entry.paper.title);
  const { data: existing, error: existingError } = await supabase
    .from("papers")
    .select("title")
    .eq("owner_id", user.id)
    .in("title", titles);

  if (existingError) return { ok: false, error: existingError.message };

  const existingTitles = new Set((existing || []).map((row) => row.title));
  let inserted = 0;
  let skipped = 0;

  for (const entry of DEMO_PAPERS) {
    if (existingTitles.has(entry.paper.title)) {
      skipped += 1;
      continue;
    }
    const parsed = paperSchema.safeParse(entry.paper);
    if (!parsed.success) {
      return {
        ok: false,
        error: `Demo paper "${entry.label}" is invalid.`,
        issues: parsed.error.issues,
      };
    }
    const { error: insertError } = await supabase
      .from("papers")
      .insert(paperRow(parsed.data, user.id, "private"));
    if (insertError) return { ok: false, error: insertError.message };
    inserted += 1;
  }

  revalidatePath("/");
  return { ok: true, inserted, skipped };
}

export async function duplicatePaper(paperId) {
  const { supabase, user, error } = await requireUser();
  if (!user) return { ok: false, error };

  const idResult = z.string().uuid().safeParse(paperId);
  if (!idResult.success) return { ok: false, error: "Invalid paper id." };

  const { data: original, error: fetchError } = await supabase
    .from("papers")
    .select("*")
    .eq("id", idResult.data)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (fetchError) return { ok: false, error: fetchError.message };
  if (!original) return { ok: false, error: "Paper not found." };

  const title = `${original.title} (copy)`;
  const { data, error: insertError } = await supabase
    .from("papers")
    .insert({
      slug: uniqueSlug(title),
      owner_id: user.id,
      title,
      subtitle: original.subtitle,
      subject: original.subject,
      board: original.board,
      duration_minutes: original.duration_minutes,
      max_marks: original.max_marks,
      content: original.content,
      visibility: "private",
      sender_note: null,
    })
    .select("id")
    .single();

  if (insertError) return { ok: false, error: insertError.message };

  revalidatePath("/");
  return { ok: true, id: data.id };
}

export async function deletePaper(paperId) {
  const { supabase, user, error } = await requireUser();
  if (!user) return { ok: false, error };

  const idResult = z.string().uuid().safeParse(paperId);
  if (!idResult.success) return { ok: false, error: "Invalid paper id." };

  const { error: deleteError } = await supabase
    .from("papers")
    .delete()
    .eq("id", idResult.data)
    .eq("owner_id", user.id);

  if (deleteError) return { ok: false, error: deleteError.message };

  revalidatePath("/");
  return { ok: true };
}

export async function updateShareSettings(input) {
  const { supabase, user, error } = await requireUser();
  if (!user) return { ok: false, error };

  const parsed = shareSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message || "Invalid share settings." };
  }

  const { data, error: updateError } = await supabase
    .from("papers")
    .update({
      visibility: parsed.data.visibility,
      sender_note: parsed.data.senderNote?.trim() || null,
    })
    .eq("id", parsed.data.paperId)
    .eq("owner_id", user.id)
    .select("share_slug, visibility, sender_note")
    .single();

  if (updateError) return { ok: false, error: updateError.message };

  revalidatePath("/");
  return {
    ok: true,
    shareSlug: data.share_slug,
    visibility: data.visibility,
    senderNote: data.sender_note,
  };
}

export async function resetAttempt(paperId) {
  const { supabase, user, error } = await requireUser();
  if (!user) return { ok: false, error };

  const idResult = z.string().uuid().safeParse(paperId);
  if (!idResult.success) return { ok: false, error: "Invalid paper id." };

  const { error: deleteError } = await supabase
    .from("attempts")
    .delete()
    .eq("paper_id", idResult.data)
    .eq("user_id", user.id);

  if (deleteError) return { ok: false, error: deleteError.message };

  revalidatePath("/");
  return { ok: true };
}
