import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.string().default("3004"),
  APIKEY: z.string().default("123456"),
  REDIS_URL: z.string().default("redis://127.0.0.1:6379"),
  CAPMONSTER_KEY: z.string().optional().default(""),
  CAPTCHA2_API_KEY: z.string().optional().default(""),
  PLAYPANEL_URL: z.string().default("https://api.playpainel.com/"),
  PLAYPANEL_PANEL_URL: z.string().default("https://playpainel.com/login"),
  PLAYPANEL_RECAPTCHA_SITEKEY: z.string().default("6LeoXPYfAAAAAESd3YBOkZDLnDrXvMv0vHtM0Qbh"),
  DEFAULT_PLAYPANEL_USER: z.string().default("Marcelo15"),
  DEFAULT_PLAYPANEL_PASS: z.string().default("10203040wW"),
});

export const envParsed = envSchema.parse(process.env);
