# Project Decisions

**Version:** 0.1  
**Status:** Living document  
**Last updated:** 2026-10-20

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

## 3. Under Evaluation

### AI Integration

- LLM provider and model selection.
- Whether simple LLM calls are sufficient for opportunity evaluation and application generation.
- Appropriate output structures, evidence checks, and validation mechanisms.

**Initial preference:** Favor simple workflows and introduce additional processing only when justified by results.

### Persistence Implementation

- Database schema design.
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
