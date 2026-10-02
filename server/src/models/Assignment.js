import mongoose from "mongoose";

const rubricItemSchema = new mongoose.Schema({
  criterion: { type: String, required: true },
  description: String,
  maxPoints: { type: Number, required: true, min: 0 },
}, { _id: false });

const questionSchema = new mongoose.Schema({
  prompt: { type: String, required: true, trim: true },
  type: { type: String, enum: ["text", "code"], required: true },
  language: String,
  points: { type: Number, required: true, min: 0 },
}, { timestamps: false });

const assignmentSchema = new mongoose.Schema({
  assignmentCode: { type: String, required: true, uppercase: true, trim: true, match: /^A\d{5}$/ },
  course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  learningOutcomes: [String],
  difficulty: { type: String, enum: ["beginner", "intermediate", "advanced"], default: "intermediate" },
  rubric: [rubricItemSchema],
  questions: [questionSchema],
  totalPoints: { type: Number, required: true, default: 100 },
  dueAt: { type: Date, required: true },
  status: { type: String, enum: ["draft", "published", "closed"], default: "draft" },
  aiGenerated: { type: Boolean, default: false },
  aiEvaluationEnabled: { type: Boolean, default: true },
  plagiarismCheckEnabled: { type: Boolean, default: true },
  plagiarismThreshold: { type: Number, enum: [10, 20, 30, 40, 50], default: 30 },
}, { timestamps: true });

assignmentSchema.index({ createdBy: 1, assignmentCode: 1 }, { unique: true });

export default mongoose.model("Assignment", assignmentSchema);
