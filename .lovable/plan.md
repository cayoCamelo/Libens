# Libens — Confirmações, Substituições e Conclusão de Eventos

Atualização incremental: reaproveita escalas, eventos, notificações e o processo automático que já roda a cada 15 minutos. Nada existente é recriado.

## 1. Confirmação de presença
- No cartão da escala, o Servo escalado vê dois botões: **Confirmar** e **Não poderei ir**.
- Status exibidos: Aguardando resposta, Confirmado, Recusado.
- Líder vê o resumo por ministério (confirmados / recusados / sem resposta); Pastor e Admin veem todos.
- Recusar avisa o Líder pela central de notificações (sininho).

## 2. Substituição
Fluxo:
```text
Servo pede troca -> escolhe substituto sugerido -> substituto aceita/recusa
  -> Líder aprova/rejeita -> escala atualizada automaticamente
```
- Sugestões: membros ativos do mesmo ministério, disponíveis na data e sem outra escala no mesmo evento.
- Cada etapa gera aviso no sininho para os envolvidos (sem duplicar).
- Histórico de cada pedido (quem pediu, substituto, decisões e datas) visível na escala.
- Nova seção "Trocas" dentro de Escalas para o Líder (seus ministérios) e Pastor/Admin (todos).
- Na aprovação, a escala original fica como "Substituída" e uma nova é criada para o substituto, preservando o histórico.

## 3. Status automático dos eventos
- Agendado, Em andamento, Concluído, Cancelado.
- Atualização automática no servidor (mesmo com o app fechado), pelo processo de 15 em 15 minutos já existente — sem criar outro agendamento.
- Fuso America/Fortaleza (também passa a ser usado nos lembretes; mesmo horário de São Paulo hoje).
- Eventos cancelados nunca mudam automaticamente; Admin/Pastor/criador podem cancelar pelo menu do evento.
- Filtro por status na aba Eventos; selo de status no cartão.
- Em evento concluído ou cancelado: bloqueadas confirmações e trocas (no banco, não só na tela).

## 4. Segurança
- Todas as regras validadas no banco: só o próprio servo confirma/pede troca; só o substituto escolhido aceita; só Líder do ministério, Pastor ou Admin aprova.
- Visual, modo claro/escuro e layout mobile atuais preservados.

## 5. Finalização
- Testar confirmação, troca completa e mudança de status com dados reais; verificar telas anteriores.
- Informar arquivos modificados e pendências. Sem commit/push.

## Detalhes técnicos
- `schedules`: adicionar `response` (`pending|confirmed|declined`, default `pending`), `responded_at`; status `confirmed` existente é mantido em sincronia para compatibilidade.
- `events`: adicionar `status` (`scheduled|in_progress|completed|cancelled`, default `scheduled`) + backfill pela data/hora.
- Nova tabela `substitution_requests` (schedule_id, requester_id, substitute_id, status `pending_substitute|pending_leader|approved|rejected|declined|cancelled`, decided_by, timestamps, motivo) com GRANTs e RLS; índice único parcial impede dois pedidos abertos para a mesma escala. Histórico = linhas dessa tabela + `replaces_schedule_id`.
- Funções SECURITY DEFINER: `respond_schedule`, `request_substitution`, `respond_substitution`, `decide_substitution` (cria nova escala, marca a antiga `replaced`, insere notificações com idempotência).
- `process_schedule_reminders()` estendida para atualizar status dos eventos (fuso Fortaleza); cron atual reaproveitado.
- Telas: `app.escalas.tsx`, `editor-escala.tsx`, `app.eventos.tsx`, `app.inicio.tsx`, `lib/dados.ts`; testes de regra para sugestão de substitutos e cálculo de status.
