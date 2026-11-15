# Stammtisch-Tracker – Plan

## Context
The Stammtisch data lives in `Stammtisch.xlsx`. It has 4 sheets: **General** has one row per visit. **Location**, **Service** and **Essen_Trinken** each hold one score per rater per visit. We want a small static website that shows these statistics:
- `/`: landing page with overall statistics
- `/brauhaus/[slug]`: one page per restaurant
- `/teilnehmer/[slug]`: one page per participant

The UI is in German. Keep everything as simple as possible: no backend and no database. To update the site, replace the xlsx and rebuild.

## Tech stack (decided)
- **Nuxt 4 + Vue 3 + TypeScript**, built with `nuxt generate` into fully static HTML that can be hosted anywhere (GitHub Pages, Netlify, Cloudflare Pages).
- **shadcn-vue + Tailwind CSS v4** for the UI (Card, Table, Badge, Tabs, NavigationMenu).
- **nuxt-charts** (`nuxt-charts@next`, module `"nuxt-charts"`) for the charts: Bar, Line, Area, Donut, Radar. Charts are wrapped in `<ClientOnly>` if they cause SSR or prerender problems.
- **SheetJS (`xlsx`)** plus **tsx** for a build-time conversion script.
- pnpm.

## Data pipeline
`scripts/convert-xlsx.ts` reads `data/Stammtisch.xlsx` and writes `data/stammtisch.json`. It runs automatically through the `predev`/`prebuild`/`pregenerate` npm scripts. The generated JSON is gitignored.

Parsing rules (based on the actual file):
- **Finding the tables:** In General, the header row is the one where column A = "Brauhaus" (currently row 22). In the rating sheets it is also the row with A = "Brauhaus" (currently row 23). The script finds columns by their header names, not by fixed cell positions.
- **Valid visits:** A visit counts only if its "Brauhaus" cell is not empty. This skips the trailing `#DIV/0!` rows.
- **Matching scores to visits:** The rating sheets list visits in the same order as General (they reference `General!A…`), so ratings are matched to visits by order.
- **Cleanup:** All names are trimmed. Dates are converted from Excel serial numbers to ISO strings. Planner "-" or empty becomes `null`. Aliases are mapped: `Florian` → `Flo`.
- **Averages:** Averages are recomputed from the raw scores; the cached Excel values are ignored. "Gesamt" is the mean of the 3 category averages, and "Preis/Leistung" is AVG Rechnung / Gesamt, both the same as in Excel.
- **Visit order:** Visits are sorted by date. This matters because visit no. 24 is dated earlier than its neighbours.
- **Slugs:** generated from names, e.g. "Bierhaus en d'r Salzgass" → `bierhaus-en-dr-salzgass`. Restaurants visited more than once (Haus Unkelbach, Gilden im Zims) get **one** page that collects all their visits.

Types live in `shared/types.ts`: `Visit` (nr, date, brauhaus, slug, bier, mitglieder, gaeste, rechnung, biere, liter, bierpreis, kurze, planer, ratings: {location, service, essen} as Record<person, number>, averages) and `Participant`.

All derived statistics live in `composables/useStammtisch.ts`, which imports the JSON statically. There are no API calls.

## Pages
**`/` – Übersicht**
- KPI cards: number of visits, distinct restaurants, total bill, total beers / litres, shots, average bill per person, average score.
- Line chart of the overall score over time (`Gesamt`, plus the 3 categories).
- Top/flop ranking table of the restaurants (sortable, with links).
- Donut chart of visits per Kölsch brand.
- Bar chart of how often each person was the planner.
- Scatter or bar chart of Preis/Leistung.

**`/brauhaus/[slug]`**
- Visits (date, planner, bill, beers).
- Category scores compared with the overall average (Radar or Bar chart).
- Table of each rater's scores per category.
- Rank among all restaurants.

**`/teilnehmer/[slug]`**
- Number of visits rated (used as a stand-in for attendance) and visits planned.
- The person's own averages compared with the group average for each category, i.e. "strenger/großzügiger Kritiker" (Bar chart).
- Their favourite and least favourite restaurant.
- Their scores over time (Line chart).

Also: an index list at `/brauhaus` and `/teilnehmer`, and a header nav (`layouts/default.vue`).

## Prerender
In `nuxt.config.ts`, `nitro.prerender.routes` lists all slugs from the JSON (as a fallback in addition to the crawler), so every detail page is generated.

## File layout
```
data/Stammtisch.xlsx          (moved from the project root)
scripts/convert-xlsx.ts
shared/types.ts
composables/useStammtisch.ts
components/ui/*               (shadcn-vue)
components/KpiCard.vue, RatingTable.vue, ...
pages/index.vue, brauhaus/index.vue, brauhaus/[slug].vue, teilnehmer/index.vue, teilnehmer/[slug].vue
layouts/default.vue
nuxt.config.ts
```

## Verification
1. `pnpm convert`: check the JSON. It should contain 42 visits, about 40 restaurants, and the raters Lucas, Jan, Kevin, Simon, Mathieu, Johannes, Tim, Flo and Johannes Jr. Spot-check against Excel: Em Kölsche Boor averages 3.71/4.14/3.32 and Gesamt 3.72.
2. `pnpm dev`: click through `/`, one restaurant visited twice (Haus Unkelbach) and one participant.
3. `pnpm generate && npx serve .output/public`: every detail page must exist as static HTML, and charts must render without hydration errors.
4. `pnpm typecheck`.
