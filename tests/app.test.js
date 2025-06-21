// tests/app.test.js
import chai from 'chai';
import chaiHttp from 'chai-http';
import { ObjectId } from 'mongodb';
import { expect } from 'chai';
import { before } from 'mocha';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';
import app from '../server';

chai.use(chaiHttp);

describe('App Endpoints', () => {
  const testUser = { email: 'testuser@example.com', password: 'pass123' };
  let token = '';
  let userId = '';

  before(async () => {
    await dbClient.db.collection('users').deleteMany({ email: testUser.email });
  });

  it('GET /status should return redis and db status', async () => {
    const res = await chai.request(app).get('/status');
    expect(res.status).to.equal(200);
    expect(res.body).to.have.property('redis');
    expect(res.body).to.have.property('db');
  });

  it('GET /stats should return user and file counts', async () => {
    const res = await chai.request(app).get('/stats');
    expect(res.status).to.equal(200);
    expect(res.body).to.have.property('users');
    expect(res.body).to.have.property('files');
  });

  it('POST /users should create a new user', async () => {
    const res = await chai.request(app).post('/users').send(testUser);
    expect(res.status).to.equal(201);
    expect(res.body).to.have.property('id');
    expect(res.body).to.have.property('email', testUser.email);
    userId = res.body.id;
  });

  it('GET /connect should authenticate user and return token', async () => {
    const credentials = Buffer.from(`${testUser.email}:${testUser.password}`).toString('base64');
    const res = await chai.request(app)
      .get('/connect')
      .set('Authorization', `Basic ${credentials}`);
    expect(res.status).to.equal(200);
    expect(res.body).to.have.property('token');
    token = res.body.token;
  });

  it('GET /users/me should return current user', async () => {
    const res = await chai.request(app)
      .get('/users/me')
      .set('X-Token', token);
    expect(res.status).to.equal(200);
    expect(res.body).to.have.property('id', userId);
    expect(res.body).to.have.property('email', testUser.email);
  });

  it('GET /disconnect should log out the user', async () => {
    const res = await chai.request(app)
      .get('/disconnect')
      .set('X-Token', token);
    expect(res.status).to.equal(204);
  });

  it('GET /users/me after disconnect should return Unauthorized', async () => {
    const res = await chai.request(app)
      .get('/users/me')
      .set('X-Token', token);
    expect(res.status).to.equal(401);
  });
});
