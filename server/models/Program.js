const mongoose = require("mongoose");

const programSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true, default: "Untitled" },
    code: { type: String, default: "" },
    codeHash: { type: String, default: "" },
    executedSuccessfully: { type: Boolean, default: false },
    lastExecutedAt: { type: Date },
  },
  { timestamps: true }
);

programSchema.index({ userId: 1, updatedAt: -1 });
programSchema.index({ userId: 1, codeHash: 1 });

module.exports = mongoose.model("Program", programSchema);
