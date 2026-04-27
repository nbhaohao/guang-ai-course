import { ChatOpenAI } from '@langchain/openai';

// 基础设施层 — LLM 适配器
// 封装对外部 AI 服务的依赖，其他层不直接 import ChatOpenAI
export function createModel() {
    return new ChatOpenAI({
        modelName: process.env.MODEL_NAME || 'qwen-coder-turbo',
        apiKey: process.env.OPENAI_API_KEY,
        configuration: {
            baseURL: process.env.OPENAI_BASE_URL,
        },
    });
}
