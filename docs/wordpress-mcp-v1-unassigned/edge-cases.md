# Edge Cases

- WordPress may return HTML login or proxy pages instead of JSON.
- The same site can accept application-password auth over `https` while rejecting it over plain `http` with `rest_not_logged_in`.
- Node-based live validation may fail TLS verification on the test site unless `WORDPRESS_MCP_ALLOW_INSECURE_TLS=true` is set explicitly.
- Public read routes may succeed without auth while write routes fail due to role or capability checks.
- A route can be reachable and authenticated while still failing with a route-specific `403`, so the server should distinguish authenticated permission failures from missing auth.
- Route capture from a live test site may include plugin namespaces absent on other installs.
- Media upload semantics differ from standard JSON body writes and require file-path validation.
- Post inspection without a deterministic post ID can be ambiguous when only a title or slug is provided.
- Elementor revision or autosave restore should be blocked when the candidate fails Elementor validation, even if the live document itself looks healthy.
- Deleting an `elementor_library` kit can return an Elementor HTML confirmation screen instead of REST JSON, so kit deletion cannot be treated as a normal API delete.
- Menu reordering is risky when callers submit only a partial item list, so reorder workflows should require a complete structure to avoid silent item loss or orphaning.
- Menu cloning must recreate items in parent-safe order and remap parent IDs; cloning flat payloads naively can corrupt hierarchy.
- Some sites may expose classic menu endpoints but zero registered menu locations, so location assignment workflows must tolerate an empty available-location set without treating it as a server failure.
