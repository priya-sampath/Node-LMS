import mongoose from "mongoose";
import dns from "node:dns";

dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: 'lms',
      serverSelectionTimeoutMS: 15000,
     
    });
    console.log("MongoDB Connected Successfully");
  } catch (err) {
    console.log('MongoDB Connection error', err);
  }
};

export default connectDB;