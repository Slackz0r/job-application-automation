# Job Opportunity Automation

An AI-assisted software engineering project exploring how automation can make the job search and application process more efficient, scalable, and personalized.

The goal is to develop a system that discovers and pursues relevant employment opportunities with minimal human intervention, while preserving the quality and authenticity of individual applications.

## Project Scope

The project explores two complementary approaches:

- **Job Application Automation** — Discover relevant vacancies, evaluate suitability, generate tailored applications, and automate submissions where feasible.
- **Proactive Outreach** — Identify interesting companies, research potential opportunities, and initiate personalized spontaneous applications.

Both approaches may share professional background information, application intelligence, and performance tracking.

The initial MVP focuses on advertised vacancies, from opportunity discovery and evaluation through application generation, manual submission, and tracking. Greater autonomy and proactive outreach are planned as future capabilities.

## Engineering Philosophy

This project also serves as a software engineering portfolio, documenting the complete development journey from initial concept to implementation.

The focus is on thoughtful architectural decisions, simplicity, efficiency, experimentation, and the responsible use of AI.

Technical decisions are driven by actual requirements and validated assumptions rather than predetermined solutions.

## Current Status

**Phase:** MVP Implementation — Discovery and Initial Live Evaluation

The local application now searches Platsbanken, saves valid advertisements in SQLite, and shows their locations alongside the text and original-source links. Load 20 advertisements at a time with **Load more**, keeping earlier results visible. Search by free text and optionally choose one or more locations. The homepage shows recently saved opportunities after refresh or restart. The private professional profile remains on the server, with only its loading status and professional-experience and education counts shown in the interface.

The initial stack consists of Next.js, React, Node.js, TypeScript, SQLite, and a structured JSON professional knowledge base.

Each saved advertisement offers **Evaluate with ChatGPT**. After sign-in, an explicit click sends that advertisement and the approved professional profile sections to GPT-6.1 Sol through the subscription. The app validates the completed structured reply and saves a recommendation, explanation, supporting evidence, and gaps or unknowns, plus its model and UTC save time. Existing samples stay labelled until a successful real evaluation replaces them. Saved live results are reused unless **Evaluate again with ChatGPT** is explicitly clicked. There are no automatic evaluations, retries, model substitutions, or paid API fallback. One real evaluation has completed and its evidence has been checked against the supplied advertisement and profile. Broader quality testing remains open; automated checks use synthetic replies.

The **ChatGPT subscription** card offers **Continue with ChatGPT** for a separate permission check. Open the local app using `http://127.0.0.1:3000` (or the displayed port). Clicking the button opens OpenAI's sign-in and consent page; the callback verifies identity and whether subscription usage permission was granted. Sign-in does not make a model request or send job/profile data. Credentials stay in server memory, so restart or expiry requires sign-in again. Only registration identifiers are kept in the ignored `data/chatgpt-registration.json`; local sign-out clears credentials without revoking the app's permission in ChatGPT settings. One registered account/workspace is supported in this first local version. Manual sign-in and subscription permission have been verified; automated tests use synthetic tokens and mocked token responses.

After sign-in, **Test subscription connection** fetches the account's visible model list and, if `gpt-6.1-sol` is listed, sends only `Reply with exactly: Subscription connection works.` using the subscription. It shows model choices and the reply after a completed response. No job or profile data is loaded by this test. There is at most one model request per attempt, no automatic retries or paid API fallback, and a successful test is reused until the connection ends. No test runs on sign-in or page load. If the agreed model is absent, no inference request is made. Manual testing has verified model discovery and the fixed-message response; automated tests use synthetic streams.

## Source Structure

- `src/app/` contains route files and server entry points. Feature-named Server Actions and their tests live in `src/app/actions/`.
- `src/components/opportunities/` contains `OpportunityDiscovery` for the search flow, `LocationPicker` for location selection, `OpportunityList` for advertisement display, and `OpportunityEvaluation` for reviewing and explicitly running evaluations.
- `src/components/chatgpt/` contains the subscription connection card. `src/app/auth/callback/` receives OpenAI's sign-in reply; the related Server Actions, integration logic, and validation use the existing action, library, and schema folders.
- `src/schemas/` contains validation rules and related TypeScript types, grouped by workflow or shared data model. The job-search module includes search criteria and JobTech API response checks; opportunity and professional-profile schemas have their own modules.
- `src/lib/` contains database access, the Platsbanken connector, and profile loading. SQL table changes live in `migrations/`.

