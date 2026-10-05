import "dotenv/config";
import express from "express";
import cors from "cors";
import connectDB from "./src/config/db.js";

// Import our 4 core feature routers
import authRoutes from "./src/routes/auth.js";
import eventRoutes from "./src/routes/events.js";
import ticketRoutes from "./src/routes/tickets.js";
import scanRoutes from "./src/routes/scans.js";

const app = express();

// 🧱 GLOBAL MIDDLEWARE LAYERS

// 1. Cross-Origin Resource Sharing (Allows frontend to talk to your backend)
app.use(cors());

// 2. JSON Parser (Parses standard JSON payloads from Postman/Frontend)
app.use(express.json());

// 3. URL-Encoded Parser (CRUCIAL: Allows our backend to read multi-part forms and CSV uploads)
app.use(express.urlencoded({ extended: true }));

// Boot up MongoDB connection instantly on startup
connectDB();

// 🔗 DIRECT ROUTE PRE-LINKING (Aligned with PRD Section 16)
app.use("/api/auth", authRoutes); // Handles Login & Registration
app.use("/api/events", eventRoutes); // Handles Event Creation & CSV Uploads
app.use("/api/tickets", ticketRoutes); // Handles Attendee Validation & signed QR strings
app.use("/api/scans", scanRoutes); // Handles Real-time Gate Scanning & Dashboard Reports

// Base Health Check
app.get("/", (req, res) => {
  res.json({
    message: "Group 13 Backend Engine is Live and Fully Configured!",
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Emergency backend framework active on port ${PORT}`);
});
