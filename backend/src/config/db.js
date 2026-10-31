const dns = require("dns");
const mongoose = require("mongoose");
const env = require("./env");
const logger = require("./logger");

// Ensure Node.js resolves MongoDB Atlas SRV records reliably regardless of local ISP DNS
try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch (e) {
  logger.warn(`Could not set custom DNS servers, using system default: ${e.message}`);
}

let isConnecting = false;

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  const primaryUri = env.MONGO_URI;

  if (!primaryUri) {
    throw new Error("MONGO_URI is not defined in environment variables");
  }

  if (isConnecting) return;
  isConnecting = true;

  try {
    const conn = await mongoose.connect(primaryUri, {
      serverSelectionTimeoutMS: 10000,
    });
    logger.info(`Connected to MongoDB: ${conn.connection.host}`);
    return conn;
  } catch (err) {
    logger.warn(`Connection to primary MongoDB failed: ${err.message}`);

    // If remote connection fails, provide fallback to local MongoDB
    if (!primaryUri.includes("127.0.0.1") && !primaryUri.includes("localhost")) {
      logger.info("Attempting fallback to local MongoDB (mongodb://127.0.0.1:27017/ai_resume_checker)...");
      try {
        const localConn = await mongoose.connect("mongodb://127.0.0.1:27017/ai_resume_checker", {
          serverSelectionTimeoutMS: 4000,
        });
        logger.info(`Fallback connected to local database: ${localConn.connection.host}`);
        return localConn;
      } catch (localErr) {
        logger.error(`Local MongoDB fallback failed: ${localErr.message}`);
        throw err;
      }
    }
    throw err;
  } finally {
    isConnecting = false;
  }
};

mongoose.connection.on("disconnected", () => {
  logger.warn("Disconnected from MongoDB database");
});

module.exports = { connectDB };
