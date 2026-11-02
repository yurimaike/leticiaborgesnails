import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "@/lib/api";
import { authClient } from "@/lib/auth";
import SiteLayout from "@/site/SiteLayout";
import { whatsappLink } from "@/site/siteData";
import CustomerLoyalty from "@/components/customer/CustomerLoyalty";

type CustomerBooking = {
  id: string;
  bookingCode?: string;
  customerName?: string;
  paymentAmountCents?: number | null;
  bookingDate: string;
  bookingTime: string;
  service: string;
  status: "pending" | "confirmed" | "rejected" | "cancelled";
  paymentStatus: "paid" | "unpaid";
  completedAt: string | null;
};
type Reward = { id: string; status: string; earnedAt: string; expiresAt: string | null; redeemedAt: string | null; redeemedService: string | null };
type LoyaltyData = { enabled: boolean; completedPaid: number; bookingsUntilReward: number | null; rewards: Reward[] };
type ApiPayload = {
  ok?: boolean;
  data?: { bookings?: CustomerBooking[]; booking?: CustomerBooking & { bookingCode: string }; loyalty?: LoyaltyData };
  error?: { message?: string };
};
const statusLabel: Record<CustomerBooking["status"], string> = {
  pending: "Aguardando aprovação", confirmed: "Aprovada", rejected: "Rejeitada", cancelled: "Cancelada"
};
function printPaymentReceipt(booking: CustomerBooking) {
  if (booking.paymentStatus !== "paid" || !booking.paymentAmountCents || !booking.bookingCode) return;
  const safe = (value: string) => value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
  const amount = (booking.paymentAmountCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;
  printWindow.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Comprovante de recebimento</title><style>body{font-family:Arial,sans-serif;color:#493629;max-width:720px;margin:40px auto;padding:32px;border:1px solid #eadbce}h1{color:#80634d}p{padding:8px 0;border-bottom:1px solid #eee5dc}.note{font-size:12px;color:#806c5d;margin-top:28px}@media print{body{margin:0;border:0}}</style></head><body><h1>Comprovante de recebimento</h1><p><b>Estúdio:</b> Leticia Nail Designer</p><p><b>Cliente:</b> ${safe(booking.customerName ?? "Cliente")}</p><p><b>Reserva:</b> ${safe(booking.bookingCode)}</p><p><b>Serviço(s):</b> ${safe(booking.service)}</p><p><b>Data do atendimento:</b> ${safe(booking.bookingDate)} às ${safe(booking.bookingTime)}</p><p><b>Valor recebido:</b> ${amount}</p><p><b>Data de emissão:</b> ${new Date().toLocaleDateString("pt-BR")}</p><p class="note">Comprovante de recebimento emitido pelo estabelecimento. Este documento não substitui nota fiscal eletrônica.</p><script>window.onload=function(){window.print()}</script></body></html>`);
  printWindow.document.close();
}
function dateLabel(date: string) {
  const parsed = new Date(`${date}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? date : new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(parsed);
}
export default function MyBookingsPage() {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const isVerifiedAccount = Boolean(session?.user?.emailVerified);
  const [accountBookings, setAccountBookings] = useState<CustomerBooking[]>([]);
  const [bookingCode, setBookingCode] = useState("LET-");
  const [guestBooking, setGuestBooking] = useState<(CustomerBooking & { bookingCode: string }) | null>(null);
  const [guestLoyalty, setGuestLoyalty] = useState<LoyaltyData | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!isVerifiedAccount) return;
    let active = true;
    setLoading(true);
    void apiFetch("/bookings/mine", { silent: true })
      .then(async response => {
        const payload = await response.json() as ApiPayload;
        if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? "Não foi possível carregar suas reservas.");
        if (active) setAccountBookings(payload.data?.bookings ?? []);
      })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Erro ao carregar reservas."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isVerifiedAccount, session?.user?.id]);
  async function lookupGuest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true); setError(""); setNotice(""); setGuestBooking(null); setGuestLoyalty(undefined);
    try {
      const code = bookingCode.trim().toUpperCase();
      if (!/^LET-[A-F0-9]{8}$/.test(code)) {
        throw new Error("Formato inválido. Use LET- seguido de 8 caracteres: números de 0 a 9 ou letras de A a F. Exemplo: LET-AB12CD34.");
      }
      const response = await apiFetch(`/bookings/guest-access/${encodeURIComponent(code)}`, { auth: false, silent: true });
      const payload = await response.json() as ApiPayload;
      if (!response.ok || !payload.ok || !payload.data?.booking) throw new Error(payload.error?.message ?? "Não foi possível localizar a reserva.");
      setGuestBooking(payload.data.booking);
      setGuestLoyalty(payload.data.loyalty);
      setNotice("Reserva localizada. Guarde seu código de acesso.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível consultar a reserva.");
    } finally { setLoading(false); }
  }
  const bookings = isVerifiedAccount ? accountBookings : guestBooking ? [guestBooking] : [];
  const shouldLoad = sessionPending || loading;
  return (
    <SiteLayout title="Minhas reservas | Letícia" description="Consulte suas reservas de atendimento.">
      <main className="section-shell min-h-[60vh] py-16 md:py-24">
        <div className="mx-auto max-w-3xl">
          <p className="eyebrow">Área da cliente</p>
          <h1 className="mt-3 font-display text-4xl text-foreground md:text-5xl">Minhas reservas</h1>
          <p className="mt-4 max-w-2xl text-muted-foreground">Consulte sua reserva com o código de acesso recebido ao agendar. Não precisa informar e-mail nem solicitar outro código.</p>
          {!sessionPending && !isVerifiedAccount && !guestBooking && (
            <section className="mt-8 rounded-2xl border border-border bg-card p-6 md:p-8">
              <h2 className="font-display text-2xl">Consultar reserva</h2>
              <form className="mt-6 grid gap-4" onSubmit={lookupGuest}>
                <label className="grid gap-2 text-sm font-medium" htmlFor="booking-access-code">Código da reserva</label>
                <input id="booking-access-code" className="min-h-12 w-full min-w-0 rounded-xl border border-input bg-background px-4 font-mono uppercase tracking-wider" autoComplete="off" placeholder="LET-AB12CD34" aria-describedby="booking-code-format" required minLength={12} maxLength={12} pattern="LET-[A-F0-9]{8}" title="Use LET- seguido de 8 caracteres: números de 0 a 9 ou letras de A a F." value={bookingCode} onChange={event => { const entered = event.target.value.toUpperCase().replace(/^LET-?/, ""); const suffix = entered.replace(/[^A-F0-9]/g, "").slice(0, 8); setBookingCode(`LET-${suffix}`); }} />
                <p id="booking-code-format" className="text-xs text-muted-foreground">Formato obrigatório: LET- + 8 caracteres (0–9 ou A–F). Exemplo: <strong>LET-AB12CD34</strong>. O prefixo LET- já está preenchido; digite os 8 caracteres restantes.</p>
                <button className="min-h-12 w-fit rounded-full bg-primary px-6 text-primary-foreground disabled:opacity-60" type="submit" disabled={loading}>{loading ? "Consultando…" : "Consultar reserva"}</button>
              </form>
              {!session?.user && <p className="mt-5 text-sm text-muted-foreground">Também pode <Link className="text-primary underline" to="/auth">entrar ou criar uma conta</Link>.</p>}
            </section>
          )}
          {notice && <p className="mt-6 rounded-xl bg-secondary p-4 text-sm text-secondary-foreground" role="status">{notice}</p>}
          {error && <p className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-destructive" role="alert">{error}</p>}
          {shouldLoad && <p className="mt-10" role="status">Carregando suas reservas…</p>}
          {!shouldLoad && !isVerifiedAccount && guestBooking && <button className="mt-5 text-sm text-primary underline" type="button" onClick={() => { setGuestBooking(null); setGuestLoyalty(undefined); setBookingCode("LET-"); setNotice(""); }}>Consultar outro código</button>}
          {!shouldLoad && bookings.length === 0 && isVerifiedAccount && <section className="mt-8 rounded-2xl border border-border bg-card p-7"><h2 className="font-display text-2xl">Nenhuma reserva encontrada</h2><p className="mt-2 text-muted-foreground">Faça uma nova reserva para continuar.</p><Link className="mt-6 inline-flex min-h-11 items-center rounded-full bg-primary px-6 text-primary-foreground" to="/agenda">Agendar horário</Link></section>}
          {!shouldLoad && bookings.length > 0 && <div className="mt-8 grid gap-4">{bookings.map(booking => (
            <article key={booking.id} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-display text-xl">{booking.service}</h2><p className="mt-2 text-muted-foreground">{dateLabel(booking.bookingDate)} · {booking.bookingTime}</p></div><span className="rounded-full bg-secondary px-3 py-1 text-sm text-secondary-foreground">{statusLabel[booking.status]}</span></div>
              <div className="mt-4 grid gap-2 rounded-xl bg-secondary/50 p-4 text-sm"><p><strong>Pagamento:</strong> {booking.paymentStatus === "paid" ? "Pago" : "Aguardando pagamento"}</p>{booking.paymentStatus === "paid" && booking.paymentAmountCents && booking.bookingCode && <button type="button" className="mt-2 text-primary underline" onClick={() => printPaymentReceipt(booking)}>Baixar comprovante PDF</button>}<p><strong>Atendimento:</strong> {booking.completedAt ? "Concluído" : "Ainda não concluído"}</p></div>
              {(booking.status === "pending" || booking.status === "confirmed") && <a className="mt-5 inline-flex min-h-11 items-center rounded-full border border-primary/30 px-5 text-sm text-primary hover:bg-primary/5" href={whatsappLink(`Olá, gostaria de solicitar o cancelamento do meu horário de ${booking.service}, em ${dateLabel(booking.bookingDate)} às ${booking.bookingTime}.`)} target="_blank" rel="noreferrer">Solicitar cancelamento pelo WhatsApp</a>}
            </article>
          ))}</div>}
          {isVerifiedAccount && <CustomerLoyalty />}
          {!isVerifiedAccount && guestBooking && guestLoyalty?.enabled && <section className="mt-8 rounded-2xl border border-border bg-card p-6"><h2 className="font-display text-2xl">Programa de fidelidade</h2><p className="mt-2 text-muted-foreground">{guestLoyalty.completedPaid % 8} de 8 atendimentos pagos e concluídos. {guestLoyalty.bookingsUntilReward === 1 ? "Falta 1 atendimento para ganhar um serviço." : `Faltam ${guestLoyalty.bookingsUntilReward} atendimentos para ganhar um serviço.`}</p>{guestLoyalty.rewards.map(reward => <p key={reward.id} className="mt-3 text-sm">{reward.status === "earned" ? "Você tem um serviço gratuito disponível!" : `Bônus utilizado: ${reward.redeemedService ?? "serviço"}`}</p>)}</section>}
        </div>
      </main>
    </SiteLayout>
  );
}
