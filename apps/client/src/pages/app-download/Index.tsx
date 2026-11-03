import { ArrowDownToLine, ArrowLeft, CheckCircle2, ExternalLink, Info, LockKeyhole, ShieldCheck, Smartphone, Wifi } from "lucide-react";
import { Link } from "react-router-dom";
import SiteLayout from "../../site/SiteLayout";
import "./download.css";

const APK_URL = "https://github.com/yurimaike/leticiaborgesnails/releases/latest/download/leticia.apk";
const RELEASE_URL = "https://github.com/yurimaike/leticiaborgesnails/releases/tag/android-v1.0.0";

export default function AppDownloadPage() {
  return (
    <SiteLayout
      title="Baixar aplicativo | Letícia Borges Nails"
      description="Instale Letícia Borges Nails no Android ou iPhone gratuitamente. Veja como baixar, adicionar à tela inicial e usar com segurança."
    >
      <main className="app-download-page">
        <section className="app-download-hero">
          <div className="app-download-orb app-download-orb-one" aria-hidden="true" />
          <div className="app-download-orb app-download-orb-two" aria-hidden="true" />
          <div className="app-download-content">
            <Link to="/" className="app-download-back"><ArrowLeft size={16} /> Voltar ao site</Link>
            <div className="app-download-brand-icon"><Smartphone size={34} strokeWidth={1.5} /></div>
            <p className="app-download-eyebrow">Aplicativo para Android e iPhone</p>
            <h1>Letícia Borges <em>Nails</em></h1>
            <p className="app-download-lede">
              Seus agendamentos e informações do salão em uma experiência prática no celular.
            </p>
            <div className="app-download-version"><span /> Versão 1.0.0 disponível</div>
            <a className="app-download-button" href={APK_URL} download>
              <ArrowDownToLine size={21} />
              <span><strong>Baixar aplicativo</strong><small>Download gratuito · arquivo APK</small></span>
            </a>
            <a className="app-download-release" href={RELEASE_URL} target="_blank" rel="noopener noreferrer">
              Conferir versão e arquivo no GitHub <ExternalLink size={14} />
            </a>
          </div>
        </section>

        <section className="app-download-details">
          <div className="app-download-section-heading">
            <p className="app-download-eyebrow">Antes de instalar</p>
            <h2>Informações claras e segurança em primeiro lugar.</h2>
          </div>
          <div className="app-download-info-grid">
            <article className="app-download-info-card">
              <Smartphone size={22} />
              <h3>Compatibilidade</h3>
              <p>Android: baixe o arquivo APK. iPhone: adicione o site à Tela de Início pelo Safari, sem baixar APK.</p>
            </article>
            <article className="app-download-info-card">
              <Wifi size={22} />
              <h3>Precisa de internet</h3>
              <p>O aplicativo abre o site oficial e precisa de conexão com a internet para funcionar.</p>
            </article>
            <article className="app-download-info-card">
              <ShieldCheck size={22} />
              <h3>Download oficial</h3>
              <p>O botão acima direciona ao arquivo publicado no repositório oficial do projeto no GitHub.</p>
            </article>
          </div>

          <div className="app-download-safety">
            <div className="app-download-safety-title"><LockKeyhole size={21} /><h2>Como instalar com cuidado</h2></div>
            <ol>
              <li><span>1</span><p>Toque em <strong>Baixar aplicativo</strong> e aguarde o download de <strong>leticia.apk</strong>. Quando terminar, toque na notificação de download ou abra <strong>Downloads</strong> no navegador ou no app Meus Arquivos.</p></li>
              <li><span>2</span><p>Encontre e abra o arquivo <strong>leticia.apk</strong> na pasta Downloads. O Android pode mostrar um aviso porque o aplicativo foi distribuído fora da Play Store.</p></li>
              <li><span>3</span><p>Leia as informações exibidas pelo Android. Só continue se o arquivo for <strong>leticia.apk</strong> e você tiver certeza de que veio deste site.</p></li>
              <li><span>4</span><p>Se o telefone bloquear a instalação, mostrar algo inesperado ou você ficar em dúvida, <strong>cancele e não desative as proteções do aparelho</strong>.</p></li>
            </ol>
            <p className="app-download-warning"><Info size={18} /> O aviso do Android é uma proteção do sistema. Não é uma garantia de segurança nem uma prova de golpe. Nunca desligue o Play Protect ou outras proteções para instalar.</p>
          </div>

          <section className="app-download-safety" aria-labelledby="ios-install-title">\n            <div className="app-download-safety-title"><Smartphone size={21} /><h2 id="ios-install-title">Tem iPhone? Veja como instalar gratuitamente</h2></div>\n            <ol>\n              <li><span>1</span><p>Abra <strong>https://leticiaborgesnails.pages.dev</strong> no navegador <strong>Safari</strong> do iPhone.</p></li>\n              <li><span>2</span><p>Toque no botão <strong>Compartilhar</strong> (quadrado com uma seta para cima).</p></li>\n              <li><span>3</span><p>Escolha <strong>Adicionar à Tela de Início</strong>. Se aparecer a opção, mantenha <strong>Abrir como App da Web</strong> activada.</p></li>\n              <li><span>4</span><p>Toque em <strong>Adicionar</strong>. O ícone Letícia Nails aparecerá na tela inicial; abra por ele para usar.</p></li>\n            </ol>\n            <p className="app-download-warning"><Info size={18} /> No iPhone não se instala o arquivo APK. Esta é uma versão web instalável (PWA), gratuita e que funciona pela internet. Não é um aplicativo publicado na App Store; os agendamentos continuam no site oficial.</p>\n          </section>\n\n          <div className="app-download-trust">
            <div className="app-download-trust-icon"><CheckCircle2 size={25} /></div>
            <div><h2>Você não precisa pagar para baixar.</h2><p>Não solicitamos Pix, cartão, senha bancária, código de verificação ou pagamento antecipado para desbloquear ou instalar o aplicativo. O pagamento dos serviços do salão é combinado diretamente e realizado pessoalmente.</p></div>
          </div>
          <p className="app-download-help">Prefere não instalar? Você pode continuar usando os serviços pelo <Link to="/">site oficial no navegador</Link>.</p>
        </section>
      </main>
    </SiteLayout>
  );
}
