# Gatherwell

Gatherwell helps organizers match international students with local host families for Christmas meals. It groups students who request one another, compares availability, checks host capacity, and exports confirmed matches.

## Requirements

- Node.js 20 or newer
- npm

## Run locally

```sh
npm install
npm run dev
```

Create a production build with `npm run build`, or preview that build with `npm run preview`.

## Import data

The app starts with sample hosts and students. Use **Upload hosts CSV** or **Upload students CSV** to replace either sample dataset. CSV headers are flexible; these are the supported fields:

### Hosts

| Field | Example |
| --- | --- |
| Name | Amelia & James Chen |
| District | North Park |
| Venue | Home or Restaurant |
| Languages | English; Mandarin |
| Remarks | Vegetarian-friendly |
| Capacity | 4 |
| Availability | Dec 13 Lunch; Dec 14 Dinner |

### Students

| Field | Example |
| --- | --- |
| Name | Yuki Tanaka |
| University / Affiliation | Northbridge University |
| Religion / Faith | Buddhist |
| Country | Japan |
| Dietary / Dietary restrictions | No restrictions |
| Language / Language preference | English |
| Requests / Pair with / Friends | Min-jun Park |
| Availability | Dec 14 Dinner; Dec 16 Lunch |

Separate multiple values with semicolons. Availability entries should name a program date from December 13–27 and a meal (`Lunch` or `Dinner`).

Use **Connect a sheet** to load host and student JSON endpoints. Endpoints can return arrays of objects, arrays with a header row followed by data rows, or an object containing `values`, `data`, or `rows`. The browser must be allowed to fetch the endpoint (CORS). Importing a new dataset replaces that dataset and clears current assignments.

## Matching and export

- Students requesting one another are grouped together, including partial names and reversed first/last order. Requested friends not found in the student data are flagged.
- A group’s meal availability is the intersection of its members’ slots. Host suggestions require enough capacity and at least one shared meal, and are ranked by shared-slot count.
- Assigned groups are checked together against the host’s availability: zero shared slots is a conflict, one is a tight margin, and two or more is healthy.
- Use **Confirm & export CSV** to download confirmed matches. An optional Google Apps Script Web App URL can receive the CSV via POST; the endpoint must accept cross-origin requests from the app.

## Deploy to GitHub Pages

The Vite base path is configured for the `nerdory/f4dinner-matcher` repository. Build and publish the static site to the `gh-pages` branch with:

```sh
npm run deploy
```

The repository’s GitHub Pages settings must serve from the `gh-pages` branch at the root (`/`). The source code and this README live on the default branch; the deploy command publishes the generated `dist` files separately.
