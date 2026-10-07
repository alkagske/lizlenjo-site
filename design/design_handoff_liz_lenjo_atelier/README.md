# Handoff: Liz Lenjo — "Atelier" website (Home + Liz Notes blog + Workroom CMS)

## Overview
Personal website for **Liz Lenjo, Esq.** — Advocate of the High Court of Kenya, Chairperson of the Copyright Tribunal, Founder of MyIP Legal Studio, Interim Chair of the Kenya Fashion Council, Adjunct Faculty at Strathmore Law School.

The "Atelier" concept frames the site as a tailor's workroom: pattern-paper grid, tape-measure rules, dashed stitch lines, garment care labels, fabric swatches with pinked edges, swing tags, chalk handwriting, vintage line-art notions (scissors, spool, thimble, needle, safety pins). It expresses Liz's distinct position: a lawyer working at the intersection of IP and fashion.

Three surfaces:
1. **Home** — profile, slider, roles, practice, scholarship, speaking, recognition, media, enquiry form.
2. **Liz Notes (reader)** — blog index, archive, article view.
3. **Workroom (author CMS)** — posts list, rich editor, calendar, comment moderation, insights. Only Liz uses it (behind auth).

## About the design files
The `.dc.html` files in this bundle are **design references built in HTML** — prototypes showing the intended look and behaviour, **not production code to copy directly**. They run in a browser via `support.js` (a small runtime for the prototype format — do not ship it). Open them directly to inspect.

Recreate these designs in the target codebase's environment. If there isn't one yet, the recommended stack (the designs reference it in copy) is:
- **Astro** or **Next.js** front end, deployed on **Cloudflare Pages/Workers**
- **Cloudflare D1** for posts, series, comments, versions, subscribers
- **Cloudflare Images / R2** for covers and photos
- **Cloudflare Access** protecting `/workroom`
- **Cloudflare Turnstile** on comment + enquiry forms; **Workers AI** text classification to score comment spam
- **Cloudflare Web Analytics** (cookieless) + a small custom beacon for scroll depth ("read to the end")
- Email: any provider (Resend, Buttondown, Mailchimp) for newsletter + enquiry notifications

The in-prototype mode switcher ("Site / Workroom" pill at bottom of Liz Notes) is a **prototype convenience only** — in production these are separate routes (`/notes`, `/workroom`).

## Fidelity
**High-fidelity.** Final colours, type, spacing, copy and interactions. Recreate pixel-accurately. Blog posts, comments, stats and the calendar entries are **sample data** — replace with real content.

---

## Design tokens

### Colours
| Token | Hex | Use |
|---|---|---|
| ink / navy | `#14213d` | Primary text, borders, dark sections, buttons |
| cobalt (brand) | `#0c6b9d` | Labels, links, accents, primary CTA |
| paper | `#fbfaf7` | Page background |
| grid line | `#ebe8f0` | 32px pattern-paper grid |
| white | `#ffffff` | Cards, labels, strips |
| chalk red | `#c4372c` | Handwritten notes, pins, "Clear" |
| body text | `#1f2a44` | Article body |
| secondary text | `#3a4256` / `#4a5268` | Paragraph/secondary copy |
| muted | `#6a7186` | Meta labels |
| faint | `#8a90a0`, `#9aa1b3`, `#b9bfcc`, `#c9cdd8`, `#d4d7e0`, `#e1e3ea` | Placeholders, dashed rules |
| light-on-dark | `#d4d8e2`, `#aab1c2`, `#7f88a0`, `#8fc3e0` | Footer text/links |
| denim base | `#26406b` | Scholarship section |
| denim stitch | `#d9902f` | Orange topstitching (2px dashed) |
| cutting mat | `#2f4a3f` | Workroom background |
| mat text | `#cfe0d6` | Workroom labels on mat |
| swatches | `#0c6b9d`, `#14213d`, `#c4372c`, `#b07d1a`, `#5b3424`, `#2b2a30` | Practice swatches |
| status | published `#2f7d4f`, scheduled `#0c6b9d`, draft `#b9b4ad`; spam `#b3261e` | Workroom |
| calendar chips | published `#dcebe1`/`#1f5b37`, scheduled `#d6e7f2`/`#0b5a84`, draft `#eceae6`/`#4a5268` | |

