# Libens — Eventos padrão, escalas do Líder e painel do Admin

Mantém todas as tabelas atuais (eventos, escalas, ministérios, disponibilidade). Nada é recriado nem duplicado.

## 1. Evento x Escala
- Evento = culto com data e horário. Escala = pessoas de um ministério ligadas a esse evento. As escalas continuam sempre presas a um evento.

## 2. Eventos padrão
- Cadastro de eventos padrão: **Culto da Palavra** (quinta, 19:30–21:00) e **Culto de Celebração** (domingo, 18:00–20:00).
- Botão em Eventos (Admin/Pastor), "Gerar próximos eventos", cria as datas dos próximos 3 meses. Cada data é gerada uma vez só: rodar de novo não duplica.
- Os eventos gerados aparecem na aba Eventos como hoje e podem ser editados.

## 3. Escalas e permissões
- Líder cria escalas só para os ministérios que lidera. Edita e exclui as que ele criou.
- Líder não exclui escalas criadas por outro líder, pelo Pastor ou pelo Admin.
- Pastor: acesso global para criar, editar e publicar. Admin: pode excluir qualquer escala.
- Servo só visualiza.
- Cada escala registra quem criou, quando, quem alterou por último e quando.

## 4. "Pessoas necessárias" opcional
- Vira um seletor de 0 a 100, com valor padrão 0 (sem quantidade definida). Não é obrigatório.
- O aviso de falta de pessoas só aparece quando o valor é maior que 0.

## 5. Máximo de 2 ministérios por pessoa
- A regra fica no banco de dados. Uma tentativa de 3º ministério é bloqueada com a mensagem "Cada membro pode participar de no máximo 2 ministérios."
- Hoje ninguém passa de 2. Se algum caso antigo existir, ele é preservado e sinalizado na Administração.

## 6. Conflito no mesmo evento
- O banco impede escalar a mesma pessoa em dois ministérios no mesmo evento. A tela mostra: "Este membro já está escalado para outro ministério neste evento."

## 7. Disponibilidade para o Líder
- Na tela Disponibilidade, o Líder vê, por ministério, cada membro com os próximos eventos marcados como Disponível, Indisponível ou Não informado. É só para consulta: cada pessoa continua editando apenas a própria disponibilidade (regra que o banco já garante).

## 8. Criar escala (fluxo do Líder no celular)
- A tela Escalas passa a listar os **próximos eventos**, cada um com o botão "Criar escala".
- O editor mostra os membros do ministério marcados como disponível, indisponível ou ocupado em outro ministério no mesmo evento. A seleção é manual; "Gerar automaticamente" continua como opção.
- Na escala, o botão Excluir aparece só para quem tem permissão.

## 9. Função só em Administração
- Removo a troca de função e de status da página de detalhes do servo. Ela passa a mostrar a função sem permitir alterá-la.
- A Administração continua sendo o único lugar para mudar Servo, Líder e Pastor.

## 10. Painel do Admin
- Ao entrar, o Admin vai para um painel próprio, no lugar do Início dos outros perfis.
- Usuários: total, novos (últimos 30 dias), ativos, inativos e sem ministério ("aguardando configuração"), além da lista dos cadastrados recentemente com nome, e-mail, data, função e status.
- Escalas: total e lista das recentes com evento, data, ministério, quem criou, data de criação e quantidade de membros. Tocar abre a escala.

## Observação
- O pedido cita uma central de notificações, integração com WhatsApp e registros de notificação. Isso ainda não existe no app (só a estrutura de notificações no banco), então nada disso será criado ou removido.

## Detalhes técnicos
- Migração:
  - Tabela `event_templates` (nome, weekday, start/end, active), com GRANT e RLS (leitura para todos; gestão por admin/pastor) e seed dos 2 eventos padrão.
  - `events.template_id` nullable, com índice único parcial (template_id, date).
  - Função security definer `generate_template_events(months int)` com `INSERT ... ON CONFLICT DO NOTHING`, executável só por admin/pastor.
  - `schedules.updated_by` nullable; trigger que preenche created_by/updated_by com auth.uid().
  - Trigger BEFORE INSERT em `user_ministries` que bloqueia o 3º vínculo.
  - Índice único parcial ou trigger em schedules: um usuário por evento quando o status não é cancelled/replaced.
  - Políticas de schedules: DELETE para admin (qualquer), pastor (qualquer) e líder (created_by = auth.uid() e is_ministry_leader). UPDATE para líder só nas suas escalas, mantendo o pastor global. Rascunho deixa de ser exceção na exclusão.
  - `event_ministry_needs.required_count` com CHECK 0..100.
- Rotas:
  - `app.inicio` redireciona o admin para a nova rota `app.painel`.
  - Ajustes em `app.escalas`, `editor-escala`, `app.disponibilidade` (visão por ministério para líder), `app.eventos` (eventos padrão + gerar), `app.servos_.$id` (remover a edição de função e status).
  - `nav-config`: admin ganha "Painel".
- Validação: build e tsgo, consultas ao banco simulando cada perfil para os 16 itens e conferência no app como Admin.
