import app from '../app.js';
import mongoose from 'mongoose';

let isConnected = false;

async function connectDB() {
  if (isConnected) return;

  await mongoose.connect(process.env.DATABASE);
  isConnected = true;
  console.log('MongoDB connected (Vercel)');
}

export default async function handler(req, res) {
  try {
    await connectDB();
    return app(req, res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}
