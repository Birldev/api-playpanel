import { z } from "zod";
import { panelCredentialsSchema, panelIdSchema, queryBooleanSchema, paginationStartSchema, paginationLengthSchema } from "./shared.schema";

const clientTarget = {
  id: panelIdSchema.optional().describe("ID do cliente no Play Panel"),
  username: z.string().min(1).optional().describe("Nome do usuário do cliente"),
};
const hasClientTarget = (value: { id?: string; username?: string }) => Boolean(value.id || value.username);
const clientTargetError = { message: "Informe id ou username do cliente", path: ["id"] };

export const queryAuthLoginSchema = z.object({
  ...panelCredentialsSchema.shape,
  forceNewLogin: queryBooleanSchema.optional().describe("Forçar nova autenticação e resolução de captcha"),
}).strict();

export const queryStatsSchema = panelCredentialsSchema.strict();
export const queryFindSchema = z.object({
  ...panelCredentialsSchema.shape,
  username: z.string().min(1, "Nome de usuário é obrigatório"),
}).strict();

export const queryFindAllSchema = z.object({
  ...panelCredentialsSchema.shape,
  teste: queryBooleanSchema.optional().describe("Filtrar por testes (true) ou clientes oficiais (false)"),
  filtro: z.enum(["todas", "ativa", "expirada"]).default("todas").describe("Filtro de status"),
  tipo: z.enum(["minhas", "revendas", "todas"]).default("minhas").describe("Escopo da busca"),
  cooldown: z.coerce.number().int().min(1).max(600).default(15).describe("Cooldown da listagem em segundos"),
}).strict();

export const queryPackageSchema = panelCredentialsSchema.strict();
export const queryCreateTestUserSchema = z.object({
  ...panelCredentialsSchema.shape,
  plano: panelIdSchema.default("4").describe("ID do bouquet no Play Panel"),
  horas: z.coerce.number().int().min(1).max(72).default(3).describe("Duração do teste em horas"),
  username: z.string().min(12).max(20).optional().describe("Usuário personalizado; omita para gerar automaticamente"),
  password: z.string().min(12).optional().describe("Senha personalizada; omita para gerar automaticamente"),
}).strict();

export const queryRenewSchema = z.object({
  ...panelCredentialsSchema.shape,
  ...clientTarget,
  months: z.coerce.number().int().min(1).max(12).default(1).describe("Quantidade de meses para renovação"),
  force: queryBooleanSchema.default(false).describe("Ignorar verificações de duplicidade e concorrência"),
  cooldown: z.coerce.number().int().min(5).max(600).default(60).describe("Janela anti-duplicidade em segundos"),
}).strict().refine(hasClientTarget, clientTargetError);

export const queryToggleStatusSchema = z.object({
  ...panelCredentialsSchema.shape,
  ...clientTarget,
}).strict().refine(hasClientTarget, clientTargetError);

export const queryDeleteUserSchema = z.object({
  ...panelCredentialsSchema.shape,
  ...clientTarget,
}).strict().refine(hasClientTarget, clientTargetError);

export const queryDeleteExpiredSchema = z.object({
  ...panelCredentialsSchema.shape,
  testes: queryBooleanSchema.default(false).describe("Excluir testes expirados (true) ou clientes oficiais expirados (false)"),
  tipo: z.enum(["minhas", "revendas", "todas"]).default("minhas").describe("Escopo das listas"),
}).strict();

export const queryCreditLogsSchema = z.object({
  ...panelCredentialsSchema.shape,
  id: panelIdSchema.default("0").describe("ID de referência"),
  start: paginationStartSchema,
  length: paginationLengthSchema.default(50),
}).strict();

export const queryChangePasswordSchema = z.object({
  ...panelCredentialsSchema.shape,
  oldPassword: z.string().min(1, "Senha atual é obrigatória"),
  newPassword: z.string().min(5, "Nova senha deve ter no mínimo 5 caracteres"),
  confirmPassword: z.string().min(5, "Confirmação de senha deve ter no mínimo 5 caracteres"),
}).strict().refine(value => value.newPassword === value.confirmPassword, {
  message: "A nova senha e a confirmação devem coincidir", path: ["confirmPassword"],
});

export type QueryAuthLoginInput = z.infer<typeof queryAuthLoginSchema>;
export type QueryStatsInput = z.infer<typeof queryStatsSchema>;
export type QueryFindInput = z.infer<typeof queryFindSchema>;
export type QueryFindAllInput = z.infer<typeof queryFindAllSchema>;
export type QueryPackageInput = z.infer<typeof queryPackageSchema>;
export type QueryCreateTestUserInput = z.infer<typeof queryCreateTestUserSchema>;
export type QueryRenewInput = z.infer<typeof queryRenewSchema>;
export type QueryToggleStatusInput = z.infer<typeof queryToggleStatusSchema>;
export type QueryDeleteUserInput = z.infer<typeof queryDeleteUserSchema>;
export type QueryDeleteExpiredInput = z.infer<typeof queryDeleteExpiredSchema>;
export type QueryCreditLogsInput = z.infer<typeof queryCreditLogsSchema>;
export type QueryChangePasswordInput = z.infer<typeof queryChangePasswordSchema>;
