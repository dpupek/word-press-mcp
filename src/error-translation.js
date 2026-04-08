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
  const detectionText = `${wpCode || ''} ${wpMessage} ${responseText} ${error?.snippet || ''}`;

  if (
    route?.includes('/wp/v2/elementor_library') &&
    /cant_delete_kit|delete your site settings|force_delete_kit/i.test(detectionText)
  ) {
    return {
      kind: 'elementor_kit_delete_confirmation',
      message: 'Elementor intercepted the delete request with a site-settings confirmation page.',
      actionable:
        'Do not retry this delete blindly. Treat Elementor kit deletion as a special-case operation that may require an explicit admin confirmation flow or a different validated endpoint.',
      details: {
        status,
        wpCode,
        route,
        method,
        snippet: responseText.slice(0, 400)
      }
    };
  }

  if (status === 401 || status === 403) {
    return {
      kind: 'auth_error',
      message: wpMessage,
      actionable: 'Verify `WP_USERNAME` and `WP_APP_PASSWORD`, then confirm the account has permission for this route and action.',
      details: { status, wpCode, route, method }
    };
  }

  if (status === 404) {
    return {
      kind: 'not_found',
      message: wpMessage,
      actionable: 'Confirm the site URL, route, and target identifier. A missing post/media/taxonomy object or an unavailable plugin route usually causes this.',
      details: { status, wpCode, route, method }
    };
  }

  if (status === 400) {
    return {
      kind: 'bad_request',
      message: wpMessage,
      actionable: 'Review the provided arguments for invalid field names, enum values, taxonomy IDs, or relation IDs before retrying.',
      details: { status, wpCode, route, method, body: safeJsonBody(error?.responseBody) }
    };
  }

  if (status && status >= 500) {
    return {
      kind: 'server_error',
      message: wpMessage,
      actionable: 'Retry if this looks transient. If it persists, inspect the WordPress server/plugin logs for the target route.',
      details: { status, wpCode, route, method }
    };
  }

  if (error?.kind === 'unexpected_html') {
    const snippet = error.snippet || '';
    return {
      kind: 'unexpected_html',
      message: error.message,
      actionable: 'The endpoint returned HTML instead of JSON. This usually means a login page, reverse proxy error, or wrong site URL.',
      details: { route, method, snippet }
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
      body: safeJsonBody(error?.responseBody)
    }
  };
}
