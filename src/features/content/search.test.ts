import { resources, services } from './data';
import { searchResources } from './search';

test('empty or blank query returns nothing', () => {
  expect(searchResources('')).toEqual([]);
  expect(searchResources('   ')).toEqual([]);
  expect(searchResources('?!')).toEqual([]);
});

test('no match returns nothing', () => {
  expect(searchResources('zzzxyz')).toEqual([]);
});

test('diacritics and case are ignored in both directions', () => {
  const withMarks = searchResources('Nhà trường');
  expect(withMarks.length).toBeGreaterThan(0);
  expect(searchResources('nha truong')).toEqual(withMarks);
  expect(searchResources('NHÀ TRƯỜNG')).toEqual(withMarks);
});

test('đ folds to d', () => {
  const ids = searchResources('đi khám').map(h => h.resource.id);
  expect(ids).toContain('res-prepare-appointment');
  expect(searchResources('di kham')).toEqual(searchResources('đi khám'));
});

test('decomposed (NFD) input matches too', () => {
  expect(searchResources('nha truong'.normalize('NFD'))).toEqual(
    searchResources('nha truong'),
  );
});

test('multiple words: articles matching more words rank first', () => {
  const hits = searchResources('hóa đơn chi phí');
  expect(hits[0].resource.topic).toBe('Theo dõi chi phí');
  const scores = hits.map(h => h.score);
  expect(scores).toEqual([...scores].sort((a, b) => b - a));
});

test('at most 5 results, one per article, valid section and excerpt', () => {
  const hits = searchResources('con');
  expect(hits.length).toBeLessThanOrEqual(5);
  expect(new Set(hits.map(h => h.resource.id)).size).toBe(hits.length);
  for (const h of hits) {
    expect(h.resource.sections[h.section]).toBeDefined();
    expect(h.excerpt.length).toBeGreaterThan(0);
    expect(h.score).toBeGreaterThan(0);
  }
});

test('matches only at word start', () => {
  const r = {
    ...resources[0],
    title: 'x',
    summary: 'x',
    topic: 'x',
    sections: [{ heading: 'x', body: 'Bạn nhé' }],
  };
  expect(searchResources('an', [r])).toEqual([]); // inside "bạn", not a word start
  expect(searchResources('nhe', [r])).toHaveLength(1);
});

test('works on a custom corpus', () => {
  expect(searchResources('trường', [resources[0]])).toEqual([]);
  expect(searchResources('buổi sáng', [resources[0]])).toHaveLength(1);
});

test('sample data is labelled and carries no phone numbers', () => {
  expect(resources.length).toBeGreaterThanOrEqual(8);
  expect(resources.length).toBeLessThanOrEqual(10);
  expect(services.length).toBeGreaterThanOrEqual(5);
  expect(
    resources.every(
      r => r.sample && /^\d{4}-\d{2}-\d{2}$/.test(r.source.reviewedOn),
    ),
  ).toBe(true);
  expect(services.every(s => s.sample)).toBe(true);
  expect(JSON.stringify([...resources, ...services])).not.toMatch(
    /\d{3}[ .-]?\d{3}/,
  );
});
