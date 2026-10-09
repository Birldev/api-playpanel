import { envParsed } from "../config/env";
import { logger } from "../utils/logger";
import { CaptchaSolver } from "../utils/captcha.solver";
import redisClient, { isRedisAvailable } from "../config/redis";

export interface PlayPanelSessionData {
  token: string;
  userData?: {
    is_admin: number;
    username: string;
    id: string;
  };
  expiresAt: number;
  savedAt: number;
}

export interface LoginProps {
  panelUser: string;
  panelPass: string;
  forceNewLogin?: boolean;
}

export class PlayPanelLoginService {
  private sessionsMap = new Map<string, PlayPanelSessionData>();
  private isLoggingInProgress = new Map<string, boolean>();
  private blockedUsers = new Map<string, boolean>();

  private getCacheKey(panelUser: string, panelPass: string): string {
    return `${panelPass}-${panelUser}`;
  }

  /**
   * Obtém a sessão em cache (memória ou Redis)
   */
  async getCachedSession(panelUser: string, panelPass: string): Promise<PlayPanelSessionData | null> {
    const cacheKey = this.getCacheKey(panelUser, panelPass);

    // 1. Cache em memória
    if (this.sessionsMap.has(cacheKey)) {
      const session = this.sessionsMap.get(cacheKey)!;
      if (session.token && Date.now() < session.expiresAt) {
        const remainingMinutes = Math.round((session.expiresAt - Date.now()) / 60000);
        logger.info(`Reutilizando sessão em memória para ${panelUser} (válida por mais ${remainingMinutes} min)`);
        return session;
      }
      this.sessionsMap.delete(cacheKey);
    }

    // 2. Cache no Redis
    if (isRedisAvailable()) {
      try {
        const redisKey = `playpanel_session:${panelUser}`;
        const raw = await redisClient.get(redisKey);
        if (raw) {
          const session = JSON.parse(raw) as PlayPanelSessionData;
          if (session?.token && Date.now() < session.expiresAt) {
            this.sessionsMap.set(cacheKey, session);
            const remainingMinutes = Math.round((session.expiresAt - Date.now()) / 60000);
            logger.info(`Restaurada sessão do Redis para ${panelUser} (válida por mais ${remainingMinutes} min)`);
            return session;
          }
          await redisClient.del(redisKey).catch(() => {});
        }
      } catch (err: any) {
        logger.debug(`Erro ao buscar sessão no Redis: ${err?.message || err}`);
      }
    }

    return null;
  }

  /**
   * Salva a sessão em memória e Redis
   */
  async saveCachedSession(
    panelUser: string,
    panelPass: string,
    token: string,
    userData?: any
  ): Promise<PlayPanelSessionData> {
    const cacheKey = this.getCacheKey(panelUser, panelPass);
    // Validade de 4 horas para a sessão
    const ttlSeconds = 4 * 60 * 60;
    const expiresAt = Date.now() + ttlSeconds * 1000;

    const session: PlayPanelSessionData = {
      token,
      userData,
      expiresAt,
      savedAt: Date.now(),
    };

    this.sessionsMap.set(cacheKey, session);

    if (isRedisAvailable()) {
      try {
        await redisClient.setEx(`playpanel_session:${panelUser}`, ttlSeconds, JSON.stringify(session));
        logger.info(`Sessão salva no Redis para ${panelUser} (TTL: ${ttlSeconds}s)`);
      } catch (err: any) {
        logger.debug(`Falha ao salvar sessão no Redis: ${err?.message || err}`);
      }
    }

    return session;
  }

  /**
   * Invalida sessão armazenada
   */
  async invalidateSession(panelUser: string, panelPass: string): Promise<void> {
    const cacheKey = this.getCacheKey(panelUser, panelPass);
    this.sessionsMap.delete(cacheKey);

    if (isRedisAvailable()) {
      try {
        await redisClient.del(`playpanel_session:${panelUser}`);
        logger.info(`Sessão invalidada no Redis para ${panelUser}`);
      } catch (err: any) {
        logger.debug(`Falha ao remover sessão no Redis: ${err?.message || err}`);
      }
    }
  }

