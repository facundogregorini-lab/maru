"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import LoginDialog from "@/components/auth/LoginDialog";
import ForgetButton from "@/components/legal/ForgetButton";
import { post } from "@/components/ui";
import SubscribeButton from "./SubscribeButton";

type Cuenta = { email: string; name: string | null; paid: boolean; status: string | null; paidSince: string | null; paidUntil: string | null; used: number; limit: number | null };

const fmt = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });

/** Mi cuenta: plan, uso del mes, baja y datos. */
export default function AccountPanel({ regret = false }: { regret?: boolean }) {
  const { email, db, refresh, logout } = useAuth();
  const [data, setData] = useState<Cuenta | null>(null);
  const [login, setLogin] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/cuenta", { cache: "no-store" });
    if (res.ok) setData((await res.json()) as Cuenta);
  }, []);

  useEffect(() => {
    if (email) void load();
  }, [email, load]);

  async function cancel() {
    const question = regret
      ? "¿Arrepentirte de la compra? Damos de baja el plan y registramos el pedido de reintegro."
      : "¿Dar de baja el plan Maru? Volvés al plan gratis.";
    if (!window.confirm(question)) return;
    setBusy(true);
    setMsg("");
    try {
      const r = await post<{ reintegro: boolean }>("/api/pagos/cancelar", { arrepentimiento: regret });
      setMsg(
        regret
          ? r.reintegro
            ? "Listo: dimos de baja el plan y registramos tu pedido de reintegro. Te devolvemos lo pagado en el mismo medio de pago."
            : "Dimos de baja el plan. Pasaron más de 10 días desde la contratación, así que no corresponde el reintegro automático: escribinos si querés revisarlo."
          : "Listo: diste de baja el plan. Lo seguís teniendo hasta el final del mes pagado y no se vuelve a cobrar.",
      );
      await Promise.all([load(), refresh()]);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (email === undefined) return <div className="h-40 animate-pulse rounded-[24px] bg-[#f2f4f5]" />;

  if (!email)
    return (
      <div className="rounded-[24px] bg-[#f2f4f5] p-8 text-center">
        <p className="text-lg font-semibold">{regret ? "Ingresá con el email con el que contrataste el plan" : "Ingresá para ver tu cuenta"}</p>
        <button type="button" onClick={() => setLogin(true)} className="press mt-5 rounded-full bg-ink px-6 py-3 font-semibold text-white">
          Ingresar
        </button>
        <LoginDialog open={login} reason="ver tu cuenta" onClose={() => setLogin(false)} onLoggedIn={() => setLogin(false)} />
      </div>
    );

  return (
    <div className="space-y-5">
      <section className="rounded-[24px] bg-[#f2f4f5] p-7">
        <p className="text-sm text-ink/60">Entraste como</p>
        <p className="text-lg font-semibold">{data?.name ? `${data.name} · ${email}` : email}</p>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-5">
          <div>
            <p className="text-sm text-ink/60">Tu plan</p>
            <p className="text-2xl font-extrabold">{data?.paid ? "Plan Maru" : "Gratis"}</p>
            {data?.paid && data.paidUntil ? (
              <p className="text-xs text-ink/60">Dado de baja: lo tenés hasta el {fmt(data.paidUntil)} y no se vuelve a cobrar.</p>
            ) : (
              data?.paid && data.paidSince && <p className="text-xs text-ink/60">Desde el {fmt(data.paidSince)}</p>
            )}
            {!data?.paid && data?.limit != null && (
              <p className="mt-1 text-sm">
                Usaste <b>{Math.min(data.used, data.limit)}</b> de {data.limit} creaciones gratis este mes.
              </p>
            )}
          </div>
          {data?.paid && (!data.paidUntil || regret) ? (
            <button type="button" onClick={cancel} disabled={busy} className="rounded-full px-4 py-2 text-sm text-ink/70 ring-1 ring-black/15 hover:text-ink disabled:opacity-60">
              {busy ? "Procesando…" : regret ? "Me arrepiento de la compra" : "Dar de baja el plan"}
            </button>
          ) : data?.paid ? null : (
            <SubscribeButton className="press rounded-full bg-neon px-5 py-2.5 text-sm font-extrabold uppercase disabled:opacity-70" />
          )}
        </div>
        {msg && (
          <p role="status" className="mt-4 text-sm font-medium">
            {msg}
          </p>
        )}
        {!data?.paid && (
          <p className="mt-4 text-xs text-ink/60">
            ¿Qué incluye cada plan?{" "}
            <Link href="/precios" className="underline underline-offset-4">
              Ver precios
            </Link>
          </p>
        )}
      </section>

      {!regret && db && <AlertsSection />}

      {!regret && (
        <section className="rounded-[24px] bg-[#f2f4f5] p-7">
          <h2 className="text-lg font-bold">Tus datos</h2>
          <p className="mt-1 text-sm text-ink/70">Tu perfil, tus búsquedas y lo que armaste viven en este navegador.</p>
          <ForgetButton />
          <button type="button" onClick={logout} className="mt-4 block text-sm text-ink/60 underline underline-offset-4 hover:text-ink">
            Salir de la cuenta
          </button>
        </section>
      )}
    </div>
  );
}

type AlertView = { id: string; label: string; href: string };

/** Las alertas de búsquedas nuevas que llegan por email. */
function AlertsSection() {
  const [alerts, setAlerts] = useState<AlertView[] | null>(null);
  useEffect(() => {
    void fetch("/api/alertas", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { alerts: [] }))
      .then((d: { alerts: AlertView[] }) => setAlerts(d.alerts));
  }, []);
  async function remove(id: string) {
    const r = await fetch(`/api/alertas?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (r.ok) setAlerts(((await r.json()) as { alerts: AlertView[] }).alerts);
  }
  return (
    <section className="rounded-[24px] bg-[#f2f4f5] p-7">
      <h2 className="text-lg font-bold">Alertas de búsquedas</h2>
      <p className="mt-1 text-sm text-ink/70">Una vez por día te mandamos por email las búsquedas nuevas de cada alerta.</p>
      {alerts && alerts.length === 0 && (
        <p className="mt-4 text-sm">
          No tenés alertas. Creá una desde{" "}
          <Link href="/busquedas" className="underline underline-offset-4">
            Búsquedas
          </Link>{" "}
          con «Avisame de nuevas».
        </p>
      )}
      <ul className="mt-4 space-y-2">
        {alerts?.map((a) => (
          <li key={a.id} className="flex items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 text-sm">
            <Link href={a.href} className="min-w-0 truncate hover:underline">
              {a.label}
            </Link>
            <button type="button" onClick={() => remove(a.id)} className="shrink-0 text-xs text-ink/50 hover:text-danger">
              Borrar
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
