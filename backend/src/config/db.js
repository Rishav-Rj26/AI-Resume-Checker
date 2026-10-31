const mongoose = require("mongoose");
const env = require("./env");

let isConnecting = false;

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  const primaryUri = env.MONGO_URI || "mongodb://127.0.0.1:27017/ai_resume_checker";

  if (isConnecting) return;
  isConnecting = true;

  try {
    const conn = await mongoose.connect(primaryUri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`[MongoDB] Connected to database: ${conn.connection.host}`);
    return conn;
  } catch (err) {
    console.warn(`[MongoDB] Connection to primary URI failed: ${err.message}`);
    // If primary was a remote Atlas URI and failed, try local fallback
    if (!primaryUri.includes("127.0.0.1") && !primaryUri.includes("localhost")) {
      console.log("[MongoDB] Attempting fallback to local MongoDB (mongodb://127.0.0.1:27017/ai_resume_checker)...");
      try {
        const localConn = await mongoose.connect("mongodb://127.0.0.1:27017/ai_resume_checker", {
          serverSelectionTimeoutMS: 3000,
        });
        console.log(`[MongoDB] Fallback connected to local database: ${localConn.connection.host}`);
        return localConn;
      } catch (localErr) {
        console.error(`[MongoDB] Local fallback failed: ${localErr.message}`);
        throw err;
      }
    }
    throw err;
  } finally {
    isConnecting = false;
  }
};

mongoose.connection.on("disconnected", () => {
  console.warn("[MongoDB] Disconnected from database");
});

mongoose.connection.on("error", (err) => {
  console.error(`[MongoDB] Error: ${err.message}`);
});

module.exports = { connectDB };
