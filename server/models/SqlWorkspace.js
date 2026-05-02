const mongoose = require("mongoose");

const sqlWorkspaceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    sqliteData: { type: Buffer, required: true },
    editorScript: { type: String, default: "" },
    /** MongoDB TTL: document removed after this instant passes. */
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

sqlWorkspaceSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("SqlWorkspace", sqlWorkspaceSchema);
