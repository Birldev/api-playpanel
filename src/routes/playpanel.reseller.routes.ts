import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { playpanelResellerController } from "../controllers/playpanel.reseller.controller";
import { authGuard } from "../middlewares/auth.guard";
import {
  queryFindResellerSchema,
  queryFindAllResellerSchema,
  queryFindByMasterSchema,
  queryUpdateResellerCreditsSchema,
} from "../schemas/playpanel.reseller.schema";

export const playpanelResellerRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook("preHandler", authGuard);

  // 1. Localizar revendedor
  app.get(
    "/find",
    {
      schema: {
        tags: ["playpanelReseller"],
        description: "Localiza um revendedor pelo ID, username ou e-mail completo nas primeiras 1.000 revendas próprias.",
        querystring: queryFindResellerSchema,
      },
    },
    playpanelResellerController.findReseller
  );

  // 2. Listar todos os revendedores
  app.get(
    "/findAll",
    {
      schema: {
        tags: ["playpanelReseller"],
        description: "Lista todos os revendedores cadastrados sob a conta master",
        querystring: queryFindAllResellerSchema,
      },
    },
    playpanelResellerController.findAllReseller
  );


  // 3. Buscar por Master
  app.get(
    "/findByMaster",
    {
      schema: {
        tags: ["playpanelReseller"],
        description: "Consulta a hierarquia quando masterId é informado. Em falha ou ausência de masterId, lista revendas próprias e aplica search; esse fallback não filtra por masterId. search não é aplicado quando a consulta de hierarquia tem sucesso.",
        querystring: queryFindByMasterSchema,
      },
    },
    playpanelResellerController.findResellerByMaster
  );

  // 4. Adicionar créditos ao revendedor

  // Recarga de créditos via POST; parâmetros enviados na query string
  app.post(
    "/updateCredits",
    {
      schema: {
        tags: ["playpanelReseller"],
        description: "Adiciona créditos via POST com parâmetros na query string: id e amount positivo são obrigatórios. Usa cooldown de 60 segundos e retorna HTTP 400 em bloqueio por duplicidade e HTTP 404 nas demais falhas de negócio.",
        querystring: queryUpdateResellerCreditsSchema,
      },
    },
    playpanelResellerController.updateResellerCredits
  );
};
