import { QuestionAnswer } from '../domain/story/QuestionAnswer.mjs';

export class AnswerQuestionUseCase {
    constructor({ storyRepository, languageModel }) {
        this.storyRepository = storyRepository;
        this.languageModel = languageModel;
    }

    async execute(question) {
        const retrievedDocuments = await this.storyRepository.findSimilar(question, 3);
        const answer = await this.languageModel.answer(question, retrievedDocuments);
        return new QuestionAnswer({ question, retrievedDocuments, answer });
    }
}
