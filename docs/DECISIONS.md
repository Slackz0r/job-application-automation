# Project Decisions

**Version:** 0.1  
**Status:** Living document  
**Last updated:** 2026-10-22

## 1. Purpose

This document records significant product and architectural decisions, their rationale, and unresolved choices requiring future evaluation.

It complements the project overview, architecture, and roadmap without repeating their detailed specifications.

Decisions should be reconsidered when new requirements or evidence justify doing so, rather than treated as permanent constraints.

## 2. Established Decisions

### D001 — Structured Professional Knowledge Base

**Decision:** Use structured JSON as the primary source of professional information, rather than a traditional CV.

**Rationale:** JSON allows richer experience descriptions, clearer organization, and easier maintenance without CV formatting or length constraints. Initial experiments demonstrated promising contextual application generation, although consistent superiority over CV-based generation remains unverified.

**Revisit if:** Profile size, complexity, or retrieval requirements make the current representation impractical.

### D002 — MVP Strategy

**Decision:** Prioritize advertised job opportunities, beginning with Platsbanken, and defer proactive employer outreach.

**Rationale:** Establishing one complete, usable workflow reduces initial scope while developing capabilities that could later support multiple employment strategies.

**Revisit if:** Technical restrictions or practical results reveal a more effective initial approach.

### D003 — Technology Stack

**Decision:** Use Next.js, React, Node.js, and TypeScript without a separate Python backend.

**Alternatives considered:** TypeScript frontend with a Python backend.

**Rationale:** A single familiar language minimizes integration complexity and supports the anticipated requirements. Python currently offers no demonstrated advantage sufficient to justify the additional scope.

**Revisit if:** A future capability has a compelling dependency on Python-specific functionality.

### D004 — Execution Environment

**Decision:** Run the application locally initially, while keeping hosted deployment possible.

**Rationale:** Local execution minimizes early infrastructure requirements. Hosting is a deployment consideration rather than a defining characteristic of the product.

**Revisit if:** Unattended execution, remote access, or availability requirements justify hosting.

### D005 — Application Architecture

**Decision:** Start with a modular monolith rather than separate services.

**Rationale:** One application with logically separated responsibilities provides sufficient structure without introducing distributed-system complexity.

**Revisit if:** Independent deployment, scaling, or execution requirements justify separating components.

### D006 — Operational Database

**Decision:** Use SQLite for operational data while retaining JSON for professional knowledge.

**Alternatives considered:** Supabase/PostgreSQL and file-based storage.

**Rationale:** SQLite provides relational persistence without requiring a separate database service. Its capabilities are expected to support the full application, including autonomous workflows, not merely the MVP.

**Revisit if:** Distributed execution, concurrency requirements, or hosting constraints provide a concrete reason to change.

### D007 — Opportunity Evaluation and Application Quality

**Decision:** Evaluate opportunities with flexibility regarding transferable capabilities while maintaining strict factual accuracy in application claims.

**Rationale:** Rigid requirement matching could eliminate credible opportunities. However, professional potential must not be represented as verified experience.

Application generation should prioritize relevance, concrete evidence, natural language, and sufficient quality at scale over perfect or highly original prose.

### D008 — Progressive Autonomy

**Decision:** Keep application submission manual in the MVP, with conditional autonomy as the long-term goal.

**Rationale:** Manual submission initially allows application quality and system behavior to be evaluated before introducing consequential external actions.

Future autonomous submissions should depend on verified reliability, clear execution rules, and supported and permitted application channels.

### D009 — Direct SQL and SQLite Driver

**Decision:** Begin with direct SQL through `better-sqlite3`.

**Alternatives considered:** An ORM and Node.js's built-in `node:sqlite` module.

**Rationale:** Explicit SQL suits the initial storage requirements and supports learning how database operations work. The built-in SQLite integration is experimental in the installed Node.js 24.10.0 runtime; `better-sqlite3` provides an established API while keeping SQL visible.

**Tradeoff:** The additional native dependency requires attention to installation and Node.js compatibility. Installation and a connection check succeeded on the current Windows environment without additional build tools.

**Revisit if:** Repetitive mapping or schema maintenance justifies an ORM, or a stable built-in driver offers a practical maintenance advantage. Either change would require adapting and testing the database access code.

### D010 — Minimum Useful Opportunity Data

**Decision:** Save discovered opportunities only when they have source identifiers, a meaningful title, and a usable URL for manual verification. Record when each opportunity was first discovered, and prevent duplicates with a unique `(source, source_id)` pair.

**Rationale:** Identifiers and timestamps support traceability and processing, but a saved opportunity must also support useful browsing and verification. Incomplete source data alone is not a reason to create unusable records.

**Initial scope:** Company, location, description, publication date, and application deadline may be unknown. Location is optional display text based on supplied workplace addresses; distinct place names are combined when an advertisement lists multiple workplaces. It is never inferred from the search filters. Evaluation and generation require sufficient advertisement text before proceeding. The schema enforces required and nonblank fields; the save workflow validates HTTP/HTTPS URLs and ISO dates or timestamps, and generates the discovery timestamp. Source timezone handling is defined in D013.

