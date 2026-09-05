import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

// Resolve relative to this file, even when launched from the repository root.
// Hosting environment variables retain precedence over the local file.
dotenv.config({ path: fileURLToPath(new URL("../.env", import.meta.url)) });

export function validateAuthConfig(env = process.env) {
  if (!env.JWT_SECRET?.trim() || env.JWT_SECRET === "change_this_to_a_long_random_secret") {
    throw new Error("JWT_SECRET must be configured with a private random secret in the backend environment before starting the API.");
  }
}
