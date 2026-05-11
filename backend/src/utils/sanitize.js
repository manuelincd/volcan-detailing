// Matches any HTML tag: opening, closing, self-closing, or comments.
// Used to detect and strip markup before persisting plain-text fields.
const TAG_RE = /<[^>]+>/;

/**
 * Returns true when the string contains at least one HTML tag.
 * A fresh regex literal is used on each call to avoid lastIndex state bugs.
 */
function containsHtml(str) {
  return /<[^>]+>/.test(str);
}

/** Strips all HTML tags and trims the result. */
function stripHtml(str) {
  return str.replace(/<[^>]+>/g, '').trim();
}

module.exports = { containsHtml, stripHtml };
