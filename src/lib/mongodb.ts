import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI ?? "";

interface Cached {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

const globalWithMongoose = global as typeof globalThis & { __mongoose?: Cached };
const cached: Cached = globalWithMongoose.__mongoose ?? {
  conn: null,
  promise: null,
};
globalWithMongoose.__mongoose = cached;

export function isMongoConfigured(): boolean {
  return MONGODB_URI.length > 0;
}

export async function connectDB(): Promise<typeof mongoose> {
  if (!isMongoConfigured()) {
    throw new Error(
      "MONGODB_URI is not set. Add it to .env.local to enable persistence."
    );
  }
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 8000,
    });
  }
  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null;
    throw err;
  }
  return cached.conn;
}
