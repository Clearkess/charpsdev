const siteUrl = "https://charpsdev.vercel.app";

export type FaqEntry = { q: string; a: string };

/**
 * JSON-LD structured data for the homepage. Describes CharpsDev as what it
 * actually is — a digital services marketplace (data/airtime/gift
 * cards/virtual numbers/eSIMs), not a generic "developer tools" product —
 * so search engines index the correct entity and search intent.
 *
 * `faqs` is optional and, when provided, adds an FAQPage node built from the
 * same Q&A content already rendered on the page — this makes the homepage
 * eligible for Google's FAQ rich results without maintaining the copy twice.
 */
export default function StructuredData({ faqs = [] }: { faqs?: FaqEntry[] }) {
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        url: `${siteUrl}/`,
        name: "CharpsDev",
        description:
          "CharpsDev is a digital services marketplace for buying data plans, airtime, gift cards, eSIMs and virtual numbers online.",
        potentialAction: {
          "@type": "SearchAction",
          target: `${siteUrl}/services?query={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: "CharpsDev",
        url: `${siteUrl}/`,
        logo: `${siteUrl}/logo.png`,
      },
      {
        "@type": "WebApplication",
        "@id": `${siteUrl}/#application`,
        name: "CharpsDev",
        url: `${siteUrl}/`,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web, Android, iOS",
        description:
          "Fund your wallet and buy data, airtime, gift cards, eSIMs and virtual numbers securely from a single dashboard.",
        offers: {
          "@type": "AggregateOffer",
          priceCurrency: "NGN",
          availability: "https://schema.org/InStock",
        },
      },
      ...(faqs.length > 0
        ? [
            {
              "@type": "FAQPage",
              "@id": `${siteUrl}/#faq`,
              mainEntity: faqs.map((item) => ({
                "@type": "Question",
                name: item.q,
                acceptedAnswer: {
                  "@type": "Answer",
                  text: item.a,
                },
              })),
            },
          ]
        : []),
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(structuredData),
      }}
    />
  );
}
