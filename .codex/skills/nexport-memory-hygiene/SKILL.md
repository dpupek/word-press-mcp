---
name: nexport-memory-hygiene
description: "NexPort skill: nexport-memory-hygiene."
---

# Skill: nexport-memory-hygiene

## When to use
- After completing a meaningful chunk of work (code, docs, tests, or decisions).
- After resolving a blocker or discovering a pitfall.
- At the end of a session, even if work is partial.

## Checklist
- Confirm Quick Memory endpoint is available (nc-7-x); call listRecentEntries on cold start.
- If the user doesn’t know the epic slug/case, use heuristics:
  - Scan `docs/**` for “Epic Slug:” or “Epic: Case”.
  - Infer from epic folder names (e.g., `docs/tenant-invoicing-plan`) and roadmap titles.
  - Check recent memory entries for `epicSlug`/case tags, then ask for confirmation.
- Anchor to epic docs before code: skim roadmap/spec/baseline/edge-cases to identify in-flight work and decisions.
- Separate cold-start entries vs recent entries in summaries; label the source for each bullet.
- Use `searchEntries` with feature keywords before new work to avoid duplicating prior decisions.
- Surface blockers first (build/test failures, broken workflows) from recent entries.
- If a decision is made in-session, propose updating the roadmap/decision sections immediately.
- Always tag new entries with `progress`, epic slug/case, and topic tags.
- Use a structured update with:
  - Progress (what changed)
  - Decisions (what we chose + why)
  - Validation (tests/commands run + results)
  - Files touched
  - Next steps (3–6 bullets)
- Tag with case number and topic (e.g., case-216913, question-analytics, ui, tests).
- If memory endpoints are unavailable, leave a brief note in docs or ask the user before skipping the update.

## Constraints
- Never include credentials, tokens, connection strings, or customer data.
- Keep entries short and cross-session useful (decisions, pitfalls, commands, files).

## References
- AGENTS.md: Quick Memory usage rules.
