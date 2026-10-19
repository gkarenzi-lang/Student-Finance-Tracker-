# Student Finance Tracker

An accessible, responsive finance tracker for students, built with plain HTML, CSS and JavaScript (no frameworks). Log spending, search it with regular expressions, stay under a budget cap and back up your data as JSON.

- **Theme:** Student Finance Tracker
- **Live site (GitHub Pages):** https://gkarenzi-lang.github.io/Student-Finance-Tracker-/
- **Contact:** [gkarenzi-lang](https://github.com/gkarenzi-lang) · g.karenzi@alustudent.com

## Features

- **Dashboard:** total transactions, total spent, top category, last-7-days total and a 7-day bar chart.
- **Budget cap:** set a cap in Settings. The message is announced politely when under the cap and assertively (`role="alert"`) when exceeded.
- **Transactions list:** a table on tablet and desktop, cards on mobile.
- **Add, edit and delete:** the Edit button loads a row into the form, Delete asks for confirmation, and `updatedAt` is refreshed on every change.
- **Regex search:** live search across description, category, date and amount, with a "Match case" toggle, `<mark>` highlighting and safe handling of invalid patterns.
- **Sorting:** by date, description (A–Z, Z–A) and amount (low–high, high–low).
- **Currency:** USD, EUR and RWF with manual exchange rates in Settings (no API). Amounts are stored in USD and converted for display.
- **Persistence:** every change is saved to `localStorage` automatically.
- **Import / export:** download a JSON backup, or import one. The file is validated before it replaces your data.

## Project structure

```
index.html
tests.html
styles/style.css
scripts/script.js
README.md
```

## Data model

```json
{
  "id": "rec_0001",
  "description": "Lunch at cafeteria",
  "amount": 12.5,
  "category": "Food",
  "date": "2026-10-19",
  "createdAt": "2026-10-19T08:00:00.000Z",
  "updatedAt": "2026-10-19T08:00:00.000Z"
}
```

Records are saved under the `sft:records` key and settings under `sft:settings`. First-time visitors get six sample transactions.

## Regex catalog

### Form validation

| Field | Pattern | Valid example | Invalid example |
|---|---|---|---|
| Description (no leading/trailing spaces) | `^\S(?:.*\S)?$` | `Lunch at cafeteria` | ` Lunch` |
| Description (no double spaces) | `\s{2,}` (rejects a match) | `Bus pass` | `Bus  pass` |
| Amount | `^(0\|[1-9]\d*)(\.\d{1,2})?$` | `12`, `12.50` | `012`, `12.555` |
| Date | `^\d{4}-(0[1-9]\|1[0-2])-(0[1-9]\|[12]\d\|3[01])$` | `2026-02-14` | `2026-13-01` |
| Category | `^[A-Za-z]+(?:[ -][A-Za-z]+)*$` | `Fast-food` | `Food1` |
| **Advanced:** duplicate word (back-reference) | `\b(\w+)\s+\1\b` | `Lunch at cafeteria` | `the the book` |

Dates that pass the pattern but don't exist, such as `2026-02-31`, are also rejected. The amount must be greater than 0.

### Search queries

Type any pattern into the search box, or click one of the example buttons.

| Button | Pattern | Finds |
|---|---|---|
| Cents present | `\.\d{2}\b` | Amounts with two decimal places |
| Coffee or tea | `(coffee\|tea)` | Beverage keywords |
| Duplicate word | `\b(\w+)\s+\1\b` | Repeated words (back-reference) |
| Food only | `@category:Food` | Filters by category. Any category works, e.g. `@category:Books` |

Searches are case-insensitive unless "Match case" is ticked. An invalid pattern such as `(` shows a message instead of breaking the page.

## Keyboard map

| Key | Action |
|---|---|
| `Tab` / `Shift + Tab` | Move forward / backward through links, fields and buttons |
| `Tab` on page load, then `Enter` | Use the "Skip to content" link |
| `Enter` | Activate a focused link or button, or submit the form from a text field |
| `Space` | Press a focused button, or tick "Match case" |
| `↑` / `↓` | Change the selected option in the Sort and Category dropdowns |

A keyboard-only flow works for adding, editing, deleting, searching, sorting and exporting. Focus moves to the first invalid field when the form has errors, and to the Description field when you press Edit.

## Accessibility notes

- Semantic landmarks (`header`, `nav`, `main`, `section`, `footer`) with one `h1` and a logical heading order.
- Skip-to-content link, and a visible focus outline on every interactive element.
- Every input has a bound `<label>`. Errors are linked with `aria-describedby` and fields are marked `aria-invalid`.
- Status messages use `role="status"` / `aria-live`: form results, search errors, import/export results and the cap message.
- The table has a screen-reader caption and `scope` on its headers. On mobile, each cell shows its label through `data-label`.
- The chart has a text alternative listing each day's spending.
- Search highlights use `<mark>`, with all other text HTML-escaped.
- Colors are chosen for strong contrast, and transitions are switched off for people who prefer reduced motion.

### Known limitations

- The "Import JSON" button is a label for a hidden file input, so it can't be reached by keyboard. Use the mouse or touch to import.
- Editing happens in the form below the table, not inline in the row.

## Responsive design

Mobile-first with three breakpoints:

- **~360px (base):** stacked layout, cards instead of a table, two-column stats.
- **768px:** full table, four-column stats, two-column settings.
- **1024px:** three-column settings.

A transition animates the chart bars when data changes, and buttons fade slightly on hover.

## Running the project

No build step or server is needed.

1. Download or clone the repository.
2. Open `index.html` in a browser.

### Running the tests

Open `tests.html` in a browser. It runs 14 assertions covering the validation rules, the safe regex compiler and match highlighting, and lists each result as `PASS` or `FAIL`.

### Deploying to GitHub Pages

1. Push the project to a GitHub repository.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, then select `main` and `/ (root)`.
4. Save, then wait a minute for the site to appear at the URL shown, and paste that URL at the top of this README.
