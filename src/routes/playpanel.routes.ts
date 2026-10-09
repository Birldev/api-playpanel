import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { playpanelController } from "../controllers/playpanel.controller";
import { authGuard } from "../middlewares/auth.guard";
import {
  queryAuthLoginSchema,
  queryStatsSchema,
  queryFindSchema,
  queryFindAllSchema,
  queryPackageSchema,
  queryCreateTestUserSchema,
  queryRenewSchema,
  queryToggleStatusSchema,
  queryDeleteUserSchema,
  queryDeleteExpiredSchema,
  queryCreditLogsSchema,
  queryChangePasswordSchema,
} from "../schemas/playpanel.schema";

export const playpanelRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook("preHandler", authGuard);

  // 1. Autenticação & Sessão
  app.get(
    "/login",
    {
      schema: {
        tags: ["Play Panel - Autenticação"],
        description: "Executa login e retorno do token com validação de captcha",
        querystring: queryAuthLoginSchema,
      },
    },
    playpanelController.login
  );

  // 2. Estatísticas & Saldo
  app.get(
    "/stats",
    {
      schema: {
        tags: ["Play Panel - Painel"],
        description: "Consulta estatísticas da conta e créditos",
        querystring: queryStatsSchema,
      },
    },
    playpanelController.getStats
  );

  // 3. Localização de Cliente
  app.get(
    "/find",
    {
      schema: {
        tags: ["Play Panel - Clientes"],
        description: "Localiza apenas clientes oficiais por nome de usuário. Contas de teste não são retornadas.",
        querystring: queryFindSchema,
      },
    },
    playpanelController.findUser
  );

  // 4. Listagem Geral
  app.get(
    "/find-all",
    {
      schema: {
        tags: ["Play Panel - Clientes"],
        description: "Lista todos os clientes ou testes com opções de filtros de status.",
        querystring: queryFindAllSchema,
      },
    },
    playpanelController.findAll
  );

  app.get(
    "/findAll",
    {
      schema: {
        tags: ["Play Panel - Clientes"],
        description: "Alias para /find-all - Lista todos os clientes ou testes.",
        querystring: queryFindAllSchema,
      },
    },
    playpanelController.findAll
  );

  // 5. Pacotes / Bouquets
  app.get(
    "/pacotes",
    {
      schema: {
        tags: ["Play Panel - Planos"],
        description: "Lista todos os pacotes / bouquets disponíveis para criação de testes e clientes.",
        querystring: queryPackageSchema,
      },
    },
    playpanelController.getPackages
  );

  // 6. Criação de Teste Rápido
  app.get(
    "/create-test-user",
    {
      schema: {
        tags: ["Play Panel - Testes"],
        description: "Cria um teste rápido com usuário/senha automáticos ou customizados e retorna os links completos de reprodução.",
        querystring: queryCreateTestUserSchema,
      },
    },
    playpanelController.createTestUser
  );

  // 7. Renovação
  app.get(
    "/renew",
    {
      schema: {
        tags: ["Play Panel - Renovações"],
        description: "Renova o acesso de um cliente por ID ou por nome de usuário com proteção anti-duplicidade.",
        querystring: queryRenewSchema,
      },
    },
    playpanelController.renewUser
  );

  // 8. Bloquear / Desbloquear Cliente
  app.get(
    "/toggle-status",
    {
      schema: {
        tags: ["Play Panel - Gerenciamento"],
        description: "Alterna o status de bloqueio/desbloqueio de um cliente por ID ou username.",
        querystring: queryToggleStatusSchema,
      },
    },
    playpanelController.toggleStatus
  );

  // 9. Deletar Cliente
  app.get(
    "/delete",
    {
      schema: {
        tags: ["Play Panel - Gerenciamento"],
        description: "Deleta um cliente por ID ou username.",
        querystring: queryDeleteUserSchema,
      },
    },
    playpanelController.deleteUser
  );

  // 10. Limpar Listas / Testes Expirados
  app.get(
    "/delete-expired",
    {
      schema: {
        tags: ["Play Panel - Gerenciamento"],
        description: "Remove listas ou testes expirados em lote.",
        querystring: queryDeleteExpiredSchema,
      },
    },
    playpanelController.deleteExpired
  );

  // 11. Extrato de Créditos
  app.get(
    "/logs/creditos",
    {
      schema: {
        tags: ["Play Panel - Relatórios"],
        description: "Consulta o histórico e movimentação de créditos.",
        querystring: queryCreditLogsSchema,
      },
    },
    playpanelController.getCreditLogs
  );

  // 12. Alterar Senha
  app.get(
    "/alterar-senha",
    {
      schema: {
        tags: ["Play Panel - Segurança"],
        description: "Altera a senha de acesso da conta do painel.",
        querystring: queryChangePasswordSchema,
      },
    },
    playpanelController.changePassword
  );
};
