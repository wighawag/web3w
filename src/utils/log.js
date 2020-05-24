export function makeLog(log) {
  if (!log) {
    return voidLog;
  }

  if (log === console) {
    return {
      trace: log.trace,
      debug: log.trace,
      info: log.info,
      warn: log.warn,
      error: log.error,
      fatal: log.fatal,
      silent: log.log,
    }  
  }
  let defaultLog = log.fatal || log.error || log.warn || log.info || log.debug || log.silent || log.log;
  if (!defaultLog) {
    defaultLog = console.log.bind(console);
  } else {
    defaultLog = defaultLog.bind(log);
  }
  return {
    trace: log.trace ? log.trace.bind(log) : defaultLog,
    debug: log.debug ? log.debug.bind(log) : defaultLog,
    info: log.info ? log.info.bind(log) : defaultLog,
    warn: log.warn ? log.warn.bind(log) : defaultLog,
    error: log.error ? log.error.bind(log) : defaultLog,
    fatal: log.fatal ? log.fatal.bind(log) : defaultLog,
    silent: log.silent ? log.silent.bind(log) : defaultLog,
  }
  
}

export const voidLog = {
  trace:() => {},
  debug:() => {},
  info:() => {},
  warn:() => {},
  error:() => {},
  fatal:() => {},
  silent:() => {},
};
