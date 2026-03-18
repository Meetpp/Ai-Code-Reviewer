import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { reviewRouter } from "./routes/review";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Support comma-separated list of allowed origins (e.g. localhost + LAN IP)
const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:3000")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. curl, Postman, server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin '${origin}' not allowed`));
    },
  })
);

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/review", reviewRouter);

// Listen on all interfaces so the server is reachable via LAN IP as well
app.listen(Number(PORT), "0.0.0.0", () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
  console.log(`Allowed origins: ${allowedOrigins.join(", ")}`);
});
