import path from 'path';
import {fileURLToPath} from 'url';
import dotenv from 'dotenv';
import fs from 'node:fs';


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


import {OpenAIEmbeddings} from '@langchain/openai';
import {AppConfig} from './infrastructure/config/AppConfig.mjs';
import {MemoryStoryRepository} from './infrastructure/persistence/MemoryStoryRepository.mjs';
import {LangChainLanguageModel} from './infrastructure/ai/LangChainLanguageModel.mjs';
import {AnswerQuestionUseCase} from './application/AnswerQuestionUseCase.mjs';
import {storyDocuments} from './domain/story/storyCorpus.mjs';
import {Question} from './domain/story/Question.mjs';

// Infrastructure
const embeddings = new OpenAIEmbeddings({
    apiKey: AppConfig.openai.apiKey,
    model: AppConfig.openai.embeddingsModelName,
    configuration: {baseURL: AppConfig.openai.baseURL},
});
const storyRepository = new MemoryStoryRepository(embeddings);
const languageModel = new LangChainLanguageModel(AppConfig.openai);

// Application
const answerQuestion = new AnswerQuestionUseCase({storyRepository, languageModel});

// Initialize
await storyRepository.save(storyDocuments);
// Run
const questions = [
    new Question("东东和光光是怎么成为朋友的？"),
];

for (const question of questions) {
    console.log("=".repeat(80));
    console.log(`问题: ${question.text}`);
    console.log("=".repeat(80));

    const result = await answerQuestion.execute(question);

    console.log("\n【检索到的文档及相似度评分】");
    result.retrievedDocuments.forEach((rd, i) => {
        console.log(`\n[文档 ${i + 1}] 相似度: ${rd.similarity}`);
        console.log(`内容: ${rd.document.pageContent}`);
        console.log(`元数据: 章节=${rd.document.chapter}, 角色=${rd.document.character}, 类型=${rd.document.type}, 心情=${rd.document.mood}`);
    });

    console.log("\n【AI 回答】");
    console.log(result.answer);
    console.log("\n");
}
