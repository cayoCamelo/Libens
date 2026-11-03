import { createFileRoute } from "@tanstack/react-router";
import { DetalheMinisterio } from "@/components/detalhe-ministerio";
export const Route = createFileRoute("/app/ministerios_/$id")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Ministério — Libens" },
      {
        name: "description",
        content: "Visão geral, membros, líderes e próximas escalas do ministério.",
      },
      { property: "og:title", content: "Ministério — Libens" },
      {
        property: "og:description",
        content: "Visão geral, membros, líderes e próximas escalas do ministério.",
      },
    ],
  }),
  component: MinisterioRoute,
});

function MinisterioRoute() {
  const { id } = Route.useParams();
  return <DetalheMinisterio id={id} />;
}
