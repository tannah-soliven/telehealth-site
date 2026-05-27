import cors from "cors";
import express from "express";

import { errorHandler } from "./middleware/error-handler.js";
import aiRouter from "./routes/ai.routes.js";
import appointmentsRouter from "./routes/appointments.routes.js";
import authRouter from "./routes/auth.routes.js";
import consultationsRouter from "./routes/consultations.routes.js";
import doctorRouter from "./routes/doctor.routes.js";
import doctorsListRouter from "./routes/doctors-list.routes.js";
import notificationsRouter from "./routes/notifications.routes.js";
import patientRouter from "./routes/patient.routes.js";
import patientRecordsRouter from "./routes/patient-records.routes.js";

export function createApp() {
  const app = express();

  app.use(express.json());

  const allowedOrigin = process.env.FRONTEND_ORIGIN ?? "http://localhost:5173";
  app.use(
    cors({
      origin: allowedOrigin,
      credentials: true
    })
  );

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/api/hello", (_req, res) => {
    res.json({ message: "Hello from backend" });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/patient", patientRouter);
  app.use("/api/doctor", doctorRouter);
  app.use("/api/doctors", doctorsListRouter);
  app.use("/api/appointments", appointmentsRouter);
  app.use("/api/ai", aiRouter);
  app.use("/api/notifications", notificationsRouter);
  app.use("/api/consultations", consultationsRouter);
  app.use("/api/patients", patientRecordsRouter);

  app.use(errorHandler);

  return app;
}

