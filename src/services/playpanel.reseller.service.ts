import { logger } from "../utils/logger";
import { playpanelFetchService } from "./playpanel.fetch.service";
import { RenewLock } from "../utils/renew.lock";

export interface PlayPanelRawReseller {
  id: string;
  username: string;
  owner_id?: string;
  email?: string;
  status: string;
  credits?: string | number;
  date_registered?: string | number;
  last_login?: string | number;
  created_at?: string;
  is_admin?: number;
}

export interface PlayPanelFormattedReseller {
  id: string;
  username: string;
  owner_id: string;
  email: string;
  status: string;
  status_desc: string;
  credits: number;
  created_at: string;
  last_login: string;
}

export interface BaseResellerProps {
  panelUser?: string;
  panelPass?: string;
}

export interface FindResellerProps extends BaseResellerProps {
  search: string;
}

export interface FindAllResellerProps extends BaseResellerProps {
  start?: number;
  length?: number;
}

export interface FindByMasterProps extends BaseResellerProps {
  masterId?: string;
  search?: string;
}

export interface UpdateResellerCreditsProps extends BaseResellerProps {
  idcentral?: string;
  id?: string;
  creditos?: string;
  amount?: string;
  reason?: string;
}

export class PlayPanelResellerService {
  /**
   * Formata os dados de revendedor retornados pelo Play Panel
   */
  private formatReseller(reseller: PlayPanelRawReseller): PlayPanelFormattedReseller {
    const unixRegistered = Number(reseller.date_registered) || 0;
    const unixLogin = Number(reseller.last_login) || 0;

    const createdAt = unixRegistered
      ? new Date(unixRegistered * 1000).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
      : String(reseller.created_at || "");

    const lastLogin = unixLogin
      ? new Date(unixLogin * 1000).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
      : "";

    return {
      id: String(reseller.id),
      username: reseller.username,
      owner_id: String(reseller.owner_id || ""),
      email: reseller.email || "",
      status: String(reseller.status),
      status_desc: reseller.status === "1" ? "Ativo" : "Bloqueado",
      credits: Number(reseller.credits) || 0,
      created_at: createdAt,
      last_login: lastLogin,
    };
  }

  /**
   * Localiza um revendedor específico por ID ou username
   */
  async findReseller(props: FindResellerProps): Promise<{
    success: boolean;
    data?: PlayPanelFormattedReseller;
    message?: string;
  }> {
    const { panelUser, panelPass, search } = props;
    logger.info(`Buscando revendedor '${search}' no Play Panel...`);

    const cleanSearch = search.trim().toLowerCase();

    const response = await playpanelFetchService.post<{
      draw: number;
      recordsTotal: number;
      recordsFiltered: number;
      data: PlayPanelRawReseller[];
    }>("revendedores/meus", {
      draw: 1,
      start: 0,
      length: 1000,
    }, {
      panelUser,
      panelPass,
    });

    const list = response?.data || [];
    const found = list.find(
      (r) =>
        String(r.id) === cleanSearch ||
        r.username.toLowerCase() === cleanSearch ||
        (r.email && r.email.toLowerCase() === cleanSearch)
    );

    if (!found) {
      return {
        success: false,
        message: "Revendedor não encontrado",
      };
    }

    return {
      success: true,
      data: this.formatReseller(found),
    };
  }

  /**
   * Lista todos os revendedores da conta com paginação
   */
  async findAllReseller(props: FindAllResellerProps = {}): Promise<{
    success: boolean;
    total: number;
    data: PlayPanelFormattedReseller[];
    message?: string;
  }> {
    const { panelUser, panelPass, start = 0, length = 100 } = props;
    logger.info(`Listando revendedores no Play Panel (start: ${start}, length: ${length})...`);

    const response = await playpanelFetchService.post<{
      draw: number;
      recordsTotal: number;
      recordsFiltered: number;
      data: PlayPanelRawReseller[];
    }>("revendedores/meus", {
      draw: 1,
      start,
      length,
    }, {
      panelUser,
      panelPass,
    });

    const rawList = response?.data || [];
    const formattedList = rawList.map((r) => this.formatReseller(r));

    return {
      success: true,
      total: response?.recordsTotal || formattedList.length,
      data: formattedList,
    };
  }

