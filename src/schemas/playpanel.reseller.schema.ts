import { z } from "zod";
import { panelCredentialsSchema, panelIdSchema, paginationStartSchema, paginationLengthSchema } from "./shared.schema";

export const queryFindResellerSchema = z.object({
  ...panelCredentialsSchema.shape,
  search: z.string().min(1, "Informe ID, username ou e-mail do revendedor"),
}).strict();

export const queryFindAllResellerSchema = z.object({
  ...panelCredentialsSchema.shape,
  start: paginationStartSchema.describe("Índice inicial para paginação"),
  length: paginationLengthSchema.default(100).describe("Quantidade de registros por página"),
}).strict();

export const queryFindByMasterSchema = z.object({
  ...panelCredentialsSchema.shape,
  masterId: panelIdSchema.optional().describe("ID do master no Play Panel"),
  search: z.string().min(1).optional().describe("Termo de busca opcional"),
}).strict();

export const queryUpdateResellerCreditsSchema = z.object({
  ...panelCredentialsSchema.shape,
  id: panelIdSchema.describe("ID do revendedor no Play Panel"),
  amount: z.coerce.number().finite().positive().describe("Quantidade positiva de créditos a adicionar"),
  reason: z.string().min(1).default("Recarga de créditos via API").describe("Motivo da recarga"),
}).strict();

export type QueryFindResellerInput = z.infer<typeof queryFindResellerSchema>;
export type QueryFindAllResellerInput = z.infer<typeof queryFindAllResellerSchema>;
export type QueryFindByMasterInput = z.infer<typeof queryFindByMasterSchema>;
export type QueryUpdateResellerCreditsInput = z.infer<typeof queryUpdateResellerCreditsSchema>;
