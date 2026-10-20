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

**Phase:** MVP Implementation — Project Foundation

The Next.js/TypeScript application loads and validates the private professional profile on the server. The initial page reports whether the profile is ready without displaying its full contents. SQLite persistence is the next foundation increment.

The initial stack consists of Next.js, React, Node.js, TypeScript, SQLite, and a structured JSON professional knowledge base.

## Local Development

Use Node.js 24 or newer and npm. Node.js 24 also runs the TypeScript tests directly.

```powershell
npm.cmd ci
if (-not (Test-Path professional-profile.json)) {
  Copy-Item professional-profile.example.json professional-profile.json
}
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

Tooling limitation: ESLint 9 is retained for compatibility with the plugins in Next.js's lint configuration, although ESLint marks that release as unsupported. The development dependency audit reports five high-severity entries from one unpatched [braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) in the lint dependency chain. The production dependency audit reports no vulnerabilities. Revisit this when compatible upstream releases become available.

## Documentation

- [Project Overview](docs/PROJECT.md) — Vision, objectives, principles, and product direction.
- [System Architecture](docs/ARCHITECTURE.md) — Technical design, system responsibilities, and data flow.
- [Development Roadmap](docs/ROADMAP.md) — MVP scope, milestones, and completion criteria.
- [Project Decisions](docs/DECISIONS.md) — Significant decisions, rationale, and unresolved choices.

Documentation evolves alongside the project, capturing meaningful discoveries, decisions, and their underlying reasoning.
