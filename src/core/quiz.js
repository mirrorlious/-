export const normalizeQuizQuestions = (quizData) => {
    if (!quizData) return [];
    if (Array.isArray(quizData)) return quizData.filter(Boolean);
    if (Array.isArray(quizData.questions)) return quizData.questions.filter(Boolean);
    if (quizData.questionEn || quizData.options) return [quizData];
    return [];
};
