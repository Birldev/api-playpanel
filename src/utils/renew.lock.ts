import { logger } from "./logger";
import redisClient, { isRedisAvailable } from "../config/redis";

// Usuários com renovação atualmente em processamento (in-flight lock)
const inProgressRenewals = new Map<string, number>();

// Registro das últimas renovações concluídas com timestamp (anti-duplicate cool-down)
const recentRenewals = new Map<string, number>();

// Tempo padrão de proteção contra clique duplo acidental: 60 segundos
const DEFAULT_COOLDOWN_SECONDS = 60;

export class RenewLock {
  /**
   * Verifica se o usuário pode ser renovado ou se deve ser bloqueado por duplicidade
   */
  static async checkCanRenew(
    userId: string,
    cooldownSeconds: number = DEFAULT_COOLDOWN_SECONDS,
    force: boolean = false
  ): Promise<{ allowed: boolean; reason?: string; secondsRemaining?: number }> {
    if (force) {
      logger.info(`[RenewLock] Renovação forçada (force=true) para o usuário ID ${userId}`);
      return { allowed: true };
    }

    const now = Date.now();

    // 1. Verifica se já há uma renovação em andamento agora para este usuário (in-flight lock)
    if (inProgressRenewals.has(userId)) {
      const startedAt = inProgressRenewals.get(userId)!;
      // Se a requisição anterior começou há menos de 30 segundos, bloqueia
      if (now - startedAt < 30 * 1000) {
        logger.warn(`[RenewLock] Bloqueio concorrente: Renovação já em andamento para usuário ID ${userId}`);
        return {
          allowed: false,
          reason: "Uma renovação já está em processamento para este usuário neste exato momento. Aguarde.",
        };
      }
      inProgressRenewals.delete(userId);
    }

    // 2. Verifica se foi renovado recentemente (memória local)
    if (recentRenewals.has(userId)) {
      const lastRenewTime = recentRenewals.get(userId)!;
      const elapsedSeconds = Math.floor((now - lastRenewTime) / 1000);
      if (elapsedSeconds < cooldownSeconds) {
        const remaining = cooldownSeconds - elapsedSeconds;
        logger.warn(
          `[RenewLock] Bloqueio anti-duplicidade: Usuário ID ${userId} foi renovado há ${elapsedSeconds}s (restam ${remaining}s)`
        );
        return {
          allowed: false,
          reason: `Operação de renovação bloqueada por duplicidade para evitar cobrança dupla. Este usuário foi renovado há ${elapsedSeconds}s. Aguarde mais ${remaining}s ou passe force=true.`,
          secondsRemaining: remaining,
        };
      }
      recentRenewals.delete(userId);
    }

    // 3. Verifica no Redis (caso distribuído)
    if (isRedisAvailable()) {
      try {
        const redisKey = `playpanel_recent_renew:${userId}`;
        const ttl = await redisClient.ttl(redisKey);
        if (ttl > 0) {
          logger.warn(`[RenewLock-Redis] Bloqueio anti-duplicidade para usuário ID ${userId} (TTL: ${ttl}s)`);
          return {
            allowed: false,
            reason: `Operação de renovação bloqueada por duplicidade (Redis). Restam ${ttl}s de segurança.`,
            secondsRemaining: ttl,
          };
        }
      } catch (err: any) {
        logger.debug(`[RenewLock-Redis] Erro ao verificar lock: ${err?.message || err}`);
      }
    }

    return { allowed: true };
  }

  /**
   * Adquire o lock in-flight antes de disparar a requisição ao servidor
   */
  static acquireInFlightLock(userId: string): void {
    inProgressRenewals.set(userId, Date.now());
  }

  /**
   * Libera o lock in-flight após conclusão ou erro
   */
  static releaseInFlightLock(userId: string): void {
    inProgressRenewals.delete(userId);
  }

  /**
   * Registra que a renovação foi concluída com sucesso e inicia o cool-down
   */
  static async recordSuccessfulRenew(
    userId: string,
    cooldownSeconds: number = DEFAULT_COOLDOWN_SECONDS
  ): Promise<void> {
    inProgressRenewals.delete(userId);
    recentRenewals.set(userId, Date.now());

    // Limpeza automática na memória
    setTimeout(() => {
      if (recentRenewals.has(userId)) {
        const time = recentRenewals.get(userId)!;
        if (Date.now() - time >= cooldownSeconds * 1000) {
          recentRenewals.delete(userId);
        }
      }
    }, cooldownSeconds * 1000);

    // Registro no Redis com TTL se disponível
    if (isRedisAvailable()) {
      try {
        await redisClient.setEx(`playpanel_recent_renew:${userId}`, cooldownSeconds, "1");
      } catch (err: any) {
        logger.debug(`[RenewLock-Redis] Erro ao gravar registro de renovação: ${err?.message || err}`);
      }
    }
  }
}
