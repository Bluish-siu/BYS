import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { openDb } from "./db.js";
import { createApp } from "./app.js";

if (existsSync(".env")) process.loadEnvFile(".env");

const port = Number(process.env.PORT ?? 4000);
const db = openDb();
const server = createServer(createApp(db, { corsOrigin: process.env.CORS_ORIGIN ?? "*" }));

server.listen(port, () => console.log(`PickMySeat API running on http://localhost:${port}/api`));

const stop = () => server.close(() => { db.close(); process.exit(0); });
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
