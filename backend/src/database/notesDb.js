const Datastore = require('nedb-promises');

let notesDb = null;

function getNotesDatabase() {
  if (!notesDb) {
    notesDb = Datastore.create();
    console.log('Connected to NeDB in-memory document database for notes');
  }
  return notesDb;
}

async function initializeNotesDatabase() {
  const db = getNotesDatabase();
  await db.ensureIndex({ fieldName: 'user_email' });
  await db.ensureIndex({ fieldName: 'tags' });
  console.log('Notes document database initialized');
}

module.exports = {
  getNotesDatabase,
  initializeNotesDatabase
};
