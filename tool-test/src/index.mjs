import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ChatSession } from './domain/ChatSession.mjs';
import { createModel } from './infrastructure/LangChainModelAdapter.mjs';
import { createFileReaderTool } from './infrastructure/FileReaderTool.mjs';
import { AgentService } from './application/AgentService.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envCandidates = [
    path.resolve(__dirname, '../../.env'),
    path.resolve(process.cwd(), '.env'),
];

const envPath = envCandidates.find((candidate) => fs.existsSync(candidate));

if (envPath) {
    dotenv.config({ path: envPath });
} else {
    console.warn('[dotenv] .env file not found, continuing with existing process.env');
}

// 入口层 — 依赖注入 & 组装
// 只负责"把零件拼在一起"，不含任何业务逻辑
const session = new ChatSession(`你是一个代码助手，可以使用工具读取文件并解释代码。

工作流程：
1. 用户要求读取文件时，立即调用 read_file 工具
2. 等待工具返回文件内容
3. 基于文件内容进行分析和解释`);

session.addHumanMessage('请读取 src/index.mjs 文件内容并解释代码');

const agentService = new AgentService({
    model: createModel(),
    tools: [createFileReaderTool()],
    session,
});

const result = await agentService.run();
console.log('\n[最终回复]');
console.log(result);
