# Libens — Etapa 2: autenticação, perfil e sessão

Escopo: apenas autenticação real + tabela de perfis + sessão. Layout, identidade visual e componentes existentes são preservados. Escalas e dashboard continuam com dados fictícios.

## 0. Pendências da etapa 1
Antes de começar, corrigir os erros que impedem o preview de abrir e criar as telas faltantes (Escalas, Disponibilidade, Perfil, Servos, Ministérios, Eventos, Administração) no formato já aprovado, para que a navegação funcione.

## 1. Backend
Ativar o Lovable Cloud (backend integrado). Nenhuma chave secreta no código; a chave privilegiada nunca vai ao navegador.

## 2. Autenticação (e-mail e senha)
- `/login`: tela de login atual, agora validando de verdade, com mensagens de erro claras.
- `/cadastro`: criar conta (nome, e-mail, senha) — necessária para o teste "criar usuário". Toda conta nova nasce como **servo**.
- `/recuperar-senha`: envia e-mail real de redefinição.
- `/redefinir-senha`: nova tela para definir a senha nova a partir do link.
- Logout: botão "Sair" na barra lateral e no menu do avatar no celular.
- Sessão persiste ao atualizar a página.
- Área `/app/*` protegida: sem sessão, redireciona para `/login`. `/` redireciona para `/login` ou `/app/inicio`.

## 3. Tabela `profiles`
Campos: id (ligado ao usuário), full_name, email, phone, role (admin | pastor | lider | servo), active, created_at, updated_at.
- Perfil criado automaticamente no cadastro.
- `updated_at` atualizado automaticamente.
- Segurança (RLS): cada usuário lê e edita apenas o próprio perfil; admin e pastor podem ler todos.
- **Proteção importante:** o próprio usuário não pode alterar seu `role` nem `active` (evita alguém se promover a admin). Só admin altera.
- Função segura `has_role` pronta para as políticas das próximas etapas.

## 4. Perfis na interface
- O seletor "Perfil de demonstração" é removido; a navegação passa a seguir o `role` real do usuário.
- Tela Perfil mostra nome, e-mail, telefone (se houver) e função reais.
- Saudação e avatar usam o nome real (não mais "Ana Ribeiro").
- Dashboard e cards de escala permanecem com dados fictícios.

## 5. Testes após implementar
Criar usuário, login, atualizar página, sessão mantida, logout, tentar acessar página privada deslogado, recuperar senha, perfil correto carregado.

Observação: para testar Pastor/Líder/Admin, o papel será alterado diretamente no banco (não há tela para isso nesta etapa).

## Detalhes técnicos
- Rotas: renomear login de `/` para `/login`; `src/routes/index.tsx` vira redirecionamento. Área privada movida para `src/routes/_authenticated/app.*` com o gate gerenciado (`ssr: false`, redireciona para `/login`).
- `perfil-context` passa a ler sessão + linha de `profiles` via cliente do navegador (RLS aplica); `onAuthStateChange` único no root.
- Migração: tabela `profiles` com CHECK/enum de role, GRANTs, RLS, trigger `handle_new_user`, trigger `updated_at`, trigger que bloqueia mudança de role/active por não-admin, função `has_role` security definer.
- Ativar login por e-mail; confirmação de e-mail mantida (cadastro mostra "verifique seu e-mail").
- Nenhuma biblioteca nova. Sem tabelas de eventos/escalas.
