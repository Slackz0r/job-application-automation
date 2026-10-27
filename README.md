# Job Opportunity Automation

A local job-search application that helps discover opportunities, evaluate them against verified professional experience, prepare tailored application text, and track progress.

The project doubles as an engineering portfolio, recording decisions and lessons from building a practical tool. It prioritizes truthful applications, reduced manual effort, and simple, verifiable implementations.

## Current Capabilities

- Search Platsbanken by text and location, browse advertisement details, and load more results.
- Evaluate saved opportunities against a private professional profile, including credible stretch roles and important unknowns.
- Generate, edit, save, and copy a Swedish motivation for an application question.
- Track statuses, application dates, notes, and status changes; revisit older opportunities through a filtered list.

Applications are reviewed and submitted manually. UI/dashboard work and end-to-end validation are next; outreach and greater automation remain future capabilities.

Built with Next.js, React, TypeScript, Node.js, SQLite, and a structured JSON professional profile.

## Quick Start

Use Node.js 24 or newer and npm. The examples below use Windows PowerShell.

```powershell
npm.cmd ci
if (-not (Test-Path professional-profile.json)) {
  Copy-Item professional-profile.example.json professional-profile.json
}
npm.cmd run db:migrate
npm.cmd run dev
```

Replace sample data with verified information; keep unknowns unknown. The conditional copy preserves your existing private profile.

Open [http://127.0.0.1:3000](http://127.0.0.1:3000), or the displayed port. Use the `127.0.0.1` address for ChatGPT sign-in. Platsbanken searches require internet access but no API key. Rerun `npm.cmd run db:migrate` after pulling database changes.

## Data and AI Access

`professional-profile.json` and the local `data/` directory are ignored by Git. Keep private CV material and credentials out of version control. Saved drafts and tracking notes may contain personal information.

AI features use GPT-6.1 Sol through **Continue with ChatGPT**, subject to the connected account's permission and model availability. Sign-in is kept in server memory, so restart or expiry requires signing in again. AI requests happen only through explicit generation, evaluation, or connection-test actions, with no automatic retries or paid API fallback.

Evaluation and drafting send selected professional profile sections and the chosen advertisement; drafting also sends the application question. Personality and interests are excluded. Tracking notes are not model input. Review generated claims before using them. Technical boundaries are described in the [architecture](docs/ARCHITECTURE.md).

## Development Commands

| Command | Purpose |
| --- | --- |
| `npm.cmd run dev` | Start local development |
| `npm.cmd run lint` | Check code style |
| `npm.cmd run typecheck` | Check TypeScript |
| `npm.cmd run test:application` | Run application and tracking tests |
| `npm.cmd test` | Run all test groups |
| `npm.cmd run build` then `npm.cmd start` | Build and run production locally |

Other test groups are `test:discovery`, `test:evaluation`, `test:chatgpt`, `test:profile`, and `test:database`. Tests live under `tests/` and use sanitized data, temporary databases, and mocked AI replies.

Choose checks according to the change. Discussion and documentation-only edits need no automated tests; focused changes use relevant groups. See [AGENTS.md](AGENTS.md) for verification guidance and [package.json](package.json) for all commands.

## Git Workflow

- Work directly on the default branch (`master`) for routine, sequential work on this solo project. A separate branch is optional.
- Use a dedicated branch when it helps with a larger experiment, an alternative approach, parallel work, or review through a pull request.
- When using a task branch, start from the default branch and continue unfinished work on that branch. After merging the completed task, return to the default branch; use a fresh branch for a later task if one is useful.
- Use short, descriptive task branch names with the `codex/` prefix and hyphens between words, such as `codex/job-search-api`.
- Keep related code, tests, and documentation together in small, clear commits. Review changes and run appropriate checks before committing or merging, whichever workflow is used.
- Commit each completed, tested feature or fix before moving to a distinct part of the work; a larger milestone can span several commits.

## Documentation

- [Project overview](docs/PROJECT.md): goals and product direction.
- [Architecture](docs/ARCHITECTURE.md): source organization, data flow, and technical behavior.
- [Roadmap](docs/ROADMAP.md): milestones, current progress, and next steps.
- [Decisions](docs/DECISIONS.md): significant choices and their rationale.
- [AI collaboration guide](AI_WORKFLOW.md): how development discussions and implementation are approached.
