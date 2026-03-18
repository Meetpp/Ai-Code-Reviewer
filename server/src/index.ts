import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { reviewRouter } from "./routes/review";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Allow all origins — this is a local dev tool, not a public API with auth cookies
const corsOptions = {
  origin: true,                  // reflect the requesting origin (works for all clients)
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: false,
};

// Handle preflight OPTIONS requests for every route before any other middleware
app.options("*", cors(corsOptions));
app.use(cors(corsOptions));

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/review", reviewRouter);

// Listen on all interfaces so the server is reachable via LAN IP as well
app.listen(Number(PORT), "0.0.0.0", () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
  console.log(`CORS: all origins allowed (dev mode)`);
});
