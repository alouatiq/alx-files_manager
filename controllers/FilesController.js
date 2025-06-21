// controllers/FilesController.js
import { ObjectId } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';
import mime from 'mime-types';
import Queue from 'bull';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);
const access = promisify(fs.access);
const stat = promisify(fs.stat);
const readFile = promisify(fs.readFile);

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

    if (type === 'image') {
      await fileQueue.add({ userId, fileId: result.insertedId.toString() });
    }

    return res.status(201).json({
      id: result.insertedId.toString(),
      userId,
      name,
      type,
      isPublic,
      parentId,
    });
  }

  static async getShow(req, res) {
    const token = req.header('X-Token');
    const { id } = req.params;

    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    let objectId;
    try {
      objectId = ObjectId(id);
    } catch {
      return res.status(404).json({ error: 'Not found' });
    }

    const file = await dbClient.db.collection('files').findOne({ _id: objectId, userId: ObjectId(userId) });
    if (!file) return res.status(404).json({ error: 'Not found' });

    return res.status(200).json({
      id: file._id.toString(),
      userId: file.userId.toString(),
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId: file.parentId === 0 ? 0 : file.parentId.toString(),
    });
  }

  static async getIndex(req, res) {
    const token = req.header('X-Token');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const parentId = req.query.parentId || 0;
    const page = parseInt(req.query.page, 10) || 0;

    const match = { userId: ObjectId(userId), parentId: parentId === 0 ? 0 : ObjectId(parentId) };

    const pipeline = [
      { $match: match },
      { $skip: page * 20 },
      { $limit: 20 },
    ];

    const files = await dbClient.db.collection('files').aggregate(pipeline).toArray();
    const response = files.map((file) => ({
      id: file._id.toString(),
      userId: file.userId.toString(),
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId: file.parentId === 0 ? 0 : file.parentId.toString(),
    }));

    return res.status(200).json(response);
  }

  static async putPublish(req, res) {
    const token = req.header('X-Token');
    const { id } = req.params;

    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    let objectId;
    try {
      objectId = ObjectId(id);
    } catch {
      return res.status(404).json({ error: 'Not found' });
    }

    const file = await dbClient.db.collection('files').findOne({ _id: objectId, userId: ObjectId(userId) });
    if (!file) return res.status(404).json({ error: 'Not found' });

    await dbClient.db.collection('files').updateOne({ _id: objectId }, { $set: { isPublic: true } });

    return res.status(200).json({
      id: file._id.toString(),
      userId: file.userId.toString(),
      name: file.name,
      type: file.type,
      isPublic: true,
      parentId: file.parentId === 0 ? 0 : file.parentId.toString(),
    });
  }

  static async putUnpublish(req, res) {
    const token = req.header('X-Token');
    const { id } = req.params;

    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    let objectId;
    try {
      objectId = ObjectId(id);
    } catch {
      return res.status(404).json({ error: 'Not found' });
    }

    const file = await dbClient.db.collection('files').findOne({ _id: objectId, userId: ObjectId(userId) });
    if (!file) return res.status(404).json({ error: 'Not found' });

    await dbClient.db.collection('files').updateOne({ _id: objectId }, { $set: { isPublic: false } });

    return res.status(200).json({
      id: file._id.toString(),
      userId: file.userId.toString(),
      name: file.name,
      type: file.type,
      isPublic: false,
      parentId: file.parentId === 0 ? 0 : file.parentId.toString(),
    });
  }

  static async getFile(req, res) {
    const { id } = req.params;
    const size = req.query.size;

    let objectId;
    try {
      objectId = ObjectId(id);
    } catch {
      return res.status(404).json({ error: 'Not found' });
    }

    const file = await dbClient.db.collection('files').findOne({ _id: objectId });
    if (!file) return res.status(404).json({ error: 'Not found' });

    const token = req.header('X-Token');
    let ownerAccess = false;

    if (token) {
      const userId = await redisClient.get(`auth_${token}`);
      if (userId && userId === file.userId.toString()) {
        ownerAccess = true;
      }
    }

    if (!file.isPublic && !ownerAccess) {
      return res.status(404).json({ error: 'Not found' });
    }

    if (file.type === 'folder') {
      return res.status(400).json({ error: "A folder doesn't have content" });
    }

    let localPath = file.localPath;
    if (size && ['100', '250', '500'].includes(size)) {
      localPath = `${localPath}_${size}`;
    }

    try {
      await stat(localPath);
    } catch {
      return res.status(404).json({ error: 'Not found' });
    }

    const fileData = await readFile(localPath);
    const mimeType = mime.lookup(file.name) || 'application/octet-stream';
    res.setHeader('Content-Type', mimeType);
    return res.status(200).send(fileData);
  }
}

export default FilesController;
