import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CalendarDays, CalendarCheck, Check, ChevronLeft, ChevronRight, Clock3, Gift, LayoutDashboard, Mail, Menu, Phone, RefreshCw, Scissors, Settings2, ShieldCheck, Users, Wallet, X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { AdminGuard } from "@/components/auth/AdminGuard";
import SiteLayout from "../../site/SiteLayout";
import LeticiaAIChat from "@/components/admin/LeticiaAIChat";
import FinancePanel from "@/components/admin/FinancePanel";
import ServicePricesPanel from "@/components/admin/ServicePricesPanel";
import ServiceCatalogPanel from "@/components/admin/ServiceCatalogPanel";
import SalonSettingsPanel from "@/components/admin/SalonSettingsPanel";

type Booking = {
  id: string;
  bookingCode: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  bookingDate: string;
  bookingTime: string;
  service: string;
  appointmentDetails?: string;
  status: string;
  paymentStatus?: "paid" | "unpaid";
  paymentAmountCents?: number | null;
  completedAt?: string | null;
};
type LoyaltyReward = { id: string; customerEmail: string; customerName: string; cycleNumber: number; status: "earned" | "redeemed"; earnedAt: string; expiresAt?: string | null; redeemedAt?: string | null; redeemedService?: string | null };
type LoyaltyData = { enabled: boolean; validityMonths: number; rewards: LoyaltyReward[]; customers: Array<{ customerEmail: string; customerName: string; completedPaid: number }> };
type Payload<T> = { ok: boolean; data?: T; error?: { message?: string } };

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  confirmed: "Aprovada",
  rejected: "Rejeitada",
  cancelled: "Cancelada",
};

