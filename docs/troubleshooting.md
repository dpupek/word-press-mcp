# WordPress MCP Troubleshooting

Use this resource when the MCP tool output is failing, contradictory, or incomplete.

## Auth Fails Or `health` Shows No Usable Session

Check:
- `WP_SITE_URL`
- `WP_USERNAME`
- `WP_APP_PASSWORD`
- whether the site requires `https`

What it usually means:
- `auth_error`: credentials or transport are wrong
- `permission_error`: auth worked, but the current user cannot perform that action

## A Route Exists But The Capability Probe Is Blocked

What it means:
- route discovery proved exposure, not permission
- do not treat visible routes as writable or even readable in `edit` context until the probe succeeds

Common examples:
- `elementor/v1/post` returns `403` even for an admin user
- a page write route exists, but `canWritePages=false`

## `canWritePages=false`

What it means:
- the server attempted a safe write-related probe and did not confirm usable page-write access

What to do next:
1. stop assuming page writes will work
2. inspect blocked route details from `workflow_get_site_capabilities`
3. switch to read-only inspection or change credentials/role before retrying writes

## Stored State Updated But The Page Still Looks Stale

Run:
1. `workflow_get_site_capabilities`
2. `workflow_get_live_render_state`

Interpretation:
- `restVsStoredMismatch=true`: stored state and REST-rendered markers disagree
- `liveVsStoredMismatch=true`: stored state and live frontend markers disagree
- `likelyCacheIssue=true`: REST markers match stored markers, but the public frontend still lags

## Cache Purge Is Unavailable

What it means:
- the site either does not expose the Elementor cache route or the current user cannot use it

What to do next:
1. do not assume live verification can succeed immediately after a write
2. verify stored and REST-rendered state first
3. if public correctness matters, treat browser or delayed frontend verification as a separate step

## Unexpected HTML Instead Of REST JSON

What it usually means:
- the site returned an HTML login, confirmation, or plugin-admin flow instead of a JSON API response

Do:
- read the normalized MCP error envelope
- do not parse the raw HTML as if it were a valid API success

## Elementor Kit Cleanup Stops At A Confirmation Page

What it means:
- Elementor intercepted the normal delete path

What to do next:
1. use `workflow_cleanup_elementor_kit`
2. allow the guarded `force_delete_kit` retry only when explicit opt-in is appropriate
3. if Elementor still requires a browser-admin confirmation URL, treat that as a documented manual step rather than forcing a destructive workaround
