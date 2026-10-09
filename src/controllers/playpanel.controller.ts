import type { FastifyReply, FastifyRequest } from "fastify";
import { playpanelLoginService } from "../services/playpanel.login.service";
import { playpanelFetchService } from "../services/playpanel.fetch.service";
import { playpanelService } from "../services/playpanel.service";
import type {
  QueryAuthLoginInput,
  QueryStatsInput,
  QueryFindInput,
  QueryFindAllInput,
  QueryPackageInput,
  QueryCreateTestUserInput,
  QueryRenewInput,
  QueryToggleStatusInput,
  QueryDeleteUserInput,
  QueryDeleteExpiredInput,
  QueryCreditLogsInput,
  QueryChangePasswordInput,
} from "../schemas/playpanel.schema";

export class PlayPanelController {
  /**
   * Endpoint para testar / autenticar no painel Play Panel
   */
  async login(
    req: FastifyRequest<{ Querystring: QueryAuthLoginInput }>,
    res: FastifyReply
  ) {
    const { panelUser, panelPass, forceNewLogin } = req.query;

    const result = await playpanelLoginService.login({
      panelUser,
      panelPass,
      forceNewLogin: Boolean(forceNewLogin),
    });

    if (!result.success) {
      return res.status(400).send(result);
    }

    return res.status(200).send(result);
  }

  /**
   * Endpoint para consultar estatísticas gerais e créditos
   */
  async getStats(
    req: FastifyRequest<{ Querystring: QueryStatsInput }>,
    res: FastifyReply
  ) {
    const { panelUser, panelPass } = req.query;

    try {
      const stats = await playpanelFetchService.get("stats", {
        panelUser,
        panelPass,
      });

      return res.status(200).send(stats);
    } catch (err: any) {
      return res.status(500).send({
        success: false,
        error: err?.message || "Erro ao consultar estatísticas no Play Panel",
      });
    }
  }

  /**
   * Endpoint para localizar um cliente específico
   */
  async findUser(
    req: FastifyRequest<{ Querystring: QueryFindInput }>,
    res: FastifyReply
  ) {
    const { panelUser, panelPass, username } = req.query;

    const result = await playpanelService.findUser({
      panelUser,
      panelPass,
      username,
    });

    if (!result.success) {
      return res.status(404).send({
        status: 404,
        user: false,
        success: false,
        error: "Not Found",
        message: result.message || "User not found",
      });
    }

    return res.status(200).send({
      status: 200,
      user: true,
      success: true,
      data: result.data,
    });
  }

  /**
   * Endpoint para listar todos os clientes / testes
   */
  async findAll(
    req: FastifyRequest<{ Querystring: QueryFindAllInput }>,
    res: FastifyReply
  ) {
    const { panelUser, panelPass, teste, filtro, tipo, cooldown } = req.query;

    const result = await playpanelService.findAll({
      panelUser,
      panelPass,
      teste,
      filtro,
      tipo,
      cooldown,
    });

    if (!result.success) {
      return res.status(400).send({
        status: 400,
        user: false,        success: false,
        message: result.message || "Find all already in progress",
      });
    }

    return res.status(200).send({
      status: 200,
      user: true,
      success: true,
      total: result.total,
      data: result.data,
    });
  }

  /**
   * Endpoint para consultar os pacotes / bouquets disponíveis
   */
  async getPackages(
    req: FastifyRequest<{ Querystring: QueryPackageInput }>,
    res: FastifyReply
  ) {
    const { panelUser, panelPass } = req.query;

    const result = await playpanelService.getPackages({
      panelUser,
      panelPass,
    });

    return res.status(200).send({
      status: 200,
      success: true,
      data: result.data,
    });
  }

