export const AppConfig = {
    openai: {
        get apiKey() { return process.env.OPENAI_API_KEY; },
        get baseURL() { return process.env.OPENAI_BASE_URL; },
        get modelName() { return process.env.MODEL_NAME; },
        get embeddingsModelName() { return process.env.EMBEDDINGS_MODEL_NAME; },
    },
};
