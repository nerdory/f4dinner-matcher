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

## Load data

The app starts with generic placeholder records only. Paste a Google Sheets URL into **Load from Google Sheet URL** in the top bar and select **Load Sheet**. The app reads the `Family - Responses` and `Students - Responses` tabs directly in your browser using Google Visualization CSV endpoints. After a successful load, the URL is remembered in your browser's local storage and automatically reloaded the next time you open the app; the URL and data are not saved in this repository or sent to an app backend.

Set the sheet's general access to **Anyone with the link can view**. Both tabs must be present. Loading is all-or-nothing: if either tab fails, the current data and assignments remain unchanged. The browser must be able to fetch the Google endpoint (CORS).

### Expected sheet columns

Hosts: `Name`, `Phone no.`, `Email Address`, `How many students would you like to host?`, the host venue and area questions, date availability columns from `13 Dec` through `27 Dec`, the Mandarin-hosting preference question, and the organizer remarks question.

Students: `First Name`, `Last Name`, `Home Country`, `Gender`, `Whatsapp number`, `University`, the faith and dietary questions, date availability columns from `Dec 13` through `Dec 27`, the student grouping question, and the Mandarin-host preference question.

Header matching ignores capitalization and punctuation, recognizes common synonyms, and can match key terms inside longer form questions so wording does not need to be an exact copy. Daily date columns can include a longer question around a bracketed date, such as `[13 Dec]` or `[Dec 13]`. Availability cells can contain `Lunch`, `Dinner`, or both. `Yes`, `Available`, and `Both` are treated as both meals; empty or negative values are unavailable. Friend requests can contain partial names and are matched in either name order.

If you prefer local files, use **Upload hosts CSV** or **Upload students CSV**. CSV parsing supports quoted commas and newlines. The CSV headers can use the sheet field names above, or these common aliases:

### Hosts

| Field | Example |
| --- | --- |
| Name | Sample Host A |
| Area / District | Sample District |
| Venue | Home or Restaurant |
| Phone | (loaded from your sheet) |
| Email | (loaded from your sheet) |
| Mandarin preference | Yes or No |
| Remarks | Placeholder host |
| Capacity | 4 |
| 13 Dec through 27 Dec | Lunch, Dinner, Both, or blank |

### Students

| Field | Example |
| --- | --- |
| First Name | Student |
| Last Name | 1 |
| University | Sample University |
| Faith | Not provided |
| Country | Country A |
| Gender | (loaded from your sheet) |
| WhatsApp | (loaded from your sheet) |
| Dietary restrictions | Not provided |
| Specific students to be grouped with | Student 2 |
| Dec 13 through Dec 27 | Lunch, Dinner, Both, or blank |

Separate multiple values with semicolons. Loading a sheet replaces both datasets; each CSV upload replaces its corresponding dataset. Replacing data clears current assignments.

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
