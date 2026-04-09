function safeJsonBody(body) {
  if (!body) return null;
  if (typeof body === 'string') return body.slice(0, 400);
  return body;
}

function asText(body) {
  if (!body) return '';
  if (typeof body === 'string') return body;
  if (typeof body?.message === 'string') return body.message;
  return '';
}

export function translateWpError(error, context = {}) {
  if (error?.kind === 'confirmation_required') {
    return {
      kind: 'confirmation_required',
      message: error.message,
      actionable: 'Re-run with `confirm: true` after validating the target request.',
      details: safeJsonBody(error.details)
    };
  }

  if (error?.kind === 'validation_error') {
    return {
      kind: 'validation_error',
      message: error.message,
      actionable: 'Fix the input arguments before retrying. The request was rejected before any API write occurred.',
      details: safeJsonBody(error.details)
    };
  }

  const status = error?.statusCode ?? error?.status;
  const wpCode = error?.wpCode || error?.responseBody?.code;
  const wpMessage = error?.responseBody?.message || error?.message || 'WordPress request failed.';
  const route = context.route || error?.route;
  const method = context.method || error?.method;
  const responseText = asText(error?.responseBody || error) || '';
  const detectionText = `${wpCode || ''} ${wpMessage} ${responseText} ${error?.snippet || ''}`.toLowerCase();

  if (
    route?.includes('/wp/v2/elementor_library') &&
    /cant_delete_kit|delete your site settings|force_delete_kit/i.test(detectionText)
  ) {
    return {
      kind: 'elementor_kit_delete_confirmation',
      message: 'Elementor intercepted the delete request with a site-settings confirmation page.',
      actionable:
        'Do not retry this delete blindly. Use the guarded Elementor kit cleanup workflow so the server can apply the validated delete path safely.',
      details: {
        status,
        wpCode,
        route,
        method,
        requestUrl: error?.requestUrl,
        snippet: responseText.slice(0, 400)
      }
    };
  }

  if (error?.kind === 'auth_error' || status === 401) {
    return {
      kind: 'auth_error',
      message: wpMessage,
      actionable:
        'The server could not establish an authenticated WordPress REST session. Verify `WP_USERNAME` and `WP_APP_PASSWORD`, then retry.',
      details: { status, wpCode, route, method, requestUrl: error?.requestUrl, attempts: error?.attempts }
    };
  }

  if (error?.kind === 'permission_error' || status === 403) {
    return {
      kind: 'permission_error',
      message: wpMessage,
      actionable:
        'The current WordPress account is authenticated but does not have permission for this route or action. Use a safer workflow or a higher-privilege account.',
      details: { status, wpCode, route, method, requestUrl: error?.requestUrl, attempts: error?.attempts }
    };
  }

  if (error?.kind === 'not_found' || status === 404) {
    return {
      kind: 'not_found',
      message: wpMessage,
      actionable: 'Confirm the target identifier and the site configuration. The requested object or plugin route is not available.',
      details: { status, wpCode, route, method, requestUrl: error?.requestUrl }
    };
  }

  if (error?.kind === 'bad_request' || status === 400) {
    return {
      kind: 'bad_request',
      message: wpMessage,
      actionable: 'Review the provided arguments for invalid field names, enum values, taxonomy IDs, or relation IDs before retrying.',
      details: { status, wpCode, route, method, body: safeJsonBody(error?.responseBody), requestUrl: error?.requestUrl }
    };
  }

  if (error?.kind === 'tls_error') {
    return {
      kind: 'tls_error',
      message: wpMessage,
      actionable:
        'The MCP server could not complete a TLS-secured connection to the WordPress site. Fix the certificate chain or explicitly opt into insecure TLS only for controlled test environments.',
      details: { route, method, requestUrl: error?.requestUrl, code: error?.code }
    };
  }

  if (error?.kind === 'network_error') {
    return {
      kind: 'network_error',
      message: wpMessage,
      actionable:
        'The MCP server could not reach the WordPress site reliably. Check site availability, reverse-proxy reachability, or transient network conditions before retrying.',
      details: { route, method, requestUrl: error?.requestUrl, code: error?.code, attempts: error?.attempts }
    };
  }

  if (error?.kind === 'transient_http_error') {
    return {
      kind: 'server_error',
      message: wpMessage,
      actionable:
        'WordPress or a plugin returned a transient server error. The MCP server already applied its safe retry policy; if this persists, inspect the site or plugin logs for the target route.',
      details: { status, wpCode, route, method, requestUrl: error?.requestUrl, attempts: error?.attempts }
    };
  }

  if (error?.kind === 'server_error' || (status && status >= 500)) {
    return {
      kind: 'server_error',
      message: wpMessage,
      actionable: 'WordPress or a plugin failed while processing the request. Inspect the site or plugin logs for the target route before retrying.',
      details: { status, wpCode, route, method, requestUrl: error?.requestUrl }
    };
  }

  if (error?.kind === 'unexpected_html') {
    const snippet = error.snippet || '';
    return {
      kind: 'site_configuration_error',
      message: error.message,
      actionable:
        'The site returned HTML instead of the expected JSON API response. This usually means a login page, proxy interception, or plugin/admin confirmation flow.',
      details: { route, method, requestUrl: error?.requestUrl, snippet }
    };
  }

  return {
    kind: 'unexpected_error',
    message: wpMessage,
    actionable: 'Review the error details and request context, then retry after correcting the input or environment.',
    details: {
      status,
      wpCode,
      route,
      method,
      requestUrl: error?.requestUrl,
      body: safeJsonBody(error?.responseBody)
    }
  };
}
