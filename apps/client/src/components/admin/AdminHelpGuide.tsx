import { useEffect, useState } from "react";
import { BookOpen, ChevronLeft, ChevronRight, CircleHelp, X } from "lucide-react";

const STORAGE_KEY = "leticia-admin-guide-v2";

const lessons = [
  { title: "Bem-vinda ao painel", text: "Este painel reúne as ferramentas para administrar o estúdio. Use as explicações para conhecer cada área. Você pode fechar o guia e abri-lo novamente pelo botão Ajuda." },
  { title: "Resumo e atualização", text: "No início, os cartões mostram o total de reservas, quantas aguardam aprovação e quantas estão confirmadas. Use Atualizar agenda para buscar os dados mais recentes." },
  { title: "Financeiro", text: "A área Financeiro ajuda a acompanhar receitas e despesas registradas no sistema. Confira os lançamentos e os valores antes de tomar decisões. Marcar um pagamento na reserva também pode gerar o lançamento de receita correspondente." },
  { title: "Programa de fidelidade", text: "O programa contabiliza atendimentos pagos e concluídos. A cada 8 atendimentos elegíveis, a cliente recebe um bônus. Você pode ativar ou desativar o programa, definir a validade padrão e consultar bônus disponíveis ou utilizados." },
  { title: "Validade e resgate de bônus", text: "Cada bônus disponível pode ter a validade ajustada. Para resgatar, escolha uma reserva aprovada da mesma cliente, selecione o serviço gratuito e confirme. Confira os dados antes de concluir." },
  { title: "Autorizar uma conta existente", text: "Na área de acesso, informe o e-mail que a pessoa já usa na conta original e clique em Autorizar e-mail. Esta ação apenas permite o acesso ao painel; não cria outra conta. Cada pessoa deve usar o próprio e-mail." },
  { title: "Gerar uma nova senha temporária", text: "Localize o e-mail da conta original e clique em Gerar nova senha temporária. Confirme a operação. A senha antiga deixa de funcionar, as sessões anteriores são encerradas e a nova senha aparece uma única vez para copiar. A conta, o identificador, os dados, o histórico e as permissões permanecem os mesmos. Envie a senha em particular; a pessoa deverá criar uma senha própria no próximo acesso." },
  { title: "Quando alguém esquecer a senha", text: "O administrador pode localizar a conta original na lista e gerar uma nova senha temporária. Antes, confirme a identidade da pessoa por outro meio. Não crie outra conta nem altere o e-mail. Depois de gerar, copie a senha exibida e envie em conversa privada. A pessoa deverá trocá-la no primeiro acesso." },
  { title: "Quando alguém sair da equipe ou perder o acesso", text: "Se a pessoa não trabalha mais no estúdio ou não deve mais acessar o painel, remova o e-mail da lista de autorizados. Isso bloqueia o acesso às áreas internas e encerra as sessões existentes. A remoção da autorização não apaga automaticamente reservas ou outros registos do sistema. Confira o e-mail antes de remover." },
  { title: "Reservas recebidas", text: "Cada cartão mostra cliente, código, data, horário, serviço e contactos. Uma reserva pendente pode ser aprovada ou rejeitada. Uma reserva aprovada pode ser cancelada. Confira os dados antes de alterar o estado." },
  { title: "Pagamento e atendimento", text: "Use Confirmar pagamento somente depois de receber o valor. Informe o valor realmente recebido. Depois, o sistema tenta lançar a receita no Financeiro. Marque o atendimento como concluído somente quando o serviço tiver sido realizado e o pagamento estiver recebido." },
  { title: "Comprovante", text: "Quando o pagamento estiver marcado como recebido e houver valor salvo, use Gerar comprovante PDF. O documento é um comprovante de recebimento e não substitui uma nota fiscal." },
  { title: "Agenda atual e histórico", text: "Agenda atual mostra reservas em andamento. Histórico reúne reservas rejeitadas, canceladas ou atendimentos concluídos. Use os filtros de data e estado para localizar um registo." },
  { title: "Privacidade e segurança", text: "Conceda acesso somente a pessoas de confiança e apenas pelo e-mail individual delas. Nunca peça que compartilhem a própria senha. Envie senhas temporárias em conversa privada, confirme a identidade da pessoa por outro meio antes de gerar uma nova senha e remova acessos que não sejam mais necessários. Antes de cancelar reservas ou alterar pagamentos, confira os dados." },
  { title: "Editor de preços dos serviços", text: "Na área Editor de preços, você pode definir ou alterar o valor de cada serviço. Escolha o campo do serviço, informe o preço em reais e clique em Salvar. O valor mínimo é R$ 1,00. Não há uma tabela de preços fixos: informe o valor que o estúdio pratica." },
  { title: "Como o preço aparece para as clientes", text: "Depois de salvar, o preço atualizado fica disponível na página de serviços e na seleção de serviços da agenda. A cliente consegue consultar os valores, mas não pode alterá-los. Se houver mais de um serviço selecionado e todos tiverem preço cadastrado, a agenda também mostra o total." },
  { title: "Ocultar ou corrigir um preço", text: "Se deixar o campo de preço vazio e salvar, o valor daquele serviço fica oculto para as clientes e aparece como não informado. Para corrigir um preço, basta digitar o novo valor e salvar novamente. Confira se escolheu o serviço certo antes de confirmar." },
  { title: "Quando os preços não aparecerem", text: "O banco Turso precisa ter recebido a migração da tabela de preços. Se a tabela ainda não tiver sido criada, a leitura ou gravação pode apresentar erro. Depois da migração, atualize o painel e cadastre os valores. Não repita várias vezes a operação se aparecer erro; avise o administrador para verificar o banco." },
  { title: "Guia concluído", text: "Pronto! Você já conhece as principais áreas do painel, incluindo o editor de preços. O guia não aparecerá automaticamente nas próximas visitas neste navegador. Para rever qualquer explicação, clique em Ajuda." }
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
