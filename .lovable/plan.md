# Libens — Etapa 3: Ministérios, liderança, disponibilidade e escalas

Preserva login, cadastro, recuperação de senha, sessão, perfil e o visual mobile-first atual. Sem push, sem troca completa, sem substituição avançada.

## 1. Admin único
- Localizar `cayomosby@hotmail.com` e garantir `role = admin`, `active = true` (sem criar/excluir conta).
- Regras no banco: só pode existir um admin (índice único parcial); ninguém pode promover outro usuário a admin; a conta admin não pode ser desativada nem ter a função alterada; usuário nunca altera a própria função.
- Novos cadastros continuam como Servo.

## 2. Estrutura de dados (nova)
- **ministries** — nome, descrição, ativo. Semear os 7: Mídia, Transmissão, Portaria, Louvor, Projeção, Intercessão, Infantil (sem duplicar).
- **user_ministries** — membros (usuário x ministério, sem duplicidade).
- **ministry_leaders** — líderes (um usuário pode liderar vários; um ministério pode ter vários líderes; ser membro não torna líder).
- **availability** — usuário, data, disponível (sim/não); ausência de registro = "Não informado". Um registro por usuário/dia.
- **events** — nome, descrição, data, início, fim, local, ativo.
- **event_ministry_needs** — quantas pessoas cada ministério precisa em cada evento.
- **schedules** — uma pessoa escalada em um evento/ministério, com status `draft` (sugestão), `scheduled`, `confirmed`, `cancelled`, `completed`, campo opcional de posição e `replaced_by` / `replaces` para trocas futuras sem perder histórico. Nada é apagado — cancelamentos mudam status.
- Estrutura pronta para notificações futuras (tabela **notifications** simples, sem envio).

## 3. Permissões (no banco, não só na tela)
- Admin: tudo. Pastor: operacional global (ministérios, membros, líderes, eventos, escalas, disponibilidades), sem criar admin.
- Líder: vê seus ministérios, membros e disponibilidade deles; cria/edita/publica escalas só desses ministérios; vê eventos.
- Servo: lê escalas dos seus ministérios e quem serve; edita apenas a própria disponibilidade; nunca altera escalas.
- Funções auxiliares no banco: "é líder deste ministério?", "é membro?", "é pastor ou admin?".

## 4. Telas
- **Administração** (admin): lista de usuários com troca de função (servo/líder/pastor), ativar/desativar; a conta admin aparece bloqueada; não existe opção "admin".
- **Ministérios** (admin/pastor; líder vê os seus): lista real; detalhe com membros e líderes, adicionar/remover.
- **Servos**: lista real conforme permissão, com ministérios de cada um.
- **Eventos** (admin/pastor criam e editam; líder visualiza): formulário com data, horários, local e quantidade necessária por ministério.
- **Disponibilidade**: calendário mensal real — toque alterna Disponível (verde) / Indisponível (vermelho) / Não informado (neutro), salvo no banco. Líder/pastor/admin podem consultar a de membros.
- **Escalas**: lista real (servo só leitura, vê equipe e seu status). Para autorizados: botão "Criar escala" (evento, ministério, quantidade, escolha manual de servos) e "Gerar escala automaticamente".
- **Escala sugerida**: mostra os escolhidos com motivos (disponível, escalas no mês, última escala há X dias); alerta quando faltam pessoas ("São necessárias 3, só 2 disponíveis" — Continuar mesmo assim / Voltar e editar). Permite remover, adicionar, substituir, mudar quantidade, cancelar e **Publicar**.
- Início e Perfil passam a usar dados reais (próxima escala, meus ministérios).

## 5. Geração automática (regras)
Candidatos = ativos + membros do ministério + marcaram Disponível na data + sem outra escala em horário conflitante + não escalados no mesmo evento. Ordenação equilibrada: menos escalas no mês → menos escalas nos meses anteriores → última escala mais antiga. Resultado salvo como rascunho (`draft`), nunca publicado automaticamente. Nunca trata indisponível como disponível.

## 6. Verificação
Testar como servo, líder, pastor e admin os 20 itens do briefing (incluindo tentativas diretas no banco de servo alterar escala e de promover um segundo admin). Ao final, relatório exato de tabelas, funcionalidades e regras criadas.

## Detalhes técnicos
- Uma migração com tabelas, GRANTs, RLS, funções `security definer` (`is_admin_or_pastor`, `is_ministry_leader`, `is_ministry_member`), gatilhos de proteção (admin único/imutável, `profiles_guard` ampliado para pastor não mexer em role admin), índices únicos (`user_ministries`, `ministry_leaders`, `availability(user_id,date)`, admin parcial) e seed dos ministérios com `ON CONFLICT DO NOTHING`.
- Ajuste do admin via atualização de dados após a migração.
- Geração automática em server function com `requireSupabaseAuth` (RLS como o usuário), consultando histórico em `schedules`.
- Leituras via TanStack Query; `src/data/mock.ts` deixa de ser usado pelas telas.
- Transição de roles pelo admin via server function que valida no banco (gatilho bloqueia `admin`).
