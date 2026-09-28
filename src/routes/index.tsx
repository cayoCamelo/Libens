import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Libens — Escalas e ministérios da sua igreja" },
      { name: "description", content: "Acesse o Libens para acompanhar escalas e ministérios." },
      { property: "og:title", content: "Libens — Escalas e ministérios da sua igreja" },
      { property: "og:description", content: "Acesse o Libens para acompanhar escalas e ministérios." },
    ],
  }),
  // A área /app decide: com sessão abre o início, sem sessão vai para /login.
  beforeLoad: () => {
    throw redirect({ to: "/app/inicio" });
  },
});
