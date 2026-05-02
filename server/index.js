require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const authRoutes = require("./routes/auth");
const programRoutes = require("./routes/programs");
const sqlWorkspaceRoutes = require("./routes/sqlWorkspace");

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/igniup";

if (!process.env.JWT_SECRET) {
  console.warn("JWT_SECRET not set; using default. Set JWT_SECRET in .env for production.");
}
const JWT_SECRET = process.env.JWT_SECRET || "igniup-dev-secret-change-me";

app.use(cors());
app.use(express.json({ limit: "6mb" }));

app.use("/api/auth", authRoutes);
app.use("/api/programs", programRoutes);
app.use("/api/sql-workspace", sqlWorkspaceRoutes);

app.use(express.static(path.join(__dirname, "..")));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(__dirname, "..", "index.html"));
});

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    app.listen(PORT, () => {
      console.log("MongoDB connected");
      console.log("Server running at http://localhost:" + PORT);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  });
