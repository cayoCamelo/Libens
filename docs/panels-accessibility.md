# Painéis e acessibilidade

- Início de Líder mostra somente suas escalas publicadas em todos os ministérios; equipe fica em Escalas. Servo preservado.
- Próximos eventos exclui encerrados/cancelados por horário de Fortaleza, mesmo antes do cron. Atualiza a cada 15 segundos e ao retornar à janela. Histórico conserva todos e combina os filtros.
- Admin: Painel principal, Escalas, Disponibilidade, Ministérios, Acessos, Perfil; celular com duas linhas de três destinos e sem Mais/Início/Servos.
- Painel principal inclui a gestão de Acessos e áreas expansíveis para organização.
- Pastor: página única, cards para ações e consultas em diálogos, histórico e atividades, sem navegação por abas; Perfil no cabeçalho e retorno ao painel.
- Editor de Acessos compartilhado atribui função e um/dois ministérios de liderança atomicamente. Pastor define Líder; só Admin define Pastor/estado da conta. Admin e autoalteração são protegidos. Membros/histórico preservados ao remover liderança.
- Ministérios e cadastro individual exibem líderes sem atribuição/remoção nessa tela. Remover membro que é líder requer primeiro remover liderança em Acessos.
- Perfil: Acessibilidade com fonte 100%,125%,150%; preferência por conta neste aparelho. Controles/cabeçalhos se reorganizam. Libens no celular ao final.

## Verificações
TypeScript, build, testes PGlite de permissões/atomicidade/regressões; verificação visual local com dados fictícios das telas de Líder/Admin/Pastor e fonte 150% em largura móvel. Nenhuma conta real usada nos testes. Instalação/avisos no celular continuam com a limitação existente de execução do app.
