import type { FastifyReply, FastifyRequest } from "fastify";
import { playpanelResellerService } from "../services/playpanel.reseller.service";
import type {
  QueryFindResellerInput,
  QueryFindAllResellerInput,
  QueryFindByMasterInput,
  QueryUpdateResellerCreditsInput,
} from "../schemas/playpanel.reseller.schema";

export class PlayPanelResellerController {
  /**
   * Localiza um revendedor por ID, username ou email
   */
  async findReseller(
    req: FastifyRequest<{ Querystring: QueryFindResellerInput }>,
    res: FastifyReply
  ) {
    const { panelUser, panelPass, search } = req.query;

    const result = await playpanelResellerService.findReseller({
      panelUser,
      panelPass,
      search,
    });

    if (!result.success) {
      return res.status(404).send({
        status: 404,        success: false,
        message: result.message || "User not found",
      });
    }

    return res.status(200).send({
      status: 200,      success: true,
      data: result.data,
    });
  }

  /**
   * Lista todos os revendedores da conta
   */
  async findAllReseller(
    req: FastifyRequest<{ Querystring: QueryFindAllResellerInput }>,
    res: FastifyReply
  ) {
    const { panelUser, panelPass, start, length } = req.query;

    const result = await playpanelResellerService.findAllReseller({
      panelUser,
      panelPass,
      start,
      length,
    });

    return res.status(200).send({
      status: 200,      success: true,
      total: result.total,
      data: result.data,
    });
  }

  /**
   * Busca revendedores vinculados ao master
   */
  async findResellerByMaster(
    req: FastifyRequest<{ Querystring: QueryFindByMasterInput }>,
    res: FastifyReply
  ) {
    const { panelUser, panelPass, masterId, search } = req.query;

    const result = await playpanelResellerService.findResellerByMaster({
      panelUser,
      panelPass,
      masterId,
      search,
    });

    return res.status(200).send({
      status: 200,      success: true,
      data: result.data,
    });
  }

  /**
   * Adiciona créditos a um revendedor no Play Panel
   */
  async updateResellerCredits(
    req: FastifyRequest<{ Querystring: QueryUpdateResellerCreditsInput }>,
    res: FastifyReply
  ) {
    const { panelUser, panelPass, id, amount, reason } = req.query;

    const result = await playpanelResellerService.updateResellerCredits({
      panelUser,
      panelPass,
      id,      amount,
      reason,
    });

    if (!result.success) {
      const statusCode = result.message.includes("already") ? 400 : 404;
      return res.status(statusCode).send({
        status: statusCode,        success: false,
        message: result.message,
      });
    }

    return res.status(200).send({
      status: 200,      success: true,
      message: result.message,
      data: {
        credits: result.credits,
      },
    });
  }
}

export const playpanelResellerController = new PlayPanelResellerController();
