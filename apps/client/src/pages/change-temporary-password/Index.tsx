import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { authClient } from "@/lib/auth";
import SiteLayout from "../../site/SiteLayout";

export default function ChangeTemporaryPasswordPage() {
  const navigate = useNavigate();
  const { data: session, isPending, refetch } = authClient.useSession();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (isPending) return <div className="min-h-screen grid place-items-center">Carregando...</div>;
  if (!session?.user) return <Navigate to="/auth" replace />;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword.length < 8) {
      toast.error("A nova senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirmation) {
      toast.error("As senhas não são iguais.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true
      });
      if (result.error) throw new Error(result.error.message ?? "Não foi possível alterar a senha.");
      await refetch();
      toast.success("Senha alterada. Seu acesso foi liberado.");
      navigate("/", { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao alterar a senha.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SiteLayout title="Alterar senha | Leticia" description="Defina uma nova senha para continuar">
      <main className="min-h-[70vh] bg-[#fbf5ed] px-4 py-12">
        <section className="mx-auto max-w-lg rounded-3xl border border-[#e8d9cb] bg-white p-6 shadow-sm sm:p-8">
          <h1 className="font-serif text-3xl text-[#493629]">Crie sua nova senha</h1>
          <p className="mt-3 text-sm leading-6 text-[#806c5d]">Esta conta foi criada pela administração com uma senha temporária. Por segurança, altere-a agora para continuar.</p>
          <form onSubmit={submit} className="mt-6 grid gap-4">
            <label className="grid gap-2 text-sm font-medium text-[#705844]">Senha temporária atual
              <input type="password" autoComplete="current-password" required value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} className="rounded-xl border border-[#dfcdbd] px-4 py-3 text-[#493629]" />
            </label>
            <label className="grid gap-2 text-sm font-medium text-[#705844]">Nova senha
              <input type="password" autoComplete="new-password" minLength={8} required value={newPassword} onChange={event => setNewPassword(event.target.value)} className="rounded-xl border border-[#dfcdbd] px-4 py-3 text-[#493629]" />
            </label>
            <label className="grid gap-2 text-sm font-medium text-[#705844]">Confirmar nova senha
              <input type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={event => setConfirmation(event.target.value)} className="rounded-xl border border-[#dfcdbd] px-4 py-3 text-[#493629]" />
            </label>
            <button type="submit" disabled={submitting} className="rounded-full bg-[#705844] px-5 py-3 font-semibold text-white disabled:opacity-60">{submitting ? "Salvando..." : "Alterar senha e continuar"}</button>
          </form>
        </section>
      </main>
    </SiteLayout>
  );
}
