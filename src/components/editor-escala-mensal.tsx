import { useState } from "react";
import { z } from "zod";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { dataBr, hora, traduzirErroDb } from "@/lib/dados";
import { hojeIso, useDados } from "@/lib/use-dados";
import { conflitoMensal, gerarMes, payloadMensal, precisaConfirmar, resumoMensal,
  type ContextoMensal, type LinhaMensal } from "@/lib/escala-mensal";

const contextoSchema = z.object({month:z.string(),people:z.array(z.object({id:z.string(),name:z.string(),
  month_count:z.number(),previous_count:z.number(),last_date:z.string().nullable()})),events:z.array(z.object({
  id:z.string(),name:z.string(),date:z.string(),start_time:z.string(),end_time:z.string().nullable(),required_count:z.number(),
  existing:z.array(z.object({id:z.string(),user_id:z.string(),name:z.string(),status:z.string(),available:z.boolean().nullable()})),
  candidates:z.array(z.object({user_id:z.string(),available:z.boolean().nullable(),conflict:z.boolean()})),
}))});

export function EditorEscalaMensal({onFechar}:{onFechar:()=>void}) {
  const d=useDados();
  const ministerios=d.ministerios.filter((m)=>m.active && d.podeGerenciar(m.id));
  const [ministryId,setMinistryId]=useState(ministerios.length===1?ministerios[0]!.id:"");
  const [quantidade,setQuantidade]=useState(2);
  const [contexto,setContexto]=useState<ContextoMensal|null>(null);
  const [plano,setPlano]=useState<LinhaMensal[]|null>(null);
  const [ocupado,setOcupado]=useState(false);
  const [erro,setErro]=useState<string|null>(null);
  const [soPendentes,setSoPendentes]=useState(false);
  const resumo=resumoMensal(plano??[]);
  const mes=(contexto?.month??`${hojeIso().slice(0,7)}-01`);
  const nomeMes=new Intl.DateTimeFormat("pt-BR",{month:"long",year:"numeric",timeZone:"America/Fortaleza"}).format(new Date(`${mes}T12:00:00-03:00`));

  const gerar=async()=>{
    if(!ministryId || !Number.isInteger(quantidade) || quantidade<1 || quantidade>100) {
      setErro("Escolha o ministério e uma quantidade entre 1 e 100.");return;
    }
    setOcupado(true);setErro(null);
    try {
      const {data,error}=await supabase.rpc("month_schedule_context",{_ministry_id:ministryId});
      if(error) throw error;
      const ctx=contextoSchema.parse(data);
      setContexto(ctx);setPlano(gerarMes(ctx,quantidade));setSoPendentes(false);
    } catch(e){setErro(traduzirErroDb(e as {message:string})??"Não foi possível gerar as sugestões.");}
    finally{setOcupado(false);}
  };

  const escolher=(linhaIndex:number,vagaIndex:number,userId:string)=>{
    if(!plano || !contexto) return;
    const linha=plano[linhaIndex]!,vaga=linha.slots[vagaIndex]!;
    if(userId && conflitoMensal(plano,linha.event,userId,vaga)) return;
    const pessoa=contexto.people.find((p)=>p.id===userId);
    setPlano(plano.map((l,i)=>i!==linhaIndex?l:{...l,slots:l.slots.map((s,j)=>j!==vagaIndex?s:{
      userId,name:pessoa?.name??"",kind:"manual",confirmed:false,
    })}));
  };
  const confirmar=(linhaIndex:number,vagaIndex:number,v:boolean)=>setPlano((atual)=>atual?.map((l,i)=>i!==linhaIndex?l:{
    ...l,slots:l.slots.map((s,j)=>j!==vagaIndex?s:{...s,confirmed:v}),
  })??null);

  const salvar=async(publicar:boolean)=>{
    if(!plano?.length || !contexto || resumo.semConfirmacao || (publicar && resumo.pendentes)) return;
    if(publicar && !window.confirm(`Publicar as escalas de ${plano.length} eventos de ${nomeMes}? As escalas existentes serão preservadas.`)) return;
    setOcupado(true);setErro(null);
    try{
      const {error}=await supabase.rpc("save_month_schedule",{_ministry_id:ministryId,_month:contexto.month,
        _plan:payloadMensal(plano),_publish:publicar});
      if(error) throw error;
      await d.recarregar();onFechar();
    }catch(e){setErro(traduzirErroDb(e as {message:string})??"Não foi possível salvar o mês. Nenhuma alteração parcial foi gravada.");}
    finally{setOcupado(false);}
  };

  return <div className="space-y-4">
    <div className="rounded-lg bg-secondary p-4"><h3 className="font-semibold capitalize">{nomeMes}</h3>
      <p className="text-sm text-muted-foreground">Somente eventos futuros deste mês. Escalas existentes serão preservadas.</p></div>
    {!plano ? <>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5"><Label htmlFor="mensal-ministerio">Ministério</Label>
          <select id="mensal-ministerio" value={ministryId} disabled={ocupado} onChange={(e)=>setMinistryId(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="">Selecione</option>{ministerios.map((m)=><option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
        <div className="space-y-1.5"><Label htmlFor="mensal-quantidade">Pessoas por evento (padrão)</Label>
          <Input id="mensal-quantidade" type="number" min={1} max={100} disabled={ocupado} value={quantidade} onChange={(e)=>setQuantidade(Number(e.target.value))}/></div>
      </div>
      <p className="text-sm text-muted-foreground">A quantidade já definida em cada evento será respeitada. O padrão vale para eventos sem quantidade definida.</p>
      <div className="rounded-lg border border-border p-4 text-sm">Distribuição equilibrada entre membros ativos com disponibilidade informada, sem conflitos de horário. Vagas sem candidatos ficam pendentes para preencher manualmente.</div>
      <Button className="w-full" disabled={ocupado || !ministryId} onClick={()=>void gerar()}><Sparkles className="h-4 w-4"/>{ocupado?"Consultando disponibilidades...":"Gerar sugestão do mês"}</Button>
    </> : <>
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Revisar {plano.length} eventos</h3>
        <Button variant="ghost" size="sm" disabled={ocupado} onClick={()=>{setPlano(null);setContexto(null);setErro(null);}}>Voltar à configuração</Button></div>
      <p className="text-sm" aria-live="polite">{resumo.preservadas} preservadas · {resumo.sugeridas} sugeridas · {resumo.manuais} manuais · <strong>{resumo.pendentes} pendentes</strong></p>
      {!plano.length ? <p className="text-sm text-muted-foreground">Nenhum evento futuro neste mês. Cadastre os eventos na aba Eventos antes de gerar as escalas.</p>:null}
      {resumo.pendentes>0?<p className="rounded-lg bg-accent/20 p-3 text-sm">Complete as vagas abaixo ou salve o rascunho para continuar depois.</p>:null}
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={soPendentes} onChange={(e)=>setSoPendentes(e.target.checked)}/>Mostrar somente eventos com vagas pendentes</label>
      {plano.map((linha,i)=>soPendentes && linha.slots.every((s)=>s.userId)?null:<section key={linha.event.id} className="space-y-3 rounded-lg border border-border p-3">
        <div><h4 className="font-medium">{dataBr(linha.event.date)} · {linha.event.name}</h4><p className="text-xs text-muted-foreground">{hora(linha.event.start_time)} · {linha.slots.filter(s=>s.userId).length}/{linha.required} preenchidas</p></div>
        {linha.slots.map((vaga,j)=><div key={j} className="space-y-2 border-t border-border pt-2">
          {vaga.kind==="existing"?<div className="flex flex-wrap items-center justify-between gap-2 text-sm"><span>{vaga.name||"Membro"}</span><Badge variant="secondary">Já existente{vaga.status==="draft"?" · rascunho":""}</Badge></div>:
            <label className="block space-y-1 text-sm"><span>{vaga.kind==="auto"?"Sugestão disponível":"Preencher manualmente"}</span>
              <select aria-label={`Membro para ${linha.event.name} em ${dataBr(linha.event.date)}, vaga ${j+1}`} value={vaga.userId} disabled={ocupado} onChange={(e)=>escolher(i,j,e.target.value)} className="min-h-10 w-full rounded-md border border-input bg-background px-2 text-sm">
                <option value="">Vaga pendente</option>{contexto?.people.map((p)=>{
                  const bloqueado=conflitoMensal(plano,linha.event,p.id,vaga),c=linha.event.candidates.find(x=>x.user_id===p.id);
                  return <option key={p.id} value={p.id} disabled={bloqueado}>{p.name} — {bloqueado?"ocupado ou já neste evento":c?.available===true?"disponível":c?.available===false?"indisponível":"não informado"}</option>;
                })}</select></label>}
          {precisaConfirmar(linha,vaga)?<label className="flex items-start gap-2 text-xs"><input type="checkbox" className="mt-1" disabled={ocupado} checked={vaga.confirmed} onChange={(e)=>confirmar(i,j,e.target.checked)}/><span>Conversei com {vaga.name} e confirmo sua disponibilidade nesta data.</span></label>:null}
        </div>)}
      </section>)}
      {soPendentes && plano.length>0 && resumo.pendentes===0?<p className="text-sm text-muted-foreground">Todas as vagas foram preenchidas. Desmarque o filtro para revisar as escalas.</p>:null}
      <div className="grid gap-2 sm:grid-cols-2"><Button variant="outline" disabled={ocupado || !plano.length || resumo.semConfirmacao>0} onClick={()=>void salvar(false)}>Salvar rascunho</Button>
        <Button disabled={ocupado || !plano.length || resumo.pendentes>0 || resumo.semConfirmacao>0} onClick={()=>void salvar(true)}>{ocupado?"Salvando...":"Publicar escalas"}</Button></div>
      {resumo.semConfirmacao>0?<p className="text-xs text-destructive">Confirme as escolhas sem disponibilidade informada antes de salvar.</p>:null}
    </>}
    {erro?<p role="alert" className="text-sm text-destructive">{erro}</p>:null}
  </div>;
}