### Typography (Google Fonts)
- **Instrument Serif** 400 (+ italic) — all display/headlines, titles, card names. Sizes: H1 `clamp(40px,5.2vw,68px)` lh 1; H2 `clamp(34px,4vw,52px)` lh 1.02; card titles 21–27px.
- **IBM Plex Mono** 400/500 — all labels, nav, buttons, meta. 9–11px, UPPERCASE, letter-spacing `.12em–.2em`.
- **Manrope** 300/400/500 — body. 15px / lh 1.7 base; article body 17px / lh 1.85 (user-adjustable 15/17/20).
- **Caveat** 500/600 — chalk handwriting notes, 19–26px, colour `#c4372c`, rotated −1.5° to −5°.

### Spacing & shape
- Page padding `clamp(20px,4vw,56px)`; content max-width `1240px` (home), `1200px` (blog index), `1180px` (article).
- Section vertical padding `clamp(80px,10vw,140px)`.
- **Buttons: border-radius 6px.** Chips/tags 4px. Fixed mode pill 999px. Cards/labels: square corners.
- Care-label card: `1px solid #14213d` border + `outline:1px dashed #14213d; outline-offset:-8px` + hard shadow `4px 4px 0 #14213d` (hover: translate(−3px,−3px), shadow `7px 7px 0 #0c6b9d`).
- Stitch rule: `1px dashed` in `#14213d` or `#9aa1b3`.
- Pattern paper background: `linear-gradient(#ebe8f0 1px,transparent 1px), linear-gradient(90deg,#ebe8f0 1px,transparent 1px)` at `32px 32px` on `#fbfaf7`.
- Tape-measure rule (under header): 10px tall, top border 1px navy, minor ticks every 8px (4px tall), major ticks every 40px (9px tall). Fills with cobalt (`scaleX`) as reading/scroll progress.
- Easing: `cubic-bezier(.4,0,.2,1)` (UI), `cubic-bezier(.2,.7,.2,1)` (lifts). Respect `prefers-reduced-motion`.

---

## Screen 1 — Home (`Home Atelier.dc.html`)

**Header (sticky):** 3-column grid — left nav (About, Liz Notes), centre logo (`logo-9-crop.png`, 46px → 36px when scrolled), right CTA "Book Liz to speak" (dashed cobalt border → solid fill on hover). Height 78px → 60px after 40px scroll, soft shadow appears. Tape-measure rule below fills with page scroll progress.

**Slider:** 16:9, `max-height: calc(100vh − 170px)`, navy backdrop. 7 slides crossfade (1200ms) every 6s (prop `interval` 3–12s, `autoplay` toggle). Order: Advocate (`slides/advocate.png`), Portrait (`reflection-1920.jpg`), Lecturer (`slides/lecturer.png`), At the piano (`piano-1920.jpg`), Fashion (`slides/fashion.png`), In red (`red-twirl-1920.jpg`), Model (`slides/model.png`). The four full-figure slides use `object-position: 50% 12%` so faces never crop. Corner crop marks (28px L-brackets offset −10px). Dashed white countdown bar along bottom. Pauses on hover; arrow keys; swipe on touch.
Controls row: "✂ – – – – Look 03 / 07 · Lecturer" (mono, cobalt), pin dots, two square dashed arrow buttons.
**Spec strip** below: white bordered 4-cell row — CLIENT: Liz Lenjo, Esq. · CLOTH: Intellectual property · CUT: Entertainment & fashion law · ORIGIN: Nairobi, Kenya.

**Pattern No. 01 — The Advocate:** 2-col. Scissors line-art beside label. H1 "Law, cut to measure for Africa's *creative industries.*" (italic part cobalt with chalk-red underline stroke). Chalk note "bespoke, never off the rack ↘" above right. Right column (dashed left rule): two bio paragraphs + "✂ Read the full profile".

