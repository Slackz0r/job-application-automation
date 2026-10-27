# Development Roadmap

**Version:** 0.1  
**Status:** Initial discovery, evaluation, motivation drafting, and tracking flows implemented — hands-on end-to-end validation continues
**Last updated:** 2026-10-27

## 1. Purpose

This roadmap outlines the initial development milestones for Job Opportunity Automation.

The goal is to build a usable foundation for discovering, evaluating, and pursuing employment opportunities while progressively developing the capabilities needed for greater automation.

The MVP is intended to become the first working version of the finished product, not a disposable prototype.

Development will prioritize simplicity, practical functionality, and rapid iteration. Milestones may be revised as implementation reveals new requirements or better approaches.

Architectural decisions and system responsibilities are documented separately in `ARCHITECTURE.md`.

## 2. MVP Objective

Build a web application that allows the user to:

1. Discover relevant job advertisements from Platsbanken.
2. Evaluate opportunities against a structured professional knowledge base.
3. Identify promising opportunities, including credible stretch positions.
4. Generate truthful and personalized application material.
5. Review and manually submit applications.
6. Track applications, outcomes, and opportunities for improvement.

The MVP should provide a usable end-to-end workflow while also serving as a practical environment for evaluating and refining the system's behavior.

Automated application submission is not required for the MVP.

## 3. Development Milestones

### Milestone 1 — Project Foundation

**Goal:** Establish the application and its essential infrastructure.

**Current progress:** Complete. Next.js/TypeScript setup, server-side professional profile loading, the SQLite connection, and the first opportunities table are implemented. The migration command has been checked for repeat runs, preservation of saved data, and rollback on failure. Application logic validates, saves, and reads opportunities, preserves existing records on duplicate discovery, and has been tested across reopened connections using temporary databases. Real discovery and the opportunity interface belong to Milestone 2.

Scope:

- Initialize the Next.js application with TypeScript.
- Set up SQLite persistence.
- Integrate the existing JSON professional knowledge base.
- Establish a minimal application structure with clear responsibilities.
- Configure development tooling, environment variables, and basic error handling.
- Protect private data, database files, and credentials from accidental Git commits.

**Completion criteria:**

- The application runs locally.
- SQLite can store and retrieve application data.
- The professional knowledge base can be loaded and accessed by server-side application logic.
- The project is ready for incremental feature development.

### Milestone 2 — Opportunity Discovery

**Goal:** Retrieve and browse real job opportunities.

**Current progress:** Implemented. The homepage supports free-text search and an optional **Location** picker with multiple selections, saves valid results in SQLite, and displays each advertisement's location, text, and original-source link. Search locations use official municipality identifiers and are combined in one request. A new migration adds optional location text to saved opportunities, and rediscovery fills missing locations without replacing existing facts. Recent records remain visible after refresh or application restart. Tests cover duplicate handling, source dates, form validation, API failures, and rollback of failed save batches. Browser checks verified live searches, retained search criteria, saved records after refresh, empty results, and readable advertisement details. Searches load 20 records at a time, and **Load more** appends the next batch without replacing the current list. It retains submitted criteria, deduplicates repeated advertisements, and preserves results on failure. Refresh still shows the latest 20 saved records. Broader searches may require narrowing when the source pagination limit is reached. Discovery supports continued hands-on trials of the evaluation workflow.

Scope:

- Integrate Platsbanken's JobSearch API.
- Support initial search or filtering criteria.
- Normalize retrieved advertisements into an internal representation.
- Store discovered opportunities in SQLite.
- Identify previously retrieved opportunities to avoid duplicates.
- Provide a basic interface for browsing advertisements and viewing their details.

**Completion criteria:**

- The user can initiate a search and retrieve real job advertisements.
- Opportunities can be inspected through the application.
- Retrieved opportunities persist between sessions.
- Repeated searches do not create duplicate records for the same opportunity.

### Milestone 3 — AI Opportunity Evaluation

