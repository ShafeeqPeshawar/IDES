const express = require("express");
const SqlWorkspace = require("../models/SqlWorkspace");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();
const MAX_SQLITE_BYTES = 5 * 1024 * 1024;
const MAX_EDITOR_BYTES = 512 * 1024;

router.use(authMiddleware);

router.get("/", async (req, res) => {
  try {
    const ws = await SqlWorkspace.findOne({ userId: req.user._id }).lean();
    if (!ws || !ws.sqliteData) {
      return res.json({ workspace: null });
    }
    res.json({
      workspace: {
        sqliteBase64: Buffer.from(ws.sqliteData).toString("base64"),
        editorScript: ws.editorScript || "",
        updatedAt: ws.updatedAt,
        expiresAt: ws.expiresAt,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to load workspace" });
  }
});

router.put("/", async (req, res) => {
  try {
    const { sqliteBase64, editorScript } = req.body;
    if (typeof sqliteBase64 !== "string" || sqliteBase64.length === 0) {
      return res.status(400).json({ error: "sqliteBase64 is required" });
    }
    let buf;
    try {
      buf = Buffer.from(sqliteBase64, "base64");
    } catch {
      return res.status(400).json({ error: "Invalid base64" });
    }
    if (buf.length > MAX_SQLITE_BYTES) {
      return res.status(400).json({ error: "Database file too large (max 5 MB)" });
    }
    const script = editorScript != null ? String(editorScript) : "";
    if (Buffer.byteLength(script, "utf8") > MAX_EDITOR_BYTES) {
      return res.status(400).json({ error: "SQL script too long" });
    }
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const expiresAt = new Date(Date.now() + weekMs);
    const doc = await SqlWorkspace.findOneAndUpdate(
      { userId: req.user._id },
      { $set: { sqliteData: buf, editorScript: script, expiresAt } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({
      ok: true,
      updatedAt: doc.updatedAt,
      expiresAt: doc.expiresAt,
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to save workspace" });
  }
});

module.exports = router;
