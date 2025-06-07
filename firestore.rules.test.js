const fs = require('fs');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { readFileSync } = require('fs');

const rules = fs.readFileSync('firestore_rules_folder/firestore.rules', 'utf8');


let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'test-tradeconnect',
    firestore: {
      rules: rules,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe('Firestore Security Rules', () => {
  it('should allow a user to read their own user document', async () => {
    const alice = testEnv.authenticatedContext('alice_uid');
    const db = alice.firestore();

    await assertSucceeds(db.doc('users/alice_uid').get());
  });

  it('should not allow a user to write to another user\'s document', async () => {
    const bob = testEnv.authenticatedContext('bob_uid');
    const db = bob.firestore();

    await assertFails(db.doc('users/alice_uid').set({ name: 'Bob pretending to be Alice' }));
  });
});
