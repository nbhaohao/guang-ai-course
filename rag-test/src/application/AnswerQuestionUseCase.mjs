import { QuestionAnswer } from '../domain/story/QuestionAnswer.mjs';

export class AnswerQuestionUseCase {
    constructor({ repository, languageModel }) {
        this.repository = repository;
        this.languageModel = languageModel;
    }

    async execute(question) {
        const retrievedDocuments = await this.repository.findSimilar(question, 3);
        const answer = await this.languageModel.answer(question, retrievedDocuments);
        return new QuestionAnswer({ question, retrievedDocuments, answer });
    }
}
