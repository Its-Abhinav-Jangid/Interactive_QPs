# PaperDesk — Universal Interactive Exam Portal

Turn static board papers (CBSE and others) into interactive, cloud-synced practice
tests. Paper content lives as validated JSONB in Supabase, so one schema covers
English, Science, Social Science, Mathematics and entrance mocks without migrations.

## What it does

- **Paper library** — search/filter by subject, board and attempt status; resume,
  reset, duplicate, download raw JSON, delete, or share.
- **AI prompt studio** — builds a zero-spoiler paper-to-JSON extraction prompt with
  the exact schema, chart rules, `attemptLimit` and `exportGroup` conventions.
- **Resilient importer** — paste or drop `.json`, strips Markdown fences, validates
  with Zod and reports human-readable paths (`Section B → Q3 → item 5`).
- **Exam workspace** — sticky timer with start/pause/reset, section tabs, live marks
  progress, debounced cloud autosave, local backup, split reading panes with A−/A+,
  SVG bar/line/pie charts with a text-data drawer, deselectable MCQ cards,
  fill-in-the-blank and error/correction inputs, auto-growing long answers with
  word-count badges, internal-choice (`OR`) switching that preserves both drafts,
  and “attempt any N” limits with an ungraded-extras warning.
- **Evaluation export** — Markdown for the full paper, any section, or any
  `exportGroup`, with an optional strict CBSE-style examiner prompt (on by default),
  first-N scoring, a marks table, writing rubrics and top fixes.
- **Link sharing** — private / unlisted / public share links with an optional sender
  note. Shared links open a clean student mode with no library or admin chrome;
  guest answers stay in `localStorage`.

## Stack

Next.js 16 App Router (JavaScript) · React 19 · Tailwind CSS 4 · Radix UI primitives ·
Supabase (Postgres, Auth, RLS) · Zod 4 · next-themes · sonner · lucide.

## Quick start

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase project values
npm run dev
```

Open <http://localhost:3000>. Sign in, then press **Load demo papers** to get the
Class 10 English and Science samples, or go to **Import** and paste your own JSON.

### Environment

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-publishable-or-anon-key
```

Only the publishable/anon key is needed. There is no service-role key in the app:
guests never write to the database, and every server action and route handler
re-checks the signed-in user.

### Database

Apply `supabase/migrations/20261122000000_init_exam_portal.sql` with the Supabase
CLI (`supabase db push`) or by pasting it into the SQL editor. It creates:

- `profiles`, `papers`, `attempts` with `updated_at` triggers,
- RLS policies (owners get full CRUD on their papers; attempts are per-user),
- a new-user profile trigger,
- `get_shared_paper(slug)` for unlisted/public share links,
- grants and function hardening.

### Auth settings in the Supabase dashboard

1. **Authentication → URL configuration**: set Site URL to `http://localhost:3000`
   and add `http://localhost:3000/auth/callback` to the redirect allow-list.
2. Email/password works immediately. Magic links need the redirect URL above.
3. New projects have **email confirmation** on. Either confirm the email after
   sign-up, or turn confirmation off for local testing.
4. Google OAuth is intentionally not wired up.

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Paper library and dashboard (signed in) |
| `/import` | AI prompt studio + validated JSON importer |
| `/exam/[paperId]` | Owner exam workspace with cloud sync |
| `/s/[shareSlug]` | Clean student mode for shared tests (no account needed) |
| `/auth/login` | Password sign-in/sign-up and magic link |
| `/auth/callback` | PKCE code exchange for magic links |

## Paper JSON

The canonical schema is `lib/schemas/paper.js` (Zod). A paper is:

```json
{
  "title": "…", "subtitle": "…", "subject": "English", "board": "CBSE",
  "durationMinutes": 180, "maxMarks": 80,
  "instructions": ["…"],
  "sections": [
    {
      "id": "A", "label": "Section A", "title": "Reading Skills", "marks": 20,
      "questions": [
        {
          "id": "q1", "number": "1", "marks": 10,
          "layout": "split", "attemptLimit": null, "exportGroup": null,
          "stimulus": [{ "type": "passage", "paragraphs": ["…"] }],
          "items": [{ "id": "q1a", "type": "mcq", "prompt": "…", "options": ["…"] }],
          "choices": null
        }
      ]
    }
  ]
}
```

Stimulus blocks: `passage`, `extract`, `table`, `swot`, `bullets`, `chart`.
Item types: `mcq`, `short`, `error_correction`, `long`.
Each question uses exactly one of `items` or `choices` (A/B internal choice).

`attemptLimit: N` means the question holds M scorable items and only the first N
attempts count. Progress is `min(attempted, N) / N × marks`; extras are flagged
ungraded in the UI and export.

Two validated samples live in `seed/` and are also bundled for the importer.

## State and sync

- Signed-in attempts debounce to `/api/attempts` (1 s), with a 15 s safety flush,
  retry on `online`, and a `localStorage` mirror. The newest copy wins on load.
- Guest attempts on `/s/[slug]` are `localStorage` only, keyed by share slug.
- The timer runs in its own component so ticks do not re-render question cards.
  Question cards are memoized; typing in one answer does not re-render the paper.

## Security notes

- No `dangerouslySetInnerHTML`; all paper content and sender notes render as text.
- No native `alert()` / `confirm()`; destructive actions use Radix AlertDialog.
- Unlisted papers cannot be enumerated through PostgREST. `get_shared_paper` is
  `SECURITY DEFINER` and returns at most one row for an exact slug; the Supabase
  security advisor flags this as intentional. Setting visibility to `private`
  immediately disables the link.
- Shared/guest mode never sends attempt data to the server.

## Scripts

```bash
npm run dev     # development server
npm run lint    # ESLint (Next core-web-vitals + React hooks rules)
npm run build   # production build
npm start       # serve the production build
```

## Verified

- `npm run lint` and `npm run build` pass.
- Authenticated end-to-end browser run (20/20 checks): sign-in, demo load, exam
  render, MCQ selection, cloud autosave (`Saved to cloud`), reload restore, OR draft
  preservation, export content, share link creation, clean shared mode, guest
  localStorage restore, JSON import + save, and finish/completion.
- Database/RLS run (9/9): profile trigger, owner CRUD, anon blocked on private and
  unlisted direct selects, anon RPC returns unlisted paper, anon attempt insert
  blocked, upsert on `(paper_id, user_id)`, and link revocation when set private.