**Partners strip ("Selvedge · worked with"):** white band, navy top/bottom borders, inner dashed lines 6px in (selvedge). Marquee 42s linear infinite, pause on hover. Logos greyscale 75% → colour on hover: WIPO, CANEX, GiZ, IATF, KEBS, INTA.

**Pattern No. 02 — The Offices:** spool line-art; H2 "Current roles, *label by label.*" 8 care-label cards (title mono / org serif 25px / divider / note): Copyright Tribunal (Chairperson), MyIP Legal Studio (Founder & Managing Consultant), Kenya Fashion Council (Interim Chairperson), Strathmore Law School (Adjunct Faculty), KEBS IP Technical Committee (Chair), Partners Against Piracy (Head of Legal), NuPEA (Former Board Member), INTA (Member).

**Pattern No. 03 — The Practice:** white band. Thimble line-art. H2 "Six swatches of *practice.*" + chalk "pinned for the season's fittings" + CTA "Work with MyIP Legal Studio ↗". 6 swatches: 150px colour block with pinked top edge (zig-zag clip-path), subtle twill texture, red pin head top-left, "SWATCH 0n" + hex label; title + description.

**Pattern No. 04 — The Denim (Scholarship):** denim texture (layered diagonal repeating gradients on `#26406b`) with two rows of orange dashed topstitching at top and bottom. Left: thesis title in italic serif — "Inspiration versus Exploitation: Traditional Cultural Expressions at the Hem of the Fashion Industry" (Marquette IP Law Review). Right: "COMPOSITION" garment label listing LL.M. (Turin & WIPO), LL.B. (CUEA), PGD (Kenya School of Law), certificates; footer "MADE IN NAIROBI · TURIN · GENEVA"; white safety pins above its corner.