**Goal:** Identify promising opportunities using verified professional information.

**Current progress:** The first live evaluation flow is implemented and four saved advertisements have been evaluated and reviewed against their source data, including two further frontend-oriented roles judged credible stretches. An explicit **Evaluate with ChatGPT** action sends only the approved profile sections and selected advertisement through the subscription using GPT-6.1 Sol. The app validates a completed structured reply and saves one current result with its model and date. Refresh and rediscovery reuse it; reruns are explicit, and failures preserve the old result. Samples created before the live flow remain clearly labelled until successfully replaced. Missing profile information must remain unknown rather than count as missing experience. The second review led to guidance that prioritizes the job's main responsibilities over shared tools, preserving credible stretch opportunities while requesting clarification for material unknowns about core work. Automated tests use synthetic data and responses. The two real reruns with revised guidance and updated profile produced the intended distinction: clarification for uncertain central specialist work and a positive recommendation for a credible development stretch. Wording about undocumented skills still needs scrutiny. The two-case model comparison is complete, and the user selected Sol for continued evaluation. The temporary Luna comparison feature has been removed; findings are retained in D020. Broader quality and actual usage savings remain unverified. Broader trials remain open before batching.

A separate **Continue with ChatGPT** card implements the subscription sign-in and permission check, which has been verified during manual use. Credentials stay in server memory and sign-in is required after restart or expiry. An explicit **Test subscription connection** action now lists available models and sends one fixed, nonpersonal test message if GPT-6.1 Sol is listed. Manual testing has verified model availability and a completed fixed-message response. Automated tests use synthetic identities and response streams; the first real opportunity evaluation has also completed and been reviewed, while broader quality validation remains outstanding. No daily call count or scheduled processing is enabled.

Scope:

- Integrate an LLM provider.
- Evaluate opportunities against the structured professional knowledge base.
- Consider relevant experience, transferable capabilities, interests, and qualification gaps.
- Avoid automatically rejecting opportunities based solely on unfamiliar technologies or years-of-experience requirements.
- Produce concise, understandable evaluation results.
- Store evaluations for later review.
- Allow the user to identify opportunities worth pursuing.

**Completion criteria:**

- The system can evaluate real job advertisements against the professional profile.
- Results distinguish credible opportunities from unsuitable ones.
- Evaluations provide understandable reasoning and identify important gaps or uncertainties.
- The user can inspect and revisit results without unnecessarily repeating evaluations.

The initial evaluation approach should favor simplicity. More advanced ranking and filtering mechanisms may be introduced if practical results justify them.

### Milestone 4 — Application Generation

**Goal:** Produce useful application material for selected opportunities.

**Current progress:** The first slice supports one editable Swedish motivation per advertisement and a manually supplied application question. Opening, editing, saving and copying require no model request. Explicit generation uses the existing Sol subscription connection and approved profile boundary; the generated candidate is not saved automatically. Revision checks and confirmation protect saved and unsaved edits. Migration 005 adds local draft storage. Focused tests cover requests, failures, persistence and concurrency; browser checks cover the editor and save flow without live generation. The first live motivation has been reviewed by the user, saved, reopened through the application reader, and checked against profile evidence. This validates the initial flow in one case; broader quality review continues through use. Broader application formats and tracking remain future work.

Scope:

- Generate tailored application text based on the job advertisement and professional knowledge base.
- Support application questions supplied manually when they are not available through the job advertisement.
- Select relevant experiences and accomplishments as supporting evidence.
- Prioritize concrete contributions, problem-solving, and transferable capabilities.
- Avoid unsupported claims, exaggeration, and unnecessary employer or technology name-dropping.
- Allow generated material to be reviewed, copied, edited, and saved.

**Completion criteria:**

- The user can select an opportunity and generate relevant application material.
- Responses are grounded in the available professional information.
- Missing qualifications are not presented as verified experience.
- Generated and edited material can be saved and revisited.
- Material can be copied and used in external application forms.

