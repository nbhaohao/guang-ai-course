export class Question {
    constructor(text) {
        if (!text || typeof text !== 'string') {
            throw new Error('Question text must be a non-empty string');
        }
        this.text = text;
    }
}
