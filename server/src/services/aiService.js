async function callLlm(system, prompt) {
  if (!process.env.LLM_API_KEY || !process.env.LLM_API_URL) return null;
  const response = await fetch(process.env.LLM_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.LLM_API_KEY}` },
    body: JSON.stringify({ model: process.env.LLM_MODEL, response_format: { type: "json_object" }, messages: [{ role: "system", content: system }, { role: "user", content: prompt }] }),
  });
  if (!response.ok) throw new Error(`AI service returned ${response.status}`);
  const data = await response.json();
  return JSON.parse(data.choices[0].message.content);
}

export async function generateAssignment({ topic, outcomes, difficulty, totalPoints = 100 }) {
  const generated = await callLlm(
    "You design fair university programming assignments. Return strict JSON with title, description, learningOutcomes, questions, requirements, and rubric. Every question must include prompt, type (text or code), optional language, and points. Question and rubric points must each equal the requested total.",
    JSON.stringify({ topic, outcomes, difficulty, totalPoints }),
  );
  return generated ?? {
    title: topic,
    description: `Build and document a working solution for ${topic}. Include setup instructions, tests, and a short design explanation.`,
    learningOutcomes: outcomes,
    questions: [
      { prompt: `Explain the key concepts and design choices for ${topic}.`, type: "text", points: 30 },
      { prompt: `Implement the core solution for ${topic} with validation and error handling.`, type: "code", language: "JavaScript", points: 50 },
      { prompt: "Describe the tests needed to verify correctness and edge cases.", type: "text", points: 20 },
    ],
    requirements: ["Use meaningful commits", "Include automated tests", "Document setup and API behavior"],
    rubric: [
      { criterion: "Functionality", description: "Required behavior works correctly", maxPoints: 40 },
      { criterion: "Code quality", description: "Readable, modular, maintainable implementation", maxPoints: 25 },
      { criterion: "Testing", description: "Useful automated tests and edge cases", maxPoints: 20 },
      { criterion: "Documentation", description: "Clear README and code documentation", maxPoints: 15 },
    ],
  };
}

export async function evaluateSubmission({ assignment, submission, comparisons = [] }) {
  const evaluated = await callLlm(
    "You assist, but never replace, a faculty grader. Evaluate only against the supplied questions and rubric. Return strict JSON with suggestedGrade, plagiarismLevel, summary, scores, and plagiarismEvidence. Return one scores item per assignment question containing questionId, criterion, score, maxPoints, and a specific note explaining deductions and the scoring conclusion. Each plagiarismEvidence item must contain source, location, similarity, studentExcerpt, matchedExcerpt, and explanation. Only report plagiarism evidence supported by the supplied comparison data; never invent a source or match.",
    JSON.stringify({ assignment, submission, comparisonSubmissions: comparisons }),
  );
  return evaluated ?? { suggestedGrade: 0, plagiarismLevel: 0, summary: "AI evaluation is awaiting external service configuration.", scores: [], plagiarismEvidence: [] };
}
