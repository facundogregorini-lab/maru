/** "Logo" de empresa: su inicial sobre un color que sale del nombre (siempre el mismo para la misma empresa). */
const COLORS = ["#1c8c4c", "#2457d6", "#e2553d", "#7a3fd1", "#0f9fb5", "#d4831c", "#c2367a", "#3f4a5a", "#118a7e", "#5b6ee1"];

export default function CompanyTile({ name, size = 48 }: { name: string; size?: number }) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-[10px] font-display font-bold text-white"
      style={{ width: size, height: size, background: COLORS[h % COLORS.length], fontSize: size * 0.46 }}
    >
      {name.trim()[0]?.toUpperCase() ?? "·"}
    </span>
  );
}
