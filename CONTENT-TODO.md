# Content to confirm or supply

These items need Liz (or her office) before or soon after launch. The site works without them; each one has a safe default in place.

| # | Item | Where it shows | What the site does now | What we need |
|---|------|----------------|------------------------|--------------|
| 1 | **Africa Legal Innovation Awards: year** | Home → Recognition tags, About, structured data | Shows **2022** (from the 2026 profile PDF). The award logo artwork says **2021**. | Confirm the correct year. If it is 2021, change `src/content/site.ts` (AWARDS) and `src/lib/seo.ts`. |
| 2 | **Top 25 Women in Digital: logo** | Home → Recognition tags | Shows the name as **text only**. The supplied file (`design/assets/logos/top25digital.png`) is actually the **SOMA Awards** logo, so it is not used. | Send the correct logo (transparent PNG or SVG). Save it as `public/logos/top25digital.png` and set `logo: '/logos/top25digital.png'` in `src/content/site.ts`. Also confirm the year, if there is one. |
| 3 | **Privacy page copy** | `/privacy` | A plain-English draft written for the Kenya Data Protection Act, 2019, covering the enquiry form, newsletter, comments and cookieless analytics. | Liz to review and approve, or replace with her own text (`src/pages/privacy.astro`). |
| 4 | **Blog posts** | Liz Notes | **Imported from WordPress:** 69 published posts (2013–2026) with their original dates, images and 169 approved comments, plus 1 draft. The 9 prototype **sample** posts are still in the Workroom as drafts (marked "Sample"). | Liz may delete the samples. Posts without a featured image show the striped placeholder cover; she can add covers in the Workroom. |
| 5 | **Editor choice: TipTap instead of Quill** | Workroom editor | Built with TipTap, because the design needs margin notes, pull quotes and slash commands that Quill handles poorly. | Confirm this is fine (it differs from the technical plan document). |
| 6 | **Email provider** | Enquiry notifications, newsletter confirmation | Built for **Resend**. Subscribers are stored in the site's own database and can be exported as CSV from the Workroom. | Confirm Resend, and the address that should receive enquiries. |
| 7 | **Line-art "notions"** | Home section labels, About | **Done.** The original public-domain Pearson Scott Foresman drawings were fetched from Wikimedia Commons by a GitHub Action. | Nothing. |
| 8 | **WIPR Diversity labels** | Recognition tags | Two tags: "Beacon of Light · 2022" and "Shining Lights · 2021" (per the PDF). | Confirm. |
| 9 | **KEBS logo** | Partners strip | JPEG with a white background. Looks fine in the greyscale strip. | Optional: a transparent version would be cleaner. |
| 10 | **Lookbook photos** | `/lookbook` | Shows the seven photos already on the site. | Optional: upload more in Workroom → Lookbook, with captions. |
| 11 | **WordPress categories** | Liz Notes | Mapped to the new set: Entertainment Law → Entertainment; Fashion Law (Africa) → Fashion law; IP Law → Trademarks if about brands/counterfeits, otherwise Copyright; Life & Times, Lifestyle, Motherhood, Uncategorized → **Life & Times** (new category). | Confirm, or re-file posts in the Workroom. |
| 12 | **"Kikao IP" page** | old `lizlenjo.com/kikao-ip` | Not imported; the old address now goes to `/about`. | Should it become a page or a Liz Note? |
| 13 | **Two missing PDFs** | Posts from 2016 (KFCB draft bill) and 2021 (creative-sector financing research) | The PDFs were already missing on the old site (404), so those links stay broken. | Send the PDFs if she still has them. |

