import bcrypt from 'bcryptjs';
import { MongoClient } from 'mongodb';

async function createUser() {
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  await client.connect();

  const db = client.db('inventory1');
  const users = db.collection('users');

  const password = 'admin123';
  const hashedPassword = await bcrypt.hash(password, 10);

  await users.insertOne({
    name: 'inidariseed',
    email: 'inidari@seed@gmail.com',
    password: hashedPassword,
  });

  console.log('User admin berhasil dibuat');

  await client.close();
}

createUser();
