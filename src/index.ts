import "dotenv/config";
import cors from "@fastify/cors";
import FastifySwagger from "@fastify/swagger";
import fastify, { errorCodes } from "fastify";
import { randomUUID } from "node:crypto";
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  ResponseValidationError,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { envParsed } from "./config/env";
import { logger } from "./utils/logger";
import { setupProcessLifecycle } from "./config/process";
import { playpanelRoutes } from "./routes/playpanel.routes";
import { playpanelResellerRoutes } from "./routes/playpanel.reseller.routes";

const app = fastify({ requestTimeout: 60000 }).withTypeProvider<ZodTypeProvider>();
setupProcessLifecycle(app);
const port = Number(envParsed.PORT) || 3004;

app.setSerializerCompiler(serializerCompiler);
app.setValidatorCompiler(validatorCompiler);

app.register(cors, {
  origin: "*",
});

app.register(FastifySwagger, {
  openapi: {
    info: {
      title: "Api Play Panel",
      description: "API de automação e integração completa para o servidor Play Panel",
      version: "1.0.0",
    },
  },
  transform: jsonSchemaTransform,
});

const dynamicImport = new Function("specifier", "return import(specifier)");

app.register(async (instance) => {
  const { default: ScalarApiReference } = await dynamicImport("@scalar/fastify-api-reference");
  await instance.register(ScalarApiReference, {
    routePrefix: "/reference",
    configuration: {
      hideModels: true,
    },
  });
});

app.addHook("onRequest", async (request) => {
  (request as any).startTime = Date.now();
  (request as any).requestId = randomUUID();
  logger.debug(`[Start] [${(request as any).requestId}] ${request.ip} ${request.method} ${request.url}`);
});

app.addHook("onResponse", async (request, reply) => {
  const duration = Date.now() - (request as any).startTime;
  logger.debug(
    `[End] [${(request as any).requestId}] ${request.ip} ${request.method} ${request.url} - ${duration}ms - Status: ${reply.statusCode}`
  );
});

app.get("/", async (req, res) => {
  return res.send({
    service: "Api Play Panel",
    status: "online",
    date: new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeStyle: "medium" }).format(new Date()),
  });
});

// Rotas de clientes na raiz e com o prefixo /playpanel
app.register(playpanelRoutes);
app.register(playpanelRoutes, { prefix: "/playpanel" });

// Rotas do sistema de revenda (reseller)
app.register(playpanelResellerRoutes, { prefix: "/reseller" });
app.register(playpanelResellerRoutes, { prefix: "/playpanel/reseller" });

app.setErrorHandler((error, request, reply) => {
  if (error.validation) {
    logger.error(`Validation Error: ${JSON.stringify(error.validation)}`);
    return reply.code(400).send({
      error: error.name,
      message: error.message || "Erro de validação dos parâmetros",
      statusCode: 400,
      details: {
        issues: error.validation,
        method: request.method,
        url: request.url,
      },
    });
  }

  if (error instanceof ResponseValidationError) {
    logger.error(`Serialization Error: ${error.message}`);
    return reply.code(500).send({
      error: error.name,
      message: "Erro interno de validação de resposta",
      statusCode: 500,
      details: {
        method: request.method,
        url: request.url,
      },
    });
  }

  if (error instanceof errorCodes.FST_ERR_BAD_STATUS_CODE) {
    logger.error(`Bad status code error: ${error.message}`);
    return reply.status(500).send({ ok: false });
  }

  logger.error(`Unhandled error: ${error.message || error}`);
  return reply.send(error);
});

const start = async () => {
  try {
    await app.listen({ port, host: "0.0.0.0" });
    logger.info(`Api Play Panel iniciada com sucesso na porta ${port}!`);
    logger.info(`Documentação interativa disponível em http://localhost:${port}/reference`);
  } catch (err) {
    logger.error(`Falha ao iniciar Api Play Panel: ${err}`);
    process.exit(1);
  }
};

start();
