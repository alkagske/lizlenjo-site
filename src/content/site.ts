/**
 * Site copy and facts. Source of truth: design/uploads/profile-2026.pdf.
 * Items awaiting client confirmation are listed in CONTENT-TODO.md.
 */
import advocate from '../assets/slides/advocate.png';
import lecturer from '../assets/slides/lecturer.png';
import fashion from '../assets/slides/fashion.png';
import model from '../assets/slides/model.png';
import reflection from '../assets/photos/reflection-1920.jpg';
import piano from '../assets/photos/piano-1920.jpg';
import redTwirl from '../assets/photos/red-twirl-1920.jpg';

export const SITE = {
  name: 'Liz Lenjo',
  formal: 'Liz Lenjo, Esq.',
  url: 'https://lizlenjo.com',
  description:
    'Liz Lenjo, Advocate of the High Court of Kenya, Chairperson of the Copyright Tribunal and Founder of MyIP Legal Studio. Intellectual property, entertainment and fashion law for Africa’s creative industries.',
  linkedin: 'https://www.linkedin.com/in/lizlenjo/',
  myip: 'https://myip.lawyer/',
  locale: 'en_GB',
};

export const PHOTOS = { advocate, lecturer, fashion, model, reflection, piano, redTwirl };

export const SLIDES = [
  { label: 'Advocate', img: advocate, alt: 'Liz Lenjo, Advocate of the High Court of Kenya', pos: '50% 12%' },
  { label: 'Portrait', img: reflection, alt: 'Portrait of Liz Lenjo', pos: '50% 30%' },
  { label: 'Lecturer', img: lecturer, alt: 'Liz Lenjo lecturing', pos: '50% 12%' },
  { label: 'At the piano', img: piano, alt: 'Liz Lenjo at the piano', pos: '62% 40%' },
  { label: 'Fashion', img: fashion, alt: 'Liz Lenjo in a tailored look', pos: '50% 12%' },
  { label: 'In red', img: redTwirl, alt: 'Liz Lenjo in a red gown', pos: '50% 45%' },
  { label: 'Model', img: model, alt: 'Liz Lenjo modelling', pos: '50% 12%' },
];

export const SPEC = [
  { k: 'CLIENT', v: 'Liz Lenjo, Esq.' },
  { k: 'CLOTH', v: 'Intellectual property' },
  { k: 'CUT', v: 'Entertainment & fashion law' },
  { k: 'ORIGIN', v: 'Nairobi, Kenya' },
];

export const PARTNERS = [
  { name: 'WIPO', logo: '/logos/wipo.png' },
  { name: 'CANEX by Afreximbank', logo: '/logos/canex.png' },
  { name: 'GiZ', logo: '/logos/giz.png' },
  { name: 'Intra-African Trade Fair', logo: '/logos/iatf.png' },
  { name: 'Kenya Bureau of Standards', logo: '/logos/kebs.jpeg' },
  { name: 'INTA', logo: '/logos/inta.jpeg' },
];

export const ROLES = [
  { title: 'Chairperson', org: 'Copyright Tribunal, Kenya', note: 'Kenya’s specialised court under Section 48 of the Copyright Act (CAP 130).' },
  { title: 'Founder & Managing Consultant', org: 'MyIP Legal Studio', note: 'Boutique advisory for Africa’s creative, digital, technology and energy sectors.' },
  { title: 'Interim Chairperson', org: 'Kenya Fashion Council', note: 'Also Head of its Legal, Policy and Intellectual Property portfolio.' },
  { title: 'Adjunct Faculty', org: 'Strathmore University Law School', note: 'Teaches Media and Entertainment Law. Tutor with CopyrightX (HarvardX – Kenya).' },
  { title: 'Chair', org: 'IP Technical Committee, KEBS', note: 'Standards, compliance and certification across sectors.' },
  { title: 'Head of Legal', org: 'Partners Against Piracy', note: 'Volunteer role in anti-piracy and enforcement.' },
  { title: 'Former Board Member', org: 'NuPEA', note: 'Chaired the HR & General Purpose, Finance & Strategic Planning, and Audit Committees.' },
  { title: 'Member', org: 'International Trademark Association', note: 'Served on the Anti-Counterfeiting Committee and Programming Council.' },
];