  /**
   * Lista revendedores por hierarquia ou master
   */
  async findResellerByMaster(props: FindByMasterProps = {}): Promise<{
    success: boolean;
    data: PlayPanelFormattedReseller[];
    message?: string;
  }> {
    const { panelUser, panelPass, masterId, search } = props;
    logger.info(`Consultando revendedores vinculados a master '${masterId || "padrão"}'...`);

    if (masterId) {
      try {
        const response = await playpanelFetchService.get<{
          draw?: number;
          data?: PlayPanelRawReseller[];
        }>(`revendedores/hierarquia/${masterId}`, {
          panelUser,
          panelPass,
        });

        const list = (response?.data || []).map((r) => this.formatReseller(r));
        return {
          success: true,
          data: list,
        };
      } catch (err: any) {
        logger.warn(`Falha na rota de hierarquia direta: ${err?.message || err}. Recorrendo a /meus...`);
      }
    }

    // Fallback: busca em /meus e filtra por search se informado
    const all = await this.findAllReseller({ panelUser, panelPass, length: 1000 });
    let filtered = all.data;

    if (search) {
      const cleanSearch = search.trim().toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.username.toLowerCase().includes(cleanSearch) ||
          r.id === cleanSearch ||
          (r.owner_id && r.owner_id === cleanSearch)
      );
    }

    return {
      success: true,
      data: filtered,
    };
  }

  /**
   * Adiciona ou atualiza créditos de um revendedor com proteção anti-duplicação
   */
  async updateResellerCredits(props: UpdateResellerCreditsProps): Promise<{
    success: boolean;
    message: string;
    credits?: number;
  }> {
    const { panelUser, panelPass, reason = "Recarga de créditos via API" } = props;
    const resellerId = props.id || props.idcentral;
    const creditsAmount = props.creditos || props.amount;

    if (!resellerId) {
      return {
        success: false,
        message: "ID do revendedor (id ou idcentral) é obrigatório.",
      };
    }

    if (!creditsAmount || isNaN(Number(creditsAmount))) {
      return {
        success: false,
        message: "Quantidade de créditos (creditos ou amount) deve ser um número válido.",
      };
    }

    // Trava de proteção anti-duplicação de recarga de créditos (cooldown de 60s)
    const lockKey = `reseller_credit_${resellerId}`;
    const lockCheck = await RenewLock.checkCanRenew(lockKey, 60);
    if (!lockCheck.allowed) {
      return {
        success: false,
        message: "Credits already inserted",
      };
    }

    RenewLock.acquireInFlightLock(lockKey);

    try {
      logger.info(`Adicionando ${creditsAmount} créditos para o revendedor ID ${resellerId}...`);

      const response = await playpanelFetchService.post<{
        result: boolean;
        msg?: string;
        credits?: number;
      }>(`revendedores/${resellerId}/creditos/adicionar`, {
        amount: Number(creditsAmount),
        reason,
      }, {
        panelUser,
        panelPass,
      });

      if (!response.result) {
        logger.warn(`Falha ao adicionar créditos para revendedor ID ${resellerId}: ${response.msg}`);
        return {
          success: false,
          message: response.msg || "Erro ao adicionar créditos ao revendedor",
        };
      }

      await RenewLock.recordSuccessfulRenew(lockKey, 60);

      const successMsg = `Créditos atualizados com sucesso, quantidade adicionada: ${creditsAmount}`;
      logger.info(`Revendedor ID ${resellerId}: ${successMsg}`);

      return {
        success: true,
        message: successMsg,
        credits: response.credits,
      };
    } finally {
      RenewLock.releaseInFlightLock(lockKey);
    }
  }
}

export const playpanelResellerService = new PlayPanelResellerService();
