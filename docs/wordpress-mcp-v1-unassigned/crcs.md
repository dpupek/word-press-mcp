# CRCs

## `src/server.js`
- Responsibility: register resources, generated endpoint tools, and workflow tools.
- Collaborators: `src/wp-client.js`, `src/tool-runtime.js`, `src/help.js`, `src/workflows.js`.

## `src/wp-client.js`
- Responsibility: execute WordPress REST requests with auth, payload handling, and response parsing.
- Collaborators: `src/config.js`, `src/error-translation.js`, `src/generator.js`.

## `src/generator.js`
- Responsibility: derive stable operation metadata from captured route specs.
- Collaborators: `scripts/generate-tools.js`, `scripts/verify-spec-parity.js`, `scripts/generate-help.js`.
