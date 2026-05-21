import { Helmet } from "react-helmet-async";

const SITE_URL = "https://doc-aga.goldenforage.com";

interface RouteSeoProps {
  title: string;
  description: string;
  path: string;
  /** Optional JSON-LD structured data object(s) to inject for this route. */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  /** Override og:type (defaults to "website"). */
  ogType?: string;
}

/**
 * Per-route SEO head tags. Provides a unique title, description, canonical,
 * and Open Graph block per page so search engines and JS-aware social
 * crawlers see route-specific metadata instead of the static index.html
 * fallback.
 */
export function RouteSeo({ title, description, path, jsonLd, ogType = "website" }: RouteSeoProps) {
  const url = `${SITE_URL}${path}`;
  const blocks = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content={ogType} />
      {blocks.map((block, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(block)}
        </script>
      ))}
    </Helmet>
  );
}
