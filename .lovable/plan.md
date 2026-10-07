# Libens — Eventos do Líder, escalas agrupadas, lembretes e perfil completo

Reaproveita as tabelas atuais (events, schedules, notifications, profiles, ministries). Nenhum sistema novo de usuários, ministérios, eventos ou escalas.

## 1. Líder cria eventos
- O Líder cria eventos e edita ou exclui só os que ele criou. Pastor e Admin mantêm o acesso total.
- A regra fica no banco de dados: cada evento passa a registrar quem o criou.
- Na tela Eventos, o Líder vê o botão "Novo evento". "Gerar próximos eventos" continua só para Pastor e Admin.
- Excluir pede confirmação. Se o evento tiver escalas, aparece o aviso "Este evento possui escalas vinculadas". Nesse caso a exclusão é bloqueada até as escalas serem removidas (nada é apagado em cascata).

## 2. Escalas agrupadas por evento
- Cada evento aparece uma única vez, recolhido por padrão: data, horário, nome, quantidade de ministérios, total de pessoas e status.
- O botão "Ver escalas" expande e mostra cada ministério com os nomes.
- As regras atuais do Líder (criar nos ministérios que lidera, editar e excluir as suas) já estão no banco e serão mantidas.

## 3. Filtros na tela Escalas
- Período: Hoje, Esta semana, Este mês, Próximo mês, Personalizado (de/até).
- Filtros por evento, ministério, pessoa e status, mais "Minhas escalas" ou "Todas".
- Busca: "Pesquisar evento, ministério ou pessoa...".
- Os filtros funcionam juntos. O Líder vê só os seus ministérios; Pastor e Admin veem tudo.

## 4. Lembretes de escala (dentro do app)
- Um processo automático no servidor, a cada 15 minutos, cria os avisos 24h e 2h antes de cada escala publicada. Não depende de ninguém estar com o app aberto.
- Nunca repete o mesmo lembrete: só existe um por escala, tipo e canal.
- Um sininho no topo mostra os avisos não lidos; tocar marca como lido.
- O WhatsApp fica preparado (canal registrado, número no perfil), mas nada é enviado nesta etapa.
- Custo: são 96 verificações por dia. Isso mantém o banco de dados ativo, mas garante que o aviso de 2h chegue com no máximo 15 minutos de atraso.

## 5. Preferência no perfil
- "Receber lembretes de escala" (ligado por padrão). Desligado: nenhum lembrete é criado.

## 6. Ministérios
- Servo vê só os ministérios de que participa, com a frase "Você participa deste ministério."
- Líder vê os ministérios de que é membro e os que lidera.
- Pastor e Admin mantêm a visão global.
- A página do ministério fica somente leitura para o Servo e nunca altera função de usuário.

## 7. Perfil
- Foto: enviar, trocar e remover. Aceita JPG, PNG e WEBP de até 2 MB; a foto fica guardada em arquivo, não no banco.
- Bio opcional (até 300 caracteres) e WhatsApp com formato validado, como (85) 99999-9999.
- A página mostra foto, nome, função, e-mail, telefone, WhatsApp, bio, ministérios e a preferência de lembretes.
- Cada pessoa edita só os próprios dados. O WhatsApp não aparece para os outros membros (só para a própria pessoa, Pastor e Admin).

## 8. Início
- Mostra: próxima escala, próximo evento, avisos pendentes e meus ministérios.
- Para o Líder, também: próximas escalas que ele gerencia e atalhos "Criar escala" e "Criar evento".
- O Admin continua indo para o painel administrativo.

## Detalhes técnicos
- Migração:
  - `events.created_by` com trigger que preenche auth.uid(). As políticas de events passam a ser: SELECT para todos; INSERT para admin/pastor ou quem lidera algum ministério; UPDATE/DELETE para admin/pastor ou criador líder. A FK schedules→events continua sem cascade (bloqueia a exclusão).
  - `profiles`: novas colunas `avatar_url`, `bio` (CHECK de até 300 caracteres), `whatsapp` e `reminders_enabled` (padrão true).
  - `notifications`: novas colunas `channel` (padrão 'app') e `event_id`, e índice único (schedule_id, type, channel).
  - Função SQL `process_schedule_reminders()` que insere lembretes `reminder_24h` e `reminder_2h` com ON CONFLICT DO NOTHING (horário de São Paulo), rodando via pg_cron a cada 15 min.
  - Bucket público `avatars` com políticas de escrita só na pasta do próprio usuário.
- Privacidade do WhatsApp: função security definer `profile_contact(uid)`. A listagem geral de pessoas não seleciona `whatsapp`.
- Front:
  - `app.escalas` reescrita com cards recolhíveis e filtros; `app.eventos` com permissões do Líder e confirmação de exclusão.
  - Sininho no AppShell; `app.perfil` com foto, bio, WhatsApp e preferência; `app.inicio` ampliada.
  - `app.ministerios` com o filtro por participação.
