# Libens — fundação visual inicial

Primeira etapa: apenas estrutura visual e navegação, com dados fictícios. Sem banco, sem login real, sem algoritmo de escalas.

## Identidade

Marca própria "Libens" presente no login, no cabeçalho e na navegação: paleta serena e profissional, tipografia legível, cantos suaves, muito espaço em branco. Nada de excesso de elementos.

## Telas

Públicas
- Login (marca Libens, e-mail/senha, link de recuperação)
- Recuperação de senha (envio de e-mail simulado com mensagem de confirmação)

Área do usuário
- Início (dashboard): saudação "Olá, usuário", card "Próxima escala" (Domingo, 04 de outubro — Culto de Celebração — Transmissão), seção "Escalas do mês" com calendário simples, seção "Minha disponibilidade"
- Escalas: lista por data, com evento, ministério e pessoas escaladas
- Disponibilidade: marcar dias/períodos disponíveis (estado local, sem salvar)
- Perfil: dados do usuário e ministérios em que participa
- Servos (líder/pastor): lista de servos por ministério
- Ministérios e Eventos (pastor): listas estruturais
- Administração: tela estrutural com as seções previstas (Usuários, Ministérios, Eventos, Escalas, Permissões, Configurações, Logs), ainda sem funções

## Navegação

Mobile-first: barra inferior no celular, navegação lateral/superior em telas maiores. Os itens da barra mudam conforme o perfil (Servo, Líder, Pastor, Admin), exatamente como descrito no briefing.

Como ainda não há login real, incluo um seletor discreto de perfil (apenas para demonstração) que permite ver a navegação e as telas de cada perfil. Ele sai quando a autenticação entrar.

## Dados fictícios

Um único lugar centraliza os dados de exemplo (ministérios: Mídia, Transmissão, Portaria, Louvor, Projeção, Intercessão, Infantil; servos; eventos; escalas; disponibilidade), com tipos declarados para troca direta por dados reais depois.

## Detalhes técnicos

- Rotas TanStack em `src/routes`: `/` (login), `/recuperar-senha`, e área do app com layout compartilhado (`inicio`, `escalas`, `disponibilidade`, `servos`, `ministerios`, `eventos`, `perfil`, `admin`).
- Organização: `src/components/ui` (shadcn), `src/components` (cards, calendário, listas reutilizáveis), `src/layouts` (app shell + bottom nav + sidebar), `src/data` (mocks), `src/types` (Ministerio, Servo, Evento, Escala, Disponibilidade, Perfil).
- Perfil ativo em um contexto React leve, pronto para ser substituído por sessão real.
- Tokens de cor/tipografia em `src/styles.css`; nenhuma cor fixa nos componentes.
- `head()` próprio por rota com título e descrição do Libens.
- Nenhuma biblioteca nova além do que o template já traz.

## Fora desta etapa

Banco de dados, autenticação real, RLS, algoritmo de escalas, integrações, pagamentos e notificações.
