import mongoose from "mongoose";

const scoreSchema = new mongoose.Schema({
  questionId: String,
  criterion: String,
  score: Number,
  maxPoints: Number,
  note: String,
}, { _id: false });

const plagiarismEvidenceSchema = new mongoose.Schema({
  source: String,
  location: String,
  similarity: { type: Number, min: 0, max: 100 },
  studentExcerpt: String,
  matchedExcerpt: String,
  explanation: String,
}, { _id: false });

const answerSchema = new mongoose.Schema({
  question: { type: mongoose.Schema.Types.ObjectId, required: true },
  type: { type: String, enum: ["text", "code"], required: true },
  answer: { type: String, required: true },
}, { _id: false });

const submissionSchema = new mongoose.Schema({
  assignment: { type: mongoose.Schema.Types.ObjectId, ref: "Assignment", required: true, index: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  repositoryUrl: String,
  commitSha: String,
  answers: [answerSchema],
  attemptNumber: { type: Number, required: true, min: 1 },
  note: String,
  status: { type: String, enum: ["submitted", "ai_reviewed", "graded", "returned"], default: "submitted" },
  aiEvaluation: {
    suggestedGrade: Number,
    summary: String,
    scores: [scoreSchema],
    plagiarismLevel: { type: Number, min: 0, max: 100 },
    plagiarismEvidence: [plagiarismEvidenceSchema],
    evaluatedAt: Date,
  },
  finalGrade: Number,
  facultyFeedback: String,
  finalizedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  scoreReleasedAt: Date,
  submittedAt: { type: Date, default: Date.now },
}, { timestamps: true });

submissionSchema.index({ assignment: 1, student: 1, attemptNumber: 1 }, { unique: true });
export default mongoose.model("Submission", submissionSchema);