function AdminContent() {
  const [items, setItems] = useState<Booking[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activePage, setActivePage] = useState("overview");
  const [calendarMonth, setCalendarMonth] = useState(() => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1); });
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`; });
  const [unreadBookingCount, setUnreadBookingCount] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [historyView, setHistoryView] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loyalty, setLoyalty] = useState<LoyaltyData>({ enabled: false, validityMonths: 12, rewards: [], customers: [] });
  const [serviceChoices, setServiceChoices] = useState(["Esmaltação em gel", "Pés tradicional", "Mãos tradicional", "Manutenção"]);
  useEffect(() => { let active=true; apiFetch("/service-catalog",{auth:false,silent:true}).then(async response=>{const payload=await response.json() as Payload<{services:Array<{name:string}>}>;if(response.ok&&payload.ok&&active&&payload.data?.services)setServiceChoices(payload.data.services.map(item=>item.name));}).catch(()=>undefined);return()=>{active=false;}; }, []);
  const [redeemChoices, setRedeemChoices] = useState<Record<string, string>>({});
  const [redeemBookingChoices, setRedeemBookingChoices] = useState<Record<string, string>>({});
  const [authorisedEmails, setAuthorisedEmails] = useState<Array<{ email: string; createdAt: number; userId?: string | null; name?: string | null }>>([]);
  const [authorisedEmailInput, setAuthorisedEmailInput] = useState("");
  const [resettingEmail, setResettingEmail] = useState("");
  const [temporaryCredentials, setTemporaryCredentials] = useState<{ name: string; email: string; temporaryPassword: string; sessionsRevoked: boolean } | null>(null);

  async function refresh() {
    setRefreshing(true);
    setError("");
    try {
      const response = await apiFetch("/bookings/admin");
      const payload = await response.json() as Payload<{ bookings: Booking[] }>;
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? "Não foi possível carregar as reservas.");
      const bookings = payload.data?.bookings ?? [];
      setItems(bookings);
      const knownKey = "leticia-admin-known-bookings-v1";
      const unreadKey = "leticia-admin-unread-bookings-v1";
      const currentIds = bookings.map((booking) => booking.id);
      const knownRaw = window.localStorage.getItem(knownKey);
      const unreadRaw = window.localStorage.getItem(unreadKey);
      if (knownRaw === null) {
        window.localStorage.setItem(knownKey, JSON.stringify(currentIds));
        window.localStorage.setItem(unreadKey, "[]");
        setUnreadBookingCount(0);
      } else {
        const knownIds = new Set<string>(JSON.parse(knownRaw) as string[]);
        const unreadIds = new Set<string>(JSON.parse(unreadRaw ?? "[]") as string[]);
        for (const id of currentIds) {
          if (!knownIds.has(id)) unreadIds.add(id);
          knownIds.add(id);
        }
        window.localStorage.setItem(knownKey, JSON.stringify([...knownIds]));
        window.localStorage.setItem(unreadKey, JSON.stringify([...unreadIds]));
        setUnreadBookingCount(unreadIds.size);
      }
      await refreshLoyalty();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erro ao carregar reservas.");
    } finally {
      setRefreshing(false);
    }
  }

  async function refreshLoyalty() {
    try {
      const response = await apiFetch("/loyalty/admin");
      const payload = await response.json() as Payload<LoyaltyData>;
      if (response.ok && payload.ok && payload.data) setLoyalty(payload.data);
    } catch { /* agenda continua disponível mesmo se o painel de fidelidade falhar */ }
  }

  async function refreshAuthorisedEmails() {
    try {
      const response = await apiFetch("/email-authorizations");
      const payload = await response.json() as Payload<{ emails: Array<{ email: string; createdAt: number; userId?: string | null; name?: string | null }> }>;
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? "Não foi possível carregar os e-mails autorizados.");
      setAuthorisedEmails(payload.data?.emails ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erro ao carregar e-mails autorizados.");
    }
  }

  async function addAuthorisedEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = authorisedEmailInput.trim().toLowerCase();
    if (!email) return;
    try {
      const response = await apiFetch("/email-authorizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const payload = await response.json() as Payload<{ email: string }>;
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? "Não foi possível autorizar o e-mail.");
      setAuthorisedEmailInput("");
      await refreshAuthorisedEmails();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erro ao autorizar e-mail.");
    }
  }

  async function resetExistingAccountPassword(email: string) {
    if (!window.confirm(`Gerar uma nova senha temporária para ${email}? A senha atual deixará de funcionar e todas as sessões desta conta serão encerradas. A conta, o histórico e as permissões serão mantidos.`)) return;
    setResettingEmail(email);
    setError("");
    setTemporaryCredentials(null);
    try {
      const response = await apiFetch(`/email-authorizations/${encodeURIComponent(email)}/reset-password`, { method: "POST" });
      const payload = await response.json() as Payload<{ account: { name: string; email: string }; temporaryPassword: string; sessionsRevoked: boolean }>;
      if (!response.ok || !payload.ok || !payload.data) throw new Error(payload.error?.message ?? "Não foi possível gerar a nova senha.");
      setTemporaryCredentials({
        name: payload.data.account.name,
        email: payload.data.account.email,
        temporaryPassword: payload.data.temporaryPassword,
        sessionsRevoked: payload.data.sessionsRevoked
      });
      await refreshAuthorisedEmails();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erro ao gerar nova senha.");
    } finally {
      setResettingEmail("");
    }
  }

  async function copyTemporaryPassword() {
    if (!temporaryCredentials) return;
    try {
      await navigator.clipboard.writeText(temporaryCredentials.temporaryPassword);
    } catch {
      setError("Não foi possível copiar automaticamente. Selecione e copie a senha exibida.");
    }
  }

  async function removeAuthorisedEmail(email: string) {
    if (!window.confirm(`Remover a autorização de ${email}? A pessoa perderá o acesso autenticado às áreas internas e as sessões serão encerradas. A conta não será apagada; ela ainda poderá usar o site como cliente e fazer reservas públicas.`)) return;
    try {
      const response = await apiFetch(`/email-authorizations/${encodeURIComponent(email)}`, { method: "DELETE" });
      const payload = await response.json() as Payload<unknown>;
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? "Não foi possível remover a autorização.");
      await refreshAuthorisedEmails();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erro ao remover autorização.");
    }
  }

  useEffect(() => { void refresh(); void refreshAuthorisedEmails(); }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => { void refresh(); }, 20000);
    return () => window.clearInterval(intervalId);
  }, []);

  function navigateToPage(page: string) {
    setActivePage(page);
    setMobileMenuOpen(false);
    if (page === "bookings") markBookingsSeen();
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function markBookingsSeen() {
    const knownKey = "leticia-admin-known-bookings-v1";
    const unreadKey = "leticia-admin-unread-bookings-v1";
    const knownIds = new Set<string>(JSON.parse(window.localStorage.getItem(knownKey) ?? "[]") as string[]);
    for (const booking of items) knownIds.add(booking.id);
    window.localStorage.setItem(knownKey, JSON.stringify([...knownIds]));
    window.localStorage.setItem(unreadKey, "[]");
    setUnreadBookingCount(0);
  }

  async function decide(booking: Booking, action: "confirmed" | "rejected" | "cancelled") {
    setBusy(booking.id);
    setError("");
    try {
      const response = await apiFetch(`/bookings/${booking.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = await response.json() as Payload<unknown>;
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? "Não foi possível atualizar a reserva.");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erro ao atualizar reserva.");
    } finally {
      setBusy("");
    }
  }

  async function updateBookingFlag(booking: Booking, endpoint: "payment" | "completion", value: boolean) {
    let amountCents = 0;
    if (endpoint === "payment" && value) {
      const raw = window.prompt("Informe o valor realmente recebido (R$). Exemplo: 85,00");
      if (raw === null) return;
      amountCents = Math.round(Number(raw.trim().replace(",", ".")) * 100);
      if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
        setError("Informe um valor recebido válido, maior que zero.");
        return;
      }
    }
    setBusy(booking.id); setError("");
    try {
      const response = await apiFetch(`/loyalty/bookings/${booking.id}/${endpoint}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(endpoint === "payment" ? { paid: value, amountCents } : { completed: value }) });
      const payload = await response.json() as Payload<unknown>;
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? "Não foi possível atualizar.");
      if (endpoint === "payment" && value) {
        const now = new Date();
        const transactionDate = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
        const incomeResponse = await apiFetch(`/finance/bookings/${booking.id}/income`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amountCents, transactionDate }) });
        const incomePayload = await incomeResponse.json() as Payload<unknown>;
        if (!incomeResponse.ok || !incomePayload.ok) throw new Error("Pagamento foi marcado como recebido, mas o lançamento financeiro não foi concluído: " + (incomePayload.error?.message ?? "tente registrar a receita no painel Financeiro."));
      }
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Erro ao atualizar."); }
    finally { setBusy(""); }
  }

  function generatePaymentReceipt(booking: Booking) {
    if (booking.paymentStatus !== "paid") return;
    if (!Number.isSafeInteger(booking.paymentAmountCents) || Number(booking.paymentAmountCents) <= 0) {
      setError("O valor recebido não está salvo nesta reserva. Confira o pagamento novamente.");
      return;
    }
    const amount = Number(booking.paymentAmountCents) / 100;
    const safe = (value: string) => value.replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char] ?? char);
    const date = new Date().toLocaleDateString("pt-BR");
    const money = amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      setError("Permita a abertura de janelas para gerar o PDF.");
      return;
    }
    printWindow.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Comprovante de pagamento</title><style>body{font-family:Arial,sans-serif;color:#493629;max-width:720px;margin:40px auto;padding:32px;border:1px solid #eadbce}h1{color:#80634d}p{padding:8px 0;border-bottom:1px solid #eee5dc}.note{font-size:12px;color:#806c5d;margin-top:28px}@media print{body{margin:0;border:0}}</style></head><body><h1>Comprovante de pagamento</h1><p><b>Estúdio:</b> Leticia Nail Designer</p><p><b>Cliente:</b> ${safe(booking.customerName)}</p><p><b>Reserva:</b> ${safe(booking.bookingCode)}</p><p><b>Serviço(s):</b> ${safe(booking.service)}</p><p><b>Data do atendimento:</b> ${safe(booking.bookingDate)} às ${safe(booking.bookingTime)}</p><p><b>Valor recebido:</b> ${money}</p><p><b>Data de emissão:</b> ${date}</p><p class="note">Comprovante de recebimento emitido pelo estabelecimento. Este documento não substitui nota fiscal eletrônica.</p><script>window.onload=function(){window.print()}</script></body></html>`);
    printWindow.document.close();
  }

  async function toggleLoyalty() {
    try {
      const response = await apiFetch("/loyalty/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: !loyalty.enabled }) });
      const payload = await response.json() as Payload<{ enabled: boolean }>;
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? "Não foi possível alterar.");
      await refreshLoyalty();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Erro ao alterar fidelidade."); }
  }

  async function saveLoyaltyValidity(months: number) {
    try {
      const response = await apiFetch("/loyalty/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ validityMonths: months }) });
      const payload = await response.json() as Payload<{ enabled: boolean; validityMonths: number }>;
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? "Não foi possível salvar a validade.");
      await refreshLoyalty();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Erro ao salvar validade."); }
  }

  async function adjustRewardValidity(reward: LoyaltyReward) {
    const raw = window.prompt("Quantos meses de validade a partir de hoje? Informe de 1 a 60.", "12");
    if (raw === null) return;
    const months = Number(raw);
    if (!Number.isInteger(months) || months < 1 || months > 60) { setError("Informe um prazo entre 1 e 60 meses."); return; }
    try {
      const response = await apiFetch(`/loyalty/rewards/${reward.id}/validity`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ months }) });
      const payload = await response.json() as Payload<unknown>;
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? "Não foi possível alterar a validade.");
      await refreshLoyalty();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Erro ao alterar validade."); }
  }

  async function redeemReward(reward: LoyaltyReward) {
    const booking = items.find(item => item.id === redeemBookingChoices[reward.id] && item.customerEmail.toLowerCase() === reward.customerEmail.toLowerCase() && item.status === "confirmed");
    const service = redeemChoices[reward.id] || serviceChoices[0];
    if (!booking) { setError("Selecione uma reserva aprovada da mesma cliente para registrar o resgate."); return; }
    if (!window.confirm(`Confirmar resgate do bônus de ${reward.customerName} para o serviço ${service}?`)) return;
    try {
      const response = await apiFetch(`/loyalty/rewards/${reward.id}/redeem`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bookingId: booking.id, service }) });
      const payload = await response.json() as Payload<unknown>;
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? "Não foi possível resgatar.");
      await refreshLoyalty();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Erro ao resgatar bônus."); }
  }

  const visibleItems = useMemo(
    () => items.filter((booking) =>
      (historyView ? (booking.status === "rejected" || booking.status === "cancelled" || Boolean(booking.completedAt)) : (booking.status !== "rejected" && booking.status !== "cancelled" && !booking.completedAt)) &&
      (!dateFilter || booking.bookingDate === dateFilter) &&
      (statusFilter === "all" || (statusFilter === "completed" ? Boolean(booking.completedAt) : booking.status === statusFilter))
    ),
    [items, dateFilter, statusFilter, historyView],
  );
  // Os cartões do painel mostram somente reservas com data no mês atual.
  // O histórico completo continua disponível na lista de reservas.
  const currentMonth = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  })();
  const currentMonthItems = items.filter((booking) => booking.bookingDate.slice(0, 7) === currentMonth);
  const pendingCount = currentMonthItems.filter((booking) => booking.status === "pending").length;
  const confirmedCount = currentMonthItems.filter((booking) => booking.status === "confirmed").length;
  const calendarYear = calendarMonth.getFullYear();
  const calendarMonthIndex = calendarMonth.getMonth();
  const calendarMonthLabel = calendarMonth.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const calendarFirstWeekday = new Date(calendarYear, calendarMonthIndex, 1).getDay();
  const calendarDaysInMonth = new Date(calendarYear, calendarMonthIndex + 1, 0).getDate();
  const calendarCells: Array<{ day: number; date: string } | null> = [
    ...Array.from({ length: calendarFirstWeekday }, () => null),
    ...Array.from({ length: calendarDaysInMonth }, (_, index) => {
      const day = index + 1;
      return { day, date: `${calendarYear}-${String(calendarMonthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}` };
    }),
  ];
  const selectedDayBookings = items
    .filter((booking) => booking.bookingDate === selectedCalendarDate && booking.status !== "rejected" && booking.status !== "cancelled" && !booking.completedAt)
    .sort((a, b) => a.bookingTime.localeCompare(b.bookingTime));
  const calendarMonthBookings = items.filter((booking) => booking.bookingDate.startsWith(`${calendarYear}-${String(calendarMonthIndex + 1).padStart(2, "0")}`));
  const calendarStatusCount = (date: string) => calendarMonthBookings.filter((booking) => booking.bookingDate === date && booking.status !== "rejected" && booking.status !== "cancelled" && !booking.completedAt).length;

  return (
    <SiteLayout title="Painel administrativo | Leticia" description="Gestão de reservas do estúdio Leticia Nail Designer">
      <main className="min-h-screen bg-[#f7f5f1]">
        <div className="mx-auto max-w-[1500px] px-3 py-4 sm:px-5 lg:px-7 lg:py-6">
          <div className="grid gap-5 lg:grid-cols-[270px_minmax(0,1fr)] lg:gap-7">
            <aside className="hidden lg:block">
              <div className="sticky top-5 rounded-3xl border border-[#e9e0d7] bg-white p-5 shadow-[0_8px_28px_rgba(73,54,41,0.06)]">
                <div className="mb-6 flex items-center gap-3 px-2 py-3">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#76543f] text-white"><Scissors size={20} /></span>
                  <span><strong className="block font-serif text-lg text-[#493629]">Letícia Nails</strong><small className="text-xs text-[#9a8574]">Gestão do estúdio</small></span>
                </div>
                <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#b19b88]">Menu principal</p>
                <nav aria-label="Menu administrativo" className="grid gap-1">
                  {[
                    { id: "overview", label: "Visão geral", Icon: LayoutDashboard },
                    { id: "bookings", label: "Agendamentos", Icon: CalendarCheck },
                      { id: "calendar", label: "Calendário mensal", Icon: CalendarDays },
                    { id: "calendar", label: "Calendário mensal", Icon: CalendarDays },
                    { id: "operating", label: "Funcionamento", Icon: Settings2 },
                    { id: "services", label: "Serviços e preços", Icon: Scissors },
                    { id: "finance", label: "Financeiro", Icon: Wallet },
                    { id: "loyalty", label: "Fidelidade", Icon: Gift },
                    { id: "team", label: "Equipa e acessos", Icon: Users },
                  ].map(({ id, label, Icon }) => <button type="button" key={id} onClick={() => navigateToPage(id)} aria-current={activePage === id ? "page" : undefined} className={`w-full text-left group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8a654b] ${activePage === id ? "bg-[#76543f] text-white shadow-sm" : "text-[#735e4d] hover:bg-[#f7f1eb] hover:text-[#493629]"}`}><Icon size={17} className={activePage === id ? "text-[#f7e9dc]" : "text-[#a1846c] group-hover:text-[#76543f]"} />{label}{id === "bookings" && unreadBookingCount > 0 && <span aria-label={`${unreadBookingCount} novos pedidos não visualizados`} className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">{unreadBookingCount > 99 ? "99+" : unreadBookingCount}</span>}</button>)}
                </nav>
                <div className="mt-6 rounded-2xl bg-[#f8f4ef] p-3"><p className="text-xs font-semibold text-[#705844]">Painel protegido</p><p className="mt-1 text-[11px] leading-relaxed text-[#9a8574]">Acesso exclusivo à equipa autorizada.</p></div>
              </div>
            </aside>
            <div className="min-w-0">
              <div className="relative mb-4 lg:hidden">
                <button
                  type="button"
                  aria-expanded={mobileMenuOpen}
                  aria-controls="admin-mobile-menu"
                  onClick={() => setMobileMenuOpen((open) => !open)}
                  className="flex min-h-12 w-full items-center justify-between rounded-xl border border-[#e9e0d7] bg-white px-4 py-3 text-sm font-semibold text-[#493629] transition hover:border-[#cdb8a5]"
                >
                  <span className="flex items-center gap-3"><Menu size={19} className="text-[#76543f]" /> Menu principal</span>
                  <span className="text-xs font-medium text-[#9a8574]">{mobileMenuOpen ? "Fechar" : "Abrir"}</span>
                </button>
                {mobileMenuOpen && (
                  <nav id="admin-mobile-menu" aria-label="Menu principal" className="mt-2 overflow-hidden rounded-xl border border-[#e9e0d7] bg-white">
                    {[
                      { id: "overview", label: "Visão geral", Icon: LayoutDashboard },
                      { id: "bookings", label: "Agendamentos", Icon: CalendarCheck },
                      { id: "operating", label: "Funcionamento e horários", Icon: Settings2 },
                      { id: "services", label: "Serviços e preços", Icon: Scissors },
                      { id: "finance", label: "Financeiro", Icon: Wallet },
                      { id: "loyalty", label: "Fidelidade", Icon: Gift },
                      { id: "team", label: "Equipa e acessos", Icon: Users },
                    ].map(({ id, label, Icon }) => (
                      <button
                        type="button"
                        key={id}
                        onClick={() => navigateToPage(id)}
                        aria-current={activePage === id ? "page" : undefined}
                        className={`flex min-h-12 w-full items-center gap-3 border-b border-[#f0e7df] px-4 py-3 text-left text-sm font-medium transition last:border-b-0 hover:bg-[#fbf6f0] hover:text-[#493629] ${activePage === id ? "bg-[#fbf6f0] text-[#493629]" : "text-[#705844]"}`}
                      >
                        <Icon size={17} className="shrink-0 text-[#a1846c]" />
                        <span className="flex-1">{label}</span>
                        {id === "bookings" && unreadBookingCount > 0 && (
                          <span aria-label={`${unreadBookingCount} novos pedidos não visualizados`} className="inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                            {unreadBookingCount > 99 ? "99+" : unreadBookingCount}
                          </span>
                        )}
                      </button>
                    ))}
                  </nav>
                )}
              </div>
              {activePage !== "overview" && <div className="mb-6 rounded-2xl border border-[#e9e0d7] bg-white p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#a1846c]">Painel administrativo</p><h1 className="mt-1 font-serif text-2xl text-[#493629]">{({ bookings: "Agendamentos", calendar: "Calendário mensal", operating: "Funcionamento e horários", services: "Serviços e preços", finance: "Financeiro", loyalty: "Fidelidade", team: "Equipa e acessos" } as Record<string, string>)[activePage] ?? "Visão geral"}</h1></div>
                  <button type="button" onClick={() => navigateToPage("overview")} className="rounded-full border border-[#d9c4b1] bg-white px-4 py-2 text-sm font-semibold text-[#705844] hover:bg-[#f5e9dd]">Voltar à visão geral</button>
                </div>
              </div>}
          <div style={{ display: activePage === "overview" ? undefined : "none" }} className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#e6d6c7] bg-white/70 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[#9a765b]">
                <ShieldCheck size={14} /> Área protegida
              </div>
              <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-[#b17f65]">Painel administrativo</p>
              <h1 className="font-serif text-3xl text-[#493629] sm:text-4xl">Olá, equipe <em className="text-[#a77d60]">Leticia</em></h1>
              <p className="mt-2 max-w-xl text-sm text-[#806c5d]">Gerencie os pedidos de agendamento e acompanhe a agenda do estúdio.</p>
            </div>
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={refreshing}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-[#d9c4b1] bg-white px-5 py-3 text-sm font-semibold text-[#705844] shadow-sm transition hover:bg-[#f5e9dd] disabled:opacity-60"
            >
              <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
              {refreshing ? "Atualizando..." : "Atualizar agenda"}
            </button>
          </div>

          <div id="overview" style={{ display: activePage === "overview" ? undefined : "none" }} className="mb-7 grid scroll-mt-28 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-[#eadbce] bg-white p-5 shadow-[0_8px_24px_rgba(92,65,43,0.05)]">
              <p className="text-sm text-[#8c7767]">Total de reservas</p>
              <p className="mt-2 font-serif text-3xl text-[#493629]">{currentMonthItems.length}</p>
            </div>
            <div className="rounded-2xl border border-[#eadbce] bg-white p-5 shadow-[0_8px_24px_rgba(92,65,43,0.05)]">
              <p className="text-sm text-[#8c7767]">Aguardando aprovação</p>
              <p className="mt-2 font-serif text-3xl text-[#a66e45]">{pendingCount}</p>
            </div>
            <div className="rounded-2xl border border-[#eadbce] bg-white p-5 shadow-[0_8px_24px_rgba(92,65,43,0.05)]">
              <p className="text-sm text-[#8c7767]">Confirmadas</p>
              <p className="mt-2 font-serif text-3xl text-[#66816a]">{confirmedCount}</p>
            </div>
          </div>

          <section id="calendar" style={{ display: activePage === "calendar" ? undefined : "none" }} className="mb-7 scroll-mt-28 rounded-3xl border border-[#e8d9cb] bg-white p-4 shadow-[0_12px_35px_rgba(92,65,43,0.06)] sm:p-7">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#a1846c]">Agenda do estúdio</p><h2 className="mt-1 font-serif text-2xl capitalize text-[#493629]">{calendarMonthLabel}</h2><p className="mt-1 text-sm text-[#8c7767]">Toque num dia para ver quem já marcou horário.</p></div>
              <div className="flex items-center gap-2">
                <button type="button" aria-label="Mês anterior" onClick={() => setCalendarMonth(new Date(calendarYear, calendarMonthIndex - 1, 1))} className="grid h-10 w-10 place-items-center rounded-full border border-[#dfcdbd] text-[#705844] hover:bg-[#fbf6f0]"><ChevronLeft size={18}/></button>
                <button type="button" onClick={() => { const now = new Date(); setCalendarMonth(new Date(now.getFullYear(), now.getMonth(), 1)); setSelectedCalendarDate(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`); }} className="rounded-full border border-[#dfcdbd] px-3 py-2 text-sm font-semibold text-[#705844] hover:bg-[#fbf6f0]">Hoje</button>
                <button type="button" aria-label="Próximo mês" onClick={() => setCalendarMonth(new Date(calendarYear, calendarMonthIndex + 1, 1))} className="grid h-10 w-10 place-items-center rounded-full border border-[#dfcdbd] text-[#705844] hover:bg-[#fbf6f0]"><ChevronRight size={18}/></button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(day => <div key={day} className="py-2 text-center text-xs font-semibold text-[#8c7767]">{day}</div>)}
              {calendarCells.map((cell, index) => cell ? <button key={cell.date} type="button" onClick={() => setSelectedCalendarDate(cell.date)} aria-pressed={selectedCalendarDate === cell.date} className={`min-h-[68px] rounded-xl border p-1 text-center transition sm:min-h-[88px] sm:p-2 ${selectedCalendarDate === cell.date ? "border-[#76543f] bg-[#76543f] text-white ring-2 ring-[#d9c4b1]" : "border-[#eee4da] bg-[#fffaf5] text-[#493629] hover:border-[#c8aa91]"}`}>
                <span className="block text-sm font-semibold">{cell.day}</span>
                {calendarStatusCount(cell.date) > 0 && <span className={`mx-auto mt-1 block max-w-full rounded-full px-1 py-0.5 text-[10px] font-semibold sm:text-xs ${selectedCalendarDate === cell.date ? "bg-white/20 text-white" : "bg-[#efe2d5] text-[#705844]"}`}>{calendarStatusCount(cell.date)} <span className="hidden sm:inline">{calendarStatusCount(cell.date) === 1 ? "cliente" : "clientes"}</span></span>}
              </button> : <div key={`empty-${index}`} className="min-h-[68px] sm:min-h-[88px]" />)}
            </div>
            <div className="mt-6 rounded-2xl border border-[#eadbce] bg-[#fffaf5] p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><h3 className="font-serif text-xl text-[#493629]">{new Date(`${selectedCalendarDate}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</h3><p className="mt-1 text-sm text-[#8c7767]">{selectedDayBookings.length} agendamento(s) ativo(s) neste dia</p></div>
                <button type="button" onClick={() => { setDateFilter(selectedCalendarDate); setHistoryView(false); setStatusFilter("all"); navigateToPage("bookings"); }} className="rounded-full bg-[#705844] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#5e4736]">Ver agendamentos do dia</button>
              </div>
              <div className="mt-4 space-y-2">
                {selectedDayBookings.map(booking => <button key={booking.id} type="button" onClick={() => { setDateFilter(selectedCalendarDate); setHistoryView(false); setStatusFilter("all"); navigateToPage("bookings"); }} className="flex w-full flex-col gap-2 rounded-xl border border-[#eadbce] bg-white p-3 text-left sm:flex-row sm:items-center sm:justify-between">
                  <span><strong className="text-[#493629]">{booking.bookingTime} · {booking.customerName}</strong><span className="mt-1 block text-xs text-[#8c7767]">{booking.service}</span></span>
                  <span className={`w-fit rounded-full border px-2.5 py-1 text-xs font-semibold ${booking.status === "confirmed" ? "border-[#d8e6d8] bg-[#edf4ed] text-[#547357]" : booking.status === "pending" ? "border-[#f0dfc5] bg-[#fff5e8] text-[#9a6a35]" : "border-[#e6ddd5] bg-[#f3efeb] text-[#806f62]"}`}>{statusLabels[booking.status] ?? booking.status}</span>
                </button>)}
                {selectedDayBookings.length === 0 && <p className="rounded-xl bg-white p-4 text-sm text-[#8c7767]">Nenhum agendamento ativo nesta data.</p>}
              </div>
            </div>
          </section>

          <div id="operating" style={{ display: activePage === "operating" ? undefined : "none" }} className="scroll-mt-28"><SalonSettingsPanel /></div>
          <div id="services" style={{ display: activePage === "services" ? undefined : "none" }} className="scroll-mt-28 space-y-7">
            <ServiceCatalogPanel />
            <ServicePricesPanel />
          </div>

          <div id="finance" style={{ display: activePage === "finance" ? undefined : "none" }} className="scroll-mt-28"><FinancePanel /></div>

          <section id="loyalty" style={{ display: activePage === "loyalty" ? undefined : "none" }} className="mb-7 scroll-mt-28 rounded-3xl border border-[#e8d9cb] bg-white p-5 shadow-[0_12px_35px_rgba(92,65,43,0.06)] sm:p-7">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div><h2 className="font-serif text-2xl text-[#493629]">Fidelidade: a cada 8 atendimentos</h2><p className="mt-1 text-sm text-[#8c7767]">Somente atendimentos pagos e concluídos contam. O bônus dá direito a um serviço cadastrado.</p></div>
              <button type="button" onClick={() => void toggleLoyalty()} className={`rounded-full px-5 py-2.5 text-sm font-semibold ${loyalty.enabled ? "bg-[#6d8267] text-white" : "border border-[#d9c4b1] bg-white text-[#705844]"}`}>{loyalty.enabled ? "Programa ativado · Desativar" : "Programa desativado · Ativar"}</button>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl bg-[#fbf6f0] p-4"><label className="text-sm font-medium text-[#705844]">Validade padrão dos novos bônus <select value={loyalty.validityMonths} onChange={event => void saveLoyaltyValidity(Number(event.target.value))} className="ml-2 rounded-xl border border-[#dfcdbd] bg-white px-3 py-2">{Array.from({ length: 60 }, (_, index) => index + 1).map(months => <option key={months} value={months}>{months} {months === 1 ? "mês" : "meses"}</option>)}</select></label><span className="text-xs text-[#8c7767]">Cada bônus pode ter prazo próprio, ajustado pela Letícia.</span></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl bg-[#fbf6f0] p-4"><p className="text-sm text-[#8c7767]">Bônus disponíveis</p><p className="mt-1 font-serif text-3xl text-[#493629]">{loyalty.rewards.filter(r => r.status === "earned").length}</p></div><div className="rounded-2xl bg-[#fbf6f0] p-4"><p className="text-sm text-[#8c7767]">Bônus já utilizados</p><p className="mt-1 font-serif text-3xl text-[#493629]">{loyalty.rewards.filter(r => r.status === "redeemed").length}</p></div></div>
            <div className="mt-5 space-y-3">{loyalty.rewards.map(reward => <div key={reward.id} className="flex flex-col gap-3 rounded-xl border border-[#eaded3] p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-[#493629]">{reward.customerName}</p><p className="text-xs text-[#8c7767]">{reward.customerEmail} · Ciclo {reward.cycleNumber} · {reward.status === "earned" ? `Vence em: ${reward.expiresAt ? new Date(reward.expiresAt).toLocaleDateString("pt-BR") : "sem prazo definido"}` : `Utilizado: ${reward.redeemedService ?? "serviço"}`}</p></div>{reward.status === "earned" && <div className="flex flex-wrap gap-2"><button type="button" onClick={() => void adjustRewardValidity(reward)} className="rounded-full border border-[#d9c4b1] bg-white px-3 py-2 text-xs font-semibold text-[#705844]">Ajustar validade</button><select aria-label={`Reserva para resgate de ${reward.customerName}`} value={redeemBookingChoices[reward.id] || ""} onChange={event => setRedeemBookingChoices(old => ({ ...old, [reward.id]: event.target.value }))} className="rounded-xl border border-[#dfcdbd] bg-white px-3 py-2 text-sm text-[#493629]"><option value="">Escolher reserva aprovada</option>{items.filter(item => item.customerEmail.toLowerCase() === reward.customerEmail.toLowerCase() && item.status === "confirmed").map(item => <option key={item.id} value={item.id}>{item.bookingDate} · {item.bookingTime} · {item.service}</option>)}</select><select aria-label={`Serviço gratuito de ${reward.customerName}`} value={redeemChoices[reward.id] || serviceChoices[0]} onChange={event => setRedeemChoices(old => ({ ...old, [reward.id]: event.target.value }))} className="rounded-xl border border-[#dfcdbd] bg-white px-3 py-2 text-sm text-[#493629]">{serviceChoices.map(service => <option key={service}>{service}</option>)}</select><button type="button" onClick={() => void redeemReward(reward)} className="rounded-full bg-[#6d8267] px-4 py-2 text-sm font-semibold text-white">Confirmar resgate</button></div>}</div>)}</div>
          </section>

          <section id="team" style={{ display: activePage === "team" ? undefined : "none" }} className="mb-7 scroll-mt-28 rounded-3xl border border-[#e8d9cb] bg-white p-5 shadow-[0_12px_35px_rgba(92,65,43,0.06)] sm:p-7">
            <h2 className="font-serif text-2xl text-[#493629]">Acesso de funcionários e familiares</h2>
            <p className="mt-1 text-sm text-[#8c7767]">Autorize o e-mail que já pertence à conta original da pessoa. Para trocar uma senha esquecida, use Gerar nova senha temporária ao lado do e-mail. O sistema mantém a mesma conta, histórico, permissões e identificador; não cria outra conta.</p>
            <form onSubmit={addAuthorisedEmail} className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input type="email" required maxLength={254} value={authorisedEmailInput} onChange={event => setAuthorisedEmailInput(event.target.value)} placeholder="e-mail da conta existente" className="min-w-0 flex-1 rounded-xl border border-[#dfcdbd] bg-white px-4 py-3 text-sm text-[#493629] outline-none focus:border-[#a77d60]" />
              <button type="submit" className="rounded-full bg-[#705844] px-5 py-3 text-sm font-semibold text-white">Autorizar e-mail</button>
            </form>
            {temporaryCredentials && <div className="mt-4 rounded-2xl border border-[#d9c4b1] bg-[#fbf6f0] p-4 text-sm text-[#493629]"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">Nova senha gerada para {temporaryCredentials.name}</p><p className="mt-1">{temporaryCredentials.email}</p></div><button type="button" onClick={() => setTemporaryCredentials(null)} className="rounded-full border border-[#d9c4b1] bg-white px-3 py-1 text-xs font-semibold">Fechar</button></div><p className="mt-3 text-xs font-semibold uppercase tracking-wide text-[#806c5d]">Senha temporária — exibida somente agora</p><code className="mt-1 block break-all rounded-lg bg-white p-3 text-base">{temporaryCredentials.temporaryPassword}</code><button type="button" onClick={() => void copyTemporaryPassword()} className="mt-3 rounded-full bg-[#705844] px-4 py-2 text-xs font-semibold text-white">Copiar senha temporária</button><p className="mt-2 text-xs text-[#806c5d]">A pessoa entra com o mesmo e-mail e esta senha. No primeiro acesso, deverá criar uma senha pessoal. A senha anterior foi substituída.</p>{!temporaryCredentials.sessionsRevoked && <p className="mt-2 text-xs font-semibold text-[#9b594c]">Atenção: não foi possível encerrar todas as sessões antigas. Elas continuam bloqueadas até a troca da senha.</p>}</div>}
            <div className="mt-4 space-y-2">
              {authorisedEmails.map(item => <div key={item.email} className="flex flex-col gap-2 rounded-xl border border-[#eaded3] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="break-all text-sm font-medium text-[#493629]">{item.name || item.email}</p>{item.name && <p className="break-all text-xs text-[#8c7767]">{item.email}</p>}</div><div className="flex flex-wrap items-center gap-2"><button type="button" disabled={resettingEmail === item.email} onClick={() => void resetExistingAccountPassword(item.email)} className="w-fit rounded-full bg-[#705844] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{resettingEmail === item.email ? "Gerando..." : "Gerar nova senha temporária"}</button>{!item.userId && <span className="text-xs text-[#8c7767]">Primeiro acesso: cria o cadastro autorizado e gera a senha</span>}<button type="button" onClick={() => void removeAuthorisedEmail(item.email)} className="w-fit rounded-full border border-[#e3c8c0] px-3 py-1.5 text-xs font-semibold text-[#9b594c]">Remover autorização</button></div></div>)}
              {authorisedEmails.length === 0 && <p className="rounded-xl bg-[#fbf6f0] px-4 py-5 text-sm text-[#8c7767]">Nenhum e-mail autorizado ainda.</p>}
            </div>
          </section>

          <section id="bookings" style={{ display: activePage === "bookings" ? undefined : "none" }} className="scroll-mt-28 rounded-3xl border border-[#e8d9cb] bg-white p-5 shadow-[0_12px_35px_rgba(92,65,43,0.06)] sm:p-7">
            <div className="mb-6 flex flex-col gap-1">
              <h2 className="font-serif text-2xl text-[#493629]">Reservas recebidas</h2>
              <p className="text-sm text-[#8c7767]">Yuri e Letícia têm acesso administrativo com as mesmas permissões.</p>
            </div>

            <div className="mb-5 flex flex-wrap gap-2"><button type="button" onClick={() => { setHistoryView(false); setStatusFilter("all"); }} className={`rounded-full px-4 py-2 text-sm font-semibold ${!historyView ? "bg-[#705844] text-white" : "border border-[#dfcdbd] bg-white text-[#705844]"}`}>Agenda atual</button><button type="button" onClick={() => { setHistoryView(true); setStatusFilter("all"); }} className={`rounded-full px-4 py-2 text-sm font-semibold ${historyView ? "bg-[#705844] text-white" : "border border-[#dfcdbd] bg-white text-[#705844]"}`}>Histórico</button></div>
            <div className="mb-6 grid gap-3 rounded-2xl bg-[#fbf6f0] p-4 sm:grid-cols-[1fr_1fr]">
              <label className="grid gap-2 text-sm font-medium text-[#705844]">
                Filtrar por data
                <span className="relative">
                  <CalendarDays size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#a1846c]" />
                  <input
                    type="date"
                    value={dateFilter}
                    onChange={(event) => setDateFilter(event.target.value)}
                    className="w-full rounded-xl border border-[#dfcdbd] bg-white py-2.5 pl-10 pr-3 text-sm text-[#493629] outline-none focus:border-[#a77d60] focus:ring-2 focus:ring-[#a77d60]/15"
                  />
                </span>
              </label>
              <label className="grid gap-2 text-sm font-medium text-[#705844]">
                Estado da reserva
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="w-full rounded-xl border border-[#dfcdbd] bg-white px-3 py-2.5 text-sm text-[#493629] outline-none focus:border-[#a77d60] focus:ring-2 focus:ring-[#a77d60]/15"
                >
                  <option value="all">Todos os estados</option>
                  {!historyView && <option value="pending">Pendentes</option>}
                  {!historyView && <option value="confirmed">Aprovadas</option>}{historyView && <option value="completed">Concluídas</option>}
                  <option value="rejected">Rejeitadas</option>
                  <option value="cancelled">Canceladas</option>
                </select>
              </label>
            </div>

            {error && <p role="alert" className="mb-5 rounded-xl border border-[#e7b9ad] bg-[#fff1ed] px-4 py-3 text-sm text-[#914b40]">{error}</p>}

            <div className="grid gap-4">
              {visibleItems.map((booking) => {
                const status = booking.status;
                const statusStyle = status === "confirmed"
                  ? "bg-[#edf4ed] text-[#547357] border-[#d8e6d8]"
                  : status === "pending"
                    ? "bg-[#fff5e8] text-[#9a6a35] border-[#f0dfc5]"
                    : "bg-[#f3efeb] text-[#806f62] border-[#e6ddd5]";
                return (
                  <article key={booking.id} className="rounded-2xl border border-[#eaded3] bg-white p-5 transition hover:border-[#d8c2ae] hover:shadow-[0_8px_24px_rgba(92,65,43,0.06)] sm:p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <h3 className="text-lg font-semibold text-[#493629]">{booking.customerName}</h3>
                        <p className="mt-1 text-xs text-[#9a8574]">Código: {booking.bookingCode}</p>
                      </div>
                      <span className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-semibold ${statusStyle}`}>
                        {statusLabels[status] ?? status}
                      </span>
                    </div>

                    <div className="mt-5 grid gap-3 text-sm text-[#705f51] sm:grid-cols-2">
                      <div className="flex items-center gap-2"><CalendarDays size={16} className="shrink-0 text-[#a1846c]" /> {booking.bookingDate}</div>
                      <div className="flex items-center gap-2"><Clock3 size={16} className="shrink-0 text-[#a1846c]" /> {booking.bookingTime}</div>
                      <div className="sm:col-span-2"><span className="font-semibold text-[#493629]">Serviço:</span> {booking.service}</div>
                      {booking.appointmentDetails && <div className="sm:col-span-2 rounded-xl border border-[#e7d9cb] bg-[#fffaf4] p-3"><span className="font-semibold text-[#493629]">Detalhes para preparar o atendimento:</span><p className="mt-1 whitespace-pre-wrap">{booking.appointmentDetails}</p></div>}
                      <div className="flex min-w-0 items-center gap-2"><Mail size={16} className="shrink-0 text-[#a1846c]" /><span className="truncate">{booking.customerEmail}</span></div>
                      <div className="flex items-center gap-2"><Phone size={16} className="shrink-0 text-[#a1846c]" /> {booking.customerPhone}</div>
                    </div>

                    <div className="mt-4 rounded-xl bg-[#fbf6f0] p-4 text-sm text-[#705f51]">
                      <p>Pagamento: <strong>{booking.paymentStatus === "paid" ? "Recebido" : "Não recebido"}</strong></p>
                      <p className="mt-1">Atendimento: <strong>{booking.completedAt ? "Concluído" : "Não concluído"}</strong></p>
                      {status !== "rejected" && status !== "cancelled" && <div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={!!busy} onClick={() => void updateBookingFlag(booking, "payment", booking.paymentStatus !== "paid")} className="rounded-full border border-[#d9c4b1] bg-white px-4 py-2 text-xs font-semibold text-[#705844] disabled:opacity-50">{booking.paymentStatus === "paid" ? "Marcar não recebido" : "Confirmar pagamento"}</button>{booking.paymentStatus === "paid" && <button type="button" onClick={() => generatePaymentReceipt(booking)} className="rounded-full border border-[#d9c4b1] bg-white px-4 py-2 text-xs font-semibold text-[#705844]">Gerar comprovante PDF</button>}<button type="button" disabled={!!busy || (booking.paymentStatus !== "paid" && !booking.completedAt)} onClick={() => void updateBookingFlag(booking, "completion", !booking.completedAt)} className="rounded-full border border-[#d9c4b1] bg-white px-4 py-2 text-xs font-semibold text-[#705844] disabled:opacity-50">{booking.completedAt ? "Reabrir atendimento" : "Marcar concluído"}</button></div>}
                    </div>
                    <div className="mt-5 flex flex-wrap gap-2 border-t border-[#f0e7df] pt-4">
                      {status === "pending" && <>
                        <button type="button" disabled={!!busy} onClick={() => void decide(booking, "confirmed")} className="inline-flex items-center gap-2 rounded-full bg-[#6d8267] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#586e53] disabled:opacity-50">
                          <Check size={16} /> {busy === booking.id ? "Salvando..." : "Aprovar reserva"}
                        </button>
                        <button type="button" disabled={!!busy} onClick={() => void decide(booking, "rejected")} className="inline-flex items-center gap-2 rounded-full border border-[#e3c8c0] bg-white px-4 py-2.5 text-sm font-semibold text-[#9b594c] transition hover:bg-[#fff3f0] disabled:opacity-50">
                          <X size={16} /> Rejeitar
                        </button>
                      </>}
                      {status === "confirmed" && (
                        <button type="button" disabled={!!busy} onClick={() => void decide(booking, "cancelled")} className="rounded-full border border-[#e3c8c0] bg-white px-4 py-2.5 text-sm font-semibold text-[#9b594c] hover:bg-[#fff3f0] disabled:opacity-50">
                          Cancelar reserva
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
              {visibleItems.length === 0 && (
                <div className="rounded-2xl border border-dashed border-[#dfcdbd] bg-[#fdfaf7] px-5 py-12 text-center">
                  <CalendarDays size={28} className="mx-auto mb-3 text-[#b99c83]" />
                  <p className="font-medium text-[#705844]">Nenhuma reserva encontrada</p>
                  <p className="mt-1 text-sm text-[#9a8574]">Altere os filtros ou atualize a agenda.</p>
                </div>
              )}
            </div>
          </section>
            </div>
          </div>
        </div>
      </main>
      <LeticiaAIChat />
    </SiteLayout>
  );
}

export default function AdminPage() {
  return <AdminGuard><AdminContent /></AdminGuard>;
}