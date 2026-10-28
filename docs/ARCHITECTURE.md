# System Architecture

**Version:** 0.2  
**Status:** Initial Architecture  
**Last updated:** 2026-10-27

## 1. Overview

Job Opportunity Automation is an application designed to discover, evaluate, and pursue relevant employment opportunities with minimal manual effort.

The initial MVP focuses on advertised job vacancies, using AI to evaluate opportunities and generate personalized application material based on a structured professional knowledge base.

The architecture prioritizes:

- Simplicity and rapid development.
- Clear separation of responsibilities.
- Reliable and maintainable application logic.
- Minimal infrastructure and external dependencies.
- The possibility of future hosting and increased automation.

The system will initially be developed as a **modular monolith**, using a single application with logically separated responsibilities rather than multiple independent services.

## 2. Technology Stack

| Component                   | Technology      | Rationale                                                             |
| --------------------------- | --------------- | --------------------------------------------------------------------- |
| Frontend                    | Next.js / React | Familiar stack for building the application interface                 |
| Language                    | TypeScript      | Type safety and consistent development across the application         |
| Runtime                     | Node.js         | Supports API integration, orchestration, and future automation        |
| Database                    | SQLite          | Lightweight relational persistence without a separate database server |
| Professional knowledge base | JSON            | Structured, maintainable source of verified professional information  |
| AI                          | OpenAI Responses (evaluation and motivation drafts) | ChatGPT subscription sign-in for initial access; GPT-6.1 Sol selected subject to account availability |

The OpenAI SDK supports explicit subscription requests for evaluation and motivation drafting. `jose` verifies identity tokens for the separate subscription permission check. Additional tooling will be selected when its requirements become clearer.

Python and separate backend services are excluded from the initial architecture because they introduce complexity without a demonstrated advantage for the MVP.

## 3. Execution Environment

The application will initially run locally and be accessed through a web browser, minimizing infrastructure requirements during development and early usage.

External services will be used for job discovery and LLM functionality.

Hosted deployment remains a future option rather than an initial requirement. The architecture should avoid unnecessary dependencies on a specific execution environment, without introducing abstractions solely to support hypothetical deployment scenarios.

## 4. System Responsibilities

The application will contain several logical areas of responsibility.

### 4.1 User Interface

Provides the means to:

- Initiate opportunity discovery and processing.
- Browse and inspect discovered opportunities.
- Review suitability evaluations and supporting reasoning.
- View, copy, and adjust generated application material.
- Track application statuses and outcomes.

The interface should remain separate from the underlying business logic.

Route files remain in `src/app/`; Server Actions are grouped by feature in `src/app/actions/`. UI components are grouped by feature under `src/components/`. The opportunity interface uses `OpportunityDiscovery` to coordinate the search, `LocationPicker` to manage location selection, `OpportunityList` to display advertisements, and `OpportunityEvaluation` to run and review evaluations. Server-side data access and integration code remain in `src/lib/`.

The Ember visual foundation uses regular CSS: `src/app/theme.css` defines shared design variables and locally hosted Inter/Geist Mono fonts; `src/app/globals.css` contains base typography, shared controls and the current component styles. Opportunity preparation and tracking use a flat responsive layout, with request details available through native disclosures. D025 records the design direction and the boundary of this first redesign slice.

`WorkspaceShell` and its CSS Module provide the responsive page layout and navigation. Discovery, tracking, AI connection and profile are separate views selected through URL fragments. `OpportunityWorkspace` keeps shared tracking updates outside those views, and the shell hides inactive views without unmounting them so search and editor state survive navigation. The homepage still loads all private/server data on the server and passes only the existing display information and rendered setup sections to the client shell. D026 records the navigation decision.

Discovery and tracking share `OpportunityList` and `OpportunityCard`. Cards start collapsed, showing advertisement identity, dates and a labelled manual status. Card-specific layout lives in a CSS Module, while shared status colors remain in the theme/global CSS. Expanded cards show one of four task panels: Advertisement, Evaluation, Application and Tracking. Existing evaluation, draft and tracking components stay mounted while tabs or cards are hidden; editor activity remains visible and continues to protect unsaved changes. D027–D028 record these browsing refinements.

