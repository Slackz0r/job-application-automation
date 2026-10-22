# Job Opportunity Automation

**Version:** 0.4  
**Status:** MVP Implementation — Discovery and Initial Live Evaluation
**Last updated:** 2026-10-23

## 1. Vision

Build an intelligent, highly automated system that identifies and pursues relevant employment opportunities with minimal human intervention.

The system should combine the scalability of automation with the quality and personalization of carefully prepared applications.

The ultimate goal is to improve the chances of securing employment while dramatically reducing the time and mental effort traditionally required for job searching.

## 2. Problem Statement

The conventional job application process is fragmented, repetitive, and time-consuming.

Applicants must repeatedly discover opportunities, evaluate suitability, interpret requirements, prepare personalized material, complete application forms, and track outcomes.

Although AI tools can already assist with individual tasks, the applicant remains responsible for coordinating the overall process.

For a junior developer navigating a competitive job market, this creates a significant investment of time and energy with uncertain returns.

**Core problem:** How can we minimize the manual effort required to pursue relevant employment opportunities without sacrificing application quality or personalization?

## 3. Project Objectives

### Primary — Employment

Develop a system that:

- Automates as much of the opportunity discovery and application process as practical.
- Produces truthful, relevant, and personalized applications at scale.
- Minimizes repetitive manual work and unnecessary human intervention.
- Supports multiple approaches to finding employment.
- Measures outcomes to identify and improve effective strategies.

### Secondary — Engineering Portfolio

Use the project to demonstrate practical software engineering capabilities through:

- Thoughtful architecture and technical decision-making.
- Effective and justified use of AI and automation.
- Simplicity, efficiency, reliability, and maintainability.
- Iterative experimentation, testing, and evaluation.
- Transparent, living documentation explaining decisions and their rationale.

## 4. Current Product Hypothesis

A shared system could coordinate multiple employment strategies through reusable information, intelligence, and automation capabilities.

Two initial approaches are being explored:

**Advertised opportunities**

Discover relevant job advertisements, evaluate suitability, prepare tailored applications, and automate submission where feasible and permitted.

**Proactive outreach**

Identify potentially relevant employers, research their technologies and business needs, discover appropriate professional contact channels, and prepare personalized spontaneous applications.

Both approaches could share application intelligence, professional background information, and performance tracking.

Autonomous execution is the eventual goal, reached through initial supervised and testing phases. The exact workflow, architecture, and conditions for autonomy remain undecided.

## 5. Guiding Principles

**Automation over repetition**  
Minimize the need for human coordination and repetitive interaction, not merely the time required for individual tasks.

**Personalization at scale**  
Application volume should not require sacrificing relevance, accuracy, or authentic representation of the applicant.

**Simplicity first**  
Favor the smallest reliable solution that solves the problem effectively. Complexity must provide demonstrable value.

**Selective AI integration**  
Use AI where contextual interpretation, reasoning, or generation provides meaningful benefits. Prefer deterministic approaches when sufficient.

**Evidence-driven development**  
Evaluate solutions through measurable outcomes, including manual effort, quality, reliability, cost, responses, and interviews.

**Responsible automation**  
Preserve factual accuracy, protect personal information, respect platform restrictions, and avoid unwanted or duplicate outreach.

**Transparent engineering**  
Document meaningful decisions, alternatives, tradeoffs, experiments, and lessons learned throughout development.

## 6. Professional Knowledge Base — Initial Design Direction

A structured collection of verified professional information will act as the system's single source of truth.

The initial implementation will use **JSON combining structured fields with rich natural-language descriptions**. This approach was selected for its simplicity, maintainability, and ability to preserve more detailed information than a conventional CV.

The knowledge base will organize information across four main areas:

- **Skills and competencies:** Technical skills, tools, frameworks, and demonstrated engineering capabilities.
- **Experiences:** Education, employment, projects, responsibilities, contributions, challenges, solutions, and outcomes.
- **Personality and interests:** Personal background, motivations, interests, and relevant characteristics.
- **Career preferences:** Professional goals, preferred working environments, and areas of interest.

Individual experiences may contain detailed descriptions of problems, implementations, technical decisions, and reflections. The system should be able to select relevant evidence from multiple experiences and adapt its presentation to different opportunities.

Verified facts must remain distinguishable from interpretations, transferable capabilities, and unconfirmed information.

