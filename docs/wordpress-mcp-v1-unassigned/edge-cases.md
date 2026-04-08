# Edge Cases

- WordPress may return HTML login or proxy pages instead of JSON.
- The same site can accept application-password auth over `https` while rejecting it over plain `http` with `rest_not_logged_in`.
- Node-based live validation may fail TLS verification on the test site unless `WORDPRESS_MCP_ALLOW_INSECURE_TLS=true` is set explicitly.
- Public read routes may succeed without auth while write routes fail due to role or capability checks.
- Route capture from a live test site may include plugin namespaces absent on other installs.
- Media upload semantics differ from standard JSON body writes and require file-path validation.
- Post inspection without a deterministic post ID can be ambiguous when only a title or slug is provided.
- Elementor revision or autosave restore should be blocked when the candidate fails Elementor validation, even if the live document itself looks healthy.
- Deleting an `elementor_library` kit can return an Elementor HTML confirmation screen instead of REST JSON, so kit deletion cannot be treated as a normal API delete.