Automated tests live separately under `tests/`, grouped into `discovery`, `evaluation`, `chatgpt`, `profile`, `database`, and `application`. Each group has an npm command, and `npm test` discovers all test files. Tests import the existing application modules directly and continue to use sanitized examples, temporary databases, and mocked provider responses. See the README for commands and AGENTS.md for proportionate verification guidance; D022 records the organization decision.

Validation rules and their related TypeScript types live together in `src/schemas/opportunity.ts`, `src/schemas/professional-profile.ts`, and `src/schemas/job-search.ts`. Schemas for the same workflow are grouped together: job search includes search criteria, JobSearch responses, source advertisements and workplace addresses, and the Taxonomy municipality response. Shared data models, such as an opportunity used by discovery and persistence, have their own schema modules. Names and comments distinguish external response formats from application data. These modules contain data definitions without file, database, or network access. SQL migrations separately define the database structure.

### 4.2 Opportunity Discovery

Retrieves job advertisements from supported external sources.

Platsbanken's public JobSearch API is the intended initial integration.

The server-only connector in `src/lib/job-search.ts` fetches one batch using search text and an optional array of municipality identifiers. It sends unique identifiers as repeated `municipality` parameters in one request, matching any selected area; an empty selection searches nationwide. It converts source fields to our opportunity format using shared validation from `src/schemas/opportunity.ts`, preserves plain advertisement text, and returns the API's total match count together with valid opportunities, a count of skipped invalid advertisements, and pagination metadata. The optional offset is validated from 0 to 2,000. The next offset advances by raw source hits, including skipped advertisements; an empty page, the reported end, or the source offset limit stops pagination. Requests have a ten-second timeout and bypass caching. Network, HTTP, or malformed-response failures stop the search with an error; individual invalid advertisements are skipped. It performs no database writes. The same module loads the official municipality list from JobTech Taxonomy, cached for one day; lookup failure leaves nationwide search available.

The homepage renders `src/components/opportunities/opportunity-discovery.tsx`, a client component using a Server Action from `src/app/actions/opportunity-actions.ts`. The action validates form fields, reads all submitted location identifiers, calls the connector, and saves the valid batch in one database transaction before returning the saved records. The interface labels the picker as **Location**, with a searchable checkbox list and removable selections. Selected identifiers are submitted independently of the picker filter, so hiding a selected checkbox does not lose that location. Each advertisement shows its supplied location or **Not provided**. The interface shows progress, errors, empty results, full advertisement text, and original-source links. Each request fetches up to 20 advertisements. **Load more** submits the successful search criteria and next offset, then appends unseen opportunity IDs while keeping existing cards and their local evaluation state mounted. Draft form edits apply only to a new search. A successful new search replaces the list; failures preserve the last successful list and next offset for retry. Buttons are disabled while a search request is pending. Search criteria stay selected after submission. The interface reports cumulative displayed and skipped counts and explains when the source browsing limit requires a narrower search. Search page state is not persisted; refresh reads the latest 20 saved records. External advertisement text is rendered as text, not HTML.

Responsibilities include:

- Fetching available opportunities.
- Extracting and normalizing relevant information.
- Identifying previously encountered opportunities.
- Preparing records for evaluation and persistence.

Additional discovery sources may be introduced later.

### 4.3 Opportunity Evaluation

Evaluates opportunities against the professional knowledge base.

The evaluation should consider:

- Relevant skills and demonstrated competencies.
- Transferable experience and problem-solving capabilities.
- Requirements, responsibilities, and potential qualification gaps.
- Professional interests and career preferences.

Matching should not rely exclusively on rigid keyword comparisons or years-of-experience thresholds.

The system should consider credible stretch opportunities while identifying genuine eligibility barriers and clearly unsuitable positions.

