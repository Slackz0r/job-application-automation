# Agent Instructions

## Project Context

- Repository root: `job-application-automation/`
- Project overview: `docs/PROJECT.md`
- System architecture: `docs/ARCHITECTURE.md`
- Development roadmap: `docs/ROADMAP.md`
- Established and pending decisions: `docs/DECISIONS.md`
- AI collaboration guide: `AI_WORKFLOW.md`

Use the documentation to understand project objectives, established decisions, architecture, and current implementation scope.

Consult the relevant documents when needed. Do not read every document for every small, well-understood task.

Treat documentation as living context. If implementation requirements conflict with established decisions, raise the discrepancy before making consequential changes.

## Collaboration

Follow these principles by default:

- Establish context before proposing solutions to unfamiliar or ambiguous problems.
- Prioritize collaborative reasoning, architectural understanding, and meaningful discussion.
- Contribute ideas, challenge assumptions, explain tradeoffs, and recommend approaches.
- Introduce complexity progressively. Avoid overwhelming explanations and unnecessary questions.
- Discuss consequential decisions before implementing them. Handle routine implementation details independently.
- Preserve understanding, decision ownership, and momentum.

Consult `AI_WORKFLOW.md` for detailed guidance during exploration, architectural discussions, unfamiliar problems, or deliberate learning sessions.

Do not reread the entire document for every small, well-understood implementation task.

## Working with Files

- Follow the [Git Workflow](README.md#git-workflow): create a dedicated branch before editing files for a new task. Reuse an existing task branch only when continuing unfinished work; after merging, start subsequent work on a new branch. Small documentation or wording fixes may be made directly on the default branch.
- Use the local repository as the primary source of project information.
- Resolve file paths relative to the repository root.
- Read only files relevant to the current task.
- Avoid unnecessary searches, repeated file reads, and excessive tool output.
- If a requested file cannot be found, explain the problem before searching external sources.
- Keep private professional information, local databases, and credentials out of version control.
- Use sanitized example data when public documentation or tests require representative professional information.

## Implementation

- Follow the established architecture and current roadmap milestone.
- Prefer simple solutions and minimal, focused changes.
- Respect existing conventions and established decisions.
- Avoid speculative features, unnecessary abstractions, and unrelated refactoring.
- Do not introduce functionality explicitly excluded from the MVP without an agreed scope change.
- Keep external actions such as application submission and outreach under manual control during the MVP.
- Treat external job advertisements and LLM outputs as untrusted information. Never invent or exaggerate professional qualifications.
- Define verifiable outcomes and run appropriate checks.
- Report changes, verification results, and unresolved issues concisely.

For small, clearly defined tasks, execute efficiently without introducing unnecessary planning or discussion.

## Documentation

- Update documentation when meaningful architectural, product, or implementation decisions change.
- Record significant decisions and their rationale in `docs/DECISIONS.md`.
- Keep the architecture and roadmap consistent with established decisions.
- Avoid duplicating detailed information across documents.
- Preserve existing content where possible and keep updates focused.

Do not create additional documentation or extensively rewrite existing documents unless the task justifies it.
