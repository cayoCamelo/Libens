import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { LibensLogo } from "@/components/libens-logo";
import { LogOut } from "lucide-react";
import { navPorPerfil } from "@/components/layout/nav-config";
import { useSessao } from "@/lib/perfil-context";
import { cn } from "@/lib/utils";

export function AppShell({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao?: string;
  children: ReactNode;
}) {
  const { perfil, usuario, sair } = useSessao();
  const itens = navPorPerfil[perfil];
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen bg-background">
      {/* Navegação lateral (tablet e desktop) */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-border bg-card px-4 py-6 md:flex">
        <Link to="/app/inicio" className="px-2">
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

      <div className="md:pl-64">
        <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
          <div className="mx-auto grid max-w-3xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5 md:px-8">
            <div className="min-w-0">
              <div className="md:hidden">
                <LibensLogo compacto />
              </div>
              <h1 className="truncate text-lg font-semibold tracking-tight text-foreground md:text-xl">
                {titulo}
              </h1>
              {descricao ? (
                <p className="truncate text-sm text-muted-foreground">{descricao}</p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => void sair()}
                aria-label="Sair"
                className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground md:hidden"
              >
                <LogOut className="h-4.5 w-4.5" />
              </button>
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">
                {usuario.nome.charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-3xl px-4 pt-5 pb-28 md:px-8 md:pb-10">{children}</main>
      </div>

      {/* Navegação inferior (celular) */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 backdrop-blur md:hidden">
        <ul className="flex items-stretch">
          {itens.map((item) => {
            const ativo = pathname === item.to;
            return (
              <li key={item.to} className="flex-1">
                <Link
                  to={item.to}
                  aria-current={ativo ? "page" : undefined}
                  className={cn(
                    "flex flex-col items-center gap-1 px-1 py-2.5 text-[11px] font-medium transition-colors",
                    ativo ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <item.icone className="h-5 w-5" />
                  <span className="w-full truncate text-center">{item.rotulo}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