The initial live flow starts in `OpportunityEvaluation` in `src/components/opportunities/` and the Server Action in `src/app/actions/evaluation-actions.ts`. `evaluateSavedOpportunity()` in `src/lib/opportunity-evaluation.ts` reads the saved advertisement and private profile and prepares only skills and competencies, professional experience, education, and career preferences. It excludes personality and interests and other top-level fields while preserving rich details and uncertainty notes inside approved sections. The action passes this input to the browser-bound auth store; credentials never leave that store for browser code. An explicit click is required. The simulator remains isolated for automated workflow tests, with no simulation button in the app.

`src/schemas/opportunity-evaluation.ts` defines the recommendation, summary, supporting evidence, and gaps or unknowns. Recommendations are **Worth considering**, **Needs clarification**, or **Unlikely fit**, with no numerical score. `src/lib/opportunity-evaluations.ts` reads or saves one current result per opportunity. Migration `004-enable-live-opportunity-evaluations.sql` upgrades the table from migration 003, preserving samples and adding a required model name for live results. Saved samples remain visibly labelled; the next explicit evaluation may replace them. Saved live results are reused unless the user explicitly reruns the evaluation. Failure preserves the previous result. The full input is not persisted or returned to the client, although generated evidence can include relevant professional facts. Missing evaluation setup does not prevent discovery.

`src/lib/chatgpt-evaluation.ts` checks that the connected account lists `gpt-6.1-sol`, then requests one structured evaluation using the installed OpenAI SDK and subscription credentials. System instructions treat the advertisement and profile as untrusted evidence, distinguish confirmed experience from transferable capabilities and unconfirmed details, and treat missing information as unknown. Recommendations prioritize evidence for the job's main work over shared tools; material unknowns about central responsibilities call for clarification rather than rejection. The request uses low reasoning effort, a 4,000-token output limit, a 90-second timeout, and a strict JSON schema derived from the live result validator. There are no tools, automatic retries, model substitutions, or paid API fallback. Refused, incomplete, malformed, or invalid results are not saved. One active evaluation is allowed per connection; duplicate clicks for that job share the pending request. Signing out or expiry before completion prevents saving through that connection. Four saved roles have been reviewed, including two further frontend-oriented roles judged credible stretches. The second led to refined recommendation guidance; a rerun with the updated profile produced an appropriately qualified recommendation. A credible-stretch rerun retained a grounded positive recommendation. Wording about undocumented skills still needs scrutiny; the reviewed cases do not establish broad reliability. Sol remains the evaluation model after the completed two-case comparison recorded in D020. Broader quality validation remains open.

The separate `ChatGPTConnectionCard` in `src/components/chatgpt/` calls `src/app/actions/chatgpt-actions.ts` to begin sign-in or sign out locally. The server-only `src/lib/chatgpt-auth.ts` generates PKCE, state and nonce values, and redirects to OpenAI's published public-client authorization flow. `src/app/auth/callback/route.ts` binds the reply to the browser session, consumes the attempt once, exchanges the code, verifies the signed ID token, and checks the token response's granted subscription scope. `src/schemas/chatgpt-auth.ts` groups response checks, display types, and fixed notices. The displayed status distinguishes identity-only sign-in from subscription permission; neither proves inference works.

Credentials remain in a server-memory store associated with an HTTP-only browser cookie. Server restart requires a new sign-in, and this first version does not refresh expired credentials. The ignored `data/chatgpt-registration.json` retains only the stable host identifier, issued client ID, and verified account subject for one registered account/workspace. Local sign-out removes memory state and the cookie but retains that registration. The callback is restricted to HTTP on `127.0.0.1`; development logging excludes callback queries. Registration metadata is excluded from server file tracing. Manual sign-in and subscription permission have been verified; tests use synthetic identities and mocked HTTP responses.

