import { useEffect, useState } from "react";
import { BookOpen, ChevronLeft, ChevronRight, CircleHelp, X } from "lucide-react";

const STORAGE_KEY = "leticia-admin-guide-v3";

const lessons = [
  { title: "Bem-vinda ao painel", text: "Este painel reúne as ferramentas para administrar o estúdio Leticia Nail Designer. Use as dicas para aprender cada área. Você pode fechar o guia e abri-lo novamente pelo botão Ajuda do painel, no início da página." },
  { title: "Resumo e atualização da agenda", text: "Os cartões do início mostram o total de reservas, quantas aguardam aprovação e quantas estão confirmadas. Clique em Atualizar agenda para carregar os dados mais recentes. Se uma alteração não aparecer imediatamente, actualize a agenda e confira novamente." },
  { title: "Catálogo: conhecer os serviços", text: "O Editor do catálogo de serviços controla os nomes e as informações que aparecem no site e na escolha de serviços da agenda. Os serviços iniciais são Esmaltação em gel, Pés tradicional, Mãos tradicional e Manutenção. Não é necessário colocar fotos para cadastrar um serviço." },
  { title: "Adicionar um serviço", text: "No Editor do catálogo, vá até Adicionar serviço. Preencha o nome, a descrição curta, os detalhes e a sigla, se desejar. Clique em Adicionar serviço. O novo serviço será salvo e poderá aparecer no catálogo público e na agenda. Depois, cadastre o preço na área Preços dos serviços." },
  { title: "Editar nome e informações", text: "Clique em Editar no serviço desejado. Altere o nome, a descrição, os detalhes ou a sigla e clique em Guardar alterações. Confira a escrita antes de salvar. O sistema actualiza o catálogo e as opções de novos agendamentos; reservas antigas devem continuar preservando o serviço que foi registado na época." },
  { title: "Organizar, ocultar e mostrar serviços", text: "Use as setas para cima e para baixo para mudar a ordem dos serviços. Clique em Ocultar para retirar um serviço das opções públicas e dos novos agendamentos. Clique em Mostrar para voltar a disponibilizá-lo. Ocultar não é apagar: o histórico de reservas é preservado." },
  { title: "Preços dos serviços", text: "A edição dos preços é separada do catálogo. Na área Preços dos serviços, localize o serviço, informe o valor em reais e clique em Salvar. Confira se está a editar o serviço certo. O catálogo pode existir mesmo quando o preço ainda não foi preenchido." },
  { title: "Preço vazio ou incorreto", text: "Se o preço ficar vazio e for salvo, ele não será apresentado como um valor definido para a cliente. Para corrigir, informe o novo valor e salve novamente. Não invente nem estime valores: cadastre somente o preço realmente praticado pelo estúdio." },
  { title: "O que a cliente consegue fazer", text: "A cliente pode consultar os serviços disponíveis e solicitar um agendamento pelo site. O cadastro de serviços, a alteração de preços e a administração de contas internas são tarefas da equipa autorizada. Não compartilhe acesso administrativo com clientes." },
  { title: "Reservas recebidas", text: "Cada reserva mostra o nome da cliente, código, data, horário, serviço e contactos. Uma reserva pendente pode ser aprovada ou rejeitada. Uma reserva aprovada pode ser cancelada. Confira todos os dados antes de alterar o estado." },
  { title: "Agenda atual e histórico", text: "Agenda atual mostra reservas que ainda estão em andamento. Histórico reúne reservas rejeitadas, canceladas ou atendimentos concluídos. Use os filtros de data e estado para encontrar uma reserva. Alterações no catálogo não devem ser usadas para apagar o histórico." },
  { title: "Pagamento e conclusão do atendimento", text: "Clique em Confirmar pagamento somente depois de receber o dinheiro e informe o valor realmente recebido. O sistema tenta criar o lançamento correspondente no Financeiro. Marque o atendimento como concluído somente depois que o serviço tiver sido realizado. Confira os valores antes de salvar." },
  { title: "Comprovante de pagamento", text: "Quando o pagamento estiver marcado como recebido e houver um valor salvo, use Gerar comprovante PDF. O documento registra o recebimento informado no sistema. Ele não substitui uma nota fiscal." },
  { title: "Financeiro", text: "A área Financeiro reúne receitas e despesas registadas. Confira data, descrição e valor de cada lançamento. Marcar o pagamento numa reserva pode gerar a receita correspondente; se houver erro, verifique o painel Financeiro antes de lançar novamente para evitar duplicidade." },
  { title: "Programa de fidelidade", text: "O programa considera atendimentos pagos e concluídos. A cada 8 atendimentos elegíveis, a cliente recebe um bônus. A equipa pode activar ou desactivar o programa, definir a validade padrão e consultar os bônus disponíveis ou utilizados." },
  { title: "Validade e resgate de bônus", text: "Cada bônus disponível pode ter a validade ajustada. Para resgatar, escolha uma reserva aprovada da mesma cliente, selecione o serviço gratuito e confirme. Confira a cliente, a reserva e o serviço antes de concluir." },
  { title: "Acesso de funcionário ou familiar", text: "Somente pessoas autorizadas pela administração devem ter acesso às áreas internas. Para autorizar alguém, vá à área de acesso, digite o e-mail individual da pessoa e clique em Autorizar e-mail. Confirme o endereço antes de salvar. Não use um e-mail partilhado por várias pessoas." },
  { title: "Primeiro acesso de uma pessoa autorizada", text: "Quando for uma pessoa nova na equipa ou familiar autorizado, primeiro adicione o e-mail dela na lista de autorizações. A pessoa deve usar esse mesmo e-mail no acesso e seguir o fluxo de primeiro acesso apresentado pelo sistema. Nunca autorize um cliente comum para que ele tenha acesso administrativo. Se a pessoa já tiver uma conta, autorize o e-mail original para manter a conta existente." },
  { title: "Cliente não deve criar acesso administrativo", text: "O site público permite que a cliente consulte os serviços e solicite reservas. A cliente não deve receber autorização para entrar no painel interno. Não crie uma conta administrativa para cliente e não compartilhe credenciais da equipa." },
  { title: "Quando alguém esquecer a senha", text: "Na lista de e-mails autorizados, localize a conta original da pessoa e clique em Gerar nova senha temporária. Confirme a operação. A senha antiga será substituída e as sessões anteriores serão encerradas. Copie a senha temporária que aparece e envie em conversa privada, depois de confirmar a identidade da pessoa por outro meio." },
  { title: "Como usar a senha temporária", text: "A pessoa deve entrar usando o mesmo e-mail autorizado e a senha temporária recebida. No primeiro acesso, o sistema pede que ela crie uma senha pessoal nova. A senha temporária é para uso único e não deve ser partilhada com outras pessoas. Se a janela com a senha for fechada, não será possível consultá-la novamente; será necessário gerar outra." },
  { title: "A conta e o histórico são preservados", text: "Gerar uma senha temporária para uma conta existente não deve criar um utilizador duplicado nem apagar a conta. O identificador da conta, as reservas, o histórico e as permissões são mantidos. Use sempre o e-mail original da pessoa. Não tente resolver o esquecimento criando outra conta." },
  { title: "Remover autorização de acesso", text: "Se alguém sair da equipa ou não precisar mais do painel, localize o e-mail e clique em Remover autorização. Isso bloqueia o acesso às áreas internas e encerra as sessões. A remoção da autorização não apaga automaticamente a conta nem as reservas e o histórico. Confira o e-mail antes de confirmar." },
  { title: "Privacidade e segurança", text: "Conceda acesso apenas a pessoas de confiança e pelo e-mail individual delas. Nunca peça nem divulgue senhas pessoais. Envie senhas temporárias em conversa privada. Confirme a identidade antes de gerar uma senha e remova acessos que já não sejam necessários. Antes de cancelar reservas ou alterar pagamentos, confira os dados." },
  { title: "Guia concluído", text: "Pronto! Este guia explica o catálogo e os preços dos serviços, as reservas, o financeiro, a fidelidade e o acesso de funcionários ou familiares, incluindo o procedimento de senha temporária. Para rever qualquer explicação, clique novamente em Ajuda do painel." }
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
