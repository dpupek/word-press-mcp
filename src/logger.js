import fs from 'node:fs';

export function createLogger(config) {
  function write(level, message, meta) {
    if (!config.debug && level === 'debug' && !config.logFile) return;
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      level,
      message,
      meta: meta || undefined
    });
    if (config.debug || level !== 'debug') {
      console.error(line);
    }
    if (config.logFile) {
      try {
        fs.appendFileSync(config.logFile, `${line}\n`, 'utf8');
      } catch (error) {
        console.error(
          JSON.stringify({
            ts: new Date().toISOString(),
            level: 'warn',
            message: 'Failed to append wordpress-mcp log file',
            meta: { error: error.message, logFile: config.logFile }
          })
        );
      }
    }
  }

  return {
    debug(message, meta) {
      write('debug', message, meta);
    },
    info(message, meta) {
      write('info', message, meta);
    },
    warn(message, meta) {
      write('warn', message, meta);
    },
    error(message, meta) {
      write('error', message, meta);
    }
  };
}