The card's explicit **Test subscription connection** action separately calls `testConnection()` on the auth store. The store checks the browser's active permission and credentials, deduplicates concurrent attempts, and reuses a successful result in memory. The server-only `src/lib/chatgpt-connection-test.ts` fetches visible models from the public account catalog, then uses the OAuth token with the installed OpenAI SDK to send one fixed, nonpersonal message to `gpt-6.1-sol` only if it was listed. The shared server-only `src/lib/chatgpt-response.ts` transport uses the public Responses endpoint with `store: false`, `stream: true`, no retries, and bounded timeouts. Text deltas and finalized text parts are accumulated in output order, without duplicating finalized parts. The completed response's text is preferred when present; otherwise the accumulated text is used. Only a validated completed event with a nonempty short reply establishes success; partial output is never displayed as successful. Errors retain safe diagnostic codes, HTTP status, and request IDs without exposing credentials or raw provider messages. No API-key fallback, profile loader, advertisement loader, database write, or automatic test is connected to this action. The model list and test result are safe display data; both are forgotten when the connection ends. Manual testing has verified model discovery and the fixed-message response; live opportunity evaluation has a separate explicit action, with its first manual trial recorded in D019.

### 4.4 Application Generation

Generates relevant application material using the structured professional profile and the requirements of an opportunity.

The system should:

- Select appropriate supporting experiences and accomplishments.
- Emphasize demonstrated capabilities and problem-solving.
- Produce concise, natural, and professionally appropriate language.
- Avoid unnecessary employer names and technology lists.
- Distinguish verified qualifications from transferable competencies.
- Avoid invented or exaggerated claims.

The MVP will generate material for manual review and submission.

The first implementation uses `ApplicationDraft` in the existing opportunity component folder and Server Actions in `src/app/actions/application-actions.ts`. Opening the editor reads the saved draft on demand; it does not load the profile or invoke a model. The user enters the employer's question manually, then explicitly requests a Swedish motivation. `src/lib/application-generation.ts` loads the advertisement and current private profile, reuses the approved input boundary from evaluation, validates the question and storage setup, and passes the request through the browser-bound auth store. Previous evaluations and draft text are not model input. No form scraping, CV generation, uploads or submission are automated.

`src/lib/chatgpt-application.ts` checks Sol availability and uses the shared bounded response transport with strict structured output, low reasoning effort, a 4,000-token output limit and a 90-second timeout. Instructions require grounded Swedish prose and prohibit invented motivations, preferences, qualifications, availability and salary. Profile, advertisement and question are untrusted evidence. The connection permits one evaluation or generation request at a time; identical pending generation requests share one attempt. Sign-out or expiry discards completion. No retries, tools, alternate model or paid API fallback are enabled.

Generation returns a candidate to the editor without writing the database. `src/lib/application-drafts.ts` reads and saves one draft per opportunity in the table added by migration 005. Saved fields are question, text, nullable originating model, revision and UTC save time. Explicit saves compare the loaded revision so an older tab cannot overwrite a newer save. The model label indicates the draft's origin and may include manual edits. Existing editor text requires confirmation before generation or reopening; failures retain it. Dirty or busy editors block a new search, appended search pages keep them mounted, and refresh warns about unsaved work. Drafts are not version history and are loaded again explicitly after refresh. Schemas and display state types live in `src/schemas/application-draft.ts`; tests use the agreed `tests/application/` group.

The generation workflow should initially favor a simple LLM-based approach. Additional processing or validation steps should only be introduced when they provide meaningful improvements.

### Application Tracking

The manual tracking workflow uses `src/schemas/opportunity-tracking.ts`, `src/lib/opportunity-tracking.ts` and Server Actions in `src/app/actions/tracking-actions.ts`. Migration 006 adds a current row per explicitly tracked opportunity and separate status-history rows. A missing current row means To review, without a write or fabricated timestamp. Current tracking saves and actual status events share one immediate transaction, with optimistic revision checks. Notes/date edits update current metadata without creating status events. Identical writes do nothing. Application dates are optional calendar dates; history dates are UTC recording timestamps.

