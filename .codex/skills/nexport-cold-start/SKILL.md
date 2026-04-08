---
name: nexport-cold-start
description: "NexPort skill: cold start workflow (Quick Memory + epic discovery + docs anchoring)."
---

# Skill: nexport-cold-start

## When to use
- The user requests a cold start, session recap, or “get back up to speed.”

## Required flow
1) Read AGENTS.md to find the Quick Memory endpoint.
2) Read Quick Memory `help`, `entry-fields`, and `cheatsheet` resources and summarize key reminders.
3) If the epic slug/case is unknown, discover via heuristics:
   - Scan `docs/active-projects/**` first (then `docs/**`) for “Epic Slug:” or “Epic: Case”.
   - Infer from epic folder names and roadmap titles.
   - Check recent Quick Memory entries for `epicSlug`/case tags.
   - Ask the user to confirm the candidate epic.
4) Locate the epic docs folder and skim roadmap/spec/baseline/edge-cases.
   - If the roadmap indicates completed work that matches current code/tests, update status using `nexport-roadmap-hygiene`.
5) Run Quick Memory `coldStart` (epicSlug if known) and summarize:
   - Cold-start entries separately from recent entries.
   - Label the source for each bullet (cold-start, recent, epic docs, or search).
6) If epic is known, run `searchEntries` with a focused keyword and capture only epic-relevant hits.
7) Present: current understanding (≤5 bullets), open questions, and next 3 tasks aligned to the roadmap.

## Output rules
- Always state “Endpoint: <slug> / Epic: <slug or unknown>”.
- Surface blockers (build/test failures) first if present.
- Never include credentials or secrets.

## Tags & capture
- When logging new entries, include `progress`, epic slug/case, and topic tags.
