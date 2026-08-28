# NOVA — Autonomous Multimodal AI Agent Platform

## 1. What we're building

NOVA is an autonomous AI agent platform: it takes a user's objective, plans it into tasks, selects and runs tools, observes results, verifies its own work, retries on failure, and shows a transparent execution trace.

First concrete product: **NOVA Career Agent** — researches jobs, analyzes job descriptions against a user profile, prepares tailored resumes/cover letters, runs mock interviews, and tracks applications.

Not building: a chatbot, a RAG demo, a wrapper around one LLM call, or a UI with hardcoded responses. Every "agent" must actually plan → act → observe → verify.

## 2. Core loop

```
UNDERSTAND → PLAN → EXECUTE → OBSERVE → VERIFY → RETRY IF NEEDED → COMPLETE
```

## 3. Development rules (apply to every task, every phase)

1. **Inspect before changing** — read a file, understand its dependents, make the smallest correct change. Don't rewrite working code.
2. **Never invent structure** — check existing package manager, framework, scripts, env vars, DB config, tests before adding anything. If the repo is empty, use the structure in §5.
3. **Work incrementally** — after each milestone: run the app, lint, typecheck, run tests, fix, *then* move on. Never batch-implement dozens of files before testing.
4. **No silent dangerous assumptions** — anything that deletes data, overwrites work, exposes secrets, runs arbitrary shell commands, touches prod, or sends an external message/message requires an explicit approval boundary.
5. **No fake functionality** — no "Coming soon" buttons unless explicitly scoped as future work; no hardcoded fake analytics once a real data source exists; no pretending a tool ran when it didn't.
6. **Fail loud, not fake** — if a provider/API key/tool is unavailable, show a clear "not configured" state. Never fabricate search results or pretend a browser action happened.

## 4. Tech stack

- **Frontend:** React + TypeScript, Vite (or Next.js only if repo already favors it), Tailwind, shadcn/ui, TanStack Query, Zustand where actual client state is needed.
- **Backend:** Node.js + TypeScript, Fastify (preferred for greenfield) or Express.
- **DB:** PostgreSQL + Prisma + pgvector (semantic memory).
- **Cache/queue:** Redis (task queues, rate limiting, session state).
- **Browser automation:** Playwright, sandboxed.
- **Containers:** Docker for local dev and any isolated code execution. Never run AI-generated shell commands directly on the host.

## 5. Monorepo layout

```
nova/
├── apps/
│   ├── web/        # React frontend
│   └── api/        # Fastify/Express backend: agents/, tools/, workflows/, memory/, llm/, database/, routes/, services/, security/, workers/
├── packages/
│   ├── database/   # Prisma schema + client
│   ├── shared/     # shared types/schemas
│   ├── agent-core/ # Agent/Tool/Task primitives, reusable across products
│   ├── ui/
│   └── config/
├── docker/
├── scripts/
├── docs/
├── .env.example
├── docker-compose.yml
└── package.json
```

## 6. Agent architecture

Common `Agent` interface: `id, name, description, system instructions, allowed tools, memory access, execution policy`. Specialized agents (Planner, Research, Browser, Coding, Critic) all run through the same execution framework.

- **Planner** — turns a natural-language objective into a structured, schema-validated plan (JSON, not parsed prose).
- **Research** — searches, extracts, retains `source URL / title / retrieved timestamp / content / claims / confidence`. Never presents unverified info as fact.
- **Browser** — tools: `open_url, go_back, click, type, scroll, read_page, take_screenshot, extract_links`. Every action logged. Policy-gated, no unrestricted browsing.
- **Coding** — sandboxed `inspect/read/write/patch/test/lint/typecheck`. Never touches production repos automatically.
- **Critic** — verifies correctness, completeness, source quality, requirement compliance, hallucination/security risk. Outputs `PASS` or `FAIL` + reasons + recommended action.

**Retry:** every task has `max retries`, `timeout`, `budget`. Failure → analyze error → retry with modified params → if still failing, ask user or mark blocked. No infinite loops.

**Memory:** short-term (current task context), episodic (past task outcomes, e.g. "user rejected Company X — remote requirement"), semantic (long-term facts, e.g. known skills). Retrieval is semantic (pgvector) where appropriate.

## 7. Career Agent domain

**User profile:** name, education, skills, experience, projects, certifications, locations, preferred roles/industries, salary expectations, resume, portfolio, GitHub, LinkedIn. Nothing hardcoded — all from DB.

**Job entity:** title, company, location, url, description, salary, requirements, skills, source, postedAt, verifiedAt, status. Dedupe via canonical URL + similarity matching.

**Matching:** compute structured signals per requirement (✓/✗ against profile skills) → explainable compatibility score. Don't just ask the LLM "give a score" — calculate it, then optionally use the model for qualitative color.

**Resume customization:** analyze JD → identify relevant experience/projects → generate a new *version* → show diff → require explicit approval before it touches the original. Never silent-overwrite.