`OpportunityTracking` displays status, editable fields and recent history in the existing opportunity component folder. Discovery reads tracking metadata in one batch so previously pursued roles are recognizable. `TrackedOpportunities` reads a separate filtered, paginated list; To review includes unmarked saved ads, while All tracked requires a current tracking row. Expanding an item reuses `OpportunityList` and its evaluation/draft controls. `OpportunityWorkspace` shares fresh tracking metadata and a change counter between discovery and the list. List refreshes wait for dirty/busy editors to finish; searches and filters cannot silently remove unsaved work. Revision conflicts also protect duplicate editors and other tabs.

Tracking does not read the private profile, require subscription sign-in, contact employers, or invoke AI. Notes are local data and are excluded from generation/evaluation inputs. Tests remain in the existing application, discovery and database groups. D024 defines the statuses, date meanings and future dashboard boundary.

### 4.5 Workflow Orchestration

Coordinates the processing of opportunities through discovery, evaluation, generation, and persistence.

Responsibilities include maintaining execution state, handling failures, and coordinating the relevant application components.

The initial implementation should remain simple, but potentially long-running operations should not rely on keeping a browser request open indefinitely.

The specific execution mechanism will be determined during implementation.

### 4.6 Persistence and Tracking

Stores discovered opportunities, evaluations, generated application material, and application statuses.

The application uses SQLite for persistent operational data.

Application records should support:

- Avoiding duplicate opportunities and unnecessary repeated processing.
- Revisiting previous evaluations and generated material.
- Tracking which opportunities have been pursued.
- Recording basic application outcomes.
- Supporting future experimentation and improvements.

The initial schema should support actual MVP requirements without attempting to model every possible future workflow.

## 5. Data Architecture

The system separates professional knowledge from operational application data.

### Professional Knowledge Base — JSON

A structured JSON file serves as the primary source of truth for professional information.

The local file is `professional-profile.json` in the repository root and is excluded from Git. A sanitized `professional-profile.example.json` documents the working four-section format: skills and competencies, experiences grouped into professional and education arrays, personality and interests, and career preferences. The server-only loader validates the section structure and core experience fields while preserving additional information, including uncertainty notes. Dates, contribution lists, and education project lists are optional; unfinished sections and empty experience arrays are allowed. Validation does not supply missing facts or assess proficiency. The interface reads the profile at request time and displays only loading status and professional-experience and education counts.

It contains verified skills, experiences, contributions, interests, and career preferences.

The knowledge base is maintained independently of generated application material.

The initial representation combines structured fields with rich natural-language descriptions. Its schema may evolve as additional experiences and requirements are introduced.

### Operational Data — SQLite

SQLite serves as the application's relational database, storing opportunities, evaluations, generated application material, processing history, and statuses.

SQLite is expected to support both the MVP and the full application, including future autonomous workflows. The database choice should only be reconsidered if new requirements, such as distributed execution or hosting constraints, justify a change.

Database interactions should remain reasonably separate from business logic without introducing unnecessary abstraction.

Initial database access uses direct SQL through `better-sqlite3`. The server-only connection module, `src/lib/db.ts`, opens `data/app.sqlite` on demand and creates its directory if necessary. The caller closes the connection after use. The entire `data/` directory is local operational data and is excluded from Git.

Schema changes are versioned as numbered SQL files in `migrations/` and applied explicitly with `npm run db:migrate`. The runner in `scripts/migrate.ts` records completed files in `schema_migrations`. Each file's SQL and its tracking entry run in the same transaction; a failure rolls back that file and stops further processing. Repeating the command skips recorded files. Run it after pulling schema changes, keep applied migrations unchanged, and add a new numbered SQL file for each later change; the runner owns the transaction.

The initial `opportunities` table stores advertisement facts, with a unique `(source, source_id)` pair. Source identifiers, title, URL, and discovery time are required and checked for empty or ordinary-space-only values. Company, location, description, publication date, and application deadline may be unknown. Migration `002-add-opportunity-location.sql` adds the nullable location column to existing databases. The connector derives display text from supplied workplace addresses, preferring municipality, then city, region, or country; distinct names are combined. Missing or malformed location data remains unknown, independently of the search filters.

