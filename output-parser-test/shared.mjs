// ===== Domain Layer =====

export class LLMService {
  /** @param {string} prompt @returns {Promise<string>} */
  async invoke(prompt) {
    throw new Error('Not implemented');
  }
}

export class OutputParser {
  /** @returns {string} */
  getFormatInstructions() {
    throw new Error('Not implemented');
  }
  /** @param {string} content @returns {Promise<unknown>} */
  async parse(content) {
    throw new Error('Not implemented');
  }
}

// ===== Infrastructure Layer =====

import { ChatOpenAI } from '@langchain/openai';
import { JsonOutputParser } from '@langchain/core/output_parsers';

export class OpenAIChatService extends LLMService {
  constructor() {
    super();
    this._model = new ChatOpenAI({
      modelName: process.env.MODEL_NAME,
      apiKey: process.env.OPENAI_API_KEY,
      temperature: 0,
      configuration: {
        baseURL: process.env.OPENAI_BASE_URL,
      },
    });
  }

  async invoke(prompt) {
    const response = await this._model.invoke(prompt);
    return response.content;
  }
}

export class JsonOutputParserAdapter extends OutputParser {
  constructor() {
    super();
    this._parser = new JsonOutputParser();
  }

  getFormatInstructions() {
    return this._parser.getFormatInstructions();
  }

  async parse(content) {
    return this._parser.parse(content);
  }
}
