import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { traduzirErroDb, type PessoaDb } from '@/lib/dados';
import { useSessao } from '@/lib/perfil-context';
import { useDados } from '@/lib/use-dados';
export function ExcluirServo({ pessoa, onExcluido }: { pessoa: PessoaDb; onExcluido: () => void }) {
 const {perfil,usuario}=useSessao();const d=useDados();
 const [open,setOpen]=useState(false),[confirmation,setConfirmation]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 if(perfil!=='admin'||pessoa.role!=='servo'||pessoa.id===usuario.id||pessoa.deleted_at)return null;
 const excluir=async()=>{
  if(busy||confirmation!=='EXCLUIR')return;setBusy(true);setError('');
  try {
   const r=await supabase.rpc('delete_servo',{_uid:pessoa.id,_confirmation:confirmation});
   if(r.error)throw r.error;await d.recarregar();setOpen(false);onExcluido();
  }catch(e){setError(traduzirErroDb(e as {message:string;code?:string})??'Não foi possível excluir o servo.');}finally{setBusy(false);}
 };
 return <><Button variant="ghost" className="min-h-11 whitespace-normal text-destructive" onClick={()=>{setConfirmation('');setError('');setOpen(true);}}><Trash2 className="h-4 w-4"/>Excluir servo do cadastro</Button>
 <Dialog open={open} onOpenChange={v=>!busy&&setOpen(v)}><DialogContent className="max-h-[90dvh] w-[calc(100%-1rem)] overflow-y-auto"><DialogHeader><DialogTitle>Excluir {pessoa.full_name||'servo'}?</DialogTitle><DialogDescription>O cadastro será retirado das listas de gestão e o acesso ao app será bloqueado. Os vínculos serão removidos, as participações futuras e pedidos de troca pendentes serão cancelados. O histórico e a conta de autenticação serão preservados; esta opção não apaga definitivamente todos os dados pessoais.</DialogDescription></DialogHeader>
 <p className="text-sm">Você precisará preencher as vagas que ficarem nas escalas futuras. Esta exclusão não pode ser desfeita pela interface.</p>
 <Label htmlFor={`excluir-${pessoa.id}`}>Digite EXCLUIR para confirmar</Label><Input id={`excluir-${pessoa.id}`} autoComplete="off" value={confirmation} onChange={e=>setConfirmation(e.target.value)} disabled={busy}/>
 {error?<p role="alert" className="text-sm text-destructive">{error}</p>:null}<div className="grid gap-2 sm:grid-cols-2"><Button variant="secondary" disabled={busy} onClick={()=>setOpen(false)}>Cancelar</Button><Button variant="destructive" disabled={busy||confirmation!=='EXCLUIR'} onClick={()=>void excluir()}>{busy?'Excluindo...':'Confirmar exclusão'}</Button></div>
 </DialogContent></Dialog></>;
}
