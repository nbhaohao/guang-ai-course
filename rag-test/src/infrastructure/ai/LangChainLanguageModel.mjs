import { ChatOpenAI } from '@langchain/openai';

export class LangChainLanguageModel {
    constructor({ apiKey, baseURL, modelName }) {
        this.model = new ChatOpenAI({
            temperature: 0,
            model: modelName,
            apiKey,
            configuration: { baseURL },
        });
    }

    async answer(question, retrievedDocuments) {
        const context = retrievedDocuments
            .map((rd, i) => `[片段${i + 1}]\n${rd.document.pageContent}`)
            .join('\n\n━━━━━\n\n');

        const prompt = `你是一个讲友情故事的老师。基于以下故事片段回答问题，用温暖生动的语言。如果故事中没有提到，就说"这个故事里还没有提到这个细节"。

故事片段:
${context}

问题: ${question.text}

老师的回答:`;

        const response = await this.model.invoke(prompt);
        return response.content;
    }
}