**Cover letter:** tailored to profile + JD + company, avoiding generic AI phrasing.

**Interview prep:** company/technical/behavioral/project/coding questions; mock-interview mode with scored feedback per answer.

**Application tracker statuses:** Saved → Researching → Ready → Applied → Interview → Offer → Rejected → Withdrawn.

## 8. Frontend / UX

Sidebar: Workspace (Overview, Tasks, Projects, Memory, Files, Automations) · Career (Job Search, Jobs, Applications, Resume, Interview Prep) · Agents (Research, Browser, Coding) · System (Settings, Usage, Security).

Task flow: objective input → NOVA shows a concise plan (`[Start] [Edit Plan] [Cancel]`) → live execution view with per-step status/timestamp/agent/tool/duration → expandable trace (`Planner Agent → Research Agent → Search Tool → ...`) → replay from persisted execution events (not screenshots).

**Never expose raw chain-of-thought.** Show concise action summaries only (e.g. "Verification Agent: Checking whether the posting is still active → Verified").

Standard states everywhere: loading, empty, error, retry. Dark/light mode, responsive, accessible. Avoid generic "AI template" look.

## 9. Permissions & human-in-the-loop

Levels: `READ / WRITE / EXECUTE / EXTERNAL_ACTION`. Reading a page = READ. Creating a local doc = WRITE. Running code = EXECUTE. Sending an email/submitting an application = EXTERNAL_ACTION → always requires explicit approval (`Approve Once / Always Allow / Cancel`). Resume overwrite requires approval too.

## 10. Security

Input/output validation, rate limiting, authz on every user-data query (ownership checks), secure headers, CSRF where applicable, secret management (never ship keys to the browser), SSRF protection + URL allow/block policy, sandboxed code execution, file upload validation + size limits.

**Prompt injection:** treat all webpage/document/external content as untrusted data, never as instructions. Keep `SYSTEM POLICY / USER INTENT / TOOL RESULTS / UNTRUSTED CONTENT` conceptually separate; tool output can never override system policy.

## 11. Cost control & observability

Track model, input/output tokens, estimated cost, task ID, agent, timestamp per call. Task budgets: max tool calls, max retries, max execution time. Structured logs: taskId, userId, agentId, runId, toolId, timestamp, duration, status.

## 12. Streaming

WebSockets or SSE for live events: `task.started, plan.created, agent.started, tool.started, tool.completed, agent.message, agent.failed, approval.required, task.completed`.

## 13. Data model (minimum entities)

`User, UserProfile, Skill, Project, Document, Memory, Conversation, Message, Task, TaskStep, AgentRun, ToolExecution, Approval, Job, JobSource, Application, Resume, ResumeVersion, CoverLetter, InterviewSession, UsageRecord` — with indexes, FKs, timestamps, soft deletes where appropriate.

## 14. Testing

Unit: scoring, memory retrieval, permission checks, validation, planning, retry logic.
Integration: API, DB, agent execution, tool execution.
E2E: login → create task → execute → view trace → job search → save job → create application.

## 15. Build phases (do NOT skip ahead)

| Phase | Scope |
|---|---|
| 1 | Monorepo, frontend shell, backend shell, Postgres+Prisma, auth, base UI, Docker dev setup |
| 2 | LLM provider abstraction, structured outputs, streaming, token tracking |
| 3 | Agent core primitives (Agent/Tool/Task/TaskStep/ExecutionContext/AgentResult) + basic planner |
| 4 | Tool calling: web search, calculator, file reader — all logged |
| 5 | Task orchestration: plan → task graph → execution → verification → retry |
| 6 | Memory: short-term, semantic, profile, episodic |
| 7 | Career Agent: job search, extraction, verification, matching, ranking |
| 8 | Resume upload/parsing/versions + customization + cover letters |
| 9 | Interview prep: question gen, mock interview, scoring, feedback |
| 10 | Browser Agent (Playwright), read-only first |
| 11 | Coding Agent, sandboxed |
| 12 | Critic + verification + retry wiring |
| 13 | Permissions: approval requests, policies, audit log |
| 14 | Agent replay (execution timeline, tool history, reasoning summaries — no raw CoT) |
| 15 | Hardening: rate limiting, security pass, monitoring, caching, CI/CD |

## 16. Definition of done (MVP)

Register/login works · profile creation works · natural-language task → structured plan → real tool execution, persisted · live execution progress visible · research agent produces traceable, sourced results · career agent finds/structures/matches/ranks real jobs · resume customization creates a new version, never overwrites · sensitive actions gated by approval · failed tools retry safely · tasks cancellable · errors handled, no leaked stack traces · tests exist and pass · README + `docs/*` + `.env.example` complete, no secrets committed · typecheck/lint/build/migrations all green · Docker dev env works.

## 17. Future (do not build until MVP is stable)

Voice, Calendar, Email, Slack, GitHub, Cloud, Finance agents; multi-user teams; agent marketplace; scheduled/long-running tasks. Leave room in the architecture, don't implement now.