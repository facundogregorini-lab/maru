"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { STATUSES, TRACKER_EVENT, findTracked, upsertTracked, type TrackInput, type TrackStatus } from "@/lib/tracker";

type Job = Pick<TrackInput, "id" | "title" | "company" | "jobUrl">;

/** Abrir la fuente guarda el aviso; el envío lo confirma la persona en su seguimiento. */
export function ApplyLink({ job, className, children }: { job: Job; className: string; children: React.ReactNode }) {
  return (
    <a href={job.jobUrl} target="_blank" rel="noopener noreferrer" onClick={() => upsertTracked(job)} className={className}>
      {children}
    </a>
  );
}

/** "Guardar en mi seguimiento" (o el estado en el que ya está). */
export function SaveJob({ job, className }: { job: Job; className: string }) {
  const [status, setStatus] = useState<TrackStatus | null>(null);
  useEffect(() => {
    const refresh = () => setStatus(findTracked(job)?.status ?? null);
    refresh();
    window.addEventListener(TRACKER_EVENT, refresh);
    return () => window.removeEventListener(TRACKER_EVENT, refresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.id, job.jobUrl]);

  if (status)
    return (
      <Link href="/seguimiento" className={className}>
        ✓ En tu seguimiento · {STATUSES.find((s) => s.id === status)?.one}
      </Link>
    );
  return (
    <button type="button" onClick={() => upsertTracked(job)} className={className}>
      Guardar en mi seguimiento
    </button>
  );
}
