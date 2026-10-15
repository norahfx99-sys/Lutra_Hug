// Independent of the model: a keyword check on the user's own message. Errs towards showing the card.

export const AI_DISCLAIMER =
  'Trợ lý AI có thể sai. Không thay thế tư vấn y tế.';

// Matched on text with diacritics and punctuation stripped, on whole words, so typing without
// tone marks still hits and "tu tuong" does not match "tu tu".
const TERMS = [
  'tự tử',
  'tự sát',
  'tự làm hại',
  'tự hại',
  'muốn chết',
  'không muốn sống',
  'ngừng thở',
  'không thở',
  'khó thở',
  'tím tái',
  'co giật',
  'lên cơn giật',
  'ngất',
  'bất tỉnh',
  'chảy máu nhiều',
  'chảy máu không cầm',
  'bị bạo hành',
  'bạo hành',
  'bị xâm hại',
  'xâm hại',
  'ngộ độc',
  'uống nhầm thuốc',
  'uống quá liều',
  'đuối nước',
];

const plain = (s: string) =>
  ` ${s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()} `;

const NEEDLES = TERMS.map(t => ` ${plain(t).trim()} `);

export function detectEmergency(message: string): boolean {
  const hay = plain(message);
  return NEEDLES.some(n => hay.includes(n));
}