  /**
   * Endpoint para criação de testes rápidos
   */
  async createTestUser(
    req: FastifyRequest<{ Querystring: QueryCreateTestUserInput }>,
    res: FastifyReply
  ) {
    const { panelUser, panelPass, plano, horas, username, password } = req.query;

    const result = await playpanelService.createTestUser({
      panelUser,
      panelPass,
      plano,
      horas,
      username,
      password,
    });

    if (!result.success) {
      return res.status(400).send({
        status: 400,
        user: false,
        ...result,
      });
    }

    return res.status(200).send({
      status: 200,
      user: true,
      success: true,
      id: result.id,
      username: result.username,
      password: result.password,
      horas: result.horas,
      exp_date: result.exp_date,
      exp_date_iso: result.exp_date_iso,
      exp_date_local: result.exp_date_local,
      message: result.message,
      data: {        success: true,
        result: {
          id: result.id,
          username: result.username,
          password: result.password,
          horas: result.horas,
          exp_date: result.exp_date,
          exp_date_iso: result.exp_date_iso,
          exp_date_local: result.exp_date_local,
          links: result.links,
        },
      },
    });
  }

  /**
   * Endpoint para renovação de clientes
   */
  async renewUser(
    req: FastifyRequest<{ Querystring: QueryRenewInput }>,
    res: FastifyReply
  ) {
    const { panelUser, panelPass, id, username, months, force, cooldown } = req.query;

    const result = await playpanelService.renewUser({
      panelUser,
      panelPass,
      id,      username,
      months,
      force: Boolean(force),
      cooldown,
    });

    if (!result.success) {
      return res.status(400).send({
        status: 400,
        user: false,        success: false,
        message: result.message || "Operação de renovação bloqueada por duplicidade.",
      });
    }

    return res.status(200).send({
      status: 200,
      user: true,
      success: true,
      message: result.message,
      data: result.data,
    });
  }

  /**
   * Endpoint para alternar bloqueio/desbloqueio de um cliente
   */
  async toggleStatus(
    req: FastifyRequest<{ Querystring: QueryToggleStatusInput }>,
    res: FastifyReply
  ) {
    const { panelUser, panelPass, id, username } = req.query;

    const result = await playpanelService.toggleUserStatus({
      panelUser,
      panelPass,
      id,
      username,
    });

    if (!result.success) {
      return res.status(400).send(result);
    }

    return res.status(200).send(result);
  }

  /**
   * Endpoint para deletar um cliente
   */
  async deleteUser(
    req: FastifyRequest<{ Querystring: QueryDeleteUserInput }>,
    res: FastifyReply
  ) {
    const { panelUser, panelPass, id, username } = req.query;

    const result = await playpanelService.deleteUser({
      panelUser,
      panelPass,
      id,
      username,
    });

    if (!result.success) {
      return res.status(400).send(result);
    }

    return res.status(200).send(result);
  }

  /**
   * Endpoint para apagar listas ou testes expirados
   */
  async deleteExpired(
    req: FastifyRequest<{ Querystring: QueryDeleteExpiredInput }>,
    res: FastifyReply
  ) {
    const { panelUser, panelPass, testes, tipo } = req.query;

    const result = await playpanelService.deleteExpired({
      panelUser,
      panelPass,
      testes: Boolean(testes),
      tipo,
    });

    return res.status(200).send(result);
  }

  /**
   * Endpoint para consultar extrato de créditos
   */
  async getCreditLogs(
    req: FastifyRequest<{ Querystring: QueryCreditLogsInput }>,
    res: FastifyReply
  ) {
    const { panelUser, panelPass, id, start, length } = req.query;

    const result = await playpanelService.getCreditLogs({
      panelUser,
      panelPass,
      id,
      start,
      length,
    });

    return res.status(200).send(result);
  }

  /**
   * Endpoint para alteração de senha da conta do painel
   */
  async changePassword(
    req: FastifyRequest<{ Querystring: QueryChangePasswordInput }>,
    res: FastifyReply
  ) {
    const { panelUser, panelPass, oldPassword, newPassword, confirmPassword } = req.query;

    const result = await playpanelService.changePassword({
      panelUser,
      panelPass,
      oldPassword,
      newPassword,
      confirmPassword,
    });

    if (!result.success) {
      return res.status(400).send(result);
    }

    return res.status(200).send(result);
  }
}

export const playpanelController = new PlayPanelController();
