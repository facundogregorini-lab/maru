import type { Metadata } from "next";
import RecruitersShell from "@/components/recruiters/RecruitersShell";
import SearchView from "@/components/recruiters/SearchView";

export const metadata: Metadata = {
  title: "Búsqueda · Maru Recruiters",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ id: string }> };

export default async function RecruiterSearchPage({ params }: Props) {
  const { id } = await params;
  return (
    <RecruitersShell>
      <SearchView id={id} />
    </RecruitersShell>
  );
}
