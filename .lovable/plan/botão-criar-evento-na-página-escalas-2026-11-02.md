# Botão "+ Criar Evento" na página Escalas

## O que muda
- Na página Escalas, ao lado direito de "+ Criar escala", aparece o botão "+ Criar Evento", com o mesmo estilo (botão principal com ícone +).
- No computador os dois ficam lado a lado; no celular ficam empilhados e ocupam toda a largura, como "Criar escala" já faz hoje.
- O botão só aparece para quem já pode criar eventos: Admin, Pastor e Líderes (a mesma regra da página Eventos).
- Ao clicar, o app vai para a página Eventos e abre na hora o formulário "Novo evento" que já existe. Salvar e cancelar continuam funcionando como antes.
- "Criar escala" continua igual.

## Detalhes técnicos
- `src/routes/app.escalas.tsx`: colocar os dois botões dentro de um `div` `flex flex-col gap-2 sm:flex-row`; o novo botão é um `Link` para `/app/eventos` com `search={{ novo: "1" }}` (usando `Button asChild`), exibido quando `d.global || d.lidero.size > 0`.
- `src/routes/app.eventos.tsx`: a única mudança necessária para abrir o formulário existente — adicionar `validateSearch` com `novo` opcional e, quando ele estiver presente e o usuário puder criar, chamar `abrir()` uma vez e limpar o parâmetro da URL. Nada mais na página muda visualmente.
- Sem novas tabelas, formulários ou migrations.
