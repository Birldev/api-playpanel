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
        tags: ["Outros"],
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
        tags: ["Outros"],
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
        tags: ["playpanel"],
        description: "Localiza um cliente oficial pelo username completo, sem diferenciar maiúsculas e minúsculas. Busca nas listas próprias e depois na lista geral. Retorna JSON em data (HTTP 200) ou HTTP 404 quando não encontrado; testes não são retornados.",
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
        tags: ["playpanel"],
        description: "Lista clientes ou testes: teste=false seleciona oficiais, teste=true seleciona testes, e a ausência do parâmetro inclui ambos. total conta os registros retornados após o filtro, com limite de 1.000 registros por chamada ao painel. O cooldown é por conta e pode retornar HTTP 400.",
        querystring: queryFindAllSchema,
      },
    },
    playpanelController.findAll
  );


  // 7. Renovação
  app.get(
    "/renew",
    {
      schema: {
        tags: ["playpanel"],
        description: "Renova por 1 a 12 meses. Informe id ou username; id tem prioridade quando ambos são enviados. A busca interna também aceita testes. O painel determina a conversão para cliente oficial e o vencimento. Retorna message e, quando recuperados, os dados atualizados em data; HTTP 400 em falha de negócio ou bloqueio por duplicidade.",
        querystring: queryRenewSchema,
      },
    },
    playpanelController.renewUser
  );

  // 5. Pacotes / Bouquets
  app.get(
    "/pacotes",
    {
      schema: {
        tags: ["playpanel"],
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
        tags: ["playpanel"],
        description: "Cria um teste de 1 a 72 horas (padrão 3), com plano padrão 4. Retorna credenciais na raiz e em data.result, com links em data.result.links. A senha informada é substituída por uma gerada se não contiver maiúscula, minúscula e número. O vencimento retornado é calculado localmente; HTTP 400 em falha de negócio.",
        querystring: queryCreateTestUserSchema,
      },
    },
    playpanelController.createTestUser
  );

  // 8. Bloquear / Desbloquear Cliente
  app.get(
    "/toggle-status",
    {
      schema: {
        tags: ["Outros"],
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
        tags: ["Outros"],
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
        tags: ["Outros"],
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
        tags: ["Outros"],
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
        tags: ["Outros"],
        description: "Altera a senha de acesso da conta do painel.",
        querystring: queryChangePasswordSchema,
      },
    },
    playpanelController.changePassword
  );
};
