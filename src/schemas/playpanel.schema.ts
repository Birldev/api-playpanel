import { z } from "zod";

const panelCredentialsSchema = z.object({
  apikey: z.string().optional().describe("Chave de autenticação da API"),
  panelUser: z.string().min(1, "Usuário do painel é obrigatório").describe("Usuário do painel Play Panel recebido na chamada"),
  panelPass: z.string().min(1, "Senha do painel é obrigatória").describe("Senha do painel Play Panel recebida na chamada"),
});

export const queryAuthLoginSchema = z.object({
  ...panelCredentialsSchema.shape,
  forceNewLogin: z
    .union([z.boolean(), z.string().transform((val) => val === "true")])
    .optional()
    .describe("Forçar nova autenticação e resolução de captcha"),
});

export const queryStatsSchema = z.object({
  ...panelCredentialsSchema.shape,
});

export const queryFindSchema = z.object({
  ...panelCredentialsSchema.shape,
  username: z.string().min(1, "Nome de usuário é obrigatório"),
});

export const queryFindAllSchema = z.object({
  ...panelCredentialsSchema.shape,
  teste: z
    .union([
      z.string().toLowerCase().transform((val) => val === "true"),
      z.boolean(),
    ])
    .optional()
    .describe("Filtrar por testes (true) ou clientes oficiais (false)"),
  filtro: z.enum(["todas", "ativa", "expirada"]).default("todas").describe("Filtro de status"),
  tipo: z.enum(["minhas", "revendas", "todas"]).default("minhas").describe("Escopo da busca"),
  cooldown: z.coerce.number().optional().default(15).describe("Cooldown anti-hammering em segundos"),
});

export const queryPackageSchema = z.object({
  ...panelCredentialsSchema.shape,
});

export const queryCreateTestUserSchema = z.object({
  ...panelCredentialsSchema.shape,
  plano: z.string().optional().default("4").describe("ID do pacote/bouquet (ex: '4' para Pacote Completo)"),
  horas: z.coerce.number().min(1).max(72).optional().default(3).describe("Duração do teste em horas"),
  username: z.string().min(12).max(20).optional().describe("Usuário desejado (mín. 12 caracteres, aleatório se vazio)"),
  password: z.string().min(12).optional().describe("Senha desejada (mín. 12 caracteres, aleatório se vazio)"),
});

export const queryRenewSchema = z.object({
  ...panelCredentialsSchema.shape,
  id: z.string().optional().describe("ID do cliente no Play Panel"),
  idcentral: z.string().optional().describe("ID do cliente (compatibilidade com workflows n8n)"),
  username: z.string().optional().describe("Nome do usuário do cliente a ser renovado"),
  months: z.coerce.number().min(1).max(12).optional().default(1).describe("Quantidade de meses para renovação"),
  force: z
    .union([z.boolean(), z.string().transform((val) => val === "true")])
    .optional()
    .default(false)
    .describe("Forçar renovação ignorando a trava de renovação dupla acidental"),
  cooldown: z.coerce
    .number()
    .min(5)
    .max(600)
    .optional()
    .default(60)
    .describe("Janela de segurança anti-duplicidade em segundos (padrão 60s)"),
});

export const queryToggleStatusSchema = z.object({
  ...panelCredentialsSchema.shape,
  id: z.string().optional().describe("ID do cliente no Play Panel"),
  username: z.string().optional().describe("Nome do usuário do cliente para alternar bloqueio"),
});

export const queryDeleteUserSchema = z.object({
  ...panelCredentialsSchema.shape,
  id: z.string().optional().describe("ID do cliente no Play Panel"),
  username: z.string().optional().describe("Nome do usuário do cliente para exclusão"),
});

export const queryDeleteExpiredSchema = z.object({
  ...panelCredentialsSchema.shape,
  testes: z
    .union([
      z.string().toLowerCase().transform((val) => val === "true" || val === "1"),
      z.boolean(),
    ])
    .optional()
    .default(false)
    .describe("Se true, apaga testes expirados. Se false, apaga clientes oficiais expirados."),
  tipo: z.enum(["minhas", "revendas", "todas"]).default("minhas").describe("Escopo das listas"),
});

export const queryCreditLogsSchema = z.object({
  ...panelCredentialsSchema.shape,
  id: z.string().optional().default("0").describe("ID de referência"),
  start: z.coerce.number().optional().default(0),
  length: z.coerce.number().optional().default(50),
});

export const queryChangePasswordSchema = z.object({
  ...panelCredentialsSchema.shape,
  oldPassword: z.string().min(1, "Senha atual é obrigatória"),
  newPassword: z.string().min(5, "Nova senha deve ter no mínimo 5 caracteres"),
  confirmPassword: z.string().min(5, "Confirmação de senha deve ter no mínimo 5 caracteres"),
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
