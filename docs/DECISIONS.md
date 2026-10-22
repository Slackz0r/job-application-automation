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

### D016 — Evaluation Provider, Input Boundary, and Simulation First

**Decision:** Select OpenAI with GPT-6.1 Sol for initial live trials. First implement and test the flow using simulated responses only. Prepare skills and competencies, professional experience, education, and career preferences; exclude personality and interests and other top-level profile data. Keep richer information and uncertainty notes inside approved sections. No external transmission or automatic switch to a live provider is enabled in this step.

**Rationale:** The workflow, result display, persistence, and errors can be verified without API charges or sending the private profile to an external service. Restricting input by section limits personal information while preserving professional evidence. Missing information remains unknown. Real evaluation quality will need a separate review on actual advertisements.

**Initial output and storage:** A short recommendation, summary, supporting evidence, and gaps or unknowns, without a numerical score. Save one current result per opportunity, explicitly marked as simulated. Reuse saved results unless the user requests a rerun; replace them only after a successful rerun. The simulator produces illustrative content and does not make suitability judgements.

**Revisit if:** Live trials establish concrete needs for a different model, input selection, evidence structure, or evaluation history. Live evaluation is a separate implementation step; D017 defines the initial subscription connection.

### D017 — ChatGPT Subscription Connection Before Live Evaluation

**Decision:** Use Sign in with ChatGPT for the initial connection, rather than separate paid API billing. Add a **Continue with ChatGPT** button and connection status to the local app. The first step validates identity and the granted subscription permission only; it does not discover models, make inference requests, or send professional profiles or advertisements. Sign-in alone must not be reported as subscription permission.

**Rationale:** The user's existing Plus subscription may support local personal-project usage without additional API spending. A permission check establishes authorization before investing in live evaluation. Account acceptance, model availability, and fixed-message inference have since been verified; see D018.

**Connection lifetime:** Keep credentials and pending sign-in attempts in server memory, bound to an HTTP-only browser-session cookie. Restarting the server requires signing in again; expired credentials also require sign-in for this first version. Retain only a stable installation identifier, the issued client registration ID, and its verified subject in `data/chatgpt-registration.json`, which is already ignored by Git. Reuse the registration for this single-account local installation. Local sign-out clears in-memory credentials and pending attempts; it does not revoke permission in ChatGPT settings.

**Implementation boundary:** Use the published local public-client flow, a `127.0.0.1` callback, PKCE, state and nonce checks, and `jose` to verify signed identity tokens. Never log callback codes or credentials. The component lives in `src/components/chatgpt/`, the callback in `src/app/auth/callback/`, Server Actions in their existing folder, and integration logic and schemas in their existing folders. No API key or automatic paid fallback is enabled.

**Revisit if:** Live checks fail, connection renewal or multiple accounts become useful, or the user chooses persistent protected credential storage or separate API billing. Daily evaluation counts remain undecided and no scheduling is enabled.

### D018 — A Small Subscription Response Test Before Job Evaluation

**Decision:** Extend the existing connection card with an explicit **Test subscription connection** action. Fetch the signed-in account's visible model catalog, then send `Reply with exactly: Subscription connection works.` only if the agreed `gpt-6.1-sol` model is listed. Show the available models and completed reply. If the model is absent, stop and review choices rather than silently choosing another model.

**Rationale:** Successful sign-in and subscription permission were confirmed through the user's manual sign-in on 2026-10-22. They establish authorization, but a completed response is needed to verify inference before sending any professional information. This fixed test contains no profile or advertisement data and does not change simulated job evaluation.

**Request boundary:** The existing OpenAI SDK uses the in-memory OAuth access token with the public Responses endpoint, `store: false`, `stream: true`, and no automatic retries. A successful result requires `response.completed` and a nonempty short reply. Failed, incomplete, or interrupted streams remain failures. There is no paid API fallback, account-credit purchase, or automatic test on sign-in or page load. Concurrent submissions share one attempt; successful tests are reused for that connection. A new attempt after a failed result requires another explicit click.

**Storage and validation:** Results and model choices stay in server memory, with only safe display data returned to the browser. Request IDs, HTTP status, and error codes support diagnosis without exposing credentials or raw provider messages. Integration code stays in `src/lib/chatgpt-connection-test.ts`; related schemas, actions, and UI extend their existing workflow files. Automated tests use synthetic streams and never call a live model. Manual testing on 2026-10-22 verified model discovery and a completed response from `gpt-6.1-sol` with the expected text: `Subscription connection works.` This verifies the connection; D019 defines the separate live evaluation step and records its initial manual review.

### D019 — Explicit Evaluation of One Saved Advertisement

**Decision:** Replace the simulation button with **Evaluate with ChatGPT**, using the existing approved input sections and four-field result format from D016. Use GPT-6.1 Sol through the verified subscription connection for the initial trial. Compare smaller models later against reviewed outputs rather than change the model during this implementation. Work stays in existing source folders.

**Request and reasoning:** An explicit click sends one saved advertisement and the approved professional profile sections. Check account model availability before inference. Request a strict structured reply, low reasoning effort, a maximum of 4,000 output tokens, and a 90-second timeout. Treat advertisement and profile text as untrusted evidence, preserve uncertainty notes, and require missing details to remain unknown. Supporting evidence should identify the relevant experience and distinguish transferable capabilities from direct experience. Structural validation cannot establish factual or reasoning quality, so review the first real result before batching.

**Storage and repeated requests:** Preserve one current result per opportunity. Migration 004 keeps previous samples intact and allows live results with a required model name. The UI labels samples and live results separately and shows the model and save date. A sample is replaced only by a successful explicit real evaluation. Reuse a saved live result unless the user explicitly reruns it. Failed requests or saves preserve the prior result; a save failure after inference must explain that another attempt would use the subscription again. The full input is not persisted, but generated evidence may contain relevant professional facts. Concurrent clicks for one job share a pending model request; another job waits until it finishes. Discard completion after sign-out or credential expiry.

**Boundaries:** No automatic evaluation on sign-in, discovery, or refresh; no tools, automatic retry, alternate model, paid API fallback, or scheduling. The connection test and live evaluation share the bounded streaming transport in `src/lib/chatgpt-response.ts`. Automated tests use sanitized inputs, synthetic streams, and temporary databases; they never call a live model. A first real opportunity evaluation has completed and been reviewed; see the initial manual review below.

**Initial manual review (2026-10-22):** A subscription evaluation of one saved advertisement completed and persisted with its model and date. Comparing its claims with the advertisement and approved profile found supporting evidence grounded in the supplied experience, relevant transferable connections, and material unknowns kept distinct from confirmed mismatches. This is a successful first trial, not evidence of reliable quality across different roles. Broader trials and a Luna/Sol comparison remain open.

## 3. Under Evaluation

### AI Integration

- Quality, cost, and latency of the selected OpenAI model on real evaluations.
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
