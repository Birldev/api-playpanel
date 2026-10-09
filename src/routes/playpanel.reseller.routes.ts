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
        tags: ["Play Panel - Revendedores"],
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
        tags: ["Play Panel - Revendedores"],
        description: "Lista todos os revendedores cadastrados sob a conta master",
        querystring: queryFindAllResellerSchema,
      },
    },
    playpanelResellerController.findAllReseller
  );

  app.get(
    "/find-all",
    {
      schema: {
        tags: ["Play Panel - Revendedores"],
        description: "Alias para /findAll - Lista todos os revendedores",
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
        tags: ["Play Panel - Revendedores"],
        description: "Consulta revendedores vinculados a uma conta master específica",
        querystring: queryFindByMasterSchema,
      },
    },
    playpanelResellerController.findResellerByMaster
  );

  // 4. Adicionar créditos ao revendedor
  app.get(
    "/updateCredits",
    {
      schema: {
        tags: ["Play Panel - Revendedores"],
        description: "Adiciona ou recarrega créditos de um revendedor via GET com trava anti-duplicidade",
        querystring: queryUpdateResellerCreditsSchema,
      },
    },
    playpanelResellerController.updateResellerCredits
  );

  // Recarga de créditos via POST; parâmetros enviados na query string
  app.post(
    "/updateCredits",
    {
      schema: {
        tags: ["Play Panel - Revendedores"],
        description: "Alias em POST para adicionar créditos a um revendedor",
        querystring: queryUpdateResellerCreditsSchema,
      },
    },
    playpanelResellerController.updateResellerCredits
  );
};
