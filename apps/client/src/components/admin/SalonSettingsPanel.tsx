import { useEffect, useState } from "react";
import { Clock3, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/api";

type Settings = { isOpen: boolean; openingTime: string; closingTime: string; intervalMinutes: number };
type Payload = { ok: boolean; data?: Settings; error?: { message?: string } };
const inputClass = "rounded-xl border border-[#dfcdbd] bg-white px-3 py-2.5 text-sm text-[#493629] outline-none focus:border-[#a77d60]";
const intervalOptions = [5, 10, 15, 20, 30, 45, 60, 90, 120];
export default function SalonSettingsPanel() {
  const [settings, setSettings] = useState<Settings>({ isOpen: true, openingTime: "08:00", closingTime: "19:00", intervalMinutes: 90 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  async function load() {
    setLoading(true); setMessage("");
    try { const response = await apiFetch("/salon-settings"); const payload = await response.json() as Payload; if (!response.ok || !payload.ok || !payload.data) throw new Error(payload.error?.message ?? "Não foi possível carregar as configurações."); setSettings(payload.data); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Erro ao carregar."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  async function save(changes: Partial<Settings>) {
    setSaving(true); setMessage("");
    try { const response = await apiFetch("/salon-settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(changes) }); const payload = await response.json() as Payload; if (!response.ok || !payload.ok || !payload.data) throw new Error(payload.error?.message ?? "Não foi possível salvar."); setSettings(payload.data); setMessage("Configurações salvas."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Erro ao salvar."); }
    finally { setSaving(false); }
  }
  return <section className="mb-7 rounded-3xl border border-[#e8d9cb] bg-white p-5 shadow-[0_12px_35px_rgba(92,65,43,0.06)] sm:p-7">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-serif text-2xl text-[#493629]">Funcionamento do salão</h2><p className="mt-1 text-sm text-[#8c7767]">Configure manualmente a faixa de atendimento e o intervalo entre horários. O formato permite escolher qualquer hora do dia, de 00:00 a 23:59.</p></div><button type="button" onClick={() => void load()} disabled={loading || saving} aria-label="Atualizar funcionamento" className="rounded-full border border-[#d9c4b1] p-2 text-[#705844] disabled:opacity-50"><RefreshCw size={17} className={loading ? "animate-spin" : ""}/></button></div>
    <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl bg-[#fbf6f0] p-4"><span className={settings.isOpen ? "rounded-full bg-[#eaf2e8] px-3 py-1.5 text-sm font-semibold text-[#547357]" : "rounded-full bg-[#f8e9e5] px-3 py-1.5 text-sm font-semibold text-[#9b594c]"}>{settings.isOpen ? "Salão aberto" : "Salão fechado"}</span><button type="button" disabled={loading || saving} onClick={() => void save({ isOpen: !settings.isOpen })} className="rounded-full bg-[#705844] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Salvando..." : settings.isOpen ? "Fechar salão" : "Abrir salão"}</button><p className="text-xs text-[#806c5d]">Fechar impede novos pedidos, mas não altera reservas existentes.</p></div>
    <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
      <label className="grid gap-2 text-sm font-medium text-[#705844]">Horário de abertura<input type="time" min="00:00" max="23:59" value={settings.openingTime} disabled={loading || saving} onChange={event => setSettings(current => ({ ...current, openingTime: event.target.value }))} className={inputClass}/></label>
      <label className="grid gap-2 text-sm font-medium text-[#705844]">Horário de fechamento<input type="time" min="00:00" max="23:59" value={settings.closingTime} disabled={loading || saving} onChange={event => setSettings(current => ({ ...current, closingTime: event.target.value }))} className={inputClass}/></label>
      <label className="grid gap-2 text-sm font-medium text-[#705844]">Intervalo entre horários<select value={settings.intervalMinutes} disabled={loading || saving} onChange={event => setSettings(current => ({ ...current, intervalMinutes: Number(event.target.value) }))} className={inputClass}>{intervalOptions.map(minutes => <option key={minutes} value={minutes}>{minutes} minutos</option>)}</select></label>
      <button type="button" disabled={loading || saving || settings.openingTime >= settings.closingTime} onClick={() => void save({ openingTime: settings.openingTime, closingTime: settings.closingTime, intervalMinutes: settings.intervalMinutes })} className="inline-flex items-center justify-center gap-2 rounded-full border border-[#d9c4b1] bg-white px-5 py-2.5 text-sm font-semibold text-[#705844] disabled:opacity-50"><Clock3 size={16}/> Salvar agenda</button>
    </div>
    <p className="mt-3 text-xs text-[#8c7767]">A agenda pública gera os horários automaticamente conforme a abertura, o fechamento e o intervalo escolhidos. O horário de fechamento também pode ser selecionado como último horário.</p>
    {message && <p role="status" className="mt-4 rounded-xl bg-[#fbf6f0] px-4 py-3 text-sm text-[#705844]">{message}</p>}
  </section>;
}
