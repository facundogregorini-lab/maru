import type { Metadata } from "next";
import AdminPanel from "@/components/match/AdminPanel";
import SiteShell from "@/components/SiteShell";

export const metadata: Metadata = { title: "Cobertura del match · Maru", robots: { index: false, follow: false } };

export default function MatchAdminPage() {
  return (
    <SiteShell tagline="Administración">
      <AdminPanel />
    </SiteShell>
  );
}
