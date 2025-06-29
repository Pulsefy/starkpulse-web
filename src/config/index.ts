import * as dotenv from 'dotenv';
import { z } from 'zod';
import path from 'path';

// Determine which .env file to load
const NODE_ENV = process.env.NODE_ENV || 'development';
const envFile = path.resolve(process.cwd(), `.env.${NODE_ENV}`);
dotenv.config({ path: envFile });

dotenv.config(); // fallback to .env if specific file not found

// Define schema for environment variables
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']),
  PORT: z.string().default('3000'),
  DB_HOST: z.string(),
  DB_PORT: z.string(),
  DB_USER: z.string(),
  DB_PASS: z.string(),
  API_KEY: z.string(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Only print non-sensitive error details
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data; 