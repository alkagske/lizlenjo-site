# lizlenjo.com — Build Plan

Source material (in `design/`, extracted from `High fashion legal lecturer site.zip`):
- `design/design_handoff_liz_lenjo_atelier/` — **the chosen "Atelier" design** (README = full spec, two `.dc.html` prototypes, assets). Earlier directions (`Home v2/v3`, `Blog.dc.html`, `Character Directions`) are reference only.
- `design/uploads/LizLenjo.com - Technical Plan and Build Architecture.docx` — client's technical plan (3 stages: site → blog → school).
- `design/uploads/profile-2026.pdf` — canonical bio copy and facts.
- `design/uploads/Screenshot 2026-10-07 at 13.59.14.png` — a heading/role-row overlap bug from an earlier iteration. Do not reproduce it (no sticky headings sitting over content lists).

The prototypes run only with `support.js` over HTTP. They are the visual source of truth. Do not ship them.

---

## 1. Decisions

| Area | Choice | Why |
|---|---|---|
| Framework | **Astro 5** + `@astrojs/cloudflare` | Marketing pages prerender to static HTML. Notes, the Workroom and the API run as SSR on Workers. Small JS islands only. |
| Hosting | **Cloudflare Workers (static assets)** on `lizlenjo.com` + `www` → apex redirect | Matches the client's plan. Pushes to GitHub deploy through Workers Builds. |
| Database | **D1** (`lizlenjo-db`) | Posts, series, versions, comments, enquiries, subscribers, stats, photos, and later courses. |
| Media | **R2** (`lizlenjo-media`) + Cloudflare Image Transformations (`/cdn-cgi/image/`) | Covers, inline images and portfolio uploads. Static site photos are optimised at build time with Astro `<Image>`. |
| Editor | **TipTap** (ProseMirror), stored as JSON | The design needs custom nodes (margin note, pull quote, case citation, stitch divider) and slash commands. Quill (named in the tech doc) handles custom block nodes poorly. **This differs from the tech doc, so the client should confirm it.** |
| Workroom UI | Preact islands | Calendar drag-and-drop, the editor and tables. |
| Auth (Workroom) | **Cloudflare Access** on `/workroom*` and `/api/admin/*`. Middleware also verifies the `Cf-Access-Jwt-Assertion` JWT. | Uses an email OTP for Liz and stores no passwords. |
| Spam | **Turnstile** on the comment and enquiry forms, plus **Workers AI** spam scoring of comment text | Per the spec |
| Email | **Resend** for enquiry notifications and newsletter confirmation. Subscribers are kept in D1 (export later to Buttondown or Mailchimp if wanted). | Needs the client's choice |
| Analytics | Cloudflare Web Analytics, plus a `/api/beacon` for read-to-end and daily stats in D1 | Cookieless |
| Scheduling | Cron Trigger every 5 minutes changes `scheduled → published` when `publish_at <= now` | |
| Fonts / line art | Self-hosted (Instrument Serif, IBM Plex Mono, Manrope, Caveat via Fontsource). PSF notions are downloaded into `public/notions/`. | No hotlinking |

## 2. Repo layout

```
/                      Astro project root
  astro.config.mjs     output: 'static' with per-route `prerender = false` for SSR
  wrangler.jsonc       D1, R2, AI, vars, cron, routes for lizlenjo.com
  migrations/          D1 SQL migrations
  src/
    styles/tokens.css  colours, type, spacing (from the README tokens table)
    styles/atelier.css pattern paper, care label, stitch, swatch, tag, denim, tape rule
    components/        Header, TapeRule, Slider, SpecStrip, CareLabel, Swatch, SwingTag,
                       Marquee, Notion (line art), ChalkNote, EnquiryForm, Footer, BackToTop
    content/site.ts    roles, practice, education, awards, partners, media, slides (from the profile PDF)
    pages/
      index.astro              Home
      about.astro              Full profile (NOT DESIGNED: build in the Atelier language)
      lookbook/index.astro     Photo portfolio (NOT DESIGNED: from the tech plan)
      notes/index.astro        Liz Notes index (SSR)
      notes/[slug].astro       Article (SSR, cached)
      notes/rss.xml.ts
      privacy.astro            (copy needed)
      workroom/…               Posts, Editor, Calendar, Comments, Insights, Lookbook manager
      api/                     enquiry, subscribe, comment, beacon, admin/* (posts, upload, comments, photos)
    lib/                       db.ts, access.ts (JWT verify), spam.ts, related.ts, readtime.ts, render-tiptap.ts
  public/                      fonts, notions, logos, media logos, favicon, og defaults
  tests/                       vitest (lib) + playwright (pages and visual checks against prototype)
```

## 3. Data model (D1)

