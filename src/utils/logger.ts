import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: isDev
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname",
        },
      }
    : undefined,
});

// Child loggers para diferentes contextos
export const agentLogger = logger.child({ module: "agent" });
export const dbLogger = logger.child({ module: "db" });
export const whatsappLogger = logger.child({ module: "whatsapp" });
export const toolLogger = logger.child({ module: "tool" });
