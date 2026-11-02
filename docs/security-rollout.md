# Correções de segurança e confiabilidade — ativação

Estado em 02/11/2026: **PRs #1 e #2 integrados e publicados. As duas etapas SQL foram aplicadas no banco do Libens.**

Verificação: nove funções de aplicação sem EXECUTE para anon; leitura direta de email/phone revogada para authenticated; bucket privado com JPG/PNG/WEBP; contagens de membros, eventos e escalas preservadas. Uma chamada sem login foi bloqueada em teste transacional com identificador inexistente. Os arquivos de migração 0007 e 0008 reproduzem exatamente o SQL aplicado.

## Mudanças

- Revoga execução anônima das sete RPCs de escalas/trocas e verifica sessão e perfil ativo nas ações.
- Mantém a leitura do próprio perfil inativo, bloqueando o restante por políticas restritivas.
- Restringe vínculos e leitura de fotos ao próprio usuário, gestores globais e pessoas do mesmo ministério. Upload de fotos permite JPG/PNG/WEBP, até o limite de 2 MB já existente.
- `list_people` entrega nome/papel para o diretório e contatos apenas ao próprio usuário, admin/pastor e liderança responsável. WhatsApp continua pela função protegida existente.
- `save_schedule` grava uma edição de escala em uma transação, preservando cancelados/histórico e verificando autoria, membro ativo, vínculo e conflito de horário no banco.
- Aprovar substituição revalida o candidato; gravações de escalas bloqueiam a pessoa durante a validação. Deadlocks concorrentes podem abortar uma tentativa com rollback; a interface permite tentar novamente.
- Perfil não encontrado ou erro de rede deixa de assumir conta ativa; mostra erro e nova tentativa. Cache é limpo quando muda a identidade.
- A tela inicial exclui eventos encerrados/cancelados e usa data de Fortaleza. Remove condições inalcançáveis do layout dos líderes.
- Corrige o lockfile, adiciona comandos de tipos/testes e CI em Node 24.

## Ordem de ativação executada

1. Confirmar que `main` não ganhou alterações conflitantes e verificar backup/restauração pelo provedor. A proposta não contém exclusão de tabelas ou de cadastros.
2. Aplicar [SQL da etapa 1](sql/security-hardening.sql) em transação. Acrescenta RPCs/trigger e endurece permissões. Ainda mantém SELECT dos contatos para compatibilidade temporária com o frontend anterior.
3. Conferir `has_function_privilege('anon', ...) = false` nas sete RPCs; testar com contas controladas servo/líder/admin/inativo e validar cron. Não testar mutações em cadastros reais.
4. Integrar a branch e publicar o frontend compatível, que usa `list_people` e `save_schedule`. Não publicar antes da etapa 1.
5. Aplicar [SQL da etapa 2](sql/restrict-profile-contacts.sql): remove leitura direta das colunas de contato. Conferir `has_column_privilege('authenticated','public.profiles','email','SELECT') = false` e o mesmo para `phone`.
6. Validar novo login, próprio perfil, lista de membros, criação/edição de escalas, troca e foto com contas controladas. Executar os advisors do provedor, se disponíveis.

As políticas novas têm nomes fixos: **não reaplicar o SQL manualmente**. O SQL aplicado está versionado nas migrações Drizzle 0007/0008 e registrado no histórico do banco. Os arquivos docs/sql são as propostas históricas aprovadas. Novos ambientes executam as migrações em ordem.

## Testes realizados e limites

- `npm ci --ignore-scripts --no-audit --no-fund`: instalação reproduzível.
- `npm run typecheck`: checagem TypeScript.
- `npm test`: 19 testes reportados após integrar os dois PRs; banco PostgreSQL local em memória (PGlite), papéis anon/authenticated, RLS e dados fictícios. Testa privilégios, contatos, inativos, rollback, conflito e revalidação da troca, além de datas/fusos.
- `npm run build`: cliente e servidor.

PGlite usa substitutos mínimos para Auth/Storage e não substitui o teste da API REST, concorrência real entre conexões, cookies, recuperação de senha, upload no Storage ou teste visual autenticado no Lovable. O teste local não executa pg_cron e não verifica entrega de notificações no celular. Não houve alteração das configurações globais de Auth, MFA, política de senhas ou backups.

## Pendências fora deste pacote

- Auditoria completa de concorrência entre edições de evento e escalas, e do limite de dois ministérios.
- Paginação e limites das consultas, observabilidade e revisão de dependências obsoletas.
- Ajuste do gerador de sugestões para conflitos que atravessam meia-noite; o banco proposto bloqueia gravações conflitantes, mas a sugestão ainda precisa ser refinada.
- Testes de navegador com sessões reais e advisors no ambiente do provedor. A publicação foi verificada pelos bundles públicos servidos; não foi realizado login com senha de usuário.
