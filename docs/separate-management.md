# Gestão pastoral e administrativa

- Pastor: início próprio com ministérios, servos ativos, eventos do mês, próximos eventos e vagas/substituições pendentes. Não acessa Usuários e acessos nem exclusão de servos. Permissões anteriores sobre ministérios, dados pessoais não administrativos, eventos e escalas são preservadas.
- Administrador: painel próprio com cadastros, novas contas, inativos, vínculos pendentes e gestão geral. Usuários e acessos é uma lista compacta com pesquisa/filtro e edição individual em diálogo; conta administradora protegida.
- Listas de servos/ministérios compactas, filtros de servos recolhíveis, criação de ministério em diálogo e detalhes de pessoas separados da listagem. Eventos padrão e disponibilidade da equipe passam a seções recolhíveis. Instalação/avisos agrupados em Perfil. A edição individual/mensal de escalas e as regras de notificações continuam existentes.
- Navegação móvel usa três atalhos e Mais, mantendo todos os destinos sem espremer rótulos.

## Exclusão de servo

A ação **Excluir servo do cadastro** fica na janela de gestão administrativa e nos detalhes do servo. Exige digitar EXCLUIR; a validação é repetida no RPC `delete_servo`. Apenas administrador ativo pode executá-la e apenas sobre papel servo. Administrador, pastor e líder são protegidos dessa operação; não se pode excluir a própria conta.

É exclusão lógica, indicada explicitamente no diálogo: profiles registra deleted_at/deleted_by, bloqueia active, desliga lembretes, remove vínculos e cancela pedidos pendentes e participações futuras que ainda não começaram. Escalas antigas, identificação histórica e auth.users são preservados. Não é eliminação definitiva de dados pessoais nem liberação do e-mail para novo cadastro. Não existe botão de restauração nesta versão; não confundir com o controle de ativar/inativar.

O diretório RPC mantém a identificação histórica e retorna deleted_at. As listas de gestão removem estes perfis; o resolvedor de nomes ainda usa os registros originais. RLS de conta ativa continua bloqueando operações mesmo com JWT anterior. O guard impede reativar o cadastro excluído ou alterar os marcadores pela conta do servo. Toda a exclusão ocorre numa transação e a função recebe confirmação explícita. Novos campos privados de exclusão não são concedidos em SELECT direto para usuários comuns.

## Validação e implantação

Aplicar migração Drizzle 0011 antes do frontend, registrar seu hash se executada via SQL e notificar pgrst. Instalação não exclui pessoas nem altera escalas reais. Testes PGlite com dados fictícios cobrem admin/servo/líder/pastor/anon, confirmação, histórico, vínculos, cancelamento futuro, bloqueio de acesso e reativação. Typecheck, build e testes de navegação verificam a integração. Não foi feita exclusão real nem navegação autenticada por todos os perfis em aparelho físico.
