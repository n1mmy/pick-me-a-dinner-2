/**
 * Load `.env.local`, then `.env`, the first file winning — Next.js's order.
 * Imported for its side effect, first, so the env is in place before the DB
 * client's module reads `DATABASE_URL`.
 */
import { config } from "dotenv";

config({ path: [".env.local", ".env"] });
