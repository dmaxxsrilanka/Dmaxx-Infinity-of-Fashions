import express from "express";
import mongoose from "mongoose";
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";

import authenticateUser from "./middlewares/authenticate.js";
import userRouter from "./routes/userRouter.js";
import productRouter from "./routes/productRouter.js";
import orderRouter from "./routes/orderRouter.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// CORS & JSON Body Parser
app.use(cors());
app.use(bodyParser.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Optional JWT middleware (populates req.user if valid token is provided)
app.use(authenticateUser);

// MongoDB Connection
const mongoURI = process.env.MONGO_URI;

if (!mongoURI) {
  console.error("MONGO_URI is not defined in environment variables.");
  process.exit(1);
}

mongoose
  .connect(mongoURI)
  .then(() => {
    console.log("Connected to MongoDB for Dmaxx - Infinity of Fashions");
  })
  .catch((error) => {
    console.error("Error connecting to MongoDB:", error);
  });

// Health check route
app.get("/", (req, res) => {
  res.json({
    brand: "Dmaxx - Infinity of Fashions",
    status: "running",
  });
});

// API Routes
app.use("/api/users", userRouter);
app.use("/api/products", productRouter);
app.use("/api/orders", orderRouter);

// 404 Handler for unknown routes
app.use((req, res) => {
  res.status(404).json({ message: "API route not found" });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("Unhandled server error:", err);
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Invalid JSON payload" });
  }
  return res.status(err?.status || 500).json({
    message: err?.message || "Internal server error",
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Dmaxx backend server is running on port ${PORT}`);
});