The initial generation process should remain straightforward. Additional steps should only be introduced when they address demonstrated limitations.

### Milestone 5 — Application Tracking and Review

**Goal:** Make the system useful for managing ongoing job applications.

**Current progress:** The first tracking slice is implemented with manual statuses, optional editable application dates, private notes, and persistent status-change history. A separate paginated list filters tracked records and exposes older unmarked ads through To review. Saved advertisements, evaluations and drafts can be reopened from that list. Atomic saves and revisions protect current tracking and history; notes/date corrections do not generate status events, and unsaved editors are protected during searches and list changes. Focused tests and browser checks cover the initial workflow. The user plans a separate UI/dashboard pass after tracking; no dashboard graphs or statistics are implemented yet. History preserves the records needed to define those metrics later. Broader end-to-end use remains the next validation step.

Scope:

- Track opportunities through basic application statuses.
- Record which opportunities have been reviewed, skipped, or applied to.
- Preserve generated material and relevant application history.
- Allow manual notes, observations, and outcome updates.
- Make it easy to revisit existing opportunities and avoid duplicate applications.
- Refine the interface around the complete workflow.

**Completion criteria:**

- The user can manage discovered opportunities and application statuses.
- Application history and generated material remain available across sessions.
- Previously pursued opportunities are clearly identifiable.
- The complete workflow can be used without relying on external tracking spreadsheets or notes.

### Milestone 6 — End-to-End Validation

**Goal:** Validate the MVP through actual job-search usage.

Scope:

- Run the complete workflow against real opportunities.
- Assess the relevance of discovered and recommended positions.
- Review generated material for accuracy and usefulness.
- Identify recurring errors, missing profile information, and unnecessary manual steps.
- Observe execution reliability and approximate API usage costs.
- Improve the most consequential weaknesses discovered through testing.

**Completion criteria:**

- The complete discovery-to-tracking workflow functions reliably.
- Generated applications are sufficiently useful for real submissions after appropriate review.
- Important inaccuracies or recurring problems can be identified and corrected.
- The system provides a practical improvement over the existing manual job-search process.
- Remaining limitations and potential improvements are understood well enough to guide further development.

The goal is not perfect evaluation or application generation, but a reliable and efficient process that produces useful results at scale.

## 4. MVP Boundaries

The following capabilities are intentionally excluded from the initial MVP:

- Autonomous application submission and form completion.
- Proactive company research and spontaneous outreach.
- Unattended scheduled execution.
- Multiple recruitment platform integrations.
- Multi-user functionality.
- Hosted deployment infrastructure.
- Sophisticated analytics, ranking models, or AI orchestration frameworks without demonstrated need.

These capabilities remain possible future extensions.

## 5. Development Approach

Implementation should proceed incrementally, with each milestone producing working functionality.

The following principles guide development:

- Implement the simplest viable solution before introducing additional abstraction.
- Validate functionality using real inputs wherever practical.
- Keep business logic reasonably separate from interface and infrastructure concerns.
- Add testing proportionately, emphasizing important application behavior and failure cases.
- Preserve the user's understanding of meaningful technical decisions.
- Revisit assumptions when implementation or real usage provides evidence that challenges them.
- Update documentation when decisions, scope, or architecture change meaningfully.

Detailed implementation tasks and library choices should be determined as development progresses rather than exhaustively specified upfront.

## 6. Beyond the MVP

The long-term direction is a conditionally autonomous job opportunity system capable of pursuing suitable employment opportunities with minimal manual involvement.

Potential developments include:

- Automated submission through supported and permitted recruitment workflows.
- Additional job discovery sources.
- Proactive employer research and personalized outreach.
- Scheduled and unattended execution.
- Improved prioritization using application history and outcomes.
- Hosted execution where beneficial.

The sequence and scope of these capabilities will be determined by actual product needs, technical feasibility, and experience gained from the MVP.

The immediate priority is establishing a useful, reliable foundation that can evolve toward these capabilities without unnecessary reconstruction.
