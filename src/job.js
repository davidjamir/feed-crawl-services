// src/rssJob.js
const Parser = require("rss-parser");
const { getChannelConfig, saveChannelConfig } = require("./channel");
const {
    shouldCreatePost,
    buildPublishItem,
} = require("./server");
const { saveBatch } = require("./publish");

const parser = new Parser({
    timeout: 15000,
    customFields: {
        item: [["content:encoded", "contentEncoded"]],
    },
});

function toStr(x) {
    return String(x ?? "").trim();
}

function parseJobKey(jobKey) {
    const s = String(jobKey || "");
    const i = s.indexOf("|");
    if (i < 0) return null;
    const chatId = s.slice(0, i).trim();
    const url = s.slice(i + 1).trim();
    if (!chatId || !url) return null;
    return { chatId, url };
}

function normalizeUrl(u) {
    let s = String(u || "").trim();
    s = s.replace(/[\r\n\t ]+/g, "");

    if (s && !/^https?:\/\//i.test(s)) s = `https://${s}`;
    return s ? encodeURI(s) : "";
}

/**
 * Trả về list item mới dựa trên lastLink.
 * - Nếu lastLink tồn tại và tìm thấy trong list => items trước nó là mới.
 * - Nếu lastLink không tìm thấy (feed đổi link / reorder) => fallback: chỉ lấy top N (ví dụ 1-3)
 */
function getNewItems(items, lastLink, fallbackTake = 1) {
    if (!items?.length) return [];

    if (!lastLink) {
        // lần đầu: tránh spam, chỉ lấy 1
        return items.slice(0, fallbackTake);
    }

    const idx = items.findIndex((it) => it.link === lastLink);
    if (idx === -1) {
        // Không thấy lastLink: feed có thể đổi link hoặc reorder
        // để an toàn không spam, chỉ lấy 1
        return items.slice(0, fallbackTake);
    }

    // items[0..idx-1] là mới
    return items.slice(0, idx);
}

// ====== MAIN: handle 1 jobKey (chatId|url) ======
async function collectBatchJob(jobKey = "") {
    const parsed = parseJobKey(jobKey);
    if (!parsed) return { ok: false, error: "invalid jobKey", jobKey };

    const chatId = toStr(parsed.chatId);
    const feedUrl = normalizeUrl(parsed.url);
    if (!feedUrl) return { ok: false, error: "invalid feedUrl", chatId, jobKey };

    const cfg = await getChannelConfig(chatId);

    // check feed còn tồn tại
    const feedCfg = (cfg.feeds || []).find(
        (f) => normalizeUrl(f?.url) === feedUrl,
    );
    if (!feedCfg) {
        return { ok: true, skipped: true, reason: "feed removed", chatId, feedUrl };
    }

    const mode =
        toStr(feedCfg?.mode).toLowerCase() === "collect" ? "collect" : "notify";

    const last = cfg.last || {};
    const api = cfg.api || {};
    const topics = cfg.topics || [];
    const flags = cfg.flags || [];
    const targets = cfg.targets || [];

    const feed = await parser.parseURL(feedUrl);
    const items = feed.items || [];

    const lastLink = last[feedUrl] || "";
    const newItems = getNewItems(items, lastLink, 1);
    if (!newItems.length)
        return { ok: true, skipped: true, reason: "no new item" };

    const publishItems = [];

    for (const item of [...newItems].reverse()) {
        if (shouldCreatePost(item)) {
            publishItems.push(buildPublishItem(item));
        }
    }

    if (!publishItems.length) return { ok: true, skipped: true };

    const payload = {
        chatId: String(chatId),
        api: {
            endpoint: api.endpoint,
            token: api.token,
            tokenMasked: api.tokenMasked,
            updatedAt: api.updatedAt,
        },
        topics,
        flags,
        targets,
        source: {
            feedUrl,
            feedTitle: feed.title || "",
            mode,
        },
        items: publishItems,
        createdAt: new Date().toISOString(),
    };

    await saveBatch(payload, mode);

    // update lastLink NGAY – tránh duplicate
    if (items[0]?.link) {
        last[feedUrl] = items[0].link;
        cfg.last = last;
        await saveChannelConfig(chatId, cfg);
    }

    return {
        ok: true,
        chatId,
        feedUrl,
        mode,
        batches: 1,
        items: publishItems.length,
    };
}

module.exports = { collectBatchJob };
