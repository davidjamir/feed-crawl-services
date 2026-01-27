const { getDb } = require("./mongodb"); // MongoDB client

// Fetch jobs based on the shardId and limit the results.
async function popJobs(shardId, count = 1) {
  const db = await getDb();
  const jobsColection = db.collection("jobs");
  const feedsColection = db.collection("feeds");

  const n = Math.max(1, Number(count) || 1);
  const out = [];

  const LOCK_MS = 3 * 60 * 1000;
  const now = new Date();

  while (out.length < n) {
    // 1️⃣ pop 1 job (FIFO + shard)
    const job = await jobsColection.findOneAndDelete(
      { shardId },
      { sort: { createdAt: 1 } },
    );

    if (!job || !job.jobKey) break;

    const jobKey = job.jobKey;

    // bước đảm bảo tồn tại (không check lock)
    await feedsColection.updateOne(
      { _id: jobKey },
      {
        $setOnInsert: {
          createdAt: now,
          lockedUntil: new Date(0),
        },
      },
      { upsert: true },
    );

    // bước lock (atomic)
    const r = await feedsColection.findOneAndUpdate(
      {
        _id: jobKey,
        lockedUntil: { $lte: now },
      },
      {
        $set: {
          lockedUntil: new Date(now.getTime() + LOCK_MS),
          lockedBy: `Worker_shard_${shardId}`,
          updatedAt: now,
        },
      },
    );

    if (!r) continue;

    out.push(jobKey);
  }

  return out;
}

module.exports = { popJobs };
