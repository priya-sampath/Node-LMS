
import express from "express";
import "dotenv/config";
import cors from "cors";

import connectDB from "./database/db.js";
import userRoute from "./routes/userRoute.js";
import courseRoute from "./routes/courseRoute.js";
import enrollmentRoute from "./routes/enrollmentRoute.js";
import paymentRoute from "./routes/paymentRoute.js";
import liveClassRoute from "./routes/liveClassRoute.js";
import studentRoute from "./routes/studentRoute.js";
import adminRoute from "./routes/adminRoute.js";
import tutorRoute from "./routes/tutorRoute.js";

const app = express();
const PORT = process.env.PORT || 3000;

// Allow local frontend and deployed frontend
const allowedOrigins = [
  "http://localhost:5173",
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

app.use(express.json());

// Root route / health check
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "LMS Backend is running successfully!"
  });
});

// API routes
app.use("/user", userRoute);
app.use("/courses", courseRoute);
app.use("/enrollments", enrollmentRoute);
app.use("/payments", paymentRoute);
app.use("/live-classes", liveClassRoute);
app.use("/student", studentRoute);
app.use("/admin", adminRoute);
app.use("/tutors", tutorRoute);

// Error-handling middleware
app.use((err, req, res, next) => {
  console.error(err);

  return res.status(500).json({
    success: false,
    message: err.message || "Something went wrong"
  });
});

app.listen(PORT, () => {
  connectDB();
  console.log(`Server listening on port ${PORT}`);
});
