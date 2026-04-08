---
name: nexport-vocabulary-glossary-enforcement
description: "NexPort skill: detect user-facing terminology drift and engineer-centric jargon; propose fixes and glossary updates aligned to docs/ui-ux/glossary.md."
metadata:
  short-description: "Enforce user-centric vocabulary + glossary process"
---

# Skill: nexport-vocabulary-glossary-enforcement

## When to use
- Any UI copy change (labels, headings, button text, help text, validation messages).
- New tools/pages, or modernization work migrating legacy UI to 7.0 patterns.
- When stakeholders report “confusing wording” or inconsistent terminology.

## Primary references
- Vocabulary glossary: `docs/ui-ux/glossary.md`
- UI/UX guide: `docs/ui-ux/README.md`
- Roles/personas: `docs/roles-and-personas.md`

## Goal
Enforce common, user-centric vocabulary so:
- Students/instructors/admins understand labels without internal knowledge.
- Equivalent concepts use the same words across the product.
- New synonyms and jargon do not creep in unnoticed.

## Procedure
1) Identify the change set.
   - If under `/mnt/**`, use Windows git:
     - `"/mnt/c/Program Files/Git/bin/git.exe" diff --name-only HEAD`
2) Find candidate user-facing strings in the touched files.
   - Views (common places):
     - `rg -n \"<h[1-6]|<label\\b|text=\\\"|placeholder=\\\"|title=\\\"|aria-label=\\\"\" NexPortVirtualCampus -g'*.cshtml'`
   - JS UI strings:
     - `rg -n \"toast|alert\\(|confirm\\(|prompt\\(|text:\\s*\\\"|message:\\s*\\\"\" NexPortVirtualCampus -g'*.js'`
   - C# UI strings (controller/viewmodel):
     - `rg -n \"ModelState\\.AddModelError\\(|ValidationResult|Display\\(\" NexPortVirtualCampus -g'*.cs'`
3) Compare found strings against `docs/ui-ux/glossary.md`:
   - Prefer the canonical term already defined.
   - If a new term is required, add it to the glossary with:
     - preferred label
     - user definition
     - rationale
     - “Don’t say / Say” examples when useful
4) Flag engineer-centric jargon and recommend replacements.
   - Examples to watch for: execute, payload, persist, entity, job, queue, worker, orphaned, hydrate.
   - Watch for unclear abbreviations: NCS, NSS, org, grp, etc. (spell out or define).
5) Check for localization hygiene (high-level):
   - User-facing strings should be localized via existing resource patterns (avoid hardcoded English in views/JS).
   - If localization work is needed, coordinate with the localization patterns used in NexPort.

## Output format (required)
- **Findings**: list each problematic string with file reference and why it is problematic (jargon, inconsistency, abbreviation, ambiguous label).
- **Replacement**: suggested canonical label and (if needed) helper text.
- **Glossary updates**: proposed additions/edits to `docs/ui-ux/glossary.md` (keep it small and deliberate).
- **Localization note**: whether the strings appear localized or need follow-up.

## Notes
- Avoid renaming concepts in the UI without coordinating across the product; terminology drift is costly.
- Prefer stable, user-recognizable terms even if internal code uses different names.
