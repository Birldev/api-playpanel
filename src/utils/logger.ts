export const logger = {
  info: (message: string, ...args: any[]) => {
    console.log(`[INFO] [PlayPanel] ${new Date().toISOString()} - ${message}`, ...args);
  },
  warn: (message: string, ...args: any[]) => {
    console.warn(`[WARN] [PlayPanel] ${new Date().toISOString()} - ${message}`, ...args);
  },
  error: (message: string, ...args: any[]) => {
    console.error(`[ERROR] [PlayPanel] ${new Date().toISOString()} - ${message}`, ...args);
  },
  debug: (message: string, ...args: any[]) => {
    if (process.env.DEBUG === "true" || process.env.NODE_ENV === "development") {
      console.log(`[DEBUG] [PlayPanel] ${new Date().toISOString()} - ${message}`, ...args);
    }
  },
};
