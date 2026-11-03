# Instalação no celular

Perfil → Libens no celular permite instalar pelo evento nativo beforeinstallprompt quando disponível, com instruções alternativas para Chrome Android e Safari/iOS. O manifest usa os ícones aprovados em 192 e 512 pixels e abre /app/inicio, mantendo login e permissões existentes. A instalação exige internet para consultar dados. O service worker não mantém caches de páginas autenticadas, APIs, tokens ou fotos; a falha de navegação offline mostra uma página sem dados.

## Estado das notificações

Os avisos do sistema são opcionais, por aparelho e conta, e solicitados somente por clique. O teste confirma apenas a capacidade local de exibir um aviso. A consulta autenticada à tabela notifications já existente continua sendo a fonte; só avisos não lidos criados depois de abrir o aplicativo geram uma notificação com título e conteúdo do aviso, incluindo data, horário, evento e ministério conforme informado na tela. A consulta ocorre a cada minuto enquanto habilitada, sujeita à execução do navegador. Não dispara histórico. Ao desmontar a sessão, avisos exibidos são fechados. Desativar remove a preferência local e fecha avisos.

**Web Push com aplicativo fechado NÃO está configurado.** Não há inscrição push, remetente VAPID ou promessa de execução de timers em segundo plano. Essa limitação é informada na interface. O conector Supabase disponível só fornece outro projeto (Finances); o backend Lovable do Libens está acessível por SQL, mas o agente Lovable está sem créditos para configurar/deployar o remetente e seus secrets. Completar Web Push requer acesso administrativo ao backend ou créditos Lovable para configurar envio seguro, inscrições próprias com RLS, limpeza de endpoints expirados e integração com os avisos existentes. Não armazenar VAPID privado no GitHub/frontend.

Validação: typecheck, build, testes isolados do service worker e manifest, mais suíte existente. Instalação e permissões reais de Android/iOS precisam ser verificadas no aparelho do usuário; não foram simuladas como se fossem entrega push real.
