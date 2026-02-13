// ============================================================
// LocoSnap — Environment Configuration
// ============================================================

import dotenv from "dotenv";
dotenv.config();

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    console.error(`❌ Missing required environment variable: ${key}`);
    console.error(`   Copy .env.example to .env and fill in your API keys.`);
    process.exit(1);
  }
  return value;
}

function optionalEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

export const config = {
  // API Keys
  anthropicApiKey: optionalEnv("ANTHROPIC_API_KEY", ""),
  replicateApiToken: optionalEnv("REPLICATE_API_TOKEN", ""),
  openaiApiKey: optionalEnv("OPENAI_API_KEY", ""),

  // Supabase
  supabaseUrl: optionalEnv("SUPABASE_URL", ""),
  supabaseServiceKey: optionalEnv("SUPABASE_SERVICE_ROLE_KEY", ""),

  // Server
  port: parseInt(optionalEnv("PORT", "3000"), 10),
  nodeEnv: optionalEnv("NODE_ENV", "development"),
  frontendUrl: optionalEnv("FRONTEND_URL", "http://localhost:8081"),

  // Feature flags
  get hasAnthropic(): boolean {
    return this.anthropicApiKey.length > 0;
  },
  get hasReplicate(): boolean {
    return this.replicateApiToken.length > 0;
  },
  get hasOpenAI(): boolean {
    return this.openaiApiKey.length > 0;
  },
  get hasImageGen(): boolean {
    return this.hasReplicate || this.hasOpenAI;
  },
  get hasVision(): boolean {
    return this.hasAnthropic || this.hasOpenAI;
  },
  get hasSupabase(): boolean {
    return this.supabaseUrl.length > 0 && this.supabaseServiceKey.length > 0;
  },
};
