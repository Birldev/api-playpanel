import type { OpenAPIV3 } from "openapi-types";

// Documentation only: these schemas do not change Fastify response serialization.
export function documentResponses(document: Partial<OpenAPIV3.Document>) {
  const jsonResponse = (description: string): OpenAPIV3.ResponseObject => ({
    description,
    content: {
      "application/json": {
        schema: { type: "object", additionalProperties: true },
      },
    },
  });

  for (const [path, item] of Object.entries(document.paths || {})) {
    for (const method of ["get", "post"] as const) {
      const operation = item?.[method];
      if (!operation) continue;
      operation.responses = {
        "200": jsonResponse(path === "/" ? "Status da API" : "Resposta JSON; confira o indicador de sucesso e os dados retornados."),
      };
      if (path === "/") continue;
      operation.responses["400"] = jsonResponse("Parâmetros inválidos ou operação bloqueada/rejeitada, conforme o endpoint.");
      operation.responses["401"] = jsonResponse("API key ausente ou inválida.");
      operation.responses["500"] = jsonResponse("Erro interno, de autenticação no painel ou de comunicação com o backend.");
      if (path === "/playpanel/find" || path === "/playpanelreseller/find" || path === "/playpanelreseller/updateCredits") {
        operation.responses["404"] = jsonResponse(path.endsWith("updateCredits") ? "Falha de negócio na recarga, exceto bloqueio por duplicidade (HTTP 400)." : "Cliente oficial ou revendedor não encontrado, conforme o endpoint.");
      }
    }
  }
  return document;
}
