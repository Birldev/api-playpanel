import { z } from "zod";

const panelCredentialsSchema = z.object({
  apikey: z.string().optional().describe("Chave de autenticação da API"),
  panelUser: z.string().min(1, "Usuário do painel é obrigatório").describe("Usuário do painel Play Panel recebido na chamada"),
  panelPass: z.string().min(1, "Senha do painel é obrigatória").describe("Senha do painel Play Panel recebida na chamada"),
  panelUrl: z.string().optional().describe("URL opcional do painel para compatibilidade"),
});

export const queryFindResellerSchema = z.object({
  ...panelCredentialsSchema.shape,
  search: z.string().min(1, "Termo de busca ou usuário do revendedor é obrigatório"),
});

export const queryFindAllResellerSchema = z.object({
  ...panelCredentialsSchema.shape,
  start: z.coerce.number().optional().default(0).describe("Índice inicial para paginação"),
  length: z.coerce.number().optional().default(100).describe("Quantidade de registros por página"),
});

export const queryFindByMasterSchema = z.object({
  ...panelCredentialsSchema.shape,
  masterId: z.string().optional().describe("ID do master para consulta de hierarquia"),
  search: z.string().optional().describe("Termo de busca opcional"),
});

export const queryUpdateResellerCreditsSchema = z.object({
  ...panelCredentialsSchema.shape,
  idcentral: z.string().optional().describe("ID do revendedor no painel (compatibilidade com Central)"),
  id: z.string().optional().describe("ID do revendedor no painel"),
  creditos: z.string().optional().describe("Quantidade de créditos a adicionar (compatibilidade com Central)"),
  amount: z.string().optional().describe("Quantidade de créditos a adicionar"),
  reason: z.string().optional().default("Recarga de créditos via API").describe("Motivo ou observação da recarga"),
});

export type QueryFindResellerInput = z.infer<typeof queryFindResellerSchema>;
export type QueryFindAllResellerInput = z.infer<typeof queryFindAllResellerSchema>;
export type QueryFindByMasterInput = z.infer<typeof queryFindByMasterSchema>;
export type QueryUpdateResellerCreditsInput = z.infer<typeof queryUpdateResellerCreditsSchema>;
