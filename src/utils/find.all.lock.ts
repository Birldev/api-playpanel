import redisClient, { isRedisAvailable } from "../config/redis";
import { logger } from "./logger";

export interface FindAllLockOptions {
  panelUser: string;
  cooldownSeconds?: number;
}

export class FindAllLock {
  private static activeOperations = new Map<string, boolean>();
  private static recentOperations = new Map<string, number>();

  private static getKey(panelUser: string): string {
    return `playpanel_findall:${panelUser}`;
  }

  /**
   * Verifica e bloqueia chamadas repetidas ou concorrentes da listagem completa
   */
  static async checkAndLock(
    options: FindAllLockOptions
  ): Promise<{ allowed: boolean; reason?: string; waitTime?: number }> {
    const { panelUser, cooldownSeconds = 15 } = options;
    const key = this.getKey(panelUser);

    // 1. Defesa contra requisição concorrente em andamento
    if (this.activeOperations.get(key)) {
      logger.warn(`[FindAllLock] Listagem completa já em execução para '${panelUser}'. Aguardando conclusão...`);
      for (let i = 0; i < 10; i++) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        if (!this.activeOperations.get(key)) {
          break;
        }
      }
      if (this.activeOperations.get(key)) {
        return {
          allowed: false,
          reason: "Find all already in progress",
        };
      }
    }

    // 2. Defesa contra chamadas em rajada (Cooldown / Debounce)
    const now = Date.now();
    const lastRun = this.recentOperations.get(key);
    if (lastRun && now - lastRun < cooldownSeconds * 1000) {
      const remainingSeconds = Math.ceil((cooldownSeconds * 1000 - (now - lastRun)) / 1000);
      logger.warn(
        `[FindAllLock] Operação /find-all bloqueada para '${panelUser}' (cooldown de ${remainingSeconds}s restante)`
      );
      return {
        allowed: false,
        reason: `Mecanismo de proteção anti-hammering ativo. Aguarde ${remainingSeconds}s antes de solicitar nova listagem completa.`,
        waitTime: remainingSeconds,
      };
    }

    // 3. Verificação no Redis (caso distribuído)
    if (isRedisAvailable()) {
      try {
        const redisKey = `lock:${key}`;
        const exists = await redisClient.get(redisKey);
        if (exists) {
          const ttl = await redisClient.ttl(redisKey);
          return {
            allowed: false,
            reason: `Mecanismo de proteção anti-hammering ativo no cluster. Aguarde ${ttl > 0 ? ttl : 10}s.`,
            waitTime: ttl > 0 ? ttl : 10,
          };
        }
      } catch (err: any) {
        logger.debug(`[FindAllLock] Erro ao consultar Redis: ${err?.message || err}`);
      }
    }

    // Bloqueia em memória para sinalizar início da execução
    this.activeOperations.set(key, true);
    return { allowed: true };
  }

  /**
   * Registra a conclusão da operação e ativa a janela de cooldown
   */
  static async release(options: FindAllLockOptions): Promise<void> {
    const { panelUser, cooldownSeconds = 15 } = options;
    const key = this.getKey(panelUser);

    this.activeOperations.delete(key);
    this.recentOperations.set(key, Date.now());

    // Limpa memória após o cooldown
    setTimeout(() => {
      this.recentOperations.delete(key);
    }, cooldownSeconds * 1000);

    if (isRedisAvailable()) {
      try {
        const redisKey = `lock:${key}`;
        await redisClient.setEx(redisKey, cooldownSeconds, "1");
      } catch (err: any) {
        logger.debug(`[FindAllLock] Erro ao gravar cooldown no Redis: ${err?.message || err}`);
      }
    }
  }

  /**
   * Liberação imediata em caso de erro na requisição
   */
  static async cancel(options: FindAllLockOptions): Promise<void> {
    const { panelUser } = options;
    const key = this.getKey(panelUser);
    this.activeOperations.delete(key);
  }
}
