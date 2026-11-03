import { useAreaEmbutida } from "@/lib/area-embutida";
import { aplicarTamanhoFonte, chaveFonte, validarTamanhoFonte } from "@/lib/acessibilidade";
import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import { LibensLogo } from "@/components/libens-logo";
import { LogOut, Moon, Sun } from "lucide-react";
import { navPorPerfil } from "@/components/layout/nav-config";
import { SinoNotificacoes } from "@/components/sino-notificacoes";
import { useAvatarUrl, useMeuPerfilExtra } from "@/lib/avatar";
import { useSessao } from "@/lib/perfil-context";
import { cn } from "@/lib/utils";
import { CompletarCadastro } from "@/components/completar-cadastro";
import { AvisosNoAparelho } from "@/components/instalar-libens";

export function AppShell({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao?: string;
  children: ReactNode;
}) {
  const { perfil, usuario, sair, carregando, ativo, erroPerfil, recarregarPerfil } = useSessao();
  const itens = navPorPerfil[perfil];
  const embutida = useAreaEmbutida();
  const pastoral = perfil === "pastor";
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [modoEscuro, setModoEscuro] = useState(false);
  const extra = useMeuPerfilExtra(usuario.id);
  const foto = useAvatarUrl(extra.data?.avatar_url);

  useEffect(() => {
    const escuro = localStorage.getItem("libens-tema") === "escuro";
    setModoEscuro(escuro);
    document.documentElement.classList.toggle("dark", escuro);
  }, []);

  useEffect(() => {
    if (!usuario.id) return;
    try {
      aplicarTamanhoFonte(validarTamanhoFonte(localStorage.getItem(chaveFonte(usuario.id))));
    } catch {
      aplicarTamanhoFonte("padrao");
    }
  }, [usuario.id]);

  const alternarTema = () => {
    const escuro = !modoEscuro;
    setModoEscuro(escuro);
    localStorage.setItem("libens-tema", escuro ? "escuro" : "claro");
    document.documentElement.classList.toggle("dark", escuro);
  };

  if (carregando || erroPerfil || !ativo) {
    return (
      <main className="mx-auto max-w-lg space-y-4 p-6" aria-live="polite">
        <h1 className="text-xl font-semibold">Libens</h1>
        <p>
          {carregando
            ? "Carregando seu perfil..."
            : (erroPerfil ?? "Sua conta está inativa. Entre em contato com a administração.")}
        </p>
        {!carregando ? (
          <div className="flex gap-4">
            <button type="button" onClick={() => void recarregarPerfil()}>
              Tentar novamente
            </button>
            <button type="button" onClick={() => void sair().catch(() => undefined)}>
              Sair
            </button>
          </div>
        ) : null}
      </main>
    );
  }

  if (embutida)
    return (
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">{titulo}</h2>
        {children}
      </section>
    );
  return (
    <div className="min-h-screen bg-background">
      <AvisosNoAparelho key={usuario.id} />
      <CompletarCadastro />
      {/* Navegação lateral (tablet e desktop) */}
      {!pastoral ? (
        <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-border bg-card px-4 py-6 md:flex">
          <Link to={perfil === "admin" ? "/app/painel" : "/app/inicio"} className="px-2">
            <LibensLogo />
          </Link>

          <nav className="mt-8 flex flex-1 flex-col gap-1">
            {itens.map((item) => {
              const ativo = pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    ativo
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )}
                >
                  <item.icone className="h-4.5 w-4.5 shrink-0" />
                  <span className="truncate">{item.rotulo}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-4 border-t border-border pt-4">
            <button
              type="button"
              onClick={() => void sair()}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <LogOut className="h-4.5 w-4.5 shrink-0" />
              Sair
            </button>
          </div>
        </aside>
      ) : null}

      <div className={pastoral ? "" : "md:pl-64"}>
        <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
          <div className="app-topo mx-auto grid max-w-3xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5 md:px-8">
            <div className="min-w-0">
              <div className={pastoral ? "" : "md:hidden"}>
                <LibensLogo compacto />
              </div>
              <h1 className="break-words text-lg font-semibold tracking-tight text-foreground md:text-xl">
                {titulo}
              </h1>
              {descricao ? (
                <p className="break-words text-sm text-muted-foreground">{descricao}</p>
              ) : null}
            </div>
            <div className="app-acoes flex shrink-0 items-center gap-2">
              <SinoNotificacoes />
              <button
                type="button"
                onClick={alternarTema}
                aria-label={modoEscuro ? "Ativar modo claro" : "Ativar modo escuro"}
                title={modoEscuro ? "Ativar modo claro" : "Ativar modo escuro"}
                className="grid min-h-9 min-w-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                {modoEscuro ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
              </button>
              <button
                type="button"
                onClick={() => void sair()}
                aria-label="Sair"
                className="grid min-h-9 min-w-9 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground md:hidden"
              >
                <LogOut className="h-4.5 w-4.5" />
              </button>
              <Link
                to="/app/perfil"
                aria-label="Meu perfil"
                className="grid min-h-9 min-w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-secondary text-sm font-semibold text-secondary-foreground"
              >
                {foto ? (
                  <img src={foto} alt="" className="h-full w-full object-cover" />
                ) : pastoral ? (
                  "Perfil"
                ) : (
                  usuario.nome.charAt(0).toUpperCase()
                )}
              </Link>
            </div>
          </div>
        </header>

        <main
          className={cn(
            "mx-auto px-4 pt-5 md:px-8 md:pb-10",
            pastoral ? "pb-10" : perfil === "admin" ? "pb-56" : "pb-28",
            perfil === "admin" || perfil === "pastor" ? "max-w-5xl" : "max-w-3xl",
          )}
        >
          {pastoral && pathname !== "/app/painel" ? (
            <Link
              to="/app/painel"
              className="mb-4 inline-flex min-h-11 items-center text-sm text-primary"
            >
              ← Voltar ao Painel pastoral
            </Link>
          ) : null}
          {children}
        </main>
      </div>

      {!pastoral ? (
        <nav
          aria-label="Navegação do aplicativo"
          className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        >
          <ul
            className={cn("grid items-stretch", perfil === "admin" ? "grid-cols-3" : "grid-cols-4")}
          >
            {itens.map((item) => (
              <li key={item.to} className="min-w-0">
                <Link
                  to={item.to}
                  aria-current={pathname === item.to ? "page" : undefined}
                  className={cn(
                    "flex min-h-16 flex-col items-center justify-center gap-1 px-1 py-2 text-xs",
                    pathname === item.to ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <item.icone className="h-5 w-5 shrink-0" />
                  <span className="w-full break-words text-center leading-snug">{item.rotulo}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
