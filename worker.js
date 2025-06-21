// worker.js
import Queue from 'bull';
import { ObjectId } from 'mongodb';
import imageThumbnail from 'image-thumbnail';
import fs from 'fs';
import path from 'path';
import dbClient from './utils/db';

const fileQueue = new Queue('fileQueue');
const userQueue = new Queue('userQueue');

// File thumbnail processing
fileQueue.process(async (job, done) => {
  const { fileId, userId } = job.data;

  if (!fileId) return done(new Error('Missing fileId'));
  if (!userId) return done(new Error('Missing userId'));

  const file = await dbClient.db.collection('files').findOne({
    _id: ObjectId(fileId),
    userId: ObjectId(userId),
  });

  if (!file) return done(new Error('File not found'));

  try {
    const sizes = [500, 250, 100];
    await Promise.all(sizes.map(async (size) => {
      const thumbnail = await imageThumbnail(file.localPath, { width: size });
      const dest = `${file.localPath}_${size}`;
      return fs.promises.writeFile(dest, thumbnail);
    }));
    done();
  } catch (err) {
    done(err);
  }
});

// User welcome message
userQueue.process(async (job, done) => {
  const { userId } = job.data;

  if (!userId) return done(new Error('Missing userId'));

  try {
    const user = await dbClient.db.collection('users').findOne({ _id: ObjectId(userId) });
    if (!user) return done(new Error('User not found'));

    console.log(`Welcome ${user.email}!`);
    done();
  } catch (err) {
    done(err);
  }
});
