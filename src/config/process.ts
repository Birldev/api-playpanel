import type { FastifyInstance } from "fastify";
import redisClient, { isRedisAvailable } from "./redis";
import { logger } from "../utils/logger";

let registered = false;

export function setupProcessLifecycle(app?: FastifyInstance) {
  if (registered) return;
  registered = true;

  const cleanup = async (signal: string) => {
    logger.info(`[Process] Sinal ${signal} recebido. Encerrando serviços graciosamente...`);

    try {
      if (app) {
        logger.info("[Process] Encerrando servidor HTTP...");
        await app.close();
      }

      if (isRedisAvailable()) {
        logger.info("[Process] Desconectando cliente Redis...");
        await redisClient.quit().catch(() => redisClient.disconnect());
      }

      logger.info("[Process] Encerramento concluído com sucesso.");
    } catch (err: any) {
      logger.error(`[Process] Erro durante encerramento dos serviços: ${err?.message || err}`);
    }

    process.exit(0);
  };

  process.on("SIGINT", () => cleanup("SIGINT"));
  process.on("SIGTERM", () => cleanup("SIGTERM"));
  process.on("SIGHUP", () => cleanup("SIGHUP"));

  process.on("unhandledRejection", (reason: any) => {
    logger.error(`[Process] Unhandled Rejection detectada: ${reason?.stack || reason}`);
  });

  process.on("uncaughtException", (error: Error) => {
    logger.error(`[Process] Uncaught Exception detectada: ${error?.stack || error}`);
  });
}
