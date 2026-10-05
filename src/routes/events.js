import express from "express";
const router = express.Router();

// Temporary test route
router.get("/test", (req, res) => {
  res.json({
    message: "Route entry point successfully mounted using ES Modules!",
  });
});

export default router; // Exporting using ES Modules syntax
