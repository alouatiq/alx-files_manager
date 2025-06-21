// tests/redis.test.js
import { expect } from 'chai';
import redisClient from '../utils/redis';

describe('RedisClient', () => {
  it('should be alive', () => {
    expect(redisClient.isAlive()).to.equal(true);
  });

  it('should set and get a value', async () => {
    await redisClient.set('test_key', '1234', 5);
    const value = await redisClient.get('test_key');
    expect(value).to.equal('1234');
  });

  it('should delete a key', async () => {
    await redisClient.set('delete_key', 'toDelete', 5);
    await redisClient.del('delete_key');
    const value = await redisClient.get('delete_key');
    expect(value).to.equal(null);
  });
});
