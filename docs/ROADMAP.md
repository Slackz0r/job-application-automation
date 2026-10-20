# Development Roadmap

**Version:** 0.1  
**Status:** In progress — Milestone 1
**Last updated:** 2026-10-20

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

**Current progress:** Next.js/TypeScript setup, server-side professional profile loading, and the SQLite connection are implemented. The connection has been verified with `SELECT 1`. The first table and storage/retrieval of application data remain the next increment; this milestone is not yet complete.

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
