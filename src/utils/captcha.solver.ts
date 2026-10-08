import { envParsed } from "../config/env";
import { logger } from "./logger";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class CaptchaSolver {
  /**
   * Resolve Cloudflare Turnstile ou Google reCAPTCHA v2 usando CapMonster como preferencial e 2Captcha como fallback
   */
  static async solveRecaptchaV2(
    websiteURL: string = envParsed.PLAYPANEL_PANEL_URL,
    websiteKey: string = envParsed.PLAYPANEL_RECAPTCHA_SITEKEY
  ): Promise<string> {
    try {
      if (envParsed.CAPMONSTER_KEY && envParsed.CAPMONSTER_KEY.trim()) {
        logger.info(`Iniciando resolução de captcha via CapMonster (Sitekey: ${websiteKey})...`);
        const token = await this.solveWithCapMonster(websiteURL, websiteKey);
        if (token) return token;
      }
    } catch (err: any) {
      logger.warn(`Falha na resolução via CapMonster: ${err?.message || err}. Tentando 2Captcha...`);
    }

    if (envParsed.CAPTCHA2_API_KEY && envParsed.CAPTCHA2_API_KEY.trim()) {
      logger.info(`Iniciando resolução de captcha via 2Captcha (fallback)...`);
      return await this.solveWith2Captcha(websiteURL, websiteKey);
    }

    throw new Error("Nenhum serviço de captcha configurado ou todos falharam.");
  }

  private static async solveWithCapMonster(websiteURL: string, websiteKey: string): Promise<string> {
    const clientKey = envParsed.CAPMONSTER_KEY;
    const isTurnstile = websiteKey.startsWith("0x4");
    const taskType = isTurnstile ? "TurnstileTaskProxyless" : "NoCaptchaTaskProxyless";

    const body = {
      clientKey,
      task: {
        type: taskType,
        websiteURL,
        websiteKey,
      },
    };

    const createRes = await fetch("https://api.capmonster.cloud/createTask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const createJson: any = await createRes.json();
    if (createJson.errorId !== 0) {
      throw new Error(`CapMonster createTask erro: ${createJson.errorDescription || createJson.errorCode}`);
    }

    const taskId = createJson.taskId;
    logger.info(`CapMonster Task ID criado: ${taskId} (${taskType}). Aguardando solução...`);

    for (let attempt = 1; attempt <= 30; attempt++) {
      await delay(2500);
      const resultRes = await fetch("https://api.capmonster.cloud/getTaskResult", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientKey, taskId }),
      });
      const resultJson: any = await resultRes.json();

      if (resultJson.status === "ready") {
        logger.info("CapMonster captcha resolvido com sucesso!");
        return resultJson.solution.token || resultJson.solution.gRecaptchaResponse;
      }

      if (resultJson.errorId !== 0) {
        throw new Error(`CapMonster getTaskResult erro: ${resultJson.errorDescription || resultJson.errorCode}`);
      }
    }

    throw new Error("CapMonster timeout ao aguardar resolução");
  }

  private static async solveWith2Captcha(websiteURL: string, websiteKey: string): Promise<string> {
    const clientKey = envParsed.CAPTCHA2_API_KEY;
    const isTurnstile = websiteKey.startsWith("0x4");
    const taskType = isTurnstile ? "TurnstileTaskProxyless" : "RecaptchaV2TaskProxyless";

    const body = {
      clientKey,
      task: {
        type: taskType,
        websiteURL,
        websiteKey,
      },
    };

    const createRes = await fetch("https://api.2captcha.com/createTask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const createJson: any = await createRes.json();
    if (createJson.errorId !== 0) {
      throw new Error(`2Captcha createTask erro: ${createJson.errorDescription || createJson.errorCode}`);
    }

    const taskId = createJson.taskId;
    logger.info(`2Captcha Task ID criado: ${taskId} (${taskType}). Aguardando solução...`);

    for (let attempt = 1; attempt <= 30; attempt++) {
      await delay(2500);
      const resultRes = await fetch("https://api.2captcha.com/getTaskResult", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientKey, taskId }),
      });
      const resultJson: any = await resultRes.json();

      if (resultJson.status === "ready") {
        logger.info("2Captcha captcha resolvido com sucesso!");
        return resultJson.solution.token || resultJson.solution.gRecaptchaResponse;
      }

      if (resultJson.errorId !== 0) {
        throw new Error(`2Captcha getTaskResult erro: ${resultJson.errorDescription || resultJson.errorCode}`);
      }
    }

    throw new Error("2Captcha timeout ao aguardar resolução");
  }
}
