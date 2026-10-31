const dotenv = require("dotenv");
const path = require("path");

// Load .env from backend directory
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const requiredKeys = ["MONGO_URI", "JWT_SECRET"];
for (const key of requiredKeys) {
  if (!process.env[key]) {
    console.warn(`[WARN] Missing required environment variable: ${key}`);
  }
}

const env = {
  PORT: parseInt(process.env.PORT, 10) || 5000,
  NODE_ENV: process.env.NODE_ENV || "development",
  MONGO_URI: process.env.MONGO_URI || "",
  JWT_SECRET: process.env.JWT_SECRET || "arr_default_jwt_secret_key_development_only",
  JWT_EXPIRES: process.env.JWT_EXPIRES || "7d",
  COOKIE_NAME: process.env.COOKIE_NAME || "arr_token",
  CLIENT_ORIGIN: (process.env.CLIENT_ORIGIN || "http://localhost:5173,http://localhost:5174")
    .split(",")
    .map((o) => o.trim()),
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
  GEMINI_MODEL: process.env.GEMINI_MODEL || "gemini-2.5-flash",
};

module.exports = env;
