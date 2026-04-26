const express = require("express");
const crypto = require("crypto");
const Program = require("../models/Program");
const { authMiddleware } = require("../middleware/auth");
const { BADGES } = require("../config/badges");
const { sendAchievementEmail } = require("../utils/email");
const router = express.Router();

const POINTS_PER_SUCCESS = 10;

router.use(authMiddleware);

/**
 * Normalize code for hashing only: lowercase, collapse whitespace, remove spaces
 * around = + - * / ( ) , : so that "a = 20", "a=20", "A=20" all match.
 * The actual code (original case and spacing) is stored separately.
 */
function normalizeCodeForHash(code) {
  if (code == null || typeof code !== "string") return "";
  let s = code.trim().toLowerCase();
  s = s.replace(/\s+/g, " ");
  s = s.replace(/\s*=\s*/g, "=");
  s = s.replace(/\s*\+\s*/g, "+");
  s = s.replace(/\s*-\s*/g, "-");
  s = s.replace(/\s*\*\s*/g, "*");
  s = s.replace(/\s*\/\s*/g, "/");
  s = s.replace(/\s*\(\s*/g, "(");
  s = s.replace(/\s*\)\s*/g, ")");
  s = s.replace(/\s*,\s*/g, ",");
  s = s.replace(/\s*:\s*/g, ":");
  return s;
}

function computeCodeHash(code) {
  const normalized = normalizeCodeForHash(code);
  return crypto.createHash("sha256").update(normalized, "utf8").digest("hex");
}

router.get("/", async (req, res) => {
  try {
    const list = await Program.find({ userId: req.user._id })
      .sort({ updatedAt: -1 })
      .select("_id title code codeHash executedSuccessfully lastExecutedAt createdAt updatedAt");
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to list programs" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const program = await Program.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });
    if (!program) return res.status(404).json({ error: "Program not found" });
    res.json(program);
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to get program" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { title, code, executedSuccessfully } = req.body;
    const codeStr = code != null ? String(code) : "";
    const codeHash = computeCodeHash(codeStr);

    const existing = await Program.findOne({
      userId: req.user._id,
      codeHash: codeHash,
    });

    if (existing) {
      // Same logical code (same hash): do not save again, do not give score.
      return res.json(existing);
    }

    const program = await Program.create({
      userId: req.user._id,
      title: title || "Untitled",
      code: codeStr,
      codeHash: codeHash,
      executedSuccessfully: executedSuccessfully === true,
      lastExecutedAt: executedSuccessfully === true ? new Date() : undefined,
    });

    // If this save earned points, check for newly unlocked badge and send achievement email
    if (executedSuccessfully === true) {
      const successCount = await Program.countDocuments({
        userId: req.user._id,
        executedSuccessfully: true,
      });
      const newPoints = successCount * POINTS_PER_SUCCESS;
      const previousPoints = newPoints - POINTS_PER_SUCCESS;
      const newlyUnlocked = BADGES.filter(
        (b) => b.points > previousPoints && b.points <= newPoints
      );
      if (newlyUnlocked.length > 0) {
        const badge = newlyUnlocked[0];
        sendAchievementEmail(
          { email: req.user.email, name: req.user.name },
          badge,
          newPoints
        ).catch(() => {});
      }
    }

    res.status(201).json(program);
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to create program" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const program = await Program.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });
    if (!program) return res.status(404).json({ error: "Program not found" });
    const wasAlreadySuccess = program.executedSuccessfully === true;
    if (req.body.title != null) program.title = req.body.title;
    if (req.body.code != null) program.code = req.body.code;
    if (req.body.executedSuccessfully === true) {
      program.executedSuccessfully = true;
      program.lastExecutedAt = new Date();
    }
    await program.save();

    // If we just marked this program as successful for the first time, check for new badge
    if (req.body.executedSuccessfully === true && !wasAlreadySuccess) {
      const successCount = await Program.countDocuments({
        userId: req.user._id,
        executedSuccessfully: true,
      });
      const newPoints = successCount * POINTS_PER_SUCCESS;
      const previousPoints = newPoints - POINTS_PER_SUCCESS;
      const newlyUnlocked = BADGES.filter(
        (b) => b.points > previousPoints && b.points <= newPoints
      );
      if (newlyUnlocked.length > 0) {
        const badge = newlyUnlocked[0];
        sendAchievementEmail(
          { email: req.user.email, name: req.user.name },
          badge,
          newPoints
        ).catch(() => {});
      }
    }

    res.json(program);
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to update program" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const result = await Program.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });
    if (!result) return res.status(404).json({ error: "Program not found" });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to delete program" });
  }
});

module.exports = router;