export const PRACTICE = [
  { n: '01', c: '#0c6b9d', title: 'Intellectual property', body: 'Copyright, trademarks and brand strategy, licensing and technology transfer for creative and technology businesses.' },
  { n: '02', c: '#14213d', title: 'Media & entertainment', body: 'Rights, licensing and compliance across music, film, broadcasting and digital platforms.' },
  { n: '03', c: '#c4372c', title: 'Fashion law', body: 'Design and brand protection, traditional cultural expressions and industry policy.' },
  { n: '04', c: '#b07d1a', title: 'Anti-counterfeiting', body: 'Supply-chain IP risk, cross-border enforcement and digital trade.' },
  { n: '05', c: '#5b3424', title: 'Governance & regulation', body: 'Board leadership, policy alignment and risk management in high-compliance environments.' },
  { n: '06', c: '#2b2a30', title: 'Dispute resolution', body: 'Mediation and arbitration, with judicial experience on licensing and commercial rights.' },
];

export const EDUCATION = [
  { title: 'LL.M. Intellectual Property Law', inst: 'University of Turin & WIPO', code: 'LLM' },
  { title: 'LL.B.', inst: 'Catholic University of Eastern Africa', code: 'LLB' },
  { title: 'Postgraduate Diploma', inst: 'Kenya School of Law', code: 'PGD' },
  { title: 'IP management, mediation, arbitration, fashion law', inst: 'WIPO Academy · Fordham University School of Law', code: 'CERT' },
];

/**
 * Recognition. `logo: null` shows the name as text.
 * - Africa Legal Innovation Awards: year per the profile PDF (2022); the logo artwork says 2021. See CONTENT-TODO.md.
 * - Top 25 Women in Digital: the supplied logo is the SOMA Awards logo, so text only until the right one arrives.
 */
export const AWARDS: { name: string; detail: string; logo: string | null }[] = [
  { name: 'Chambers and Partners', detail: 'Band 3 · IP · 2026', logo: '/logos/chambers.png' },
  { name: 'World Trademark Review', detail: 'Bronze · 2024–2026', logo: '/logos/wtr.png' },
  { name: 'Africa Legal Innovation Awards', detail: 'IP Lawyer of the Year · 2022', logo: '/logos/africa-legal.webp' },
  { name: 'WIPR Diversity', detail: 'Beacon of Light · 2022', logo: '/logos/wipr.png' },
  { name: 'WIPR Diversity', detail: 'Shining Lights · 2021', logo: '/logos/wipr.png' },
  { name: 'Business Daily', detail: 'Top 40 Under 40 Women · 2018', logo: '/logos/business-daily.png' },
  { name: 'Top 25 Women in Digital', detail: 'Kenya', logo: null },
  { name: 'INTA', detail: 'Committee member', logo: '/logos/inta.jpeg' },
];
export const AWARD_TILT = [-1.6, 1.2, -0.8, 1.8, -1.2, 0.9, -1.8, 1.4];

export const MEDIA = [
  { name: 'BBC', src: '/media/bbc.png', h: 34 },
  { name: 'CNN', src: '/media/cnn.svg', h: 36 },
  { name: 'Financial Times', src: '/media/ft.png', h: 64 },
  { name: 'CGTN', src: '/media/cgtn.png', h: 28 },
  { name: 'CCTV', src: '/media/cctv.png', h: 30 },
  { name: 'NTV Kenya', src: '/media/ntv.jpeg', h: 50 },
  { name: 'Sunday Nation', src: '/media/sunday-nation.jpeg', h: 64 },
];

export const CATEGORIES = ['Copyright', 'Trademarks', 'Entertainment', 'Fashion law', 'Governance', 'Life & Times'] as const;

export const ENQUIRY_KINDS = ['Keynote', 'Panel', 'Moderation', 'Advisory'] as const;

export const AUTHOR_ROLES = [
  { org: 'Copyright Tribunal, Kenya', role: 'Chairperson' },
  { org: 'MyIP Legal Studio', role: 'Founder' },
  { org: 'Strathmore University Law School', role: 'Adjunct Faculty' },
];

export const LOOKBOOK_COLLECTIONS = ['Advocate', 'Lecturer', 'Fashion', 'Editorial'] as const;
