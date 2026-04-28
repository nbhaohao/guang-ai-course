import { ChatOpenAI } from '@langchain/openai';

const storyPromptTemplate = (question, context) =>
    `你是一个讲友情故事的老师。基于以下故事片段回答问题，用温暖生动的语言。如果故事中没有提到，就说"这个故事里还没有提到这个细节"。

故事片段:
${context}

问题: ${question.text}

老师的回答:`;

const articlePromptTemplate = (question, context) =>
    `你是一个文章辅助阅读助手，根据文章内容来解答：

文章内容：
${context}

问题: ${question.text}

你的回答:`;

export const PromptTemplates = { story: storyPromptTemplate, article: articlePromptTemplate };

export class LangChainLanguageModel {
    constructor({ apiKey, baseURL, modelName, promptTemplate = storyPromptTemplate }) {
        this.model = new ChatOpenAI({
            temperature: 0,
            model: modelName,
            apiKey,
            configuration: { baseURL },
        });
        this.promptTemplate = promptTemplate;
    }

    async answer(question, retrievedDocuments) {
        const context = retrievedDocuments
            .map((rd, i) => `[片段${i + 1}]\n${rd.document.pageContent}`)
            .join('\n\n━━━━━\n\n');

        const response = await this.model.invoke(this.promptTemplate(question, context));
        return response.content;
    }
}
