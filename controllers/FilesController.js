// controllers/FilesController.js
import { ObjectId } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';
import Queue from 'bull';

const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);
const access = promisify(fs.access);

const fileQueue = new Queue('fileQueue');

class FilesController {
  static async postUpload(req, res) {
    const token = req.header('X-Token');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const userObjectId = ObjectId(userId);
    const { name, type, data, parentId = 0, isPublic = false } = req.body;

    if (!name) return res.status(400).json({ error: 'Missing name' });
    if (!type || !['folder', 'file', 'image'].includes(type)) {
      return res.status(400).json({ error: 'Missing type' });
    }
    if (type !== 'folder' && !data) return res.status(400).json({ error: 'Missing data' });

    let parentObjId = null;
    if (parentId !== 0) {
      try {
        parentObjId = ObjectId(parentId);
      } catch {
        return res.status(400).json({ error: 'Parent not found' });
      }

      const parent = await dbClient.db.collection('files').findOne({ _id: parentObjId });
      if (!parent) return res.status(400).json({ error: 'Parent not found' });
      if (parent.type !== 'folder') {
        return res.status(400).json({ error: 'Parent is not a folder' });
      }
    }

    const fileData = {
      userId: userObjectId,
      name,
      type,
      isPublic,
      parentId: parentId === 0 ? 0 : parentObjId,
    };

    if (type === 'folder') {
      const result = await dbClient.db.collection('files').insertOne(fileData);
      return res.status(201).json({
        id: result.insertedId.toString(),
        userId,
        name,
        type,
        isPublic,
        parentId,
      });
    }

    // Create local storage dir
    const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
    try {
      await access(folderPath);
    } catch {
      await mkdir(folderPath, { recursive: true });
    }

    const filename = uuidv4();
    const filePath = path.join(folderPath, filename);

    const buffer = Buffer.from(data, 'base64');
    await writeFile(filePath, buffer);

    fileData.localPath = filePath;

    const result = await dbClient.db.collection('files').insertOne(fileData);

    // Queue thumbnail job if image
    if (type === 'image') {
      await fileQueue.add({ userId, fileId: result.insertedId.toString() });
    }

    return res.status(20
