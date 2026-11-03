import test from "node:test";
import assert from "node:assert/strict";
import { gerarMes, conflitoMensal, resumoMensal, payloadMensal, precisaConfirmar, type ContextoMensal } from "../src/lib/escala-mensal.ts";

const contexto=():ContextoMensal=>({month:"2026-11-01",people:[
  {id:"ana",name:"Ana",month_count:0,previous_count:0,last_date:null},
  {id:"bruno",name:"Bruno",month_count:0,previous_count:0,last_date:null},
],events:[5,8,12].map((d)=>({id:String(d),name:"Culto",date:`2026-11-${String(d).padStart(2,"0")}`,start_time:"19:00:00",end_time:"21:00:00",required_count:0,existing:[],candidates:[
  {user_id:"ana",available:true,conflict:false},{user_id:"bruno",available:true,conflict:false},
]}))});

test("distribui sugestões ao longo do mês considerando as sugestões anteriores",()=>{
  const p=gerarMes(contexto(),1);assert.deepEqual(p.map(l=>l.slots[0]?.userId),["ana","bruno","ana"]);
});
test("preserva existentes e respeita quantidade já definida",()=>{
  const c=contexto();c.events[0]!.existing=[{id:"escala",user_id:"ana",name:"Ana",status:"confirmed",available:true}];
  c.events[0]!.required_count=2;c.events[0]!.candidates[0]!.conflict=true;
  const p=gerarMes(c,1);assert.equal(p[0]!.slots[0]!.scheduleId,"escala");assert.equal(p[0]!.slots[1]!.userId,"bruno");
  assert.deepEqual(payloadMensal(p)[0]!.existing_ids,["escala"]);
  assert.deepEqual(payloadMensal(p)[0]!.selections.map(s=>s.user_id),["bruno"]);
});
test("não escolhe automaticamente quem está indisponível ou não informou",()=>{
  const c=contexto();c.events[0]!.candidates[0]!.available=null;c.events[0]!.candidates[1]!.available=false;
  const p=gerarMes(c,1);assert.equal(p[0]!.slots[0]!.userId,"");assert.equal(resumoMensal(p).pendentes,1);
});
test("conflitos novos durante a própria geração ficam bloqueados",()=>{
  const c=contexto();c.events[1]!.date=c.events[0]!.date;
  const p=gerarMes(c,2);assert.equal(p[1]!.slots.filter(s=>!s.userId).length,2);
});
test("não depende da ordenação enviada pelo servidor",()=>{
  const c=contexto();c.events.reverse();assert.deepEqual(gerarMes(c,1).map(l=>l.event.id),["5","8","12"]);
});
test("escolha manual exige confirmação e não permite duplicidade/conflito",()=>{
  const c=contexto();c.events[0]!.candidates[0]!.available=null;
  const p=gerarMes(c,2),l=p[0]!,v=l.slots.find(s=>!s.userId)!;
  v.userId="ana";v.name="Ana";assert.equal(precisaConfirmar(l,v),true);assert.equal(resumoMensal(p).semConfirmacao,1);
  v.confirmed=true;assert.equal(resumoMensal(p).semConfirmacao,0);
  assert.equal(conflitoMensal(p,l.event,"bruno",v),true);
  assert.equal(payloadMensal(p)[0]!.selections.find(s=>s.user_id==="ana")!.manual_confirmed,true);
});
test("rascunhos existentes sem disponibilidade também pedem confirmação",()=>{
  const c=contexto();c.events[0]!.existing=[{id:"draft",user_id:"ana",name:"Ana",status:"draft",available:null}];
  const p=gerarMes(c,1);assert.equal(resumoMensal(p).semConfirmacao,1);
  p[0]!.slots[0]!.confirmed=true;assert.deepEqual(payloadMensal(p)[0]!.confirmed_existing,["ana"]);
});
