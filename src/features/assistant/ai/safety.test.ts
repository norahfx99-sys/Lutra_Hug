import { AI_DISCLAIMER, detectEmergency } from './safety';

test.each([
  'Con bị co giật từ sáng',
  'bé vừa ngất xỉu',
  'Mình muốn tự tử',
  'con ngừng thở mấy giây',
  'chảy máu nhiều quá',
  'cháu bị bạo hành',
  'be bi co giat', // typed without tone marks
  'TỰ LÀM HẠI bản thân!!!',
])('detects: %s', t => expect(detectEmergency(t)).toBe(true));

test.each([
  'Tháng này mình chi nhiều nhất vào nhóm nào?',
  'tư tưởng của mình là tiết kiệm',
  'tu tuong lai gan',
  'So với tháng trước thế nào?',
  '',
])('ignores: %s', t => expect(detectEmergency(t)).toBe(false));

test('disclaimer text is fixed', () => {
  expect(AI_DISCLAIMER).toBe(
    'Trợ lý AI có thể sai. Không thay thế tư vấn y tế.',
  );
});
