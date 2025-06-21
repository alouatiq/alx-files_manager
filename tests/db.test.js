// tests/db.test.js
import { expect } from 'chai';
import dbClient from '../utils/db';

describe('DBClient', () => {
  it('should be alive after connection', async () => {
    let retries = 0;
    while (!dbClient.isAlive() && retries < 10) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      retries += 1;
    }
    expect(dbClient.isAlive()).to.equal(true);
  });

  it('should count users and files (returns a number)', async () => {
    const users = await dbClient.nbUsers();
    const files = await dbClient.nbFiles();
    expect(users).to.be.a('number');
    expect(files).to.be.a('number');
  });
});
