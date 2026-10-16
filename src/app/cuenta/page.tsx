import type { Metadata } from "next";
import SiteShell from "@/components/SiteShell";
import AccountPanel from "@/components/plan/AccountPanel";

export const metadata: Metadata = { title: "Mi cuenta · Maru", robots: { index: false } };

export default function CuentaPage() {
  return (
    <SiteShell>
      <div className="mx-auto max-w-3xl px-5 pb-24 pt-12 sm:pt-16">
        <h1 className="font-display text-4xl font-bold uppercase sm:text-5xl">Mi cuenta</h1>
        <div className="mt-8">
          <AccountPanel />
        </div>
      </div>
    </SiteShell>
  );
}
