# Libens — Etapa 4: Gerenciamento real de servos, ministérios e líderes

Reaproveita as tabelas existentes (profiles, ministries, user_ministries, ministry_leaders, schedules, events). Nenhuma tabela nova, nenhum dado fictício nessas telas.

## 1. Ajustes de segurança no banco (só regras, sem novas tabelas)
- Pastor pode editar dados operacionais (nome, telefone) de qualquer usuário, exceto da conta Admin. Função e status continuam só com o Admin (regra já existente).
- Líder pode adicionar/remover membros apenas nos ministérios que lidera.
- Ministérios: só o Admin cria e ativa/desativa; Pastor edita nome/descrição.
- Ao tornar alguém líder, ele é incluído automaticamente como membro do ministério (se ainda não for).
- Admin continua único e protegido (regras atuais mantidas; e-mail não editável).
- Os 7 ministérios iniciais já estão cadastrados — nada será duplicado.

## 2. Tela Servos (real)
- Cartões com nome, e-mail, telefone, função, status, ministérios e data de cadastro.
- Pesquisa por nome/e-mail; filtros por função, ministério e status.
- Líder vê só pessoas dos ministérios que lidera; Servo vê membros dos seus ministérios.
- Tocar em um usuário abre a página de detalhes.

## 3. Detalhes do usuário (nova página /app/servos/:id)
- Dados pessoais: nome, e-mail (só leitura), telefone, status, função.
- Admin: edita tudo, troca função (servo/líder/pastor) e ativa/desativa — exceto a própria conta Admin.
- Pastor: edita nome e telefone; marca/desmarca ministérios e liderança.
- Ministérios: lista de todos com caixa "membro" e, separadamente, "líder".
- Botões ocultos para quem não tem permissão.

## 4. Meu perfil
- Usuário pode editar o próprio nome e telefone.

## 5. Ministérios
- Lista com nome, descrição, status, quantidade de membros e líderes.
- Admin: criar, editar, ativar/desativar. Pastor: editar informações.
- Líder vê só os que lidera; Servo só os que participa.
- Nova página do ministério (/app/ministerios/:id) com seções: Visão geral, Membros, Líderes, Próximas escalas (e próximos eventos).
- Membros: nome, função, status, selo de líder; botão "Adicionar membro" com busca e seleção múltipla de usuários ativos (sem duplicar).
- Remover membro com confirmação; avisos se ele é líder (opção explícita para remover também a liderança) e se tem escalas futuras nesse ministério. Histórico de escalas nunca é apagado.
- Líderes: adicionar/remover (Admin e Pastor), contagem de membros.

## 6. Compatibilidade com escalas
- Geração automática continua usando só usuários ativos e membros atuais do ministério (já é assim).

## 7. Testes
- Verificar, com contas reais de cada função, os 8 cenários do roteiro (consultas no banco simulando cada perfil + navegação no app como Admin).

## Detalhes técnicos
- Migração: política UPDATE em profiles para pastor (`is_admin_or_pastor` e alvo não-admin); políticas INSERT/DELETE em user_ministries via `is_ministry_leader`; substituir política ALL de ministries por SELECT geral + UPDATE admin/pastor + INSERT/DELETE só admin, com trigger impedindo pastor de mudar `active`; trigger AFTER INSERT em ministry_leaders que insere em user_ministries ON CONFLICT DO NOTHING.
- Novas rotas: `app.servos.$id.tsx`, `app.ministerios.$id.tsx`; reescrita de `app.servos.tsx`, `app.ministerios.tsx`; edição em `app.perfil.tsx`; `listarPessoas` passa a trazer phone e created_at.
- Remoção de usos de `src/data/mock.ts` nessas telas (rótulos de função movidos para utilitário real).
