# System Architecture

**Version:** 0.2  
**Status:** Initial Architecture  
**Last updated:** 2026-10-20

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
| AI                          | LLM API         | Contextual opportunity evaluation and application generation          |

Specific libraries, database tooling, and the LLM provider will be selected during implementation when their requirements become clearer.

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

### 4.2 Opportunity Discovery

Retrieves job advertisements from supported external sources.

Platsbanken's public JobSearch API is the intended initial integration.

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

The exact evaluation strategy and prioritization criteria remain open to experimentation.

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

The local file is `professional-profile.json` in the repository root and is excluded from Git. A sanitized `professional-profile.example.json` documents the initial single-experience format. The server-only loader validates its core fields while preserving additional information. The interface reads it at request time and displays only loading status and a contribution count.

It contains verified skills, experiences, contributions, interests, and career preferences.

The knowledge base is maintained independently of generated application material.

The initial representation combines structured fields with rich natural-language descriptions. Its schema may evolve as additional experiences and requirements are introduced.

### Operational Data — SQLite

SQLite serves as the application's relational database, storing opportunities, evaluations, generated application material, processing history, and statuses.

SQLite is expected to support both the MVP and the full application, including future autonomous workflows. The database choice should only be reconsidered if new requirements, such as distributed execution or hosting constraints, justify a change.

Database interactions should remain reasonably separate from business logic without introducing unnecessary abstraction.

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
