import { logger } from "../utils/logger";
import { playpanelFetchService } from "./playpanel.fetch.service";
import { generateRandomUser, generateRandomPass, buildPlayerLinks } from "../utils/helpers";
import { RenewLock } from "../utils/renew.lock";
import { FindAllLock } from "../utils/find.all.lock";

export interface PlayPanelRawUser {
  id: string;
  status: string;
  username: string;
  password: string;
  exp_date: string;
  is_trial: string;
  created_at: string;
  force_server_id: string;
  conexoes: string;
  max_con: string;
  reseller_notes: string;
  member_id: string;
}

export interface PlayPanelFormattedUser {
  id: string;
  username: string;
  password: string;
  status: string;
  status_desc: string;
  is_trial: boolean;
  exp_date: number;
  exp_date_iso: string;
  exp_date_local: string;
  exp_date_time_local: string;
  created_at: number;
  created_at_iso: string;
  created_at_local: string;
  created_at_time_local: string;
  max_connections: number;
  conexoes: string;
  reseller_notes: string;
  member_id: string;
  master_username: string;
  as_number: string;
  links: ReturnType<typeof buildPlayerLinks>;
}

export interface BasePanelProps {
  panelUser?: string;
  panelPass?: string;
}

export interface FindUserProps extends BasePanelProps {
  username: string;
}

export interface FindAllProps extends BasePanelProps {
  teste?: boolean;
  filtro?: "todas" | "ativa" | "expirada";
  tipo?: "minhas" | "revendas" | "todas";
  cooldown?: number;
}

export interface GetPackagesProps extends BasePanelProps {}

export interface CreateTestUserProps extends BasePanelProps {
  plano?: string | string[];
  horas?: number;
  username?: string;
  password?: string;
}

export interface RenewUserProps extends BasePanelProps {
  id?: string;
  idcentral?: string;
  username?: string;
  months?: number;
  force?: boolean;
  cooldown?: number;
}

export interface ToggleStatusProps extends BasePanelProps {
  id?: string;
  username?: string;
}

export interface DeleteUserProps extends BasePanelProps {
  id?: string;
  username?: string;
}

export interface DeleteExpiredProps extends BasePanelProps {
  testes?: boolean;
  tipo?: "minhas" | "revendas" | "todas";
}

export interface CreditLogsProps extends BasePanelProps {
  id?: string;
  start?: number;
  length?: number;
}