**Pattern No. 05 — The Runway · Speaking:** H2 + paragraph + primary CTA "Invite Liz to speak →" (anchors to #enquire).

**Pattern No. 06 — The Tags (Recognition):** needle line-art; chalk "hover to straighten". 8 swing tags hanging on 1px strings, each rotated ±1–2°, straightens on hover; tag shape clip-path with punched hole; logo, name, detail: Chambers (Band 3 · IP · 2026), WTR (Bronze 2024–2026), Africa Legal Innovation Awards (IP Lawyer of the Year 2022 — **confirm year: logo says 2021**), WIPR Diversity ×2 (2022, 2021), Business Daily Top 40 Under 40 (2018), Top 25 Women in Digital (**confirm logo**), INTA.

**Pattern No. 07 — In the media:** reverse-direction marquee (38s): BBC, CNN, FT, CGTN, CCTV, NTV, Sunday Nation.

**Footer (#enquire), navy:** "THE ORDER BOOK" — "Invite Liz to speak, moderate *or advise.*" Enquiry card (care label, cobalt hard shadow): header "ENQUIRY · NO. LL-YYYY-0nnn", type chips Keynote/Panel/Moderation/Advisory (single select), Name*, Email*, Event/date/city, "Send enquiry →". Success: "ORDER RECEIVED — Thank you. Liz's office will be in touch." Link columns (Site / Follow / Liz Notes by email with inline subscribe). Bottom: woven label with white logo + "MADE IN KENYA"; © 2026 · live Nairobi time (EAT) · Privacy · Back to top. Floating round back-to-top button appears after 1.2 viewport heights.

Sections fade/slide in (28px, 1s) on first intersect.

## Screen 2 — Liz Notes reader (`Liz Notes Atelier.dc.html`, mode "Site")

**Header:** nav About / Liz Notes, centre logo 40px, "Speaking" button. Tape-measure rule = article reading progress.

**Index:** label "PATTERN BOOK — LIZ NOTES"; H1 "Notes on entertainment, fashion and *intellectual property law.*"
- Search (full text incl. body) with `/` keyboard hint — pressing `/` anywhere focuses it. Result count.
- Category chips **multi-select** (All clears). Sort Newest/Oldest. "Clear ×" when filters active. Grid/Archive segmented toggle.
- **Grid:** featured latest post (3:2 cover, chalk "fresh off the cutting table ↓", title, excerpt, series chip, "Read · n min"); then 3-col cards ("PIECE 0n · cover image", cat/date, title, excerpt, series chip).
- **Archive:** per year — big serif year + count; months in cobalt mono; rows title ↔ "CAT · 14 Nov".
- Empty: italic "Nothing matches that search yet."

**Article:**
- Centred header: ← All posts, cat/date/read, H1, italic standfirst, author byline; 16:8 cover.
- **Left sticky rail (170–190px):** "n min left" (updates with scroll), Contents (H2s; active section cobalt with 2px left rule; click smooth-scrolls), Text size (3 "A" buttons → 15/17/20px, persisted in localStorage), Share (LinkedIn, Copy link) + chalk "select any line to quote it".
- **Series box** (if part of a pattern set): care label — "PATTERN SET · Part 2 of 3", series name, numbered list with current highlighted; prev/next part buttons after body.
- **Body:** 640px measure; drop cap on first paragraph (76px cobalt serif); H2s; pull quotes; image figures with mono captions; stitch divider (✂ + dashed line).
- **Margin notes:** 200px right column, Caveat 22px chalk red, dashed left rule, slight rotation; aligned to their paragraph; wrap beneath on narrow screens.
- **Highlight-to-share:** selecting >8 chars shows a dark floating toolbar above the selection — "Quote on LinkedIn" (copies quote + URL, opens share), "Post on X" (intent URL with quote), "Copy quote". Hides on scroll/deselect.
- Tags; **author card** (care label, cobalt shadow): photo, "Written by Liz Lenjo, Esq.", 3 role rows, "Book Liz to speak on {category} →", "Follow on LinkedIn ↗".
- **Conversation:** approved comments; form Name/Email/Comment; Turnstile note; post-submit "Thank you. Your comment will appear once it has been reviewed."
- **Keep reading** (chalk "cut from the same cloth"): 3 related posts scored by series (+3), same category (+2), shared tags (+1), each labelled with the reason.
- Footer: newsletter subscribe, logo, links.

## Screen 3 — Workroom (mode "Workroom"; production route `/workroom`, Cloudflare Access)

Layout: navy sidebar (logo, "WORKROOM", nav Posts / Calendar / Comments / Insights with counts, "New post", signed-in footer, "View site ↗") + main area on a green self-healing cutting mat (`#2f4a3f` with 20px minor / 100px major white grid lines at 8% / 16%).

**Posts:** H1 "Posts"; status filters All/Published/Scheduled/Draft with counts; white table (Title serif, Category, Status dot, Date / "Goes live …"). Row click opens editor.

**Editor:**
- Top bar: ← Posts · autosave status (amber dot "Saving…" → green "Autosaved · HH:MM") · view toggle **Write / Desktop / Mobile / LinkedIn** · primary button (label follows mode: Save draft / Publish / Schedule).
- Write view: cover drop zone, title (serif 32–48px), standfirst (italic), sticky toolbar (B, I, H, ¶, “, ✎ margin note, •, ↗ link) + chalk hint "type / for headings, notes, citations…", contenteditable body.
- **Slash commands:** typing `/` at the start of an empty block opens a menu at the caret (filter as you type; ↑/↓, Enter, Esc): Heading, Pull quote, Margin note, Case citation ("See: "), Image, Stitch divider, List.
- Desktop/Mobile preview: framed render of the current draft (mobile 390px, 34px radius). LinkedIn preview: realistic post card + chalk tip about 70-char titles.
- Side panel: Publishing (draft / now / schedule + datetime), Category, **Pattern set** select, Tags, URL slug preview, **Version history** (word count; list of autosaves and the published version; Restore).
- Storage format for body blocks (used in prototype): `#` heading, `>` quote, `^` margin note (attaches to preceding block), `!` image caption, `---` divider, plain = paragraph. In production store structured JSON (e.g. Portable Text / TipTap JSON) with a `marginNote` node type.

**Calendar:** month grid Mon–Sun, today highlighted cobalt; post chips coloured by status. Drag a scheduled chip to another day to reschedule; drag an "Unscheduled draft" from the side panel onto a day to schedule it (status → Scheduled, date set). Published chips are not draggable (click to open). Month prev/next.

**Comments:** queue sorted by spam score; each card shows name, post, time, text, score bar + verdict ("Likely spam · 94%" / "Looks genuine · 6% spam"); Approve / Delete.

**Insights:** "Last 30 days · Cloudflare Web Analytics, no cookies". Tiles: Reads, Read to the end (avg %), New subscribers. Table per post: reads, read-to-end bar, sign-ups, 14-day bar sparkline. Footnote defining read-to-end (scrolled past final paragraph).

---

## State & data model (suggested)
- `posts(id, slug, title, excerpt, category, tags[], body_json, cover_image_id, status: draft|scheduled|published, publish_at, published_at, series_id, series_order)`
- `series(id, name)`
- `post_versions(id, post_id, title, body_json, created_at, kind: autosave|published)` — autosave debounced ~900ms, keep last N.
- `comments(id, post_id, name, email, text, created_at, status: pending|approved, spam_score)`
- `subscribers(email, created_at, source_post_id)` — powers sign-ups per post.
- `enquiries(id, type, name, email, event, created_at)`
- `post_stats_daily(post_id, date, reads, completions, signups)`
- Reader client state: search query, selected categories[], sort, layout (grid|archive), text size (localStorage `ll-notes-fs`), active heading, minutes left, selection-share popover.
- Scheduled publishing: a Cron Trigger flips `scheduled → published` when `publish_at <= now`.

## Responsive
All layouts are fluid (auto-fit grids, flex-wrap). Tested down to ~360px: article rail stacks above body, margin notes drop under paragraphs, tables scroll horizontally in the Workroom, header nav stays on one row.

## Assets (in `assets/`)
- Logos: `logo-9-crop.png` (blue script), `logo-white-crop.png` (white script).
- Photos: `reflection-1920.jpg`, `piano-1920.jpg`, `red-twirl-1920.jpg`; slider cut-outs `slides/advocate.png`, `slides/lecturer.png`, `slides/fashion.png`, `slides/model.png` (supplied by client).
- Partner & award logos: `logos/` (wipo, canex, giz, iatf, kebs, inta, chambers, wtr, africa-legal, wipr, business-daily, top25digital). KEBS is a JPEG with white bg — a transparent version would be cleaner.
- Media logos: `media/` (bbc, cnn.svg, ft, cgtn, cctv, ntv, sunday-nation).
- Line-art notions (public domain, Pearson Scott Foresman via Wikimedia Commons) are **hotlinked** in the prototype — download and self-host: `Scissors3 (PSF).svg`, `Spool (PSF).png`, `Thimble (PSF).png`, `Needle (PSF).png`, `Safety Pins(PSF).png` from `https://commons.wikimedia.org/wiki/Special:FilePath/<name>`.
- Blog cover images are placeholders (striped boxes) — real covers needed.

## Files
- `Home Atelier.dc.html` — home page (template markup + `class Component` logic at the bottom contains all content arrays: slides, roles, practice, education, awards, partners, media).
- `Liz Notes Atelier.dc.html` — blog reader + Workroom (sample posts, series, comments, stats in the script block).
- `support.js` — prototype runtime only, needed to open the files locally. Not for production.

## Open items for the client
1. Africa Legal Innovation Awards year (2021 on logo vs 2022 in profile).
2. Confirm Top 25 Women in Digital logo (file supplied is SOMA Awards).
3. Real blog posts, cover images and newsletter provider.
4. Privacy page copy.