The server-only `src/lib/opportunities.ts` module validates and saves opportunities, reads them by internal ID, and lists recent records. Callers pass an open database connection and close it after use. Required text is trimmed and must remain nonblank; URLs must use HTTP or HTTPS. Optional text is trimmed, with blank values stored as `null`. Dates accept ISO calendar dates or timestamps with or without a timezone and are preserved unchanged; a missing timezone must not be assumed to mean UTC or the host computer's timezone. The module generates its own UTC discovery timestamp. Duplicate discovery only fills a missing location when supplied; existing locations and all other saved fields remain unchanged. Input validation errors and database failures propagate to the caller; reading a missing record returns `null`. The homepage reads the latest 20 records on each page load, ordered by discovery time and then internal ID. Page loads do not trigger searches or writes to the opportunities table. Tests use temporary databases, including closing and reopening connections and rollback of failed search batches.

### External Data

Job advertisements and LLM responses originate from external services.

External information should be treated as potentially incomplete or unreliable. Generated claims about the applicant must remain grounded in the professional knowledge base.

## 6. High-Level Data Flow

The initial MVP follows this conceptual workflow:

1. **Discovery:** Retrieve job advertisements from Platsbanken.
2. **Normalization:** Transform external advertisements into a consistent internal representation.
3. **Persistence:** Store new opportunities and identify existing records.
4. **Evaluation:** Compare opportunity requirements against the professional profile.
5. **Selection:** Identify opportunities worth pursuing.
6. **Generation:** Produce tailored application material using relevant verified evidence.
7. **Review:** Present opportunities and generated material for human review.
8. **Tracking:** Record application decisions, statuses, and eventual outcomes.

These steps describe logical responsibilities rather than requiring separate services or independent execution processes.

The workflow may evolve as we learn from implementation and real application results.

## 7. Security and Privacy

The application will handle professional information, potentially sensitive personal data, and external API credentials.

Initial principles:

- Keep private professional information outside the public Git repository.
- Exclude local database files and environment secrets from version control.
- Keep API credentials and database operations on the server side.
- Avoid exposing private information unnecessarily through the client interface or application logs.
- Consider what professional information is transmitted to external LLM providers.
- Respect external service terms and restrictions.

Additional security measures will be introduced as required by deployment and automation capabilities.

## 8. MVP Boundaries

### Included

- Local web interface.
- Platsbanken job discovery.
- Opportunity evaluation using structured professional information.
- AI-assisted application generation.
- Manual review and application submission.
- Persistent opportunity and application tracking.

### Excluded Initially

- Automated application submissions.
- Autonomous browsing and form completion.
- Proactive employer research and outreach.
- Unattended scheduled execution.
- Multiple recruitment platform integrations.
- Multi-user functionality.
- Hosted deployment infrastructure.

These exclusions define the initial scope, not permanent architectural limitations.

## 9. Open Technical Decisions

Significant unresolved technical choices and their current evaluation status are maintained in [DECISIONS.md](DECISIONS.md).

Implementation details should be determined when concrete requirements emerge, prioritizing simplicity and avoiding premature complexity.

### Tooling Maintenance

Previously recorded tooling limitation: ESLint 9 was retained for compatibility with the Next.js lint plugins. The earlier development-dependency audit reported five high-severity entries from one [braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), while the production-dependency audit reported none. This preserves the prior README's audit note, not a fresh security assessment. Recheck dependency status when compatible upgrades are considered.

## 10. Future Evolution

The long-term goal is conditional autonomy, where the system can independently pursue suitable opportunities through supported and permitted execution channels.

Possible future developments include:

- Additional opportunity discovery sources.
- Proactive company research and personalized outreach.
- Automated application submission.
- Scheduled and unattended workflows.
- Expanded tracking and performance analysis.
- Hosted execution, with persistence requirements reassessed if the chosen hosting environment demands it.

These capabilities should emerge from validated requirements rather than speculative architectural preparation.

The initial modular structure should support gradual evolution without requiring premature infrastructure or abstractions.