export interface ChangePasswordProps extends BasePanelProps {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export class PlayPanelService {
  /**
   * Formata os dados de um cliente retornado pela API do Play Panel
   */
  private formatUser(user: PlayPanelRawUser): PlayPanelFormattedUser {
    const expSeconds = Number(user.exp_date) || 0;
    const createdSeconds = Number(user.created_at) || 0;

    const expDate = new Date(expSeconds * 1000);
    const createdDate = new Date(createdSeconds * 1000);

    const expDateLocal = expSeconds
      ? expDate.toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          timeZone: "America/Sao_Paulo",
        })
      : "";
    const createdDateLocal = createdSeconds
      ? createdDate.toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          timeZone: "America/Sao_Paulo",
        })
      : "";

    return {
      id: user.id,
      username: user.username,
      password: user.password,
      status: user.status,
      status_desc: user.status === "1" ? "Ativo" : "Bloqueado",
      is_trial: user.is_trial === "1",
      exp_date: expSeconds,
      exp_date_iso: expDate.toISOString(),
      exp_date_local: expDateLocal,
      exp_date_time_local: expDate.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
      created_at: createdSeconds,
      created_at_iso: createdDate.toISOString(),
      created_at_local: createdDateLocal,
      created_at_time_local: createdDate.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
      max_connections: Number(user.max_con) || 1,
      conexoes: user.conexoes,
      reseller_notes: user.reseller_notes || "",
      member_id: user.member_id || "",
      master_username: user.member_id || "",
      as_number: "",
      links: buildPlayerLinks(user.username, user.password),
    };
  }

  /**
   * Busca um usuário específico pelo nome de usuário
   */
  async findUser(props: FindUserProps): Promise<{
    success: boolean;
    data?: PlayPanelFormattedUser;
    message?: string;
  }> {
    const { panelUser, panelPass, username } = props;
    logger.info(`Buscando usuário '${username}' no Play Panel...`);

    const cleanUser = username.trim().toLowerCase();

    // 1. Busca nas listas do revendedor
    const result = await playpanelFetchService.post<{
      draw: number;
      recordsTotal: number;
      recordsFiltered: number;
      data: PlayPanelRawUser[];
    }>("listas/minhas", {
      draw: 1,
      start: 0,
      length: 1000,
    }, {
      panelUser,
      panelPass,
      headers: {
        X_FILTRO: "todas",
      },
    });

    let found = result?.data?.find((u) => u.username.toLowerCase() === cleanUser);

    // 2. Se não encontrar nas próprias listas, busca em todas as listas
    if (!found) {
      const allResult = await playpanelFetchService.post<{
        data: PlayPanelRawUser[];
      }>("listas/todas", {
        draw: 1,
        start: 0,
        length: 1000,
      }, {
        panelUser,
        panelPass,
        headers: {
          X_FILTRO: "todas",
        },
      });
      found = allResult?.data?.find((u) => u.username.toLowerCase() === cleanUser);
    }

    if (!found) {
      return {
        success: false,
        message: "Usuário não encontrado",
      };
    }

    return {
      success: true,
      data: this.formatUser(found),
    };
  }

  /**
   * Lista todos os usuários / clientes com opções de filtro
   */
  async findAll(props: FindAllProps): Promise<{
    success: boolean;
    total: number;
    data: PlayPanelFormattedUser[];
    message?: string;
  }> {
    const { panelUser, panelPass, teste, filtro = "todas", tipo = "minhas", cooldown = 15 } = props;
    const effectiveUser = panelUser || "default";

    // Defesa anti-hammering: evita múltiplas listagens pesadas simultâneas
    const lockCheck = await FindAllLock.checkAndLock({
      panelUser: effectiveUser,
      cooldownSeconds: cooldown,
    });
    if (!lockCheck.allowed) {
      return {
        success: false,
        total: 0,
        data: [],
        message: lockCheck.reason,
      };
    }

    logger.info(`Buscando todas as listas no Play Panel (tipo: ${tipo}, filtro: ${filtro}, teste: ${teste})...`);

    const endpoint = `listas/${tipo}`;
    try {
      const result = await playpanelFetchService.post<{
        draw: number;
        recordsTotal: number;
        recordsFiltered: number;
        data: PlayPanelRawUser[];
      }>(endpoint, {
        draw: 1,
        start: 0,
        length: 1000,
      }, {
        panelUser,
        panelPass,
        headers: {
          X_FILTRO: filtro,
        },
      });

      let rawList = result?.data || [];

      if (teste !== undefined) {
        const isTrialFilter = teste ? "1" : "0";
        rawList = rawList.filter((u) => u.is_trial === isTrialFilter);
      }

      const formattedList = rawList.map((u) => this.formatUser(u));

      await FindAllLock.release({ panelUser: effectiveUser, cooldownSeconds: cooldown });

      return {
        success: true,
        total: formattedList.length,
        data: formattedList,
      };
    } catch (err: any) {
      await FindAllLock.cancel({ panelUser: effectiveUser });
      throw err;
    }
  }

  /**
   * Consulta os pacotes / bouquets disponíveis para criação e renovação
   */
  async getPackages(props: GetPackagesProps = {}): Promise<{
    success: boolean;
    data: Array<{ id: string; name: string }>;
  }> {
    const { panelUser, panelPass } = props;
    logger.info("Buscando pacotes / bouquets disponíveis...");

    const response = await playpanelFetchService.get<{
      result: boolean;
      data: Array<{ id: string; bouquet_name: string }>;
    }>("bouquets", {
      panelUser,
      panelPass,
      headers: {
        X_FILTRO: "1",
      },
    });

    const packages = (response?.data || []).map((b) => ({
      id: b.id,
      name: b.bouquet_name,
    }));

    return {
      success: true,
      data: packages,
    };
  }

  /**
   * Cria um teste rápido no painel Play Panel
   */
  async createTestUser(props: CreateTestUserProps): Promise<{
    success: boolean;
    id?: string;
    username: string;
    password: string;
    horas: number;
    exp_date?: number;
    exp_date_iso?: string;
    exp_date_local?: string;
    links: ReturnType<typeof buildPlayerLinks>;
    message: string;
  }> {
    const { panelUser, panelPass, horas = 3 } = props;

    // Garante usuário com 12 a 20 caracteres
    let username = props.username?.trim();
    if (!username || username.length < 12) {
      username = generateRandomUser(12);
    }

    // Garante senha com no mínimo 12 caracteres, maiúscula, minúscula e número
    let password = props.password?.trim();
    if (!password || password.length < 12 || !password.match(/[A-Z]/) || !password.match(/[a-z]/) || !password.match(/[0-9]/)) {
      password = generateRandomPass(12);
    }

    // Pacote padrão (4 = Pacote Completo)
    const plano = props.plano || "4";

    logger.info(`Criando teste rápido para ${username} (Plano: ${JSON.stringify(plano)}, Horas: ${horas})...`);

    const response = await playpanelFetchService.post<{
      result: boolean;
      msg?: string;
      id?: string;
      username?: string;
      password?: string;
    }>("listas/teste", {
      plano: Array.isArray(plano) ? plano : [plano],
      horas,
      username,
      password,
      nitro: 0,
    }, {
      panelUser,
      panelPass,
    });

    if (!response.result) {
      logger.warn(`Falha ao criar teste no Play Panel: ${response.msg}`);
      return {
        success: false,
        username,
        password,
        horas,
        links: buildPlayerLinks(username, password),
        message: response.msg || "Erro ao criar teste no Play Panel",
      };
    }

    logger.info(`Teste criado com sucesso para o usuário ${username}!`);

    const expDateTimestamp = Math.floor(Date.now() / 1000) + horas * 3600;
    const expDate = new Date(expDateTimestamp * 1000);
    const expDateLocal = expDate.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "America/Sao_Paulo",
    });

    return {
      success: true,
      id: response.id,
      username,
      password,
      horas,
      exp_date: expDateTimestamp,
      exp_date_iso: expDate.toISOString(),
      exp_date_local: expDateLocal,
      links: buildPlayerLinks(username, password),
      message: "Teste gerado com sucesso!",
    };
  }

  /**
   * Renova a linha de um cliente por X meses
   */
  async renewUser(props: RenewUserProps): Promise<{
    success: boolean;
    message: string;
    data?: PlayPanelFormattedUser;
  }> {
    const { panelUser, panelPass, months = 1 } = props;
    let userId = props.id || props.idcentral;

    // Se o ID não foi informado mas o username foi, localiza o ID do usuário
    if (!userId && props.username) {
      const search = await this.findUser({ panelUser, panelPass, username: props.username });
      if (search.success && search.data) {
        userId = search.data.id;
      } else {
        return {
          success: false,
          message: `Não foi possível localizar o ID do usuário '${props.username}' para renovação.`,
        };
      }
    }

    if (!userId) {
      return {
        success: false,
        message: "ID ou username do usuário não informado para renovação.",
      };
    }

    // Proteção contra renovação dupla acidental (In-flight e Cool-down)
    const lockCheck = await RenewLock.checkCanRenew(userId, props.cooldown || 60, props.force);
    if (!lockCheck.allowed) {
      return {
        success: false,
        message: lockCheck.reason || "Operação de renovação bloqueada por duplicidade.",
      };
    }

    RenewLock.acquireInFlightLock(userId);

    try {
      logger.info(`Renovando cliente ID ${userId} por ${months} mês(es)...`);

      const response = await playpanelFetchService.post<{
        result: boolean;
        msg?: string;
      }>(`listas/${userId}/renovar`, {
        tempo: months,
      }, {
        panelUser,
        panelPass,
      });

      if (!response.result) {
        logger.warn(`Falha ao renovar cliente ID ${userId}: ${response.msg}`);
        return {
          success: false,
          message: response.msg || "Falha ao renovar cliente no Play Panel",
        };
      }

      // Registra que a renovação foi concluída para ativar a janela de proteção contra duplicidade
      await RenewLock.recordSuccessfulRenew(userId, props.cooldown || 60);

      logger.info(`Cliente ID ${userId} renovado com sucesso!`);

      // Busca dados atualizados do usuário após a renovação
      let updatedData: PlayPanelFormattedUser | undefined;
      if (props.username) {
        const search = await this.findUser({ panelUser, panelPass, username: props.username });
        if (search.success) updatedData = search.data;
      }

      // Se não tinha username ou não localizou pelo username, busca diretamente pelo ID
      if (!updatedData) {
        try {
          const listRes = await playpanelFetchService.post<{ data: PlayPanelRawUser[] }>(
            "listas/minhas",
            { draw: 1, start: 0, length: 1000 },
            { panelUser, panelPass, headers: { X_FILTRO: "todas" } }
          );
          let foundRaw = listRes?.data?.find((u) => String(u.id) === String(userId));
          if (!foundRaw) {
            const listAll = await playpanelFetchService.post<{ data: PlayPanelRawUser[] }>(
              "listas/todas",
              { draw: 1, start: 0, length: 1000 },
              { panelUser, panelPass, headers: { X_FILTRO: "todas" } }
            );
            foundRaw = listAll?.data?.find((u) => String(u.id) === String(userId));
          }
          if (foundRaw) {
            updatedData = this.formatUser(foundRaw);
          }
        } catch (err: any) {
          logger.warn(`Não foi possível recuperar dados atualizados do cliente ID ${userId}: ${err?.message || err}`);
        }
      }

      return {
        success: true,
        message: response.msg || "Cliente renovado com sucesso!",
        data: updatedData,
      };
    } finally {
      RenewLock.releaseInFlightLock(userId);
    }
  }

  /**
   * Bloqueia ou desbloqueia um cliente (toggle status)
   */
  async toggleUserStatus(props: ToggleStatusProps): Promise<{
    success: boolean;
    message: string;
  }> {
    const { panelUser, panelPass } = props;
    let userId = props.id;

    if (!userId && props.username) {
      const search = await this.findUser({ panelUser, panelPass, username: props.username });
      if (search.success && search.data) {
        userId = search.data.id;
      } else {
        return {
          success: false,
          message: `Usuário '${props.username}' não localizado para alternar status.`,
        };
      }
    }

    if (!userId) {
      return {
        success: false,
        message: "ID ou username do usuário é obrigatório.",
      };
    }

    logger.info(`Alternando status de bloqueio do cliente ID ${userId}...`);

    const response = await playpanelFetchService.get<{
      result: boolean;
      msg?: string;
    }>(`listas/${userId}/toogleLista`, {
      panelUser,
      panelPass,
    });

    return {
      success: response.result,
      message: response.msg || (response.result ? "Status alterado com sucesso" : "Erro ao alterar status"),
    };
  }

  /**
   * Deleta um cliente do painel
   */
  async deleteUser(props: DeleteUserProps): Promise<{
    success: boolean;
    message: string;
  }> {
    const { panelUser, panelPass } = props;
    let userId = props.id;

    if (!userId && props.username) {
      const search = await this.findUser({ panelUser, panelPass, username: props.username });
      if (search.success && search.data) {
        userId = search.data.id;
      } else {
        return {
          success: false,
          message: `Usuário '${props.username}' não localizado para exclusão.`,
        };
      }
    }

    if (!userId) {
      return {
        success: false,
        message: "ID ou username do usuário é obrigatório.",
      };
    }

    logger.info(`Deletando cliente ID ${userId}...`);

    const response = await playpanelFetchService.get<{
      result: boolean;
      msg?: string;
    }>(`listas/${userId}/deletar`, {
      panelUser,
      panelPass,
    });

    return {
      success: response.result,
      message: response.msg || (response.result ? "Cliente deletado com sucesso" : "Erro ao deletar cliente"),
    };
  }

  /**
   * Limpa listas ou testes expirados
   */
  async deleteExpired(props: DeleteExpiredProps): Promise<{
    success: boolean;
    message: string;
  }> {
    const { panelUser, panelPass, testes = false, tipo = "minhas" } = props;
    logger.info(`Limpando listas expiradas (testes: ${testes}, tipo: ${tipo})...`);

    const response = await playpanelFetchService.post<{
      result: boolean;
      msg?: string;
    }>("listas/deletar_expiradas", {
      testes: testes ? 1 : 0,
      tipo,
    }, {
      panelUser,
      panelPass,
    });

    return {
      success: response?.result ?? true,
      message: response?.msg || "Operação de limpeza concluída.",
    };
  }

  /**
   * Consulta histórico de créditos do revendedor
   */
  async getCreditLogs(props: CreditLogsProps): Promise<{
    success: boolean;
    total: number;
    data: any[];
  }> {
    const { panelUser, panelPass, id = "0", start = 0, length = 50 } = props;
    logger.info(`Buscando extrato de movimentação de créditos ID ${id}...`);

    const response = await playpanelFetchService.post<{
      draw: number;
      recordsTotal: number;
      recordsFiltered: number;
      data: Array<{ id: string; amount: string; reason: string; date: string }>;
    }>(`logs/creditos/${id}`, {
      draw: 1,
      start,
      length,
    }, {
      panelUser,
      panelPass,
    });

    const list = (response?.data || []).map((item) => {
      const unixDate = Number(item.date) || 0;
      return {
        ...item,
        date_iso: unixDate ? new Date(unixDate * 1000).toISOString() : "",
        date_local: unixDate
          ? new Date(unixDate * 1000).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
          : "",
      };
    });

    return {
      success: true,
      total: response?.recordsTotal || list.length,
      data: list,
    };
  }

  /**
   * Altera a senha do painel Play Panel
   */
  async changePassword(props: ChangePasswordProps): Promise<{
    success: boolean;
    message: string;
  }> {
    const { panelUser, panelPass, oldPassword, newPassword, confirmPassword } = props;

    if (newPassword !== confirmPassword) {
      return {
        success: false,
        message: "A nova senha e a confirmação de senha não coincidem.",
      };
    }

    logger.info("Alterando senha de acesso ao painel Play Panel...");

    const response = await playpanelFetchService.post<{
      result: boolean;
      msg?: string;
    }>("alterar_senha", {
      old_pwd: oldPassword,
      new_password: newPassword,
      new_password2: confirmPassword,
    }, {
      panelUser,
      panelPass,
    });

    return {
      success: Boolean(response.result),
      message: response.msg || (response.result ? "Senha alterada com sucesso!" : "Erro ao alterar senha."),
    };
  }
}

export const playpanelService = new PlayPanelService();
