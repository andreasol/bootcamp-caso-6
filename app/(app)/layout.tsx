import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/services/profile";

// Session data is request-specific, so the header streams in behind its own Suspense boundary.
async function SessionHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await getCurrentProfile(supabase);
  return <AppHeader profile={profile} email={user.email ?? ""} />;
}

function HeaderPlaceholder() {
  return <div className="h-[69px] border-b border-line bg-surface" aria-hidden />;
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <Suspense fallback={<HeaderPlaceholder />}>
        <SessionHeader />
      </Suspense>
      {children}
    </>
  );
}
