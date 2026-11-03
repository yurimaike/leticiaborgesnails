import "./hero-image.css";
import { ArrowUpRight, CalendarDays, Camera, Check, Clock3, Download, Heart, MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import SiteLayout from "../../site/SiteLayout";
import { salonContact, services, whatsappLink } from "../../site/siteData";

const Index = () => {
  const [heartBurst, setHeartBurst] = useState(0);

  return (
    <SiteLayout
      title="Nail Designer Leticia | Manicure e pedicure em Nova Tramandaí"
      description="Esmaltação em gel, pés tradicional, mãos tradicional e manutenção com Leticia Borges em Nova Tramandaí."
    >
      <main>
        <section className="hero-section section-shell">
          <div className="hero-copy">
            <p className="eyebrow"><span className="eyebrow-dot" /> Nail designer em Nova Tramandaí</p>
            <h1>Unhas cuidadas, presença marcante.</h1>
            <p className="hero-lede">
              Um momento só seu para sair com mãos e pés impecáveis. Atendimento próximo,
              acabamento delicado e horários combinados diretamente com a Leticia.
            </p>
            <div className="hero-actions">
              <Link className="button button-primary" to="/agenda">
                <CalendarDays size={18} />
                Ver agenda
                <ArrowUpRight size={17} />
              </Link>
              <a className="button button-quiet" href={whatsappLink("Olá, Leticia! Gostaria de saber mais sobre seus atendimentos.")} target="_blank" rel="noreferrer">
                <MessageCircle size={18} />
                Falar no WhatsApp
              </a>
            </div>
            <div className="hero-notes">
              <span><Check size={15} /> Horários de 08h às 19h</span>
              <span><Check size={15} /> Valores sob consulta</span>
            </div>
          </div>

          <div className="hero-visual-wrap">
            <div className="hero-glow" />
            <div className="hero-image-card">
              <img
                data-image-slot="home.hero"
                src="/assets/slots/home.hero.jpg"
                alt="Perfil da Nail Designer Leticia com exemplos de manicure e pedicure"
                width="620"
                height="720"
              />
            </div>
            <div className="floating-stamp-wrap">
              <button
                className="floating-stamp"
                type="button"
                aria-label="Feito com cuidado. Clique para ver corações."
                onClick={() => setHeartBurst((value) => value + 1)}
              >
                <Heart size={16} fill="currentColor" />
                <span>feito com cuidado</span>
              </button>
              {heartBurst > 0 && (
                <span className="heart-burst" key={heartBurst} aria-hidden="true">
                  {Array.from({ length: 9 }, (_, index) => (
                    <span className={`burst-heart burst-heart-${index + 1}`} key={index}>♥</span>
                  ))}
                </span>
              )}
            </div>
            <div className="hero-booking-link">
              <Link className="button button-primary" to="/agenda">
                <CalendarDays size={18} />
                Reserve seu horário
                <ArrowUpRight size={17} />
              </Link>
            </div>
          </div>
        </section>

        <section className="trust-strip">
          <div className="section-shell trust-grid">
            <div className="trust-item"><span className="trust-icon"><Clock3 size={18} /></span><div><strong>08h — 19h</strong><span>janela de atendimento</span></div></div>
            <div className="trust-item"><span className="trust-icon"><Heart size={18} /></span><div><strong>Acabamento delicado</strong><span>cuidado em cada detalhe</span></div></div>
            <a className="trust-item" href={salonContact.instagram} target="_blank" rel="noreferrer"><span className="trust-icon"><Camera size={18} /></span><div><strong>{salonContact.instagramHandle}</strong><span>veja mais inspirações</span></div></a>
          </div>
        </section>

        <section className="section-shell section-block">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Serviços essenciais</p>
              <h2>Seu ritual de beleza, do seu jeito.</h2>
            </div>
            <Link className="text-link" to="/servicos">Ver todos os serviços <ArrowUpRight size={16} /></Link>
          </div>
          <div className="service-grid">
            {services.slice(0, 3).map((service, index) => (
              <article className={`service-card service-card-${index + 1}`} key={service.name}>
                <div className="service-number">0{index + 1}</div>
                <div className="service-mark">{service.mark}</div>
                <h3>{service.name}</h3>
                <p>{service.description}</p>
                <Link to="/agenda" className="card-link">Escolher horário <ArrowUpRight size={16} /></Link>
              </article>
            ))}
          </div>
        </section>

        <section className="section-shell invite-section">
          <div className="invite-card">
            <div>
              <p className="eyebrow">Vamos combinar?</p>
              <h2>O próximo horário bonito pode ser o seu.</h2>
              <p>Escolha um serviço e um horário livre. A confirmação final acontece no WhatsApp, de forma simples e pessoal.</p>
            </div>
            <Link className="button button-light" to="/agenda">Abrir agenda <ArrowUpRight size={17} /></Link>
          </div>
        </section>

        <section className="section-shell invite-section" aria-labelledby="android-app-title">
          <div className="invite-card">
            <div>
              <p className="eyebrow">NOVO · Aplicativo gratuito</p>
              <h2 id="android-app-title">Letícia Borges Nails no seu Android.</h2>
              <p>Acesse o site e consulte a agenda com praticidade pelo aplicativo oficial do salão.</p>
              <p className="mt-3 text-sm opacity-90"><strong>Segurança e confiança:</strong> baixe somente pelo botão oficial desta página. O aplicativo não pede Pix nem pagamento antecipado. Os pagamentos do atendimento são combinados presencialmente no salão.</p>
              <details className="mt-4 rounded-xl border border-current/15 p-4">
                <summary className="cursor-pointer font-semibold">Como instalar no Samsung (passo a passo)</summary>
                <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
                  <li>Toque em <strong>Baixar Leticia.apk</strong> e aguarde o download terminar.</li>
                  <li>Se aparecer um aviso, abra as configurações de segurança. Em celulares Samsung, o <strong>Bloqueador automático</strong> pode impedir instalações de fora da Play Store/Galaxy Store. Para instalar este APK, pode ser necessário desativá-lo temporariamente.</li>
                  <li>Se o celular pedir, permita <strong>Instalar aplicativos desconhecidos</strong> para o navegador ou aplicativo usado para abrir o arquivo baixado.</li>
                  <li>Abra <strong>Leticia.apk</strong> em Downloads e toque em <strong>Instalar</strong>.</li>
                  <li>Depois da instalação, volte às configurações e reative o Bloqueador automático e retire a permissão de instalar aplicativos desconhecidos.</li>
                </ol>
                <p className="mt-3 text-sm">O nome das opções pode variar conforme a versão do Android. Só prossiga se tiver baixado o arquivo diretamente deste site oficial. Se não se sentir confortável, não altere as proteções do telefone.</p>
              </details>
              <p className="mt-3 text-xs opacity-80">Este app abre o site do salão; precisa de internet. Não é distribuído pela Google Play. O Android pode mostrar avisos por ser uma instalação manual.</p>
            </div>
            <a className="button button-light" href="https://github.com/yurimaike/leticiaborgesnails/releases/latest/download/leticia.apk" target="_blank" rel="noreferrer">
              <Download size={18} /> Baixar Leticia.apk <ArrowUpRight size={17} />
            </a>
          </div>
        </section>
      </main>
    </SiteLayout>
  );
};

export default Index;
