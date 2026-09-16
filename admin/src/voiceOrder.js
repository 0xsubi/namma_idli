// Deterministic parser for spoken orders ("2 plates of Idli and a Vada")
// against the current menu. This is the free, instant, offline first pass —
// it only needs to understand small numbers plus food-order filler words, so
// it resolves the vast majority of phrasings without ever touching the
// network. Anything it can't confidently resolve is left in `unmatched` so
// the caller can fall back to the server-side LLM parser for that transcript.

const NUMBER_WORDS = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  dozen: 12,
  couple: 2,
};

const FILLER_WORDS = new Set([
  "plate",
  "plates",
  "order",
  "orders",
  "cup",
  "cups",
  "glass",
  "glasses",
  "piece",
  "pieces",
  "serving",
  "servings",
  "of",
]);

// Strips a leading command phrase like "add sales for" / "I want" / "give me"
// so the remainder is just the order itself.
// Alternatives are ordered longest-first (e.g. "sales" before "sale") since
// none of the trailing groups are required — a regex engine happily accepts
// the shorter alternative and never backtracks to try the longer one.
const LEADING_COMMAND_RE =
  /^\s*(?:please\s+)?(?:i\s+(?:want|need|would like)|give\s+me|add|record|log|create|make|enter)\s+(?:a\s+|an\s+)?(?:sales|sale|orders|order|entries|entry|bill)?\b\s*(?:for|of)?\s*/i;

const TRAILING_FILLER_RE = /\s*(?:please|for me|thanks?)\s*$/i;
const LEADING_CONNECTOR_RE = /^\s*(?:for|of|and)\s+/i;

function singularize(word) {
  if (word.endsWith("ies") && word.length > 3) return word.slice(0, -3) + "y";
  if (word.endsWith("es") && word.length > 3) return word.slice(0, -2);
  if (word.endsWith("s") && !word.endsWith("ss") && word.length > 2) return word.slice(0, -1);
  return word;
}

function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map(singularize)
    .join(" ");
}

function stripFillers(text) {
  return text
    .split(/\s+/)
    .filter((w) => w && !FILLER_WORDS.has(w.toLowerCase()))
    .join(" ");
}

// Matches a phrase against the catalog, requiring every word of a catalog
// item's name to appear in the phrase — e.g. "lemon rice" only matches a
// catalog item named "Lemon Rice", not one named plain "Rice", to avoid
// mismatching mid-sentence noise onto short item names.
function matchCatalogItem(phrase, catalog) {
  const normPhrase = normalize(phrase);
  if (!normPhrase) return null;
  const phraseWords = new Set(normPhrase.split(" "));

  let best = null;
  let bestNameLength = 0;
  for (const item of catalog) {
    const normName = normalize(item.name);
    if (!normName) continue;
    if (normPhrase === normName) return item;

    const nameWords = normName.split(" ");
    const allWordsPresent = nameWords.every((w) => phraseWords.has(w));
    if (allWordsPresent && normName.length > bestNameLength) {
      best = item;
      bestNameLength = normName.length;
    }
  }
  return best;
}

export function parseVoiceOrder(transcript, catalog) {
  const withoutCommand = transcript.trim().replace(LEADING_COMMAND_RE, "");
  const segments = withoutCommand
    .split(/,|\band\b|\bplus\b|\balso\b/gi)
    .map((s) => s.trim())
    .filter(Boolean);

  const lines = [];
  const unmatched = [];

  for (const rawSegment of segments) {
    const segment = rawSegment.replace(LEADING_CONNECTOR_RE, "").replace(TRAILING_FILLER_RE, "").trim();
    if (!segment) continue;

    const tokens = segment.split(/\s+/);
    let quantity = 1;
    let rest = segment;

    const first = tokens[0].toLowerCase();
    const second = tokens[1]?.toLowerCase();
    if (/^\d+$/.test(first)) {
      quantity = parseInt(first, 10);
      rest = tokens.slice(1).join(" ");
    } else if ((first === "a" || first === "an") && (second === "dozen" || second === "couple")) {
      // "a dozen" / "a couple" — the quantity word is the second token here.
      quantity = NUMBER_WORDS[second];
      rest = tokens.slice(2).join(" ");
    } else if (NUMBER_WORDS[first] !== undefined) {
      quantity = NUMBER_WORDS[first];
      rest = tokens.slice(1).join(" ");
    }

    rest = stripFillers(rest).trim();
    if (!rest || quantity <= 0) {
      unmatched.push(rawSegment.trim());
      continue;
    }

    const item = matchCatalogItem(rest, catalog);
    if (!item) {
      unmatched.push(rawSegment.trim());
      continue;
    }

    const existing = lines.find((l) => l.item_id === String(item.id));
    if (existing) {
      existing.quantity = String(parseInt(existing.quantity, 10) + quantity);
    } else {
      lines.push({ item_id: String(item.id), quantity: String(quantity) });
    }
  }

  return {
    lines,
    unmatched,
    confident: lines.length > 0 && unmatched.length === 0,
  };
}
