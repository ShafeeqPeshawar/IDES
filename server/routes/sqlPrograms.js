const express = require("express");
const crypto = require("crypto");
const SqlProgram = require("../models/SqlProgram");
const Program = require("../models/Program");
const { authMiddleware } = require("../middleware/auth");
const { BADGES } = require("../config/badges");
const { sendAchievementEmail } = require("../utils/email");
const router = express.Router();

const POINTS_PER_SUCCESS = 10;

router.use(authMiddleware);

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
    const list = await SqlProgram.find({ userId: req.user._id })
      .sort({ updatedAt: -1 })
      .select("_id title code codeHash executedSuccessfully lastExecutedAt createdAt updatedAt");
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to list SQL programs" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { title, code, executedSuccessfully } = req.body;
    const codeStr = code != null ? String(code) : "";
    const codeHash = computeCodeHash(codeStr);

    const existing = await SqlProgram.findOne({
      userId: req.user._id,
      codeHash: codeHash,
    });

    if (existing) {
      return res.json(existing);
    }

    const program = await SqlProgram.create({
      userId: req.user._id,
      title: title || "Untitled",
      code: codeStr,
      codeHash: codeHash,
      executedSuccessfully: executedSuccessfully === true,
      lastExecutedAt: executedSuccessfully === true ? new Date() : undefined,
    });

    if (executedSuccessfully === true) {
      const successSql = await SqlProgram.countDocuments({
        userId: req.user._id,
        executedSuccessfully: true,
      });
      const successPy = await Program.countDocuments({
        userId: req.user._id,
        executedSuccessfully: true,
      });
      const newPoints = (successPy + successSql) * POINTS_PER_SUCCESS;
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
    res.status(500).json({ error: err.message || "Failed to create SQL program" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const program = await SqlProgram.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });
    if (!program) return res.status(404).json({ error: "SQL program not found" });
    res.json(program);
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to get SQL program" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const program = await SqlProgram.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });
    if (!program) return res.status(404).json({ error: "SQL program not found" });
    const wasAlreadySuccess = program.executedSuccessfully === true;
    if (req.body.title != null) program.title = req.body.title;
    if (req.body.code != null) program.code = req.body.code;
    if (req.body.executedSuccessfully === true) {
      program.executedSuccessfully = true;
      program.lastExecutedAt = new Date();
    }
    await program.save();

    if (req.body.executedSuccessfully === true && !wasAlreadySuccess) {
      const successPy = await Program.countDocuments({
        userId: req.user._id,
        executedSuccessfully: true,
      });
      const successSql = await SqlProgram.countDocuments({
        userId: req.user._id,
        executedSuccessfully: true,
      });
      const newPoints = (successPy + successSql) * POINTS_PER_SUCCESS;
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
    res.status(500).json({ error: err.message || "Failed to update SQL program" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const result = await SqlProgram.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });
    if (!result) return res.status(404).json({ error: "SQL program not found" });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to delete SQL program" });
  }
});

module.exports = router;