**Revisit if:** Real source data or workflow requirements reveal a concrete need to change the minimum requirements or add fields.

### D011 — Explicit SQL Migrations

**Decision:** Keep numbered SQL changes in `migrations/` and apply them with `scripts/migrate.ts` through `npm run db:migrate`.

**Rationale:** Explicit setup keeps schema changes visible and repeatable. A tracking table prevents repeated execution, and a transaction keeps each change together with the record that it ran. Failed changes roll back and stop the command, preserving earlier successful work.

Applied migration files remain unchanged; subsequent changes use new files. Migration filenames are tracked without content checksums in the initial implementation.

### D012 — Preserve Opportunities on Duplicate Discovery

**Decision:** Saving an opportunity with an existing `(source, source_id)` preserves its contents and first discovery time. The single exception is filling a missing (`null`) location from newly supplied advertisement data; a known location is never overwritten.

**Rationale:** Repeated discovery should avoid duplicates and preserve the saved advertisement. Filling missing locations lets records saved before the location migration gain useful display information without replacing existing facts. Broader advertisement updates still need an explicit policy.

**Revisit if:** Real discovery reveals a need to refresh changed or expired advertisements.

### D013 — Preserve Source Dates Without Guessing Timezones

**Decision:** Accept valid ISO calendar dates and timestamps with or without a timezone for publication dates and application deadlines. Keep supplied values unchanged. The application-generated discovery timestamp remains UTC.

**Rationale:** Live JobSearch responses supply publication dates and deadlines without timezone information. Preserving the supplied date and time avoids losing information or inventing a timezone. This extends the initial validation rule, which required a timezone on full timestamps.

**Revisit if:** Deadline reminders, comparisons across sources, or other time-sensitive behavior require verified timezone interpretation. A timestamp without a timezone must not automatically be treated as UTC or the host computer's local time.

### D014 — Organise Source Files by Responsibility

**Decision:** Keep route files in `src/app/`, feature-named Server Actions in `src/app/actions/`, feature-grouped UI in `src/components/`, and schemas with their TypeScript types in `src/schemas/`. Group schemas for the same workflow together, including its external API response checks. Shared data models have their own schema modules. Keep data access and integration logic in `src/lib/`; SQL table changes remain in `migrations/`.

**Rationale:** Clear ownership makes the search flow and data requirements easier to find. Keeping workflow schemas together provides one place to review its validation rules; names distinguish source formats from application data. Shared application schemas let connectors and persistence use the same rules without depending on each other's implementation. Split components around meaningful responsibilities and add further structure only when the code needs it.

### D015 — Working Multi-Experience Profile Format

**Decision:** Organize the private JSON profile into `skillsAndCompetencies`, `experiences` with `professional` and `education` arrays, `personalityAndInterests`, and `careerPreferences`. Validate the structure and core experience fields while retaining richer descriptions and uncertainty notes. Dates, contribution lists, and education project lists remain optional; unfinished sections may be empty.

**Rationale:** Opportunity evaluation needs evidence from multiple experiences and education without requiring a complete career history before use. Missing information remains unknown rather than evidence of missing ability. The format does not assign skill proficiency or infer preferences. This replaces the initial single-experience input format without adding new folders or changing profile storage.

**Revisit if:** Evaluation reveals a concrete need for more detailed validation or a different representation of supporting evidence.

## 3. Under Evaluation

### AI Integration

- LLM provider and model selection.
- Whether simple LLM calls are sufficient for opportunity evaluation and application generation.
- Appropriate output structures, evidence checks, and validation mechanisms.

**Initial preference:** Favor simple workflows and introduce additional processing only when justified by results.

### Persistence Implementation

- Additional database tables and schema changes as feature requirements emerge.
- Application status and processing-history representation.

**Initial preference:** Support actual requirements without premature abstractions.

### Workflow Execution

- Handling potentially long-running discovery, evaluation, and generation processes.
- Progress reporting, retries, and failure recovery.

**Initial preference:** Keep execution reliable without introducing unnecessary background infrastructure.

### Opportunity Evaluation

- Initial matching and prioritization criteria.
- Appropriate handling of uncertain requirements and qualification gaps.
- Methods for evaluating recommendation quality through real usage.

### External Integrations

- Practical capabilities, constraints, and usage requirements of Platsbanken's JobSearch API.
- Future recruitment-platform integrations and permitted automation methods.

## 4. Maintenance

Record new decisions when they involve meaningful alternatives, tradeoffs, or consequences for the product.

Avoid documenting routine implementation choices unless they reveal important architectural considerations.

When decisions change, update the relevant architecture or project documentation and preserve the reasoning here.

This document should capture the outcomes of engineering discussions, not become a transcript of them.
