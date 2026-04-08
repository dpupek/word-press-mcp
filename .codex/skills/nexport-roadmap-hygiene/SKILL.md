---
name: nexport-roadmap-hygiene
description: "Keep roadmaps, plans, and task lists aligned with actual progress; prevent redundant churn by verifying status before starting work and updating status after completion."
---

# Skill: nexport-roadmap-hygiene

## When to use
- Any work tied to a roadmap, plan, task list, checklist, or progress tracker.
- Before starting a task that appears in a roadmap/plan.
- After completing a meaningful chunk of work.

## Protocol (generic)
1) **Locate the tracker**
   - Find the most specific artifact (e.g., `docs/**/roadmap.md`, `plan.md`, `tasks.md`, checklists).
   - Prefer the epic’s primary roadmap; use secondary plans only if the roadmap links to them.

2) **Verify before starting**
   - Search code/tests/docs for the item’s deliverables (classes, controllers, UI, migrations, tests).
   - If the work already exists, mark it complete and add a short evidence note instead of re‑implementing.

3) **Update after completion**
   - Mark the completed checkbox.
   - Add evidence (file paths, test filters, results) in-line or in a short note.
   - If needed, split “parent” tasks into **Completed** vs **Remaining** sections to clarify scope.

4) **Churn guard**
   - Do not re-open or re-implement items marked complete unless a regression is confirmed.
   - If an item is partially complete, capture the remaining sub-tasks explicitly.

5) **Status language**
   - Use precise, concrete wording (avoid “mostly done”).
   - If uncertain, leave unchecked and add a question or blocking note.

## Evidence template (optional)
- Evidence: `path/to/file.cs`, `path/to/view.cshtml`, `dotnet test ... --filter "<TestName>"` (passed/failed).

## References
- AGENTS.md (decomposition/shaping guidance)
