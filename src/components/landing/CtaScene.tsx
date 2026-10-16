import Link from "next/link";
import { MaruSprite } from "@/components/maru/PixelMaru";

/**
 * El cierre de jobright: un globo negro con el titular, un dibujo de línea (compu, planta, pájaro
 * y una persona que saluda) y el botón neón. Acá la que saluda es Maru, en pixel art.
 */
export default function CtaScene() {
  return (
    <div className="relative mx-auto max-w-[1200px] pt-6">
      <h2 className="relative z-10 mx-auto w-fit rounded-[40px] bg-ink px-7 py-4 font-display text-[1.9rem] font-light leading-[1.1] text-white sm:absolute sm:left-[48%] sm:top-0 sm:mx-0 sm:px-8 sm:text-[40px]">
        Dejá que <strong className="font-bold">Maru</strong> te lleve
        <br />a tu próximo trabajo
      </h2>

      <div className="relative mt-6 sm:mt-14">
        <svg viewBox="0 0 1200 260" className="block h-auto w-full" fill="none" stroke="#0a0a0a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          {/* marco */}
          <path d="M20 258V60a20 20 0 0 1 20-20h1120a20 20 0 0 1 20 20v198" />
          <path d="M0 258h1200" />
          {/* nube detrás de la compu */}
          <path d="M20 258V150c30-60 120-80 190-50 40-40 130-40 170 10 40 10 60 50 60 98" fill="#fff" />
          {/* destellos */}
          <path d="M185 12v40M165 32h40M185 12c2 14 6 18 20 20-14 2-18 6-20 20-2-14-6-18-20-20 14-2 18-6 20-20z" fill="#fff" />
          <path d="M160 4c1 6 3 8 9 9-6 1-8 3-9 9-1-6-3-8-9-9 6-1 8-3 9-9z" />
          {/* compu */}
          <rect x="60" y="112" width="280" height="118" rx="10" fill="#fff" />
          <rect x="70" y="122" width="260" height="98" rx="5" fill="#effbe8" />
          <rect x="92" y="134" width="90" height="74" rx="4" fill="#fff" />
          <path d="M104 148h52M104 158h40M104 168h60" />
          <rect x="104" y="178" width="60" height="12" rx="2" />
          <rect x="250" y="134" width="40" height="28" rx="3" fill="#fff" />
          <path d="m250 136 20 14 20-14" />
          <path d="M210 176h90M210 190h70" stroke="#a7e6c0" />
          <path d="M190 230v28M210 230v28M180 258h40" />
          {/* planta */}
          <path d="M370 258v-26h40v26M368 232h44" fill="#fff" />
          <path d="M390 232c-10-12-22-14-28-10 6 10 16 12 28 10zm0 0c10-12 22-14 28-10-6 10-16 12-28 10zm0 0c0-14 4-22 10-26 0 12-4 20-10 26z" fill="#fff" />
          {/* avión de papel con su recorrido */}
          <path d="M470 150c40-10 50-50 20-50s-20 50 40 40 90-60 140-70" strokeDasharray="2 7" />
          <path d="m690 66 46-14-26 40-6-16zm14 10 22-24" fill="#fff" />
          {/* burbujas */}
          <circle cx="1010" cy="56" r="12" fill="#fff" />
          <circle cx="1034" cy="76" r="6" fill="#fff" />
        </svg>
        <div className="absolute bottom-0 right-[4%] w-[13%] min-w-[64px]">
          <MaruSprite size={160} frame="wave" className="h-auto w-full" />
        </div>
        <div className="absolute inset-x-0 bottom-[16%] flex justify-center sm:bottom-[30%]">
          <Link
            href="/match"
            className="press inline-flex h-12 items-center whitespace-nowrap rounded-full border-2 border-ink bg-neon px-7 font-display text-xl font-bold uppercase text-ink hover:shadow-[0_8px_24px_-8px_rgba(0,240,160,0.9)] sm:h-16 sm:px-10 sm:text-[32px]"
          >
            Empezar gratis
          </Link>
        </div>
      </div>
    </div>
  );
}
