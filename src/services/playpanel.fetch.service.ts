import { envParsed } from "../config/env";
import { logger } from "../utils/logger";
import { playpanelLoginService } from "./playpanel.login.service";

export interface FetchOptions extends RequestInit {
  panelUser?: string;
  panelPass?: string;
  queryParams?: Record<string, string | number | boolean | undefined>;
}

export class PlayPanelFetchService {
  /**
   * Realiza requisições HTTP autenticadas para o servidor Play Panel com auto-healing defensivo
   */
  async request<T = any>(endpoint: string, options: FetchOptions = {}): Promise<T> {
    const {
      panelUser = envParsed.DEFAULT_PLAYPANEL_USER,
      panelPass = envParsed.DEFAULT_PLAYPANEL_PASS,
      queryParams,
      ...fetchOptions
    } = options;

    let loginResult = await playpanelLoginService.login({
      panelUser,
      panelPass,
    });
    if (!loginResult.success || !loginResult.token) {
      throw new Error(`Falha de autenticação no Play Panel: ${loginResult.message}`);
    }

    const cleanEndpoint = endpoint.startsWith("/") ? endpoint.slice(1) : endpoint;
    const url = new URL(cleanEndpoint, envParsed.PLAYPANEL_URL);

    if (queryParams) {
      for (const [key, value] of Object.entries(queryParams)) {
        if (value !== undefined) {
          url.searchParams.append(key, String(value));
        }
      }
    }

    const defaultHeaders: Record<string, string> = {
      X_ACCESS_TOKEN: loginResult.token,
      X_FILTRO: "1",
      Origin: "https://playpainel.com",
      Referer: "https://playpainel.com/index",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
      Accept: "application/json, text/javascript, */*; q=0.01",
    };

    const fetchInit: any = {
      ...fetchOptions,
      headers: {
        ...defaultHeaders,
        ...fetchOptions.headers,
      },
    };

    let response = await fetch(url.toString(), fetchInit);

    let text = await response.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    // Auto-healing: detecta HTTP 401 ou retorno com "sessão expirada"
    const isSessionExpired =
      response.status === 401 ||
      (data &&
        typeof data === "object" &&
        data.result === false &&
        typeof data.msg === "string" &&
        data.msg.toLowerCase().includes("expirada"));

    if (isSessionExpired) {
      logger.warn(
        `[Auto-Healing] Sessão expirada detectada em ${endpoint} (${data?.msg || response.status}). Renovando credenciais...`
      );
      await playpanelLoginService.invalidateSession(panelUser, panelPass);
      loginResult = await playpanelLoginService.login({
        panelUser,
        panelPass,
        forceNewLogin: true,
      });

      if (!loginResult.success || !loginResult.token) {
        throw new Error(`Falha ao reautenticar no Play Panel: ${loginResult.message}`);
      }

      defaultHeaders.X_ACCESS_TOKEN = loginResult.token;
      fetchInit.headers = {
        ...defaultHeaders,
        ...fetchOptions.headers,
      };

      response = await fetch(url.toString(), fetchInit);

      text = await response.text();
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    return data as T;
  }

  async get<T = any>(endpoint: string, options: FetchOptions = {}): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: "GET" });
  }

  async post<T = any>(endpoint: string, body?: any, options: FetchOptions = {}): Promise<T> {
    const isFormData = body instanceof URLSearchParams;
    const headers: Record<string, string> = {};

    let formattedBody = body;
    if (body && !isFormData && typeof body === "object") {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(body)) {
        if (value !== undefined) params.append(key, String(value));
      }
      formattedBody = params.toString();
      headers["Content-Type"] = "application/x-www-form-urlencoded; charset=UTF-8";
    }

    return this.request<T>(endpoint, {
      ...options,
      method: "POST",
      body: formattedBody,
      headers: {
        ...headers,
        ...options.headers,
      },
    });
  }
}

export const playpanelFetchService = new PlayPanelFetchService();
