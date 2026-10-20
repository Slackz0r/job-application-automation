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

**Phase:** MVP Implementation — Project Foundation Complete

The Next.js/TypeScript application loads and validates the private professional profile on the server. The initial page reports whether the profile is ready without displaying its full contents. SQLite setup includes a repeatable migration command, the first opportunities table, and tested application logic for saving and reading opportunities. The next milestone is discovering and browsing real advertisements from Platsbanken.

The initial stack consists of Next.js, React, Node.js, TypeScript, SQLite, and a structured JSON professional knowledge base.

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

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). Both development and production start commands bind to the local computer. No environment variables or external services are needed for this increment.

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

The first migration creates `opportunities`; setup adds no sample job records. Keep applied migration files unchanged and add a new numbered SQL file for later schema changes. Each file should contain its SQL changes; the runner handles the transaction.

`src/lib/opportunities.ts` exports `saveOpportunity(db, input)` and `getOpportunity(db, id)`. Pass an open connection from `openDatabase()` and close it when finished. Saving validates required fields, accepts only HTTP/HTTPS URLs, and records the first discovery time automatically. Optional dates accept `YYYY-MM-DD` or ISO timestamps with a timezone; missing values are stored as `null`. A duplicate source/source ID returns the original record without overwriting it. Reading an unknown ID returns `null`. Invalid input throws a validation error, while database failures propagate to the caller. These functions are server-only and are not connected to the interface yet.

Tooling limitation: ESLint 9 is retained for compatibility with the plugins in Next.js's lint configuration, although ESLint marks that release as unsupported. The development dependency audit reports five high-severity entries from one unpatched [braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) in the lint dependency chain. The production dependency audit reports no vulnerabilities. Revisit this when compatible upstream releases become available.

## Git Workflow

- Before changing files for a new task, create a dedicated branch from the default branch. Continue unfinished work on its existing task branch. Once the task is merged, use a new branch for subsequent work.
- Small documentation or wording fixes may be made directly on the default branch when a separate task branch would add little value.
- Use short, descriptive branch names with the `codex/` prefix and hyphens between words, such as `codex/job-search-api`.
- Keep related code, tests, and documentation together on the task branch. A task may span several implementation steps and small, clear commits; individual edits do not need separate branches.
- Review the changes and run checks appropriate to the task before merging into the default branch.

## Documentation

- [Project Overview](docs/PROJECT.md) — Vision, objectives, principles, and product direction.
- [System Architecture](docs/ARCHITECTURE.md) — Technical design, system responsibilities, and data flow.
- [Development Roadmap](docs/ROADMAP.md) — MVP scope, milestones, and completion criteria.
- [Project Decisions](docs/DECISIONS.md) — Significant decisions, rationale, and unresolved choices.

Documentation evolves alongside the project, capturing meaningful discoveries, decisions, and their underlying reasoning.
