// src/channelsStore.js
const { getDb } = require("./mongodb"); // MongoDB client
const channelCollectionName = "channels"; // Collection chứa thông tin kênh

function toStr(x) {
  return String(x == null ? "" : x).trim();
}

function normTagorFlag(x) {
  // keep it simple: lowercase, trim, remove spaces
  // if you want stricter: replace non [a-z0-9_-] with "-"
  let s = toStr(x); // đã trim
  if (!s) return "";
  s = s.replace(/^,+|,+$/g, "");
  return s;
}

function normalizeList(input) {
  const arr = Array.isArray(input) ? input : [];
  const set = new Set(arr.map(normTagorFlag).filter(Boolean));
  return Array.from(set);
}

async function getChannelConfig(chatId) {
  const db = await getDb();
  const collection = db.collection(channelCollectionName);
  const config = await collection.findOne({ chatId });

  if (!config) {
    return {
      chatName: "",
      chatType: "",
      feeds: [],
      last: {},
      api: {},
      listen: {},
      topics: [],
      flags: [],
      tags: [],
      targets: [],
    };
  }

  return config;
}

async function getTelegramChannel(chatId) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/getChat?chat_id=${chatId}`,
      { signal: controller.signal },
    );

    const data = await res.json();
    if (!data.ok) {
      throw new Error(data.description);
    }
    return data.result;
  } catch (err) {
    throw new Error(`Telegram API error: ${err.message}`);
  } finally {
    clearTimeout(timeout);
  }
}

// Lưu thông tin channel vào MongoDB
async function saveChannelConfig(chatId, config) {
  const db = await getDb();
  const collection = db.collection(channelCollectionName);
  const chatInfo = await getTelegramChannel(chatId);

  const safe = {
    chatName: chatInfo?.title | "",
    chatType: chatInfo?.type | "",
    feeds: Array.isArray(config.feeds) ? config.feeds : [],
    last: config.last && typeof config.last === "object" ? config.last : {},
    api: config.api && typeof config.api === "object" ? config.api : {},
    listen:
      config.listen && typeof config.listen === "object" ? config.listen : {},
    topics: Array.isArray(config.topics) ? normalizeList(config.topics) : [],
    flags: Array.isArray(config.flags) ? normalizeList(config.flags) : [],
    tags: Array.isArray(config.tags) ? normalizeList(config.tags) : [],
    targets: Array.isArray(config.targets) ? normalizeList(config.targets) : [],
  };

  // Cập nhật hoặc thêm mới channel config
  await collection.updateOne({ chatId }, { $set: safe }, { upsert: true });
}

module.exports = {
  getChannelConfig,
  saveChannelConfig,
};
