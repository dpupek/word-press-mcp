---
name: wordpress-github-release-channels
description: Manage GitHub-based npx release channels for this repo using immutable version tags plus moving stable/beta channel tags. Use when preparing a release, updating install docs, or telling users how to target latest stable, latest beta, or exact versions from GitHub.
---

# WordPress GitHub Release Channels

Use this skill when the repo is distributed through GitHub refs instead of npm dist-tags.

The goal is predictable `npx` installs with three selector classes:

- moving development branch
- moving release channels
- immutable version tags

## Supported Selectors

- default development branch:
  - `github:dpupek/word-press-mcp`
- latest stable:
  - `github:dpupek/word-press-mcp#latest-release`
- latest beta:
  - `github:dpupek/word-press-mcp#beta-release`
- exact stable:
  - `github:dpupek/word-press-mcp#vX.Y.Z`
- exact beta:
  - `github:dpupek/word-press-mcp#vX.Y.Z-beta.N`

## Tag Rules

- `main` is the moving development branch.
- `latest-release` is a moving tag for the newest stable release.
- `beta-release` is a moving tag for the newest beta release.
- `vX.Y.Z` is an immutable stable version tag.
- `vX.Y.Z-beta.N` is an immutable beta version tag.

Do not retarget immutable `v*` tags after publishing them.

## Required Discipline

- Keep `package.json` version aligned with the immutable tag created on that commit.
- Move only the channel tags (`latest-release`, `beta-release`).
- Use immutable tags for reproducible installs and bug reports.
- Use channel tags only when callers explicitly want a moving target.

## Preferred Release Flow

### Stable

1. Update `package.json` to the target stable version.
2. Commit the release changes.
3. Create the immutable version tag:
   - `git tag vX.Y.Z`
4. Move the stable channel tag to the same commit:
   - `git tag -f latest-release`
5. Push the branch and tags:
   - `git push origin main`
   - `git push origin vX.Y.Z`
   - `git push origin -f latest-release`

### Beta

1. Update `package.json` to the target beta version.
2. Commit the beta release changes.
3. Create the immutable beta tag:
   - `git tag vX.Y.Z-beta.N`
4. Move the beta channel tag to the same commit:
   - `git tag -f beta-release`
5. Push the branch and tags:
   - `git push origin main`
   - `git push origin vX.Y.Z-beta.N`
   - `git push origin -f beta-release`

## Documentation Expectations

When changing release-channel behavior or user guidance, keep these docs aligned:

- `README.md`
- `user-docs/quick-start.md`
- `user-docs/github-release-channels.md`

## Output Expectations

When helping a user with release-channel installs, explain:

- which ref gives them the latest stable build
- which ref gives them the latest beta build
- which ref pins an exact version
- that `main` is not a reproducible install target
