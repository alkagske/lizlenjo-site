# lizlenjo.com

The personal website of **Liz Lenjo, Esq.**, built in the "Atelier" design: a tailor's workroom of pattern paper, tape measures, care labels and chalk notes.

| Part | Address | What it is |
|---|---|---|
| Site | `/`, `/about`, `/lookbook`, `/privacy` | Home, full profile, photo lookbook, privacy notice |
| Liz Notes | `/notes`, `/notes/<slug>`, `/notes/rss.xml` | The blog: search, categories, archive, articles, comments |
| Workroom | `/workroom` | Liz's private writing room: posts, editor, calendar, comments, insights, lookbook, subscribers |

**Stack:** Astro 5 on Cloudflare Workers, with D1 (database), R2 (images), Workers AI (comment spam scoring), Turnstile (form spam protection), Cloudflare Access (Workroom sign-in) and Resend (email).

- The design source of truth is `design/design_handoff_liz_lenjo_atelier/`. The build plan is `PLAN.md`.
- Items waiting on Liz are listed in **`CONTENT-TODO.md`**.

---

## Contents

1. [The owner's checklist (do this once, in order)](#the-owners-checklist)
2. [How Liz writes a post](#how-liz-writes-a-post)
3. [Local development](#local-development)
4. [Database migrations](#database-migrations)
5. [How deploys work](#how-deploys-work)
6. [Settings and secrets reference](#settings-and-secrets-reference)
7. [Tests and CI](#tests-and-ci)
8. [Project layout](#project-layout)
9. [Troubleshooting](#troubleshooting)

---

## The owner's checklist

Do these steps once, in this order. Each step says exactly where to click. You need a Cloudflare account (free is fine) and access to the GitHub repository `alkagske/lizlenjo-site`.

> **Tip:** keep a note open as you go. You will copy six values (marked 📋) into Cloudflare in Step 6.

### Step 0. Put the finished code on the `main` branch

The build was done on a branch called **`main-wy8juq`**. Cloudflare will deploy from **`main`**.

1. Open <https://github.com/alkagske/lizlenjo-site>.
2. GitHub shows a yellow bar: "main-wy8juq had recent pushes". Click **Compare & pull request**. (If there is no bar: click **Pull requests** → **New pull request**, set *base* to `main` and *compare* to `main-wy8juq`.)
3. Click **Create pull request**, wait for the green tick ("All checks have passed"), then click **Merge pull request** → **Confirm merge**.

### Before Step 1: the WordPress content is already copied ✅

Liz's 69 posts, 169 comments and their images were copied from the old WordPress site on 9 October 2026 (see [Importing from WordPress](#importing-from-wordpress)). A full backup of all 689 WordPress uploads is stored as a GitHub Actions artifact until 7 January 2027. Once the nameservers change, the old WordPress site stops answering, so do not run the import again after Step 1.

### Step 1. Add lizlenjo.com to Cloudflare

1. Sign in at <https://dash.cloudflare.com>.
2. Click **Add a domain** (on the home page), type `lizlenjo.com`, choose **Quick scan for DNS records**, then pick the **Free** plan.
3. Cloudflare shows **two nameservers** (for example `ada.ns.cloudflare.com` and `bob.ns.cloudflare.com`). 📋 Copy them.
4. Sign in where you bought the domain (your registrar). Find **Nameservers** / **DNS servers**, choose **custom nameservers**, delete the old ones and paste the two from Cloudflare. Save.
5. Back in Cloudflare, click **Check nameservers now**. It can take from a few minutes to 24 hours. Cloudflare emails you when `lizlenjo.com` is **Active**. You can carry on with Steps 2–5 while you wait.

### Step 2. Turn on R2 storage (one-time)

R2 holds the photos and post images. It is free up to 10 GB, but Cloudflare asks you to activate it once.

1. In the left menu: **Storage & databases** → **R2 object storage**.
2. If you see **Purchase R2** or **Get started**, follow it. You may be asked for a card; the free tier is not charged.
3. You do **not** need to create a bucket. The first deploy creates `lizlenjo-media` automatically.

### Step 3. Connect GitHub so every push deploys (Workers Builds)

1. Left menu: **Compute (Workers)** → **Workers & Pages** → **Create** → **Import a repository** (the "Workers" tab).
2. Click **Connect GitHub** (first time only), allow access to `alkagske/lizlenjo-site`, then select that repository.
3. Fill in the form exactly like this:

   | Field | Value |
   |---|---|
   | Project name | `lizlenjo-site` *(must match exactly)* |
   | Production branch | `main` |
   | Build command | `npm run build` |
   | Deploy command | `npm run deploy` |
   | Non-production branch deploy command | `npx wrangler versions upload` |
   | Root directory | *(leave empty)* |

4. Under **Advanced settings → Build variables** add `NODE_VERSION` = `22`.
5. Click **Create and deploy**. The first build takes about three minutes. It creates the database (`lizlenjo-db`), the media bucket (`lizlenjo-media`), loads the database tables and the sample draft posts, and publishes the site at an address like `https://lizlenjo-site.<your-name>.workers.dev`.
6. Open that address. The home page should appear. (`/workroom` will say **"This room is locked"**. That is correct until Step 5.)

### Step 4. Point lizlenjo.com at the site

Wait until Step 1 shows the domain as **Active**.

1. **Workers & Pages** → **lizlenjo-site** → **Settings** → **Domains & Routes** → **Add** → **Custom domain** → type `lizlenjo.com` → **Add domain**.
2. Do it again for `www.lizlenjo.com`.
3. Send `www` to the main address: left menu → choose the `lizlenjo.com` domain → **Rules** → **Overview** → **Create rule** → **Redirect rule** → pick the template **Redirect from WWW to root** → **Deploy**.
4. Visit `https://lizlenjo.com` and `https://www.lizlenjo.com` (the second should land on the first).

### Step 5. Lock the Workroom with Cloudflare Access

This makes `lizlenjo.com/workroom` ask for Liz's email and a one-time code. No passwords to remember.

1. Left menu: **Zero Trust**. First time only: choose a **team name** (for example `lizlenjo`), pick the **Free** plan, and finish the sign-up. 📋 Your **team domain** is `<team name>.cloudflareaccess.com` (shown under **Settings → Custom pages** if you need it again).
2. **Access** → **Applications** → **Add an application** → **Self-hosted**.
3. **Application name:** `Workroom`. **Session duration:** `1 week` (or as you prefer).
4. Under **Public hostname / Destinations** add two entries:
   - Domain `lizlenjo.com`, path `workroom*`
   - Domain `lizlenjo.com`, path `api/admin*`
5. **Next** → **Add a policy**: name `Liz only`, action **Allow**, rule **Include → Emails →** Liz's email address (add yours too if you will help her). Save.
6. **Login methods:** make sure **One-time PIN** is ticked.
7. Save the application. Open it again and go to **Overview** (or **Basic information**). 📋 Copy the **Application Audience (AUD) Tag**, a long string of letters and numbers.

### Step 6. Add the settings and secrets

All six values are stored as encrypted secrets. They survive every future deploy.

**First get the two remaining values:**

- **Turnstile** (spam protection on the forms): left menu **Turnstile** → **Add widget** → name `lizlenjo.com`, add hostnames `lizlenjo.com` and your `workers.dev` address, widget mode **Managed** → **Create**. 📋 Copy the **Site key** and the **Secret key**.
- **Resend** (sends enquiry emails to Liz and newsletter confirmations):
  1. Create a free account at <https://resend.com>.
  2. **Domains** → **Add domain** → `lizlenjo.com`. Resend lists 3–4 DNS records. Click **Auto configure** / **Sign in to Cloudflare** if offered; otherwise, in Cloudflare go to the `lizlenjo.com` domain → **DNS** → **Records** → **Add record** and copy each one exactly (type, name, value). Wait until Resend shows **Verified**.
  3. **API Keys** → **Create API key** → permission **Sending access**, domain `lizlenjo.com`. 📋 Copy the key (it starts with `re_`).

**Then add them:** **Workers & Pages** → **lizlenjo-site** → **Settings** → **Variables and Secrets** → **Add**. For each row below choose **Type: Secret**, paste the value, and click **Deploy** when done.

| Name | Value |
|---|---|
| `ACCESS_TEAM_DOMAIN` | your team domain, e.g. `lizlenjo.cloudflareaccess.com` |
| `ACCESS_AUD` | the Application Audience (AUD) Tag from Step 5 |
| `ADMIN_EMAILS` | Liz's email (several? separate with commas) |
| `TURNSTILE_SITE_KEY` | Turnstile site key |
| `TURNSTILE_SECRET_KEY` | Turnstile secret key |
| `RESEND_API_KEY` | the Resend key (`re_…`) |
| `ENQUIRY_TO` | the email address that should receive speaking enquiries |

Optional: `MAIL_FROM` (default `Liz Lenjo <notes@lizlenjo.com>`).

### Step 7. Turn on visitor statistics (cookieless)

Left menu → **Analytics & logs** → **Web analytics** → **Add a site** → `lizlenjo.com` → **Automatic setup** → **Done**.

### Step 8. Check everything works

1. `https://lizlenjo.com/workroom` → asks for an email → enter Liz's → a code arrives by email → the Workroom opens.
2. On the home page, send a test enquiry. It should arrive at the `ENQUIRY_TO` address.
3. In the footer, subscribe with your own email. A confirmation email should arrive.
4. In the Workroom, open a sample post, choose **Publish now**, click **Publish**, and check it appears at `/notes`. Then set it back to **Save as draft**.

### Optional extras

- **Faster images for uploads:** domain `lizlenjo.com` → **Images** → **Transformations** → **Enable for zone**. Then add a plain variable `IMAGE_TRANSFORMS` = `on` in **Variables and Secrets**.
- **Hide the workers.dev address after launch:** **Settings** → **Domains & Routes** → turn off `workers.dev`.

---

## How Liz writes a post

1. Go to `lizlenjo.com/workroom` and sign in with the emailed code.
2. Click **New post**. Type a **title** and a one-line **standfirst**.
3. Write in the body. Type **/** at the start of an empty line for: **Heading**, **Pull quote**, **Margin note** (the red handwritten aside), **Case citation**, **Image**, **Stitch divider**, **List**. Use ↑ ↓ and Enter to pick.
4. Click the striped box at the top to add a **cover image** (or drag a photo onto it), and describe it in the alt-text box.
5. On the right: choose a **Category**, optionally a **Pattern set** (series), and **Tags**.
6. Check **Desktop**, **Mobile** and **LinkedIn** previews at the top.
7. Under **Publishing** choose **Publish now** or **Schedule** (pick a date and time, Nairobi time), then click the blue button.

Everything saves automatically every second or so ("Autosaved · 14:32"). **Version history** on the right can restore earlier text. The **Calendar** lets you drag drafts onto a date. **Comments** wait in the queue until approved.

---

## Local development

Requires Node 22.

```sh
npm install
cp .dev.vars.example .dev.vars      # local settings; never commit .dev.vars
npm run db:migrate:local            # create the local database
npm run dev                         # http://localhost:4321
```

- `/workroom` works on localhost without Cloudflare Access because `.dev.vars` sets `DEV_ACCESS_BYPASS=1`. The bypass only works on `localhost`/`127.0.0.1`; it is ignored everywhere else.
- The sample posts are drafts. To see them in Liz Notes locally: `npx wrangler d1 execute DB --local --file tests/e2e/fixtures.sql`.
- Workers AI is not called locally; spam scoring falls back to the built-in heuristics.
- To run the exact production build locally: `npm run build && npx wrangler dev --local`.

## Database migrations

SQL files live in `migrations/` and run in order.

```sh
npx wrangler d1 migrations create DB describe_change   # new empty migration file
npm run db:migrate:local                               # apply locally
npm run db:migrate:remote                              # apply to production (needs Cloudflare login)
```

Production migrations also run automatically on every deploy (`npm run deploy`). Never edit a migration that has already run in production; add a new one.

- `0001_init.sql`: tables. The School tables (`courses`, `modules`, `lessons`, `enrolments`, `progress`) are reserved for Stage 3 and unused.
- `0002_seed_samples.sql`: the prototype's sample posts (**drafts only**, marked `is_sample`) and the seven built-in Lookbook photos.

## How deploys work

1. A push to `main` triggers **Workers Builds** in Cloudflare.
2. It runs `npm run build` (makes Lookbook image sizes, optimises the slider photos, builds the site into `dist/`).
3. It runs `npm run deploy`, which is `wrangler deploy --keep-vars` then `wrangler d1 migrations apply DB --remote`.
4. A cron trigger runs every 5 minutes (`src/worker.ts`) and publishes scheduled posts whose time has come.

Pushes to other branches build a preview version without touching production. GitHub Actions (`.github/workflows/ci.yml`) runs the checks on every push.

## Settings and secrets reference

Nothing secret is in the repository. `wrangler.jsonc` holds only bindings and `SITE_URL`.

| Name | Kind | Required | Purpose |
|---|---|---|---|
| `DB` | D1 binding | yes | Database `lizlenjo-db` |
| `MEDIA` | R2 binding | yes | Bucket `lizlenjo-media` |
| `AI` | Workers AI binding | yes | Comment spam scoring |
| `ASSETS` | Static assets | yes | Prerendered pages and images |
| `SITE_URL` | var | yes | `https://lizlenjo.com` (in `wrangler.jsonc`) |
| `ACCESS_TEAM_DOMAIN` | secret | yes | e.g. `lizlenjo.cloudflareaccess.com` |
| `ACCESS_AUD` | secret | yes | Access application AUD tag. **Without it the Workroom stays locked.** |
| `ADMIN_EMAILS` | secret | recommended | Extra allow-list checked after Access |
| `TURNSTILE_SITE_KEY` | secret | yes | Public widget key (sent to the browser via `/api/config`) |
| `TURNSTILE_SECRET_KEY` | secret | yes | If unset, Turnstile checks are skipped (forms still work, comments still moderated) |
| `RESEND_API_KEY` | secret | yes | If unset, no emails are sent; enquiries are still saved in the database and subscribers are stored as confirmed |
| `ENQUIRY_TO` | secret | yes | Where speaking enquiries are emailed |
| `MAIL_FROM` | secret/var | no | Sender, default `Liz Lenjo <notes@lizlenjo.com>` |
| `IMAGE_TRANSFORMS` | var | no | `on` once Cloudflare image transformations are enabled |
| `DEV_ACCESS_BYPASS` | `.dev.vars` only | no | `1` opens the Workroom on localhost only |

Security notes: the Workroom and `/api/admin/*` are protected twice: by Cloudflare Access at the edge, and by `src/middleware.ts`, which verifies the Access JWT signature, audience, issuer and expiry (and fails closed if Access is not configured). Admin write requests must also come from the same origin.

## Importing from WordPress

The old site's posts were imported once, from a WordPress export (Tools → Export) taken on 7 October 2026.

```sh
node scripts/wordpress/import.mjs extract path/to/export.xml   # → scripts/wordpress/data/wordpress.json (no emails or IPs)
node scripts/wordpress/import.mjs build                        # → migrations/0003_wordpress_import.sql, src/content/wp-redirects.json, images.json
```

- Images used by the posts were downloaded by the **"Copy images from the old WordPress site"** GitHub Action into `public/wp-content/uploads/`, so the old image addresses still work.
- The same run saved every WordPress upload (689 files, 95 MB) as the artifact `wordpress-uploads-backup`. Download it from **GitHub → Actions → Copy images from the old WordPress site → the latest run → Artifacts** before 7 January 2027 and keep it somewhere safe.
- Old addresses redirect permanently: `/<post-slug>/` → `/notes/<post-slug>`, `/about-liz/` → `/about`, `/blog/`, categories, tags and date archives → `/notes`, `/feed/` → `/notes/rss.xml` (`src/lib/redirects.ts`, applied in `src/worker.ts`).
- The raw export file is **not** in the repository because it contains commenters' email addresses.

## Tests and CI

```sh
npm run typecheck        # astro check (TypeScript)
npm test                 # Vitest: related-post scoring, read time, spam threshold, Access JWT, TipTap renderer, scheduling
npm run build
cp tests/e2e/e2e.dev.vars .dev.vars && npm run test:e2e   # Playwright smoke tests at 1440 px and 375 px
```

The Playwright tests start `wrangler dev --local`, load `tests/e2e/fixtures.sql` (publishes the sample posts **in the local test database only**) and cover Home, About, Lookbook, Privacy, 404, Liz Notes, articles, comments, RSS and the Workroom (editor, slash menu, autosave, publish, calendar drag, moderation). CI runs all of this on every push.

Other scripts:

- `npm run notions:fetch`: re-download the public-domain line-art notions from Wikimedia Commons (also available as the "Fetch line-art notions" GitHub Action).
- `node scripts/og-default.mjs`: re-render the default social-share image.
- `node scripts/gen-seed.mjs`: regenerate the sample-post seed migration.

## Project layout

```
astro.config.mjs        Astro + Cloudflare adapter (static pages, on-demand routes, custom worker entry)
wrangler.jsonc          Worker name, bindings (D1, R2, AI), cron, assets
migrations/             D1 SQL migrations
public/                 logos, media logos, notions (line art), icons, _headers, robots.txt
scripts/                build-time image sizes, notions fetcher, OG image, seed generator
src/
  worker.ts             fetch handler + cron publisher
  middleware.ts         Access JWT check, www redirect, security headers
  content/site.ts       all profile facts, roles, awards, slides (from the 2026 profile PDF)
  layouts/              Base, Notes, Workroom
  components/           header, footers, slider, notions
  islands/              Preact: NotesIndex, editor/ (TipTap), Calendar, LookbookManager
  pages/                routes (index, about, lookbook, privacy, notes/*, workroom/*, api/*)
  lib/                  access, spam, related, readtime, tiptap renderer, db, email, turnstile, media, seo
  styles/               tokens, atelier, notes, workroom
tests/unit, tests/e2e   Vitest and Playwright
design/                 the design handoff and client documents (not deployed)
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| `/workroom` says "This room is locked (access not configured)" | `ACCESS_TEAM_DOMAIN` or `ACCESS_AUD` is missing. Step 6. |
| "This room is locked (wrong audience)" | `ACCESS_AUD` does not match the Access application's AUD tag. Copy it again. |
| "This room is locked (missing token)" | You opened the workers.dev address, or the Access application paths do not cover this URL. Use `lizlenjo.com/workroom` and check Step 5.4. |
| Enquiry form says "Please complete the spam check" | Turnstile keys are wrong, or the hostname is not listed on the Turnstile widget. |
| No enquiry emails | Check `RESEND_API_KEY`, `ENQUIRY_TO`, and that the domain shows **Verified** in Resend. Enquiries are still saved in the database. |
| Build fails at "migrations apply" | Usually a permissions issue on the first run. In **Workers & Pages → lizlenjo-site → Settings → Build → API token**, make sure the token has **D1 Edit**; or run `npm run db:migrate:remote` once from a computer logged in with `npx wrangler login`. |
| Build fails creating the R2 bucket | R2 is not activated yet. Step 2, then **Retry build**. |
| A scheduled post did not go live | It publishes within 5 minutes of its time (Nairobi). Check **Workers & Pages → lizlenjo-site → Settings → Trigger events** shows the cron. |
