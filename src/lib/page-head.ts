const PUBLIC_ORIGIN = "https://pic-snapshot-creator.lovable.app";

/** Page-specific tags only; root keeps sitewide defaults. Never include personal data. */
export function pageHead(path: string, title: string, description: string, noindex = false) {
  const url = new URL(path, PUBLIC_ORIGIN).href;
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: url },
      { name: "twitter:card", content: "summary_large_image" },
      ...(noindex ? [{ name: "robots", content: "noindex, follow" }] : []),
    ],
    links: [{ rel: "canonical", href: url }],
  };
}