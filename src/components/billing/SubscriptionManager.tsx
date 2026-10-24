"use client";
import { useState } from "react";
import { PLANS, type PlanId } from "@/lib/plans";
import { trackProduct } from "@/lib/tracking";

export type RefundOption = { kind: "garantia" | "arrepentimiento"; until: number; amount: number };
export type ManagedStatus = {
  plan: string;
  tier: PlanId | null;
  status: string;
  paidThrough: number | null;
  cancelRequest?: { id: string; at: number } | null;
  refund?: { id: string; at: number; kind: RefundOption["kind"]; amount: number } | null;
  refundOption?: RefundOption | null;
};

const REASONS: [string, string][] = [
  ["", "Prefiero no decirlo"],
  ["precio", "Por el precio"],
  ["no-me-sirvio", "No me sirvió"],
  ["consegui-trabajo", "Conseguí trabajo"],
  ["pausa", "Pauso mi búsqueda"],
  ["otro", "Otro motivo"],
];

const fmtDate = (ms: number) => new Date(ms).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });
const fmtMoney = (n: number) => `$${n.toLocaleString("es-AR")}`;

/**
 * "Mi suscripción": baja de la renovación con una sola confirmación, motivo opcional y número de solicitud en pantalla.
 * El arrepentimiento sólo se ofrece en /arrepentimiento (focus "devolucion"); la garantía se pide por mail.
 * Lo usan /precios, /baja y /arrepentimiento.
 */
export default function SubscriptionManager({
  email,
  status,
  onChanged,
  focus,
}: {
  email: string;
  status: ManagedStatus;
  onChanged: () => Promise<void> | void;
  /** Qué acción mostrar primero: la baja (/baja) o la devolución (/arrepentimiento). */
  focus?: "baja" | "devolucion";
}) {
  const [confirming, setConfirming] = useState<"baja" | "devolucion" | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<string>("");

  const paid = status.plan === "maru";
  const renewing = status.status === "authorized" || status.status === "pending";
  const option = focus === "devolucion" ? status.refundOption ?? null : null;
  const plan = status.tier ? PLANS[status.tier] : null;

  async function act(kind: "baja" | "devolucion") {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/billing/${kind === "baja" ? "cancel" : "refund"}`, {
        method: "POST",
        headers: { "X-Maru-Account": email, "Content-Type": "application/json" },
        body: JSON.stringify(reason ? { reason } : {}),
      }).catch(() => null);
      const body = res ? await res.json().catch(() => ({})) : {};
      if (!res?.ok) throw new Error(body.error ?? "No pudimos completar el pedido.");
      // Con el número de solicitud, PostHog se cruza con el registro de cobros sin mandar el email.
      trackProduct(kind === "baja" ? "baja_confirmada" : "devolucion_confirmada", { solicitud: body.requestId, plan: status.tier ?? undefined, motivo: reason || undefined, tipo: body.kind });
      setReceipt(
        kind === "baja"
          ? `Renovación desactivada. ${body.paidThrough ? `Conservás el acceso hasta el ${fmtDate(body.paidThrough)}. ` : ""}Número de solicitud: ${body.requestId}.`
          : `Devolución pedida: te reintegramos ${fmtMoney(body.amount)} y cancelamos la renovación. Número de solicitud: ${body.requestId}. La acreditación depende de tu medio de pago y de tu banco.`,
      );
      setConfirming(null);
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos completar el pedido.");
    } finally {
      setBusy(false);
    }
  }

  const refundButton = option && (
    <button type="button" disabled={busy} onClick={() => setConfirming("devolucion")} className="min-h-11 rounded-full border border-ink px-5 py-2 text-sm font-semibold disabled:opacity-50">
      Arrepentirme de la compra
    </button>
  );
  const cancelButton = renewing && (
    <button type="button" disabled={busy} onClick={() => setConfirming("baja")} className="min-h-11 rounded-full border border-ink px-5 py-2 text-sm font-semibold disabled:opacity-50">
      Cancelar suscripción
    </button>
  );

  return (
    <div id="mi-plan" className="scroll-mt-24 rounded-[24px] border border-line bg-white p-5 text-left sm:p-6">
      <h3 className="text-lg font-bold">Mi suscripción</h3>
      {paid ? (
        <p className="mt-1 text-sm">
          Plan {plan?.nombre.toLowerCase()} activo{status.paidThrough ? ` hasta el ${fmtDate(status.paidThrough)}` : ""}.{" "}
          {renewing ? `Se renueva ${plan?.renewalText} a ${plan?.priceText}.` : "La renovación está cancelada."}
        </p>
      ) : (
        <p className="mt-1 text-sm">{renewing ? "Tenés una suscripción esperando la confirmación del pago." : "No tenés un plan activo."}</p>
      )}

      {status.cancelRequest && !receipt && <p className="mt-2 text-sm text-ink/70">Baja registrada el {fmtDate(status.cancelRequest.at)}. Número de solicitud: <strong>{status.cancelRequest.id}</strong>.</p>}
      {status.refund && !receipt && (
        <p className="mt-2 text-sm text-ink/70">
          Devolución de {fmtMoney(status.refund.amount)} pedida el {fmtDate(status.refund.at)}. Número de solicitud: <strong>{status.refund.id}</strong>.
        </p>
      )}
      {receipt && (
        <p role="status" className="mt-3 rounded-xl bg-brand-soft p-3 text-sm font-medium">
          {receipt}
        </p>
      )}

      {(cancelButton || refundButton) && !confirming && (
        <div className="mt-4 flex flex-wrap gap-2">
          {focus === "devolucion" ? <>{refundButton}{cancelButton}</> : <>{cancelButton}{refundButton}</>}
        </div>
      )}
      {option && !confirming && (
        <p className="mt-2 text-xs text-ink/60">
          {`Arrepentimiento: podés pedir la devolución de tu primer pago hasta el ${fmtDate(option.until)}.`}
        </p>
      )}

      {confirming && (
        <div className="mt-4 rounded-2xl bg-sand p-4">
          <p className="text-sm font-semibold">
            {confirming === "baja"
              ? `¿Cancelar la renovación? No se te cobra más y conservás el acceso${status.paidThrough ? ` hasta el ${fmtDate(status.paidThrough)}` : " hasta que termine el período pago"}.`
              : `¿Pedir la devolución? Te reintegramos ${option ? fmtMoney(option.amount) : "tu primer pago"} (el 100% de tu primer pago) y cancelamos la renovación.`}
          </p>
          {confirming === "devolucion" && <p className="mt-1 text-xs text-ink/70">La pedimos a Mercado Pago en el momento. La acreditación depende de tu medio de pago y de tu banco.</p>}
          <label className="mt-3 block text-sm">
            Motivo (opcional)
            <select value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 block w-full rounded-xl border border-line bg-white px-3 py-2 text-sm">
              {REASONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => void act(confirming)} className="min-h-11 rounded-full bg-ink px-5 py-2 text-sm font-bold text-white disabled:opacity-50">
              {busy ? "Un momento…" : confirming === "baja" ? "Confirmar baja" : "Confirmar devolución"}
            </button>
            <button type="button" disabled={busy} onClick={() => setConfirming(null)} className="min-h-11 rounded-full px-4 py-2 text-sm underline underline-offset-4">
              Volver
            </button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}
    </div>
  );
}
