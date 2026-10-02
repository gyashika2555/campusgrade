import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  type: { type: String, enum: ["assignment_published", "submission_received", "score_released", "system"], required: true },
  title: { type: String, required: true, trim: true },
  message: { type: String, required: true, trim: true },
  assignment: { type: mongoose.Schema.Types.ObjectId, ref: "Assignment" },
  submission: { type: mongoose.Schema.Types.ObjectId, ref: "Submission" },
  readAt: Date,
}, { timestamps: true });

notificationSchema.index({ recipient: 1, createdAt: -1 });

export default mongoose.model("Notification", notificationSchema);