Based on the README model, plus:
- `photos(id, r2_key, caption, collection, sort, width, height, alt, published)` for the Lookbook.
- `courses / modules / lessons / enrolments / progress`: **schema reserved only**. Stage 3 is not built now.
- `posts.body_json` holds TipTap JSON. The `marginNote` node attaches to the preceding block.

## 4. Build phases (each ends deployable)

**Phase 0: Scaffold and infrastructure**
Astro + Cloudflare adapter, `wrangler.jsonc`, D1 migration 0001, R2 bucket, tokens and fonts, CI (typecheck, vitest, build). Deploy a placeholder to a `*.workers.dev` URL.

**Phase 1: Home (pixel-accurate to `Home Atelier.dc.html`)**
Sticky shrinking header with the tape rule showing scroll progress. 7-slide crossfade slider: 6s interval, pause on hover, arrow keys, swipe, crop marks, countdown bar, and faces kept in frame with `object-position: 50% 12%`. Spec strip. Patterns 01–07: advocate, partners marquee, 8 role care-labels, 6 practice swatches, denim scholarship, runway, swing tags, media marquee. Navy footer with the enquiry "order book" (Turnstile → D1 → Resend), subscribe form, live EAT clock and back-to-top. Reveal-on-scroll. `prefers-reduced-motion` respected throughout.

**Phase 2: About + Lookbook + Privacy**
About: full profile from the PDF, laid out as care labels and pattern sections (NuPEA committees, INTA committees, CopyrightX tutoring, consulting for WIPO/CANEX/GiZ/IATF). Lookbook: collections (Advocate, Lecturer, Fashion, Editorial), a masonry layout and a full-screen lightbox with keyboard and swipe support, images served from R2 through transformations.

**Phase 3: Liz Notes reader**
Index with full-text search (`/` to focus), multi-select categories, sort, Grid/Archive views and an empty state. Article page with a sticky rail (minutes left, contents, text size saved in localStorage, share links), series box, drop cap, pull quotes, margin notes, highlight-to-share toolbar, author card, comments with Turnstile, and "Keep reading" scored as series +3 / category +2 / tag +1. RSS feed, JSON-LD `Article`, generated OG images.

**Phase 4: Workroom (behind Access)**
Posts table with status filters. TipTap editor with slash menu, toolbar, cover upload to R2, autosave every 900 ms into versions, Write/Desktop/Mobile/LinkedIn previews, side panel (publishing, category, pattern set, tags, slug, version history and restore). Calendar with drag-to-reschedule and dragging unscheduled drafts onto a day. Comments queue sorted by AI spam score. Insights from `post_stats_daily`. Lookbook manager (upload, caption, reorder). Cron publisher.

**Phase 5: SEO and launch**
JSON-LD `Person` + `LegalService`, sitemap, robots, meta and OG on every page, 404 page. Lighthouse ≥ 95 on Home and Article. Accessibility pass (slider controls, focus states, alt text, contrast). Custom domain cutover, `www` redirect, Access policy live, analytics on.

**Stage 3 (later, not in this build): School.** Learner auth on Workers + D1 sessions, courses with unlisted YouTube lessons, progress tracking, optional Paystack/M-Pesa.

## 5. Content corrections (use the profile PDF as truth)
- Africa Legal Innovation Awards: the PDF says **2022** but the logo says 2021. **Client to confirm.**
- WIPR Diversity: Shining Lights **2021** and Beacon of Light **2022**. The design's "×2" tag needs correct labels.
- WTR Bronze **2024, 2025, 2026**. Chambers **2026, Band 3, IP**. Business Daily Top 40 Under 40 Women **2018**.
- The Top 25 Women in Digital logo file is actually the SOMA Awards logo. **Client to supply the correct logo** (show text only until then).
- Add CopyrightX (HarvardX – Kenya) tutor to the roles and the About page.
- Blog posts in the prototype are **sample data**. Seed them as drafts only, never published.

## 6. Things only the owner can do (blocking for go-live, not for building)
1. Cloudflare account: add the `lizlenjo.com` zone (point nameservers at Cloudflare if the domain is registered elsewhere).
2. Connect the GitHub repo in Workers Builds, or give the build environment a scoped Cloudflare API token (Workers, D1, R2 edit) as a secret.
3. Zero Trust → Access application for `lizlenjo.com/workroom*` and `/api/admin/*`, allowing Liz's email.
4. Turnstile site key and secret.
5. Resend account and API key, with sending-domain DNS records.
6. Confirm the content items in §5, plus privacy copy and real blog posts and covers.

## 7. Definition of done
- Every surface in the handoff README is implemented and visually matches the prototypes at 1440, 1024, 768 and 375 px.
- Enquiry, subscribe and comment work end-to-end in production. Spam scoring and Turnstile are verified.
- Liz can write, schedule, publish, upload photos and moderate comments in `/workroom` without help.
- Tests pass in CI. A README covers local dev, migrations, deploy and adding a post.
