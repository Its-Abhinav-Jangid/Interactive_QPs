import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { ImportWorkspace } from "@/components/import/import-workspace";

export const metadata = {
  title: "Import & AI Prompt Studio",
};

export default async function ImportPage() {
  const { supabase, user } = await getCurrentUser();
  if (!user) redirect("/auth/login?next=/import");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, role")
    .eq("id", user.id)
    .maybeSingle();

  return <ImportWorkspace user={user} profile={profile} />;
}
