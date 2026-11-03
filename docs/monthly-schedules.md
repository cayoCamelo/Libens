# Geração mensal de escalas

Em Escalas → Criar escala, a aba **Mês atual** permite sugerir o restante do mês para um ministério gerenciado pelo usuário.

- Considera apenas eventos cadastrados cujo início ainda não ocorreu, no mês de America/Fortaleza. Não cria eventos novos.
- Usa a quantidade definida em cada evento; o campo padrão vale onde a quantidade não foi definida.
- Preserva pessoas e registros já escalados. Redistribuir escalas existentes continua sendo uma edição individual.
- Sugere somente membros ativos com disponibilidade explicitamente positiva. Distribui pela quantidade de escalas do mês, histórico anterior e última data de serviço, incluindo as novas sugestões na distribuição.
- Evita sobreposição entre sugestões e consulta conflitos reais no banco, inclusive em outros ministérios, sem expor nomes dos eventos privados.
- Vagas não preenchidas ficam pendentes. Escolhas manuais sem disponibilidade positiva exigem confirmação do gestor; conflitos e membros inativos continuam bloqueados pelo banco.
- Permite guardar rascunho com vagas vazias e retomá-lo pela geração mensal. Rascunhos existentes sem disponibilidade positiva precisam de nova confirmação antes da publicação.
- Só publica após preencher todas as vagas e confirmar a publicação. Rascunhos de outro gestor só podem ser publicados por ele ou por admin/pastor.
- A gravação de todos os eventos enviados é uma transação. Se a disponibilidade mudar, surgir conflito ou outro gestor modificar a lista de escalados, nenhuma parte da gravação é aplicada; deve-se gerar novamente.

## Segurança e implantação

A migração Drizzle 0009 cria apenas `month_schedule_context` e `save_month_schedule`, revoga EXECUTE de PUBLIC/anon e exige perfil ativo e permissão de gestão do ministério. Não modifica escalas no ato de instalação. Aplicar a migração antes de publicar o frontend e registrar seu hash no histórico Drizzle ao usar SQL direto.

O contexto só retorna nomes dos membros do ministério, dados dos eventos e disponibilidade/conflito necessários ao planejamento; não retorna contatos privados. O salvamento é aditivo e não exclui nem cancela escalas existentes.

## Validação

`npm test`, `npm run typecheck` e `npm run build`. Os testes incluem distribuição mensal, preservação de escalas, lacunas, confirmação manual, conflitos entre sugestões e regras do banco com papéis anon/authenticated e dados fictícios.

O teste de interface no navegador ficou limitado pela infraestrutura de prévia (`vite: not found` no daemon, apesar das dependências presentes no checkout). Não foi realizado login com conta real para criar escalas em produção.
