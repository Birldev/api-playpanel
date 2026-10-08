import { createClient } from "redis";
import { envParsed } from "./env";
import { logger } from "../utils/logger";

const url = envParsed.REDIS_URL;

let isRedisConnected = false;

const redisClient = createClient({
  url: url || "redis://127.0.0.1:6379",
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 3) {
        return false;
      }
      return 1000;
    },
  },
});

redisClient.on("connect", () => {
  isRedisConnected = true;
  logger.info("[PlayPanel] Conexão com Redis estabelecida para cache de sessões");
});

redisClient.on("ready", () => {
  isRedisConnected = true;
});

redisClient.on("error", (err) => {
  isRedisConnected = false;
  logger.debug(`[PlayPanel] Redis indisponível, utilizando fallback em memória: ${err?.message || err}`);
});

(async () => {
  try {
    if (url) {
      await redisClient.connect().catch(() => {});
    }
  } catch (err: any) {
    logger.debug(`[PlayPanel] Falha na conexão inicial do Redis: ${err?.message || err}`);
  }
})();

export function isRedisAvailable(): boolean {
  return isRedisConnected && redisClient.isOpen;
}

export default redisClient;
