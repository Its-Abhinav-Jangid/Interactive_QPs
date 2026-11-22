import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { paperFromRow } from "@/lib/paper";
import { ExamShell } from "@/components/exam/exam-shell";

async function fetchSharedPaper(shareSlug) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_shared_paper", {
    p_slug: shareSlug,
  });

  if (error) return { paper: null, error: error.message };
  const row = Array.isArray(data) ? data[0] : data;
  return { paper: row || null, error: null };
}

export async function generateMetadata({ params }) {
  const { shareSlug } = await params;
  const { paper } = await fetchSharedPaper(shareSlug);
  if (!paper) return { title: "Shared test" };
  return {
    title: paper.title,
    description: paper.subtitle || "Shared practice test",
  };
}

export default async function SharedPaperPage({ params }) {
  const { shareSlug } = await params;
  const { paper: row, error } = await fetchSharedPaper(shareSlug);

  if (error) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-20">
        <h1 className="text-2xl font-semibold">Could not load this shared test</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error}</p>
      </main>
    );
  }

  if (!row) notFound();

  const paper = paperFromRow(row);

  return (
    <ExamShell
      paper={paper}
      mode="shared"
      shareSlug={row.share_slug}
      senderNote={row.sender_note}
    />
  );
}
