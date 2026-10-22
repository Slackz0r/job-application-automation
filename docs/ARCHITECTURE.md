# System Architecture

**Version:** 0.2  
**Status:** Initial Architecture  
**Last updated:** 2026-10-22

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
| AI                          | OpenAI Responses (live evaluation planned) | ChatGPT subscription sign-in for initial access; GPT-6.1 Sol selected subject to account availability |

The OpenAI SDK is installed, but no live evaluation connection is enabled. `jose` verifies identity tokens for the separate subscription permission check. Additional tooling will be selected when its requirements become clearer.

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

Validation rules and their related TypeScript types live together in `src/schemas/opportunity.ts`, `src/schemas/professional-profile.ts`, and `src/schemas/job-search.ts`. Schemas for the same workflow are grouped together: job search includes search criteria, JobSearch responses, source advertisements and workplace addresses, and the Taxonomy municipality response. Shared data models, such as an opportunity used by discovery and persistence, have their own schema modules. Names and comments distinguish external response formats from application data. These modules contain data definitions without file, database, or network access. SQL migrations separately define the database structure.

### 4.2 Opportunity Discovery

Retrieves job advertisements from supported external sources.

Platsbanken's public JobSearch API is the intended initial integration.

The server-only connector in `src/lib/job-search.ts` fetches one batch using search text and an optional array of municipality identifiers. It sends unique identifiers as repeated `municipality` parameters in one request, matching any selected area; an empty selection searches nationwide. It converts source fields to our opportunity format using shared validation from `src/schemas/opportunity.ts`, preserves plain advertisement text, and returns the API's total match count together with valid opportunities and a count of skipped invalid advertisements. Requests have a ten-second timeout and bypass caching. Network, HTTP, or malformed-response failures stop the search with an error; individual invalid advertisements are skipped. It performs no database writes. The same module loads the official municipality list from JobTech Taxonomy, cached for one day; lookup failure leaves nationwide search available.

The homepage renders `src/components/opportunities/opportunity-discovery.tsx`, a client component using a Server Action from `src/app/actions/opportunity-actions.ts`. The action validates form fields, reads all submitted location identifiers, calls the connector, and saves the valid batch in one database transaction before returning the saved records. The interface labels the picker as **Location**, with a searchable checkbox list and removable selections. Selected identifiers are submitted independently of the picker filter, so hiding a selected checkbox does not lose that location. Each advertisement shows its supplied location or **Not provided**. The interface shows progress, errors, empty results, full advertisement text, and original-source links. It currently requests up to 20 advertisements in total per search. Search criteria stay selected after submission. External advertisement text is rendered as text, not HTML.

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

`src/lib/chatgpt-evaluation.ts` checks that the connected account lists `gpt-6.1-sol`, then requests one structured evaluation using the installed OpenAI SDK and subscription credentials. System instructions treat the advertisement and profile as untrusted evidence, distinguish confirmed experience from transferable capabilities and unconfirmed details, and treat missing information as unknown. The request uses low reasoning effort, a 4,000-token output limit, a 90-second timeout, and a strict JSON schema derived from the live result validator. There are no tools, automatic retries, model substitutions, or paid API fallback. Refused, incomplete, malformed, or invalid results are not saved. One active evaluation is allowed per connection; duplicate clicks for that job share the pending request. Signing out or expiry before completion prevents saving through that connection. Real evaluation quality remains unverified; comparing Luna with Sol is deferred until real outputs are available.

The separate `ChatGPTConnectionCard` in `src/components/chatgpt/` calls `src/app/actions/chatgpt-actions.ts` to begin sign-in or sign out locally. The server-only `src/lib/chatgpt-auth.ts` generates PKCE, state and nonce values, and redirects to OpenAI's published public-client authorization flow. `src/app/auth/callback/route.ts` binds the reply to the browser session, consumes the attempt once, exchanges the code, verifies the signed ID token, and checks the token response's granted subscription scope. `src/schemas/chatgpt-auth.ts` groups response checks, display types, and fixed notices. The displayed status distinguishes identity-only sign-in from subscription permission; neither proves inference works.

Credentials remain in a server-memory store associated with an HTTP-only browser cookie. Server restart requires a new sign-in, and this first version does not refresh expired credentials. The ignored `data/chatgpt-registration.json` retains only the stable host identifier, issued client ID, and verified account subject for one registered account/workspace. Local sign-out removes memory state and the cookie but retains that registration. The callback is restricted to HTTP on `127.0.0.1`; development logging excludes callback queries. Registration metadata is excluded from server file tracing. Manual sign-in and subscription permission have been verified; tests use synthetic identities and mocked HTTP responses.

The card's explicit **Test subscription connection** action separately calls `testConnection()` on the auth store. The store checks the browser's active permission and credentials, deduplicates concurrent attempts, and reuses a successful result in memory. The server-only `src/lib/chatgpt-connection-test.ts` fetches visible models from the public account catalog, then uses the OAuth token with the installed OpenAI SDK to send one fixed, nonpersonal message to `gpt-6.1-sol` only if it was listed. The shared server-only `src/lib/chatgpt-response.ts` transport uses the public Responses endpoint with `store: false`, `stream: true`, no retries, and bounded timeouts. Text deltas and finalized text parts are accumulated in output order, without duplicating finalized parts. The completed response's text is preferred when present; otherwise the accumulated text is used. Only a validated completed event with a nonempty short reply establishes success; partial output is never displayed as successful. Errors retain safe diagnostic codes, HTTP status, and request IDs without exposing credentials or raw provider messages. No API-key fallback, profile loader, advertisement loader, database write, or automatic test is connected to this action. The model list and test result are safe display data; both are forgotten when the connection ends. Manual testing has verified model discovery and the fixed-message response; live opportunity evaluation has a separate explicit action and still awaits its first manual quality review.

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

The generation workflow should initially favor a simple LLM-based approach. Additional processing or validation steps should only be introduced when they provide meaningful improvements.

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

Schema changes are versioned as numbered SQL files in `migrations/` and applied explicitly with `npm run db:migrate`. The runner in `scripts/migrate.ts` records completed files in `schema_migrations`. Each file's SQL and its tracking entry run in the same transaction; a failure rolls back that file and stops further processing.

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
