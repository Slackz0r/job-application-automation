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

**Phase:** MVP Implementation — Opportunity Discovery

The local application now searches Platsbanken, saves valid advertisements in SQLite, and shows their locations alongside the text and original-source links. Search by free text and optionally choose one or more locations. The homepage shows recently saved opportunities after refresh or restart. The private professional profile remains on the server, with only its loading status and contribution count shown in the interface.

The initial stack consists of Next.js, React, Node.js, TypeScript, SQLite, and a structured JSON professional knowledge base.

## Source Structure

- `src/app/` contains route files and server entry points. Feature-named Server Actions and their tests live in `src/app/actions/`.
- `src/components/opportunities/` contains `OpportunityDiscovery` for the search flow, `LocationPicker` for location selection, and `OpportunityList` for advertisement display.
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

The server loader is in `src/lib/professional-profile.ts`; the status page is in `src/app/page.tsx`. The loader validates the current single-experience format and preserves additional details, including `verificationNeeded`. This is an initial format, not the final schema for a complete career profile. Missing, invalid, or unreadable profiles produce a setup message, and the private file is read at request time rather than included in prerendered output.

The server-only `src/lib/db.ts` module exports `openDatabase()`, which creates `data/` if needed and opens `data/app.sqlite` through `better-sqlite3`. The caller closes the connection with `db.close()` after use, including on failure. The whole `data/` folder is ignored by Git.

`npm.cmd run db:migrate` runs `scripts/migrate.ts`. It reads numbered `.sql` files from `migrations/` in filename order, checks `schema_migrations`, and applies each new file together with its tracking entry in one transaction. A failed migration rolls back its changes and stops the command; earlier successful migrations remain applied. Repeating the command skips files already recorded. Tests run against temporary databases and check both repeat runs and failure recovery.

The first migration creates `opportunities`; setup adds no sample job records. The second migration adds the optional `location` column while retaining existing advertisements. Run `npm.cmd run db:migrate` after pulling schema changes. Keep applied migration files unchanged and add a new numbered SQL file for later schema changes. Each file should contain its SQL changes; the runner handles the transaction.

`src/lib/opportunities.ts` exports `saveOpportunity(db, input)`, `getOpportunity(db, id)`, and `listOpportunities(db, limit?)`. Pass an open connection from `openDatabase()` and close it when finished. Saving validates required fields, accepts only HTTP/HTTPS URLs, and records the first discovery time automatically. Optional dates accept `YYYY-MM-DD` or ISO timestamps with or without a timezone; supplied values are preserved unchanged and missing values are stored as `null`. Location is optional text. A duplicate source/source ID preserves the saved record, with one exception: a newly supplied location fills an existing `null` location. Known locations and all other fields remain unchanged. Reading an unknown ID returns `null`; listing returns the most recently discovered records, with a default limit of 20. Invalid input throws a validation error, while database failures propagate to the caller. These functions are server-only.

`src/lib/job-search.ts` exports `searchJobs({ query, municipalities?, limit? })`. The optional `municipalities` array contains API location identifiers, not place names. Identifiers are deduplicated and sent as repeated `municipality` parameters in one request, matching advertisements from any selected location. An empty selection searches nationwide. Searches request one batch of 20 advertisements in total by default (up to 100), with a ten-second request timeout and no cached response. The result contains `total` matches reported by the API, prepared `opportunities`, and a `skippedCount` for invalid advertisements in this batch. Empty searches succeed with an empty list; network, HTTP, and malformed-response failures throw errors. The connector uses plain advertisement text, retains only the fields needed by our opportunity format, and shares validation with the save module. It derives display locations from the advertisement's workplace addresses, preferring municipality, then city, region, or country, and combines distinct place names. Missing or unreadable location data stays `null`; locations are never inferred from search selections. It does not write to the database. `getMunicipalities()` loads official names and identifiers from JobTech Taxonomy, sorted in Swedish order and cached for one day. The interface labels these choices as **Location** and supports searchable checkboxes and removable selections. If the lookup fails, the page still offers nationwide search.

The homepage connects `src/components/opportunities/opportunity-discovery.tsx` to the Server Action in `src/app/actions/opportunity-actions.ts`. Submitting a search fetches advertisements, saves the valid batch in one transaction, and returns the saved records for display. Database failures roll back the batch and produce a setup/error message. Repeated searches fill missing locations while preserving existing advertisement facts. Each list item shows its location or **Not provided**; older records gain locations when rediscovered. Refreshing the page reads the latest 20 saved opportunities without starting a new search. Search results and recently saved lists are currently limited to 20 records; pagination is not implemented. Automated tests use sanitized responses and temporary databases, while browser checks verify live searches, persistence after refresh, form validation, empty results, and the original-source links.

Tooling limitation: ESLint 9 is retained for compatibility with the plugins in Next.js's lint configuration, although ESLint marks that release as unsupported. The development dependency audit reports five high-severity entries from one unpatched [braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) in the lint dependency chain. The production dependency audit reports no vulnerabilities. Revisit this when compatible upstream releases become available.

## Git Workflow

- Work directly on the default branch (`master`) for routine, sequential work on this solo project. A separate branch is optional.
- Use a dedicated branch when it helps with a larger experiment, an alternative approach, parallel work, or review through a pull request.
- When using a task branch, start from the default branch and continue unfinished work on that branch. After merging the completed task, return to the default branch; use a fresh branch for a later task if one is useful.
- Use short, descriptive task branch names with the `codex/` prefix and hyphens between words, such as `codex/job-search-api`.
- Keep related code, tests, and documentation together in small, clear commits. Review changes and run appropriate checks before committing or merging, whichever workflow is used.

## Documentation

- [Project Overview](docs/PROJECT.md) — Vision, objectives, principles, and product direction.
- [System Architecture](docs/ARCHITECTURE.md) — Technical design, system responsibilities, and data flow.
- [Development Roadmap](docs/ROADMAP.md) — MVP scope, milestones, and completion criteria.
- [Project Decisions](docs/DECISIONS.md) — Significant decisions, rationale, and unresolved choices.

Documentation evolves alongside the project, capturing meaningful discoveries, decisions, and their underlying reasoning.