The knowledge base will evolve as new experiences are acquired. Significant experiences may be preserved in detail, while older or less relevant information can be consolidated when appropriate.

A traditional CV remains useful as an application attachment and experimental comparison baseline, but will not serve as the primary source of truth.

The detailed JSON schema remains flexible. More advanced data relationships, retrieval mechanisms, or database infrastructure should only be introduced when demonstrated requirements justify them.

Personal and confidential information must be kept separate from public portfolio documentation.

## 7. Main Risks and Uncertainties

- Increased application volume may not improve employment outcomes.
- Job sources and recruitment platforms may impose technical or contractual restrictions.
- AI-generated applications may introduce inaccurate claims or generic language.
- Automated company research may produce unreliable information or inappropriate contacts.
- Greater autonomy may increase complexity and reduce reliability.
- Outcome measurements may be difficult to interpret with limited data.

## 8. Current Direction

### Established

- Employment outcomes and reduced manual effort are the primary goals.
- The project will also serve as a documented engineering portfolio.
- Personalization, factual accuracy, efficiency, and simplicity are core principles.
- Both advertised vacancies and proactive outreach are worth exploring.
- Opportunity matching should reflect demonstrated capabilities and transferable skills, allowing justified gaps in advertised requirements without inventing qualifications or pursuing clearly unsuitable roles.
- Execution autonomy should depend on verified behavior and agreed rules: clear matches may proceed independently, while uncertain or exceptional cases require review.
- Structured JSON will serve as the initial professional knowledge base, preserving detailed experiences and verified information independently of the traditional CV.
- Application generation should prioritize accurate, relevant, concise, and sufficiently personalized responses, emphasizing demonstrated problem-solving and contributions over unnecessary technology lists or employer name-dropping.
- Application quality should be balanced against generation cost, complexity, and manual effort. The goal is reliable, useful output at scale rather than perfect prose.
- Remaining architectural and technical decisions will be made when sufficiently justified.

### Working Hypotheses

- Shared application intelligence could support multiple employment strategies.
- A structured professional knowledge base could improve personalization and consistency.
- Automating the coordination between tasks may provide greater value than optimizing individual tasks alone.
- Platsbanken's public API may offer a low-friction initial integration.
- Tracking outcomes across different strategies could support future optimization.
- A simple LLM-based generation workflow may provide sufficient application quality without requiring sophisticated retrieval or multi-model architectures.

These hypotheses have not yet been fully validated.

## 9. Open Questions

- What should an ideal end-to-end automated workflow look like?
- Which decisions can the system make independently, and when is human involvement necessary?
- What information is required to generate consistently high-quality applications?
- How should opportunities be discovered, evaluated, and prioritized?
- Which parts of the workflow genuinely benefit from AI?
- How can we compare the effectiveness of different employment strategies?
- How can the MVP's real-world results guide the development of greater autonomy?

## 10. Current Focus & Next Steps

**Current phase:** MVP implementation — opportunity discovery and initial live evaluation.

The local application supports Platsbanken searches, an optional location picker with multiple selections, SQLite persistence, and browsing saved advertisement locations, text, and original-source links. The initial foundation and opportunity-discovery milestones are implemented. After ChatGPT sign-in, one saved advertisement can be evaluated explicitly against the approved professional profile sections using GPT-6.1 Sol and the subscription. Valid completed results are stored locally with the model and date; older samples remain labelled until replaced successfully. Credentials stay in memory and a new sign-in is required after restart. Manual testing has verified sign-in, model discovery, and the fixed-message subscription response. A first real opportunity evaluation has completed, persisted, and been checked against its source advertisement and approved profile. Its reasoning was supported in this case; broader quality validation remains open. Following a reviewed two-case model comparison, Sol remains the evaluation model and the temporary Luna comparison feature has been removed. Broader model quality and usage savings remain unverified; see D020.

The MVP will support job discovery, opportunity evaluation, AI-assisted application generation, manual application submission, and tracking.

It will also provide a practical environment for evaluating and improving matching behavior, application quality, and overall efficiency.

The implementation sequence, milestone scope, and completion criteria are defined in [ROADMAP.md](ROADMAP.md).

Remaining technical decisions will be made progressively as concrete implementation requirements emerge, following the project's principles of simplicity and evidence-driven development.
