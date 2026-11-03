# Avisos de escalas e substituições

A migração 0010 complementa a tabela `notifications` existente. Não cria outro canal nem modifica escalas reais na instalação.

- Publicação individual ou mensal: um aviso por registro de escala publicado. Rascunhos não avisam. Repetir o salvamento ou confirmar presença não duplica o aviso. Substituições aprovadas usam os avisos próprios da decisão, evitando também emitir aviso de nova escala para o mesmo fato.
- Substituição: os avisos existentes de pedido, resposta, aprovação pendente, decisão e recusa passam por normalização de texto no INSERT. Incluem data, horário, ministério e evento. Aceite do substituto deixa claro que ainda precisa de aprovação do líder.
- Lembretes: contas ativas, lembretes habilitados, escala publicada/confirmada, sem recusa e evento ativo não cancelado/concluído. Checagem a cada minuto no cron existente. Janela de geração de até 15 minutos após 24h/2h antes do início; não dispara lembrete atrasado fora da janela nem usa “amanhã”/“em 2 horas” no texto. Horários America/Fortaleza, incluindo virada de dia. Atraso do cron/aparelho não muda a informação absoluta no aviso. Identidade por horário permite novo lembrete após reagendamento. Não repete avisos legados correspondentes à mesma janela.
- Edição ou cancelamento do evento: avisa equipes publicadas; conclusão automática não gera ruído. Cancelamento não apaga histórico.
- Funções privilegiadas novas ficam em `private`, com search_path vazio e EXECUTE revogado de PUBLIC/anon/authenticated. RLS da tabela permanece. Destinatários inativos não recebem novos avisos.
- A instalação não reenvia histórico. Avisos antigos conservam os textos originais para auditoria.

## Texto no celular

O aplicativo agora passa título e corpo do registro ao `showNotification`, usando a logo Libens, em vez de sempre apresentar “Você tem um novo aviso”. O usuário é informado de que evento/ministério/data/horário aparecerão no aparelho. Data e horário são apresentados no início do lembrete para reduzir a perda da informação quando o sistema recolhe o texto. A quantidade de texto visível depende do celular; expandir o aviso ou abrir o app mostra os detalhes.

**Entrega com app fechado continua não configurada:** falta acesso administrativo ao remetente Web Push/secrets no backend Lovable (conector Supabase disponível só alcança Finances; agente Lovable sem créditos). Nenhuma inscrição ou VAPID privado é simulado ou exposto. As novas regras geram os avisos no banco mesmo com o app fechado, mas a notificação do sistema nesta versão só aparece enquanto o app estiver aberto/em execução e com permissão concedida. Testes locais não equivalem a confirmação física no Android/iOS.

## Verificação

Suíte isolada com dados fictícios: rascunho, publicação sem duplicação, texto de pedido de troca, gatilhos de edição/cancelamento, janelas de lembretes, data e horário no início da mensagem, preferência desativada, reagendamento e revogação de EXECUTE. Não cria escalas nem dispara avisos reais para testar em produção.
