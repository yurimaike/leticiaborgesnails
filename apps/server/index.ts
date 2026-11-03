import { serve } from "@hono/node-server";
import app from "./_core/create-app";
import { startBookingRetentionScheduler } from "./services/booking-retention";

const port = Number(process.env.PORT) || 3000;
console.log(`Servidor rodando na porta ${port}`);
startBookingRetentionScheduler();

serve({
  fetch: app.fetch,
  port,
});
