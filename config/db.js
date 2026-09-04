import dns from "node:dns";
import mongoose from "mongoose";

export async function connectDB() {
  try {
    if (process.env.DNS_SERVERS) {
      dns.setServers(
        process.env.DNS_SERVERS.split(",")
          .map((server) => server.trim())
          .filter(Boolean)
      );
    }

    const uri = process.env.mongoURIAtlas || process.env.MONGO_URI;

    if (!uri) {
      throw new Error("mongoURIAtlas or MONGO_URI is not defined in .env");
    }

    const conn = await mongoose.connect(uri);

    console.log(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
  } catch (error) {
    console.error(`MongoDB connection failed: ${error.message}`);
    if (error.message?.includes("querySrv")) {
      console.error(
        "Atlas SRV DNS lookup failed. Try another network/DNS resolver, or use the non-SRV mongodb:// connection string from MongoDB Atlas."
      );
    }
    process.exit(1);
  }
}

export default connectDB;
