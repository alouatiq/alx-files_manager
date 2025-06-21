// tests/files.test.js
import fs from 'fs';
import path from 'path';
import chai from 'chai';
import chaiHttp from 'chai-http';
import { expect } from 'chai';
import app from '../server';
import dbClient from '../utils/db';

chai.use(chaiHttp);

describe('Files API', () => {
  const testUser = { email: 'filetest@example.com', password: '123456' };
  let token = '';
  let fileId = '';
  let folderId = '';

  before(async () => {
    await dbClient.db.collection('users').deleteMany({ email: testUser.email });
    await dbClient.db.collection('files').deleteMany({ name: { $in: ['test.txt', 'folder1'] } });
  });

  it('should create a new user', async () => {
    const res = await chai.request(app).post('/users').send(testUser);
    expect(res).to.have.status(201);
  });

  it('should login and return token', async () => {
    const credentials = Buffer.from(`${testUser.email}:${testUser.password}`).toString('base64');
    const res = await chai.request(app)
      .get('/connect')
      .set('Authorization', `Basic ${credentials}`);
    expect(res).to.have.status(200);
    token = res.body.token;
  });

  it('should create a new folder', async () => {
    const res = await chai.request(app)
      .post('/files')
      .set('X-Token', token)
      .send({ name: 'folder1', type: 'folder' });
    expect(res).to.have.status(201);
    expect(res.body.type).to.equal('folder');
    folderId = res.body.id;
  });

  it('should upload a file to the folder', async () => {
    const base64Data = Buffer.from('hello world').toString('base64');
    const res = await chai.request(app)
      .post('/files')
      .set('X-Token', token)
      .send({
        name: 'test.txt',
        type: 'file',
        parentId: folderId,
        data: base64Data,
        isPublic: false,
      });
    expect(res).to.have.status(201);
    expect(res.body.name).to.equal('test.txt');
    fileId = res.body.id;
  });

  it('should retrieve uploaded file metadata by ID', async () => {
    const res = await chai.request(app)
      .get(`/files/${fileId}`)
      .set('X-Token', token);
    expect(res).to.have.status(200);
    expect(res.body.id).to.equal(fileId);
  });

  it('should list files in the folder', async () => {
    const res = await chai.request(app)
      .get(`/files?parentId=${folderId}`)
      .set('X-Token', token);
    expect(res).to.have.status(200);
    expect(res.body).to.be.an('array');
    expect(res.body.length).to.be.gte(1);
  });

  it('should publish the file', async () => {
    const res = await chai.request(app)
      .put(`/files/${fileId}/publish`)
      .set('X-Token', token);
    expect(res).to.have.status(200);
    expect(res.body.isPublic).to.be.true;
  });

  it('should unpublish the file', async () => {
    const res = await chai.request(app)
      .put(`/files/${fileId}/unpublish`)
      .set('X-Token', token);
    expect(res).to.have.status(200);
    expect(res.body.isPublic).to.be.false;
  });

  it('should fetch file content after publishing', async () => {
    // Re-publish to allow access without token
    await chai.request(app)
      .put(`/files/${fileId}/publish`)
      .set('X-Token', token);

    const res = await chai.request(app)
      .get(`/files/${fileId}/data`);
    expect(res).to.have.status(200);
    expect(res.text).to.equal('hello world');
  });

  it('should return 404 for non-public file access without token', async () => {
    await chai.request(app)
      .put(`/files/${fileId}/unpublish`)
      .set('X-Token', token);

    const res = await chai.request(app)
      .get(`/files/${fileId}/data`);
    expect(res).to.have.status(404);
  });
});
