import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

type PriceItem = { serviceName: string; priceCents: number | null; updatedAt?: string };
type Payload<T> = { ok: boolean; data?: T; error?: { message?: string } };
const money = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function ServicePricesPanel() {
  const [items, setItems] = useState<PriceItem[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");

  async function refresh() {
    const response = await apiFetch("/service-prices");
    const payload = await response.json() as Payload<{ services: PriceItem[] }>;
    if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? "Não foi possível carregar os preços.");
    const next = payload.data?.services ?? [];
    setItems(next);
    setValues(Object.fromEntries(next.map(item => [item.serviceName, item.priceCents == null ? "" : (item.priceCents / 100).toFixed(2).replace(".", ",")])));
  }

  useEffect(() => { void refresh().catch(error => setNotice(error instanceof Error ? error.message : "Erro ao carregar preços.")); }, []);

  async function save(item: PriceItem) {
    const raw = (values[item.serviceName] ?? "").trim();
    let priceCents: number | null = null;
    if (raw) {
      if (!/^\d+(?:[,.]\d{1,2})?$/.test(raw)) { setNotice("Digite um valor válido, por exemplo 35,00."); return; }
      priceCents = Math.round(Number(raw.replace(",", ".")) * 100);
      if (!Number.isSafeInteger(priceCents) || priceCents < 100) { setNotice("O valor mínimo permitido é R$ 1,00."); return; }
    }
    setBusy(item.serviceName); setNotice("");
    try {
      const response = await apiFetch("/service-prices", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serviceName: item.serviceName, priceCents }) });
      const payload = await response.json() as Payload<{ service: PriceItem }>;
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? "Não foi possível salvar o preço.");
      await refresh();
      setNotice("Preço atualizado. O novo valor já aparece para os clientes.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Erro ao salvar preço."); }
    finally { setBusy(""); }
  }

  return <section className="mb-7 rounded-3xl border border-[#e8d9cb] bg-white p-5 shadow-[0_12px_35px_rgba(92,65,43,0.06)] sm:p-7">
    <div className="mb-5"><h2 className="font-serif text-2xl text-[#493629]">Preços dos serviços</h2><p className="mt-1 text-sm text-[#8c7767]">Somente administradores podem alterar. Informe qualquer valor a partir de R$ 1,00. Deixe vazio para ocultar o preço do site.</p></div>
    <div className="grid gap-3">
      {items.map(item => <div key={item.serviceName} className="grid gap-3 rounded-2xl border border-[#eaded3] p-4 sm:grid-cols-[1fr_180px_auto] sm:items-center">
        <div><p className="font-semibold text-[#493629]">{item.serviceName}</p><p className="mt-1 text-xs text-[#8c7767]">Visível na página de serviços e na agenda dos clientes</p></div>
        <label className="grid gap-1 text-xs font-semibold text-[#806c5d]">Valor em reais<input inputMode="decimal" aria-label={`Preço de ${item.serviceName}`} placeholder="Ex.: 35,00" value={values[item.serviceName] ?? ""} onChange={event => setValues(current => ({ ...current, [item.serviceName]: event.target.value }))} className="w-full rounded-xl border border-[#dfcdbd] bg-white px-3 py-2.5 text-sm text-[#493629] outline-none focus:border-[#a77d60]" /></label>
        <button type="button" disabled={busy === item.serviceName} onClick={() => void save(item)} className="rounded-full bg-[#705844] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy === item.serviceName ? "Salvando..." : "Salvar preço"}</button>
      </div>)}
      {items.length === 0 && <p className="text-sm text-[#8c7767]">Carregando serviços...</p>}
    </div>
    {notice && <p role="status" className="mt-4 rounded-xl bg-[#fbf6f0] px-4 py-3 text-sm text-[#705844]">{notice}</p>}
  </section>;
}
