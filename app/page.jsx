import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { computeProgress, getPaperStats, paperFromRow } from "@/lib/paper";
import { LibraryView } from "@/components/library/library-view";

export const metadata = {
  title: "Paper Library",
};

export default async function DashboardPage() {
  const { supabase, user } = await getCurrentUser();

  if (!user) {
    redirect("/auth/login?next=/");
  }

  const [{ data: profile }, { data: papers, error: papersError }, { data: attempts }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, display_name, role, board, class_level")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("papers")
        .select("*")
        .eq("owner_id", user.id)
        .order("updated_at", { ascending: false }),
      supabase.from("attempts").select("*").eq("user_id", user.id),
    ]);

  if (papersError) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-20">
        <h1 className="text-2xl font-semibold">Could not load your library</h1>
        <p className="mt-2 text-sm text-muted-foreground">{papersError.message}</p>
      </main>
    );
  }

  const attemptByPaper = new Map(
    (attempts || []).map((attempt) => [attempt.paper_id, attempt])
  );

  const enriched = (papers || []).map((row) => {
    const paper = paperFromRow(row);
    const attempt = attemptByPaper.get(row.id);
    const progress = computeProgress(
      paper,
      attempt?.responses || {},
      attempt?.active_choices || {}
    );

    return {
      ...row,
      content: row.content,
      stats: getPaperStats(paper),
      attempt: attempt
        ? {
            status: attempt.status,
            remaining_seconds: attempt.remaining_seconds,
            updated_at: attempt.updated_at,
            percent: progress.percent,
            attemptedMarks: progress.attemptedMarks,
            maxMarks: progress.maxMarks,
            attemptedQuestions: progress.attemptedQuestions,
          }
        : null,
    };
  });

  return <LibraryView papers={enriched} user={user} profile={profile} />;
}
