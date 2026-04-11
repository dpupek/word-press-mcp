function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

export function getConfig() {
  return {
    siteUrl: (process.env.WP_SITE_URL || 'https://nexportsolutions.com').trim().replace(/\/$/, ''),
    username: process.env.WP_USERNAME?.trim() || '',
    appPassword: process.env.WP_APP_PASSWORD?.trim() || '',
    debug: parseBoolean(process.env.WORDPRESS_MCP_DEBUG, false),
    safeMode: parseBoolean(process.env.WORDPRESS_MCP_SAFE_MODE, true),
    allowInsecureTls: parseBoolean(process.env.WORDPRESS_MCP_ALLOW_INSECURE_TLS, false),
    logFile: process.env.WORDPRESS_MCP_LOG_FILE?.trim() || '',
    userAgent: process.env.WORDPRESS_MCP_USER_AGENT?.trim() || 'wordpress-mcp/0.1.2',
    routeCaptureUrl: (process.env.WORDPRESS_MCP_ROUTE_CAPTURE_URL || 'https://test.nexportsolutions.com/wp-json')
      .trim()
      .replace(/\/$/, '')
  };
}

export function hasAuth(config) {
  return Boolean(config.username && config.appPassword);
}
