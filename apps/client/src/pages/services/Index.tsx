import { useEffect, useState } from "react";
import { ArrowUpRight, Check, Heart, Sparkles } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Link } from "react-router-dom";
import SiteLayout from "../../site/SiteLayout";
import { services } from "../../site/siteData";

type PricePayload = { ok: boolean; data?: { services: Array<{ serviceName: string; priceCents: number | null }> } };
function money(cents: number) { return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }

export default function ServicesPage() {
  const [prices, setPrices] = useState<Record<string, number | null>>({});
  useEffect(() => { let active = true; apiFetch("/service-prices", { auth: false, silent: true }).then(async response => { const payload = await response.json() as PricePayload; if (response.ok && payload.ok && active) setPrices(Object.fromEntries((payload.data?.services ?? []).map(item => [item.serviceName, item.priceCents]))); }).catch(() => undefined); return () => { active = false; }; }, []);
  return (
    <SiteLayout
      title="Serviços | Nail Designer Leticia"
      description="Conheça os serviços de esmaltação em gel, pés tradicional, mãos tradicional e manutenção da Leticia."
    >
      <main>
        <section className="page-intro section-shell">
          <p className="eyebrow"><span className="eyebrow-dot" /> Serviços</p>
          <h1>Pequenos detalhes,<br /><em>grande diferença.</em></h1>
          <p>Escolha o cuidado que combina com você. Consulte os valores actualizados de cada serviço. A equipe pode ajustar os preços pelo painel administrativo.</p>
        </section>
        <section className="section-shell service-list">
          {services.map((service, index) => (
            <article className="service-row" key={service.name}>
              <div className="service-row-index">0{index + 1}</div>
              <div className="service-row-mark">{service.mark}</div>
              <div className="service-row-content">
                <h2>{service.name}</h2>
                <p>{service.description}</p>
                <span><Check size={15} /> {service.detail}</span>
                <strong className="mt-3 block text-sm text-[#705844]">{prices[service.name] == null ? "Valor ainda não informado" : money(prices[service.name]!)}</strong>
              </div>
              <Link className="round-arrow" to="/agenda" aria-label={`Agendar ${service.name}`}><ArrowUpRight size={20} /></Link>
            </article>
          ))}
        </section>
        <section className="section-shell service-note-grid">
          <div className="soft-panel">
            <Sparkles size={21} />
            <h3>Acabamento que respeita seu estilo</h3>
            <p>Do clássico ao mais marcante, a ideia é sair sentindo que o resultado tem a sua cara.</p>
          </div>
          <div className="soft-panel soft-panel-dark">
            <Heart size={21} />
            <h3>Atendimento com calma</h3>
            <p>Um horário reservado para você, com conversa leve e atenção em cada etapa.</p>
          </div>
        </section>
        <section className="section-shell bottom-cta">
          <div><p className="eyebrow">Pronta para escolher?</p><h2>Veja os horários disponíveis.</h2></div>
          <Link className="button button-primary" to="/agenda">Abrir agenda <ArrowUpRight size={17} /></Link>
        </section>
      </main>
    </SiteLayout>
  );
}

