import { SITE } from '../content/site';

const PERSON_ID = `${SITE.url}/#person`;

export function personLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': PERSON_ID,
    name: 'Liz Lenjo',
    honorificSuffix: 'Esq.',
    jobTitle: 'Advocate of the High Court of Kenya; Chairperson, Copyright Tribunal',
    url: SITE.url,
    image: `${SITE.url}/og-default.png`,
    sameAs: [SITE.linkedin, SITE.myip],
    knowsAbout: ['Intellectual property law', 'Copyright', 'Trademarks', 'Entertainment law', 'Fashion law', 'Anti-counterfeiting', 'Corporate governance'],
    alumniOf: [
      { '@type': 'CollegeOrUniversity', name: 'University of Turin' },
      { '@type': 'CollegeOrUniversity', name: 'Catholic University of Eastern Africa' },
      { '@type': 'EducationalOrganization', name: 'Kenya School of Law' },
    ],
    worksFor: [
      { '@type': 'LegalService', name: 'MyIP Legal Studio', url: SITE.myip },
      { '@type': 'GovernmentOrganization', name: 'Copyright Tribunal, Kenya' },
      { '@type': 'CollegeOrUniversity', name: 'Strathmore University Law School' },
    ],
    memberOf: [{ '@type': 'Organization', name: 'International Trademark Association' }, { '@type': 'Organization', name: 'Kenya Fashion Council' }],
    award: ['Chambers and Partners 2026, Band 3, Intellectual Property', 'World Trademark Review Bronze 2024, 2025, 2026', 'Africa Legal Innovation Awards, IP Lawyer of the Year 2022', 'WIPR Diversity Beacon of Light 2022', 'WIPR Diversity Shining Lights 2021', 'Business Daily Top 40 Under 40 Women 2018', 'Top 25 Women in Digital – Kenya'],
    address: { '@type': 'PostalAddress', addressLocality: 'Nairobi', addressCountry: 'KE' },
  };
}

export function legalServiceLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'LegalService',
    name: 'MyIP Legal Studio',
    url: SITE.myip,
    founder: { '@id': PERSON_ID },
    areaServed: 'Africa',
    address: { '@type': 'PostalAddress', addressLocality: 'Nairobi', addressCountry: 'KE' },
    knowsAbout: ['Intellectual property', 'Media and entertainment law', 'Fashion law', 'Anti-counterfeiting', 'Governance and regulation', 'Dispute resolution'],
  };
}

export function articleLd(p: { title: string; excerpt: string; url: string; image: string; published: string | null; modified: string; category: string; tags: string[]; words: number }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: p.title.slice(0, 110),
    description: p.excerpt,
    image: [p.image],
    datePublished: p.published,
    dateModified: p.modified,
    author: { '@type': 'Person', '@id': PERSON_ID, name: 'Liz Lenjo', url: SITE.url },
    publisher: { '@type': 'Person', '@id': PERSON_ID, name: 'Liz Lenjo' },
    mainEntityOfPage: p.url,
    articleSection: p.category,
    keywords: p.tags.join(', '),
    wordCount: p.words,
    inLanguage: 'en-GB',
  };
}

export function breadcrumbLd(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((x, i) => ({ '@type': 'ListItem', position: i + 1, name: x.name, item: x.url })),
  };
}
