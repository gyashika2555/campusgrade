import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  campusId: { type: String, unique: true, sparse: true, uppercase: true, trim: true, match: /^[SP]\d{5}$/ },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ["admin", "professor", "student"], required: true },
  department: { type: String, default: "Computer Science" },
  courses: [{ type: String, trim: true }],
  active: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.model("User", userSchema);