## Local Development

Use Node.js 24 or newer and npm. Node.js 24 also runs the TypeScript tests directly.

```powershell
npm.cmd ci
if (-not (Test-Path professional-profile.json)) {
  Copy-Item professional-profile.example.json professional-profile.json
}
npm.cmd run db:migrate
npm.cmd run dev
```

Copy the sanitized example only if you do not already have a private `professional-profile.json`. Replace its example contents with your verified professional information. The private file is ignored by Git and must remain outside `public/`.

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). Both development and production start commands bind to the local computer. Profile and database setup require no environment variables or external services. The JobSearch connector needs internet access but no API key.

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd start
```

The server loader is in `src/lib/professional-profile.ts`; the status page is in `src/app/page.tsx`. The working profile format has four sections: `skillsAndCompetencies`, `experiences` (with `professional` and `education` arrays), `personalityAndInterests`, and `careerPreferences`. The loader validates this structure and core experience fields while preserving rich descriptions and `verificationNeeded` notes. Dates, professional contribution lists, and education project lists are optional; the other sections may be empty objects, and experience arrays may be empty. Missing details remain unknown, without default dates, preferences, or proficiency levels. The previous single-experience format must be moved into this structure; the sanitized example shows the layout. Missing, invalid, or unreadable profiles produce a setup message, and the private file is read at request time rather than included in prerendered output.

The server-only `src/lib/db.ts` module exports `openDatabase()`, which creates `data/` if needed and opens `data/app.sqlite` through `better-sqlite3`. The caller closes the connection with `db.close()` after use, including on failure. The whole `data/` folder is ignored by Git.

`npm.cmd run db:migrate` runs `scripts/migrate.ts`. It reads numbered `.sql` files from `migrations/` in filename order, checks `schema_migrations`, and applies each new file together with its tracking entry in one transaction. A failed migration rolls back its changes and stops the command; earlier successful migrations remain applied. Repeating the command skips files already recorded. Tests run against temporary databases and check both repeat runs and failure recovery.

The first migration creates `opportunities`; setup adds no sample job records. The second migration adds the optional `location` column while retaining existing advertisements. Run `npm.cmd run db:migrate` after pulling schema changes. Keep applied migration files unchanged and add a new numbered SQL file for later schema changes. Each file should contain its SQL changes; the runner handles the transaction.

`src/lib/opportunities.ts` exports `saveOpportunity(db, input)`, `getOpportunity(db, id)`, and `listOpportunities(db, limit?)`. Pass an open connection from `openDatabase()` and close it when finished. Saving validates required fields, accepts only HTTP/HTTPS URLs, and records the first discovery time automatically. Optional dates accept `YYYY-MM-DD` or ISO timestamps with or without a timezone; supplied values are preserved unchanged and missing values are stored as `null`. Location is optional text. A duplicate source/source ID preserves the saved record, with one exception: a newly supplied location fills an existing `null` location. Known locations and all other fields remain unchanged. Reading an unknown ID returns `null`; listing returns the most recently discovered records, with a default limit of 20. Invalid input throws a validation error, while database failures propagate to the caller. These functions are server-only.

`src/lib/job-search.ts` exports `searchJobs({ query, municipalities?, limit?, offset? })`. The optional `municipalities` array contains API location identifiers, not place names. Identifiers are deduplicated and sent as repeated `municipality` parameters in one request, matching advertisements from any selected location. An empty selection searches nationwide. Each request fetches one batch of 20 advertisements by default (up to 100), starting at `offset` (default 0, maximum 2,000), with a ten-second request timeout and no cached response. The result contains `total` matches reported by the API, prepared `opportunities`, a `skippedCount` for invalid advertisements in this batch, `nextOffset`, and `limitReached`. Pagination advances by raw source hits, including invalid advertisements; an empty page or the reported end stops pagination. Reaching the source offset limit prompts a narrower search. Empty searches succeed with an empty list; network, HTTP, and malformed-response failures throw errors. The connector uses plain advertisement text, retains only the fields needed by our opportunity format, and shares validation with the save module. It derives display locations from the advertisement's workplace addresses, preferring municipality, then city, region, or country, and combines distinct place names. Missing or unreadable location data stays `null`; locations are never inferred from search selections. It does not write to the database. `getMunicipalities()` loads official names and identifiers from JobTech Taxonomy, sorted in Swedish order and cached for one day. The interface labels these choices as **Location** and supports searchable checkboxes and removable selections. If the lookup fails, the page still offers nationwide search.

The homepage connects `src/components/opportunities/opportunity-discovery.tsx` to the Server Action in `src/app/actions/opportunity-actions.ts`. Submitting a search fetches advertisements, saves the valid batch in one transaction, and returns the saved records for display. Database failures roll back the batch and produce a setup/error message. Repeated searches fill missing locations while preserving existing advertisement facts. Each list item shows its location or **Not provided**; older records gain locations when rediscovered. Refreshing the page reads the latest 20 saved opportunities without starting a new search. **Load more** fetches the next batch using the submitted search criteria and appends unseen records in order. Editing the search form only affects a new search, which replaces the displayed list on success. Failed searches or later pages preserve the current list and page position for retry. Search results accumulate only for the current page session; refresh still shows the latest 20 saved records. Search requests never evaluate advertisements automatically. Automated tests use sanitized responses and temporary databases, while browser checks verify live searches, persistence after refresh, form validation, empty results, and the original-source links.

Run `npm.cmd run db:migrate` before trying evaluation. Migration `003-create-opportunity-evaluations.sql` creates one current result per opportunity; `004-enable-live-opportunity-evaluations.sql` preserves saved samples and permits live results with a required model name. The server loads the saved advertisement and private profile, prepares only skills and competencies, professional experience, education, and career preferences, and sends those approved sections only after an explicit evaluation click. Personality and interests and other top-level fields are excluded; rich details and uncertainty notes within approved sections remain intact. The full input is not stored in the evaluation table or returned to the browser, although generated evidence can contain relevant professional facts. Missing advertisement text, profile setup problems, and missing migrations stop the flow before a model request. A failed request or save preserves any previous result. A completed request followed by a save failure is reported separately, because trying again would consume subscription usage again. Duplicate concurrent requests for the same job share one model request, and another job must wait until it finishes. An isolated simulator remains available to automated tests, but the app no longer offers a simulation button.

Tooling limitation: ESLint 9 is retained for compatibility with the plugins in Next.js's lint configuration, although ESLint marks that release as unsupported. The development dependency audit reports five high-severity entries from one unpatched [braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) in the lint dependency chain. The production dependency audit reports no vulnerabilities. Revisit this when compatible upstream releases become available.

## Git Workflow

- Work directly on the default branch (`master`) for routine, sequential work on this solo project. A separate branch is optional.
- Use a dedicated branch when it helps with a larger experiment, an alternative approach, parallel work, or review through a pull request.
- When using a task branch, start from the default branch and continue unfinished work on that branch. After merging the completed task, return to the default branch; use a fresh branch for a later task if one is useful.
- Use short, descriptive task branch names with the `codex/` prefix and hyphens between words, such as `codex/job-search-api`.
- Keep related code, tests, and documentation together in small, clear commits. Review changes and run appropriate checks before committing or merging, whichever workflow is used.
- Commit each completed, tested feature or fix before moving to a distinct part of the work; a larger milestone can span several commits.

## Documentation

- [Project Overview](docs/PROJECT.md) — Vision, objectives, principles, and product direction.
- [System Architecture](docs/ARCHITECTURE.md) — Technical design, system responsibilities, and data flow.
- [Development Roadmap](docs/ROADMAP.md) — MVP scope, milestones, and completion criteria.
- [Project Decisions](docs/DECISIONS.md) — Significant decisions, rationale, and unresolved choices.

Documentation evolves alongside the project, capturing meaningful discoveries, decisions, and their underlying reasoning.
