import type { FastifyReply, FastifyRequest } from "fastify";
import { logger } from "../utils/logger";
import { envParsed } from "../config/env";

export async function authGuard(req: FastifyRequest, res: FastifyReply) {
  let authKey =
    (req.headers?.apikey as string | undefined) ||
    (req.headers?.["x-api-key"] as string | undefined) ||
    ((req.query as any)?.apikey as string | undefined);

  if (!authKey && req.url) {
    try {
      const url = new URL(req.url, "http://localhost");
      authKey = url.searchParams.get("apikey") || undefined;
    } catch {}
  }

  const { APIKEY } = envParsed;

  if (!authKey) {
    logger.warn("Requisição bloqueada: API Key ausente");
    return res.status(401).send({ error: "API Key missing" });
  }

  if (authKey !== APIKEY) {
    logger.warn("Requisição bloqueada: API Key inválida");
    return res.status(401).send({ error: "Unauthorized" });
  }
}
