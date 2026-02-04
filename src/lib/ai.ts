import { createOpenAI, type OpenAIProvider } from "@ai-sdk/openai";

const AI_PROVIDERS = {
  openai: {
    name: "OpenAI",
    baseURL: "https://api.openai.com/v1",
    envKey: "OPENAI_API_KEY",
    defaultModel: "gpt-4o",
  },
  gemini: {
    name: "Google Gemini",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
    envKey: "GOOGLE_GENERATIVE_AI_API_KEY",
    defaultModel: "gemini-2.0-flash",
  },
  deepseek: {
    name: "DeepSeek",
    baseURL: "https://api.siliconflow.cn/v1",
    envKey: "DEEPSEEK_API_KEY",
    defaultModel: "deepseek-ai/DeepSeek-V3.2",
  },
} as const;

type ProviderName = keyof typeof AI_PROVIDERS;

function createAIProvider(
  provider: ProviderName,
  apiKey?: string,
): OpenAIProvider {
  const config = AI_PROVIDERS[provider];
  const key = apiKey || process.env[config.envKey];

  if (!key) {
    throw new Error(
      `缺少 ${config.name} 的 API Key，请设置环境变量 ${config.envKey}`,
    );
  }

  return createOpenAI({
    baseURL: config.baseURL,
    apiKey: key,
  });
}

export function getModel(
  provider: ProviderName,
  model?: string,
  apiKey?: string,
) {
  const client = createAIProvider(provider, apiKey);
  const modelName = model || AI_PROVIDERS[provider].defaultModel;
  return client.chat(modelName);
}

//预配置的便捷导出
export const gemini = (model?: string) => getModel("gemini", model);
export const openai = (model?: string) => getModel("openai", model);
export const deepseek = (model?: string) => getModel("deepseek", model);