  /**
   * Executa o login no painel Play Panel com resolução automatizada de captcha
   */
  async login(props: LoginProps): Promise<{
    success: boolean;
    token?: string;
    userData?: any;
    message: string;
  }> {
    const { panelUser, panelPass } = props;
    if (!panelUser || !panelPass) {
      return { success: false, message: "panelUser e panelPass são obrigatórios em cada chamada." };
    }
    const forceNewLogin = props.forceNewLogin || false;
    const cacheKey = this.getCacheKey(panelUser, panelPass);

    if (this.blockedUsers.has(cacheKey)) {
      logger.warn(`Usuário ${panelUser} está bloqueado temporariamente por credenciais inválidas`);
      return {
        success: false,
        message: "Usuário ou senha incorretos (bloqueado temporariamente)",
      };
    }

    if (!forceNewLogin) {
      const existingSession = await this.getCachedSession(panelUser, panelPass);
      if (existingSession) {
        return {
          success: true,
          token: existingSession.token,
          userData: existingSession.userData,
          message: "Sessão válida obtida do cache",
        };
      }
    }

    // Gerenciamento de login concorrente
    if (this.isLoggingInProgress.get(cacheKey)) {
      logger.info(`Login já em andamento para ${panelUser}, aguardando...`);
      for (let i = 0; i < 40; i++) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        if (!this.isLoggingInProgress.get(cacheKey)) {
          const session = await this.getCachedSession(panelUser, panelPass);
          if (session) {
            return {
              success: true,
              token: session.token,
              userData: session.userData,
              message: "Sessão obtida após conclusão de login concorrente",
            };
          }
          break;
        }
      }
      return {
        success: false,
        message: "Tempo limite esgotado aguardando login concorrente",
      };
    }

    try {
      this.isLoggingInProgress.set(cacheKey, true);
      logger.info(`Iniciando processo de login no Play Panel para ${panelUser}...`);

      // 1. Resolução do Google reCAPTCHA v2
      const recaptchaResponse = await CaptchaSolver.solveRecaptchaV2(
        envParsed.PLAYPANEL_PANEL_URL,
        envParsed.PLAYPANEL_RECAPTCHA_SITEKEY
      );

      // 2. Submissão do formulário de login
      const params = new URLSearchParams();
      params.append("username", panelUser);
      params.append("password", panelPass);
      params.append("g-recaptcha-response", recaptchaResponse);
      params.append("cf-turnstile-response", recaptchaResponse);

      const loginUrl = new URL("login", envParsed.PLAYPANEL_URL).toString();
      logger.info(`Submetendo credenciais para ${loginUrl}...`);

      const response = await fetch(loginUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          Origin: "https://playpainel.com",
          Referer: envParsed.PLAYPANEL_PANEL_URL,
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
          Accept: "application/json, text/javascript, */*; q=0.01",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: params.toString(),
      });

      const responseData: any = await response.json();
      logger.debug(`Resposta de login Play Panel: ${JSON.stringify(responseData)}`);

      if (responseData.result && responseData.token) {
        logger.info(`Login efetuado com sucesso no Play Panel para ${panelUser}!`);
        await this.saveCachedSession(panelUser, panelPass, responseData.token, responseData.data);

        return {
          success: true,
          token: responseData.token,
          userData: responseData.data,
          message: responseData.msg || "Login feito com sucesso.",
        };
      }

      if (responseData.msg && responseData.msg.toLowerCase().includes("inválido")) {
        this.blockedUsers.set(cacheKey, true);
        setTimeout(() => this.blockedUsers.delete(cacheKey), 5 * 60 * 1000);
      }

      return {
        success: false,
        message: responseData.msg || "Falha ao realizar login no Play Panel",
      };
    } catch (err: any) {
      logger.error(`Erro no processo de login Play Panel: ${err?.message || err}`);
      return {
        success: false,
        message: err?.message || "Erro desconhecido durante o login",
      };
    } finally {
      this.isLoggingInProgress.delete(cacheKey);
    }
  }
}

export const playpanelLoginService = new PlayPanelLoginService();
