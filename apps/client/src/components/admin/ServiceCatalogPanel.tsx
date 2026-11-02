import { useEffect, useState, type FormEvent } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, Save, X } from "lucide-react";
import { apiFetch } from "@/lib/api";

type Service = { id:string; name:string; description:string; detail:string; mark:string; active:boolean; sortOrder:number };
type Payload<T> = { ok:boolean; data?:T; error?:{message?:string} };
const blank = { name:"", description:"", detail:"", mark:"SERVIÇO" };

export default function ServiceCatalogPanel() {
  const [items,setItems] = useState<Service[]>([]);
  const [form,setForm] = useState(blank);
  const [editing,setEditing] = useState<string|null>(null);
  const [busy,setBusy] = useState(false);
  const [notice,setNotice] = useState("");
  const [error,setError] = useState("");

  async function refresh() {
    const response = await apiFetch("/service-catalog/admin");
    const payload = await response.json() as Payload<{services:Service[]}>;
    if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? "Não foi possível carregar o catálogo.");
    setItems(payload.data?.services ?? []);
  }
  useEffect(()=>{ void refresh().catch(e=>setError(e instanceof Error?e.message:"Erro ao carregar catálogo.")); },[]);

  function startEdit(item:Service) {
    setEditing(item.id);
    setForm({name:item.name,description:item.description,detail:item.detail,mark:item.mark});
    setNotice(""); setError("");
  }
  function reset() { setEditing(null); setForm(blank); }
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim()) { setError("Informe o nome do serviço."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const current = editing ? items.find(item=>item.id===editing) : undefined;
      const response = await apiFetch("/service-catalog", {
        method: editing ? "PATCH" : "POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({...form,name:form.name.trim(),id:editing ?? undefined,active:current?.active ?? true,sortOrder:current?.sortOrder ?? items.length+1})
      });
      const payload = await response.json() as Payload<{service:Service}>;
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? "Não foi possível salvar o serviço.");
      await refresh(); reset(); setNotice(editing ? "Serviço actualizado." : "Serviço adicionado ao catálogo.");
    } catch(e) { setError(e instanceof Error?e.message:"Erro ao guardar serviço."); }
    finally { setBusy(false); }
  }
  async function update(item:Service, changes:Partial<Service>) {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await apiFetch("/service-catalog", {method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({...item,...changes})});
      const payload = await response.json() as Payload<{service:Service}>;
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? "Não foi possível actualizar o serviço.");
      await refresh(); setNotice("Catálogo actualizado.");
    } catch(e) { setError(e instanceof Error?e.message:"Erro ao actualizar catálogo."); }
    finally { setBusy(false); }
  }
  async function move(index:number, delta:number) {
    const target=index+delta;
    if(target<0||target>=items.length) return;
    const a=items[index], b=items[target];
    setBusy(true); setError(""); setNotice("");
    try {
      const updateOne=async(item:Service,sortOrder:number)=>{
        const response=await apiFetch("/service-catalog",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({...item,sortOrder})});
        const payload=await response.json() as Payload<{service:Service}>;
        if(!response.ok||!payload.ok) throw new Error(payload.error?.message??"Não foi possível mudar a ordem.");
      };
      await updateOne(a,b.sortOrder); await updateOne(b,a.sortOrder); await refresh(); setNotice("Ordem dos serviços actualizada.");
    } catch(e) { setError(e instanceof Error?e.message:"Erro ao mudar ordem."); }
    finally { setBusy(false); }
  }

  return <section className="mb-7 rounded-3xl border border-[#e8d9cb] bg-white p-5 shadow-[0_12px_35px_rgba(92,65,43,0.06)] sm:p-7">
    <div className="mb-5"><h2 className="font-serif text-2xl text-[#493629]">Editor do catálogo de serviços</h2><p className="mt-1 text-sm text-[#8c7767]">Adicione, renomeie, organize ou oculte serviços. As alterações são guardadas no banco e aparecem no catálogo público e na agenda. Não é necessário adicionar fotos.</p></div>
    <div className="grid gap-3">
      {items.map((item,index)=><article key={item.id} className="rounded-2xl border border-[#eaded3] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-[#493629]">{item.name}</h3><span className={item.active?"rounded-full bg-[#edf4ed] px-2 py-1 text-xs text-[#547357]":"rounded-full bg-[#f3efeb] px-2 py-1 text-xs text-[#806f62]"}>{item.active?"Visível":"Oculto"}</span></div><p className="mt-1 text-sm text-[#806c5d]">{item.description || "Sem descrição"}</p>{item.detail && <p className="mt-1 text-xs text-[#9a8574]">{item.detail}</p>}</div>
          <div className="flex flex-wrap gap-2">
            <button type="button" title="Mover para cima" disabled={busy||index===0} onClick={()=>void move(index,-1)} className="rounded-full border border-[#dfcdbd] p-2 text-[#705844] disabled:opacity-40"><ArrowUp size={16}/></button>
            <button type="button" title="Mover para baixo" disabled={busy||index===items.length-1} onClick={()=>void move(index,1)} className="rounded-full border border-[#dfcdbd] p-2 text-[#705844] disabled:opacity-40"><ArrowDown size={16}/></button>
            <button type="button" disabled={busy} onClick={()=>startEdit(item)} className="inline-flex items-center gap-1 rounded-full border border-[#dfcdbd] px-3 py-2 text-xs font-semibold text-[#705844]"><Pencil size={14}/> Editar</button>
            <button type="button" disabled={busy} onClick={()=>void update(item,{active:!item.active})} className="rounded-full border border-[#dfcdbd] px-3 py-2 text-xs font-semibold text-[#705844]">{item.active?"Ocultar":"Mostrar"}</button>
          </div>
        </div>
      </article>)}
      {items.length===0 && <p className="rounded-xl bg-[#fbf6f0] p-4 text-sm text-[#806c5d]">Nenhum serviço cadastrado. Adicione o primeiro abaixo.</p>}
    </div>
    <form onSubmit={submit} className="mt-5 grid gap-3 rounded-2xl bg-[#fbf6f0] p-4">
      <h3 className="font-semibold text-[#493629]">{editing?"Editar serviço":"Adicionar serviço"}</h3>
      <label className="grid gap-1 text-xs font-semibold text-[#806c5d]">Nome do serviço<input required maxLength={120} value={form.name} onChange={e=>setForm(v=>({...v,name:e.target.value}))} placeholder="Ex.: Mãos tradicional" className="rounded-xl border border-[#dfcdbd] bg-white px-3 py-2.5 text-sm text-[#493629]"/></label>
      <label className="grid gap-1 text-xs font-semibold text-[#806c5d]">Descrição curta<textarea maxLength={500} rows={2} value={form.description} onChange={e=>setForm(v=>({...v,description:e.target.value}))} placeholder="Descrição que aparece no catálogo" className="rounded-xl border border-[#dfcdbd] bg-white px-3 py-2.5 text-sm text-[#493629]"/></label>
      <label className="grid gap-1 text-xs font-semibold text-[#806c5d]">Detalhes<textarea maxLength={800} rows={2} value={form.detail} onChange={e=>setForm(v=>({...v,detail:e.target.value}))} placeholder="Detalhes opcionais do serviço" className="rounded-xl border border-[#dfcdbd] bg-white px-3 py-2.5 text-sm text-[#493629]"/></label>
      <label className="grid gap-1 text-xs font-semibold text-[#806c5d]">Sigla curta<input maxLength={20} value={form.mark} onChange={e=>setForm(v=>({...v,mark:e.target.value}))} placeholder="Ex.: GEL" className="rounded-xl border border-[#dfcdbd] bg-white px-3 py-2.5 text-sm text-[#493629]"/></label>
      <div className="flex flex-wrap gap-2"><button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-full bg-[#705844] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Save size={16}/>{busy?"A guardar...":editing?"Guardar alterações":"Adicionar serviço"}</button>{editing&&<button type="button" onClick={reset} className="inline-flex items-center gap-2 rounded-full border border-[#dfcdbd] px-4 py-2.5 text-sm font-semibold text-[#705844]"><X size={16}/> Cancelar</button>}</div>
    </form>
    {error&&<p role="alert" className="mt-4 rounded-xl bg-[#fff1ed] px-4 py-3 text-sm text-[#914b40]">{error}</p>}
    {notice&&<p role="status" className="mt-4 rounded-xl bg-[#edf4ed] px-4 py-3 text-sm text-[#547357]">{notice}</p>}
  </section>;
}
