import type { Metadata } from "next";
import SiteShell from "@/components/SiteShell";
import VideoFlow from "@/components/video/VideoFlow";

export const metadata: Metadata = {
  title: "Video de presentación · Maru",
  description: "Guion a medida, teleprompter mientras grabás con tu cámara y feedback de cada toma: ritmo, mirada, luz y contenido.",
};

export default function VideoPage() {
  return (
    <SiteShell tagline="Video de presentación">
      <VideoFlow />
    </SiteShell>
  );
}
