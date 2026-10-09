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
        description: "Localiza um revendedor por ID ou username",
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
        description: "Consulta revendedores vinculados a uma conta master específica",
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
        description: "Adiciona créditos a um revendedor via POST com trava anti-duplicidade",
        querystring: queryUpdateResellerCreditsSchema,
      },
    },
    playpanelResellerController.updateResellerCredits
  );
};
