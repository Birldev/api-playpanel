import { z } from "zod";

export const panelCredentialsSchema = z.object({
  apikey: z.string().min(1).optional().describe("Chave de autenticação da API"),
  panelUser: z.string().min(1, "Usuário do painel é obrigatório").describe("Usuário do painel Play Panel recebido na chamada"),
  panelPass: z.string().min(1, "Senha do painel é obrigatória").describe("Senha do painel Play Panel recebida na chamada"),
});

export const panelIdSchema = z.string().regex(/^\d+$/, "ID deve conter apenas dígitos");
export const queryBooleanSchema = z.union([
  z.boolean(),
  z.enum(["true", "false", "1", "0"]).transform(value => value === "true" || value === "1"),
]);
export const paginationStartSchema = z.coerce.number().int().min(0).default(0);
export const paginationLengthSchema = z.coerce.number().int().min(1).max(1000);
