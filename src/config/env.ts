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
  PLAYPANEL_RECAPTCHA_SITEKEY: z.string().default("0x4AAAAAAFAORi8vAjtQe9Lx"),
});

export const envParsed = envSchema.parse(process.env);
