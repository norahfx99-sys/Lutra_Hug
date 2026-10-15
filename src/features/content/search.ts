import { resources, type Resource } from './data';

export type SearchHit = {
  resource: Resource;
  section: number;
  excerpt: string;
  score: number;
};

const MAX_RESULTS = 5;
const EXCERPT_LEN = 140;

// One char in, one char out (đ -> d, accents dropped) so indexes in the folded text
// point at the same place in the original, which the excerpt is cut from.
const fold = (s: string) =>
  Array.from(s.normalize('NFC'))
    .map(c => c.normalize('NFD').replace(/[̀-ͯ]/g, '') || c)
    .join('')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase();

/** Word-start matches only, so "an" does not hit "ban". */
function find(folded: string, token: string) {
  let count = 0;
  let first = -1;
  for (
    let i = folded.indexOf(token);
    i >= 0;
    i = folded.indexOf(token, i + 1)
  ) {
    if (i === 0 || !/[a-z0-9]/.test(folded[i - 1])) {
      count++;
      if (first < 0) first = i;
    }
  }
  return { count, first };
}

function excerptOf(body: string, at: number) {
  if (body.length <= EXCERPT_LEN) return body;
  const start = Math.max(0, at - 40);
  const cut = body.slice(start, start + EXCERPT_LEN).trim();
  return `${start > 0 ? '…' : ''}${cut}${
    start + EXCERPT_LEN < body.length ? '…' : ''
  }`;
}

/**
 * Keyword search over the sample articles. Best matches first, one hit per article
 * (its best section), at most 5. An empty query returns [].
 * ponytail: linear scan over ~10 articles; add an index if the library grows to thousands.
 */
export function searchResources(
  query: string,
  corpus: readonly Resource[] = resources,
): SearchHit[] {
  const tokens = Array.from(new Set(fold(query).split(/[^a-z0-9]+/))).filter(
    Boolean,
  );
  if (!tokens.length) return [];

  const hits: SearchHit[] = [];
  for (const resource of corpus) {
    const head = {
      title: fold(resource.title),
      summary: fold(resource.summary),
      topic: fold(resource.topic),
    };
    let score = 0;
    let matched = 0;
    const perSection = resource.sections.map(() => 0);
    const firstAt = resource.sections.map(() => 0);

    for (const t of tokens) {
      let hit = 0;
      hit += find(head.title, t).count * 4;
      hit += find(head.summary, t).count * 2;
      hit += find(head.topic, t).count * 2;
      resource.sections.forEach((s, i) => {
        const h = find(fold(s.heading), t).count * 3;
        const b = find(fold(s.body), t);
        const w = h + Math.min(b.count, 3);
        if (w && !perSection[i]) firstAt[i] = b.first;
        perSection[i] += w;
        hit += w;
      });
      if (hit) {
        matched++;
        score += hit;
      }
    }
    if (!matched) continue;

    const best = perSection.indexOf(Math.max(...perSection));
    const section = Math.max(best, 0);
    hits.push({
      resource,
      section,
      excerpt: excerptOf(
        resource.sections[section].body,
        Math.max(firstAt[section], 0),
      ),
      // More distinct query words matched always outranks more repeats of one word.
      score: matched * 100 + score,
    });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, MAX_RESULTS);
}
