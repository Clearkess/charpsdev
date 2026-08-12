const siteUrl = "https://charpsdev.vercel.app";

/**
 * JSON-LD structured data for the homepage. Describes CharpsDev as what it
 * actually is — a digital services marketplace (data/airtime/gift
 * cards/virtual numbers/eSIMs), not a generic "developer tools" product —
 * so search engines index the correct entity and search intent.
 */
export default function StructuredData() {
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
