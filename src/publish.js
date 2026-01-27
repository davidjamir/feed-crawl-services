const { getDb } = require("./mongodb"); // MongoDB client

async function saveBatch(payload, mode) {
  const db = await getDb();
  const col = db.collection("batches");

  await col.insertOne({
    payload, // nguyên gói
    mode, // notify | collect

    telegram: {
      sent: false,
      failCount: 0,
      lastError: null,
      sentAt: null,
    },

    server: {
      sent: false,
      failCount: 0,
      lastError: null,
      sentAt: null,
    },

    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

module.exports = { saveBatch };