const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Program = require("../models/Program");
const { authMiddleware } = require("../middleware/auth");
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "igniup-dev-secret-change-me";
const POINTS_PER_SUCCESS = 10;

router.get("/me", authMiddleware, async (req, res) => {
  try {
    const totalPrograms = await Program.countDocuments({ userId: req.user._id });
    const successPrograms = await Program.countDocuments({
      userId: req.user._id,
      executedSuccessfully: true,
    });
    const points = successPrograms * POINTS_PER_SUCCESS;
    res.json({
      name: req.user.name,
      email: req.user.email,
      points,
      totalPrograms,
      successPrograms,
      successRate: totalPrograms > 0 ? Math.round((successPrograms / totalPrograms) * 100) : 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to load profile" });
  }
});

router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email and password are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: "Email already registered" });
    }
    const user = await User.create({ name, email, password });
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: "7d" });
    res.status(201).json({
      token,
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "Registration failed" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: "7d" });
    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "Login failed" });
  }
});

router.patch("/change-password", authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current password and new password are required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters" });
    }
    const user = await User.findById(req.user._id);
    if (!user || !(await user.comparePassword(currentPassword))) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }
    user.password = newPassword;
    await user.save();
    res.json({ message: "Password updated successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to update password" });
  }
});

module.exports = router;
