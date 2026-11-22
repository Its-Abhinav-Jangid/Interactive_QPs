import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { paperFromRow } from "@/lib/paper";
import { ExamShell } from "@/components/exam/exam-shell";

export async function generateMetadata({ params }) {
  const { paperId } = await params;
  const { supabase } = await getCurrentUser();
  const { data } = await supabase
    .from("papers")
    .select("title, subtitle")
    .eq("id", paperId)
    .maybeSingle();

  if (!data) return { title: "Exam workspace" };
  return {
    title: data.title,
    description: data.subtitle || "Interactive exam workspace",
  };
}

export default async function ExamPage({ params }) {
  const { paperId } = await params;
  const { supabase, user } = await getCurrentUser();

  if (!user) {
    redirect(`/auth/login?next=${encodeURIComponent(`/exam/${paperId}`)}`);
  }

  const { data: row, error } = await supabase
    .from("papers")
    .select("*")
    .eq("id", paperId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (error) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-20">
        <h1 className="text-2xl font-semibold">Could not load this paper</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      </main>
    );
  }

  if (!row) notFound();

  const { data: attempt } = await supabase
    .from("attempts")
    .select("*")
    .eq("paper_id", row.id)
    .eq("user_id", user.id)
    .maybeSingle();

  const paper = paperFromRow(row);

  return (
    <ExamShell
      paper={paper}
      initialAttempt={attempt || null}
      mode="owner"
      shareMeta={{
        id: row.id,
        title: row.title,
        visibility: row.visibility,
        share_slug: row.share_slug,
        sender_note: row.sender_note,
      }}
    />
  );
}
