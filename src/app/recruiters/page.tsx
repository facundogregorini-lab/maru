import type { Metadata } from "next";
import RecruitersHome from "@/components/recruiters/RecruitersHome";
import RecruitersShell from "@/components/recruiters/RecruitersShell";

export const metadata: Metadata = {
  title: "Maru Recruiters · Encontrá y evaluá candidatos con IA",
  description: "Contale a Maru a quién buscás: arma el perfil ideal, lee cada CV y te dice qué cumple con la evidencia. Vos decidís; la IA nunca descarta a nadie.",
  robots: { index: false, follow: false },
};

export default function RecruitersPage() {
  return (
    <RecruitersShell>
      <RecruitersHome />
    </RecruitersShell>
  );
}
