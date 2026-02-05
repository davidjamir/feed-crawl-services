// Check xem có đủ điều kiện tạo bài viết không
function shouldCreatePost(item) {
  const link = (item.link || "").trim();
  const title = (item.title || "").trim();

  if (!link) return false;
  if (!title) return false;

  return true;
}

function cleanSummary(summary = "") {
  return String(summary)
    .replace(/&nbsp;/gi, " ")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function smartCutTitle(
  text,
  { minLength = 30, maxLength = 100, ellipsis = true } = {},
) {
  console.log("SMART CUT INPUT:", text.length);
  if (!text) return "";

  const s = text.replace(/\s+/g, " ").trim();
  console.log("NORMALIZED LENGTH:", s.length);
  if (s.length <= maxLength) {
    console.log("RETURN EARLY");
    return s;
  }

  console.log("CUTTING...");
  // 1️⃣ try sentence end within range
  const sentenceMatch = s.slice(minLength, maxLength + 1).match(/[.!?]/);
  if (sentenceMatch) {
    const cutAt = minLength + sentenceMatch.index + 1;
    return s.slice(0, cutAt).trim();
  }

  // 2️⃣ fallback: cut at nearest space before maxLength
  let cutAt = s.lastIndexOf(" ", maxLength);
  if (cutAt < minLength) {
    cutAt = maxLength;
  }

  return s.slice(0, cutAt).trim() + (ellipsis ? "…" : "");
}

function buildPublishItem(item) {
  return {
    title: smartCutTitle(item.title || ""),
    link: item.link || "",
    guid: item.guid || item.id || item.link || "",
    publishedAt: item.isoDate || item.pubDate || "",
    html: (item.contentEncoded || "").trim(), // full HTML
    snippet: (item.contentSnippet || cleanSummary(item.summary) || "").trim(),
  };
}

module.exports = {
  shouldCreatePost,
  buildPublishItem,
};
