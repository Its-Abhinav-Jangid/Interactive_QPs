import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { attemptPayloadSchema } from "@/lib/schemas/paper";

async function authenticatedClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function POST(request) {
  const { supabase, user } = await authenticatedClient();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = attemptPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid attempt payload", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const payload = parsed.data;

  const { data: existing, error: existingError } = await supabase
    .from("attempts")
    .select("id, status, completed_at")
    .eq("paper_id", payload.paperId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 400 });
  }

  const now = new Date().toISOString();
  const completedAt =
    payload.status === "completed" ? existing?.completed_at || now : null;

  const { data, error } = await supabase
    .from("attempts")
    .upsert(
      {
        paper_id: payload.paperId,
        user_id: user.id,
        responses: payload.responses,
        active_choices: payload.activeChoices,
        remaining_seconds: payload.remainingSeconds,
        status: payload.status,
        completed_at: completedAt,
      },
      { onConflict: "paper_id,user_id" }
    )
    .select("id, updated_at, status, remaining_seconds")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ attempt: data });
}

export async function DELETE(request) {
  const { supabase, user } = await authenticatedClient();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const paperId = searchParams.get("paperId");
  if (!paperId) {
    return NextResponse.json({ error: "paperId is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("attempts")
    .delete()
    .eq("paper_id", paperId)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
