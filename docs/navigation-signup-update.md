# Navegação, cadastro e substituições

- Servo/Líder: Início, Escalas, Disponibilidade e Perfil; quatro destinos diretos no celular.
- Pastor/Admin: Ministérios e painel próprio; somente Admin gerencia contas Pastor.
- Início lista escalas reais futuras da pessoa/equipe; detalhes abrem modal em Escalas.
- Criar escala oferece apenas Mês atual; editor individual permanece para correções das vagas.
- Perfil sem Bio; dados antigos preservados. Instalação Chrome/Safari e estado da permissão.
- Cadastro sempre Servo; ministérios ativos (até dois) vinculados pelo trigger. Metadata nunca atribui função. Contas antigas sem vínculo completam no próximo acesso.
- RPCs v2 de substituição exigem autoria, membro ativo do ministério, ausência de conflito e aceite. Opção disponível exige disponibilidade positiva; opção combinada permite exceção à disponibilidade, mas não a conflitos/inatividade. Original preservado até aceite transacional. Solicitações antigas em aprovação continuam com o fluxo anterior.
- Administração única protegida por índice e trigger; atribuição de líder por ministry_leaders continua exclusiva Pastor/Admin via RLS.
- Painel pastoral usa período e ministério e conta escalas concluídas sem recusas; não representa comprovação de presença.

## Limitação existente
Os avisos no aparelho funcionam com o app em execução. Web Push com o app fechado não está implementado; a interface informa essa limitação. Instalação não concede automaticamente permissão de notificação.

## Validação
`npm run typecheck`, `npm test` (PGlite com políticas/RPCs e fixtures fictícias) e `npm run build`. Não enviar notificações reais para membros durante os testes. Instalação e entrega final dependem de teste no próprio aparelho com a conta autenticada.
