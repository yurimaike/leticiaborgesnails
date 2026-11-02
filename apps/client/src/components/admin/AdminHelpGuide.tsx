import { useEffect, useState } from "react";
import { BookOpen, ChevronLeft, ChevronRight, CircleHelp, X } from "lucide-react";

const STORAGE_KEY = "leticia-admin-guide-v1";

const lessons = [
  { title: "Bem-vinda ao painel", text: "Este painel reúne as ferramentas para administrar o estúdio. Use as explicações para conhecer cada área. Você pode fechar o guia e abri-lo novamente pelo botão Ajuda." },
  { title: "Resumo e atualização", text: "No início, os cartões mostram o total de reservas, quantas aguardam aprovação e quantas estão confirmadas. Use Atualizar agenda para buscar os dados mais recentes." },
  { title: "Financeiro", text: "A área Financeiro ajuda a acompanhar receitas e despesas registradas no sistema. Confira os lançamentos e os valores antes de tomar decisões. Marcar um pagamento na reserva também pode gerar o lançamento de receita correspondente." },
  { title: "Programa de fidelidade", text: "O programa contabiliza atendimentos pagos e concluídos. A cada 8 atendimentos elegíveis, a cliente recebe um bônus. Você pode ativar ou desativar o programa, definir a validade padrão e consultar bônus disponíveis ou utilizados." },
  { title: "Validade e resgate de bônus", text: "Cada bônus disponível pode ter a validade ajustada. Para resgatar, escolha uma reserva aprovada da mesma cliente, selecione o serviço gratuito e confirme. Confira os dados antes de concluir." },
  { title: "E-mails autorizados", text: "Aqui você cadastra os endereços de pessoas autorizadas a criar conta e acessar áreas internas. Remover uma autorização encerra o acesso administrativo/autenticado daquela pessoa, mas não apaga a conta nem impede reservas públicas." },
  { title: "Reservas recebidas", text: "Cada cartão mostra cliente, código, data, horário, serviço e contactos. Uma reserva pendente pode ser aprovada ou rejeitada. Uma reserva aprovada pode ser cancelada. Confira os dados antes de alterar o estado." },
  { title: "Pagamento e atendimento", text: "Use Confirmar pagamento somente depois de receber o valor. Informe o valor realmente recebido. Depois, o sistema tenta lançar a receita no Financeiro. Marque o atendimento como concluído somente quando o serviço tiver sido realizado e o pagamento estiver recebido." },
  { title: "Comprovante", text: "Quando o pagamento estiver marcado como recebido e houver valor salvo, use Gerar comprovante PDF. O documento é um comprovante de recebimento e não substitui uma nota fiscal." },
  { title: "Agenda atual e histórico", text: "Agenda atual mostra reservas em andamento. Histórico reúne reservas rejeitadas, canceladas ou atendimentos concluídos. Use os filtros de data e estado para localizar um registo." },
  { title: "Privacidade e segurança", text: "Os dados de clientes são privados. Não partilhe palavras-passe nem autorize e-mails desconhecidos. Antes de remover acessos, cancelar reservas ou alterar pagamentos, confirme cuidadosamente a operação." },
  { title: "Guia concluído", text: "Pronto! Você já conhece as principais áreas do painel. O guia não aparecerá automaticamente nas próximas visitas neste navegador. Para rever qualquer explicação, clique em Ajuda." }
];

export default function AdminHelpGuide() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) !== "done") setOpen(true);
    } catch {
      setOpen(false);
    }
  }, []);

  function close() {
    setOpen(false);
    if (step === lessons.length - 1) {
      try { localStorage.setItem(STORAGE_KEY, "done"); } catch { /* armazenamento indisponível */ }
    }
  }

  function finish() {
    try { localStorage.setItem(STORAGE_KEY, "done"); } catch { /* armazenamento indisponível */ }
    setOpen(false);
    setStep(0);
  }

  return (
    <>
      <button type="button" onClick={() => { setStep(0); setOpen(true); }} className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#d9c4b1] bg-white px-4 py-2.5 text-sm font-semibold text-[#705844] shadow-sm hover:bg-[#f5e9dd]">
        <CircleHelp size={17} /> Ajuda do painel
      </button>
      {open && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#2d211a]/60 p-4" role="dialog" aria-modal="true" aria-labelledby="admin-guide-title">
        <section className="w-full max-w-xl rounded-3xl border border-[#e8d9cb] bg-[#fffdfa] p-6 shadow-2xl sm:p-8">
          <div className="mb-5 flex items-center justify-between">
            <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#9a765b]"><BookOpen size={16}/> Guia do painel</span>
            <button type="button" onClick={close} aria-label="Fechar guia" className="rounded-full p-2 text-[#806c5d] hover:bg-[#f5e9dd]"><X size={20}/></button>
          </div>
          <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-[#eee4da]"><div className="h-full rounded-full bg-[#9b785e] transition-all" style={{ width: `${((step + 1) / lessons.length) * 100}%` }}/></div>
          <p className="mb-2 text-xs text-[#9a8574]">Etapa {step + 1} de {lessons.length}</p>
          <h2 id="admin-guide-title" className="font-serif text-2xl text-[#493629] sm:text-3xl">{lessons[step].title}</h2>
          <p className="mt-4 min-h-28 text-base leading-7 text-[#705f51]">{lessons[step].text}</p>
          <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
            <button type="button" onClick={() => setStep(value => Math.max(0, value - 1))} disabled={step === 0} className="inline-flex items-center gap-1 rounded-full border border-[#dfcdbd] px-4 py-2.5 text-sm font-semibold text-[#705844] disabled:opacity-40"><ChevronLeft size={16}/> Anterior</button>
            {step === lessons.length - 1
              ? <button type="button" onClick={finish} className="rounded-full bg-[#705844] px-5 py-2.5 text-sm font-semibold text-white">Concluir guia</button>
              : <button type="button" onClick={() => setStep(value => Math.min(lessons.length - 1, value + 1))} className="inline-flex items-center gap-1 rounded-full bg-[#705844] px-5 py-2.5 text-sm font-semibold text-white">Próxima dica <ChevronRight size={16}/></button>}
          </div>
          <p className="mt-5 text-xs text-[#9a8574]">Você pode fechar agora e consultar novamente em Ajuda do painel.</p>
        </section>
      </div>}
    </>
  );
}
