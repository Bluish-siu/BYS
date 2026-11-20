import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { openDb } from "./db.js";
import { createApp } from "./app.js";
import { razorpayFromEnv } from "./razorpay.js";

if (existsSync(".env")) process.loadEnvFile(".env");

const port = Number(process.env.PORT ?? 4000);
const db = openDb();
const razorpay = razorpayFromEnv();
const server = createServer(createApp(db, { corsOrigin: process.env.CORS_ORIGIN ?? "*", razorpay }));

server.listen(port, () => {
  console.log(`PickMySeat API running on http://localhost:${port}/api`);
  console.log(razorpay ? `Razorpay test mode on (${razorpay.keyId})` : "Razorpay off: add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to backend/.env");
});

const stop = () => server.close(() => { db.close(); process.exit(0); });
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
