import { createFileRoute, Link } from '@tanstack/react-router';
import { Lock, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { ExcluirServo } from '@/components/excluir-servo';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { rotulosPerfil, traduzirErroDb } from '@/lib/dados';
import { supabase } from '@/integrations/supabase/client';
import { useSessao } from '@/lib/perfil-context';
import { useDados } from '@/lib/use-dados';
import type { Perfil } from '@/types/libens';
export const Route=createFileRoute('/app/admin')({head:()=>({meta:[{title:'Usuários e acessos — Libens'}]}),component:AdminPage});
function AdminPage(){
 const {perfil}=useSessao();const d=useDados();
 const [search,setSearch]=useState(''),[filters,setFilters]=useState(false),[filter,setFilter]=useState('todos');
 const [id,setId]=useState<string|null>(null),[role,setRole]=useState<Perfil>('servo'),[active,setActive]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState('');
 if(perfil!=='admin')return <AppShell titulo="Usuários e acessos"><p>Somente o administrador acessa esta área.</p></AppShell>;
 const selected=d.pessoas.find(p=>p.id===id);
 const list=d.pessoas.filter(p=>(p.full_name+' '+p.email).toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())&&(filter==='todos'||(filter==='ativos'?p.active:!p.active)));
 const save=async()=>{
  if(!selected||selected.role==='admin'||busy)return;setBusy(true);setError('');
  try{const r=await supabase.from('profiles').update({role,active}).eq('id',selected.id).select('id').single();if(r.error)throw r.error;await d.recarregar();setId(null);}catch(e){setError(traduzirErroDb(e as {message:string;code?:string})??'Erro ao salvar.');}finally{setBusy(false);}
 };
 return <AppShell titulo="Usuários e acessos" descricao="Gestão exclusiva do administrador">
 <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] gap-2"><Input aria-label="Buscar usuário" placeholder="Nome ou e-mail" value={search} onChange={e=>setSearch(e.target.value)} className="min-h-11 min-w-0"/><Button variant="outline" aria-expanded={filters} aria-controls="filtros-usuarios" onClick={()=>setFilters(!filters)}><SlidersHorizontal className="h-4 w-4"/>Filtros{filter!=='todos'?' · 1':''}</Button></div>
 {filters?<div id="filtros-usuarios" className="mb-4"><Select value={filter} onValueChange={setFilter}><SelectTrigger className="w-full sm:w-60" aria-label="Situação da conta"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="todos">Todas as contas</SelectItem><SelectItem value="ativos">Ativas</SelectItem><SelectItem value="inativos">Inativas</SelectItem></SelectContent></Select></div>:null}
 {d.erro?<p role="alert" className="text-sm text-destructive">{d.erro.message}</p>:null}
 <div className="divide-y divide-border border-y border-border">{list.map(p=><div key={p.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-4"><div className="min-w-0"><p className="truncate text-sm font-medium">{p.full_name||p.email}</p><p className="text-xs text-muted-foreground">{rotulosPerfil[p.role]} · {p.active?'Ativo':'Inativo'}</p></div><Button variant="ghost" className="min-h-11" onClick={()=>{setId(p.id);setRole(p.role);setActive(p.active);setError('');}}>{p.role==='admin'?<Lock className="h-4 w-4"/>:null}{p.role==='admin'?'Detalhes':'Gerenciar'}</Button></div>)}</div>
 {!d.carregando&&!list.length?<p className="py-4 text-sm text-muted-foreground">Nenhum usuário encontrado.</p>:null}
 <Dialog open={!!selected} onOpenChange={v=>!v&&!busy&&setId(null)}><DialogContent className="max-h-[90dvh] w-[calc(100%-1rem)] overflow-y-auto"><DialogHeader><DialogTitle className="break-words pr-5">{selected?.full_name||'Usuário'}</DialogTitle><DialogDescription className="break-all">{selected?.email}</DialogDescription></DialogHeader>
 {selected?.role==='admin'?<p className="text-sm text-muted-foreground">A conta administradora é única e protegida.</p>:<><Label>Função</Label><Select value={role} onValueChange={v=>setRole(v as Perfil)} disabled={busy}><SelectTrigger aria-label="Função do usuário"><SelectValue/></SelectTrigger><SelectContent>{(['servo','lider','pastor'] as Perfil[]).map(r=><SelectItem key={r} value={r}>{rotulosPerfil[r]}</SelectItem>)}</SelectContent></Select><label className="flex min-h-11 items-center justify-between gap-3 text-sm">Conta ativa<Switch checked={active} onCheckedChange={setActive} disabled={busy}/></label></>}
 {error?<p role="alert" className="text-sm text-destructive">{error}</p>:null}
 <div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link to="/app/servos/$id" params={{id:selected?.id??''}}>Ver cadastro completo</Link></Button>{selected?.role!=='admin'?<Button disabled={busy} onClick={()=>void save()}>{busy?'Salvando...':'Salvar alterações'}</Button>:null}</div>
 {selected&&!busy?<div className="border-t border-border pt-2"><ExcluirServo pessoa={selected} onExcluido={()=>setId(null)}/></div>:null}
 </DialogContent></Dialog>
 </AppShell>;
}
