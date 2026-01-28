import mongoose from 'mongoose';
import 'dotenv/config';

import app from './app.js';

process.on('uncaughtException', (err) => {
  console.log('UNCAUGHT EXCEPTION!');
  console.log(err);
  process.exit(1);
});

mongoose.connect(process.env.DATABASE_LOCAL);

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error :'));
db.once('open', () => {
  console.log('Database connected');
});

const port = process.env.PORT || 8000;
const server = app.listen(port, () => {
  console.log(`listening on ${port}`);
});

process.on('unhandledRejection', (err) => {
  console.log(err);
  server.close(() => {
    process.exit(1);
  });
});
