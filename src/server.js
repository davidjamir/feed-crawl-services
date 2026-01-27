
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

function buildPublishItem(item) {
  return {
    title: item.title || "",
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
