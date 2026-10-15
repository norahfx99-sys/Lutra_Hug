import ReactTestRenderer from 'react-test-renderer';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Boot } from '../../app/Boot';
import { newId, setDb } from '../care-cost/db';
import { splitEvenly } from '../care-cost/domain';
import { installFakeDb } from '../care-cost/fakeDb.testutil';
import { createFamily, saveChild, saveExpense } from '../care-cost/repo';
import { AssistantScreen } from './AssistantScreen';
import { AiSettingsScreen } from './AiSettingsScreen';
import { ConversationScreen } from './ConversationScreen';
import { openConversation, setProviderForTests } from './ai/chat';
import { createConversation, appendMessage, listMessages } from './ai/chatRepo';
import { AiError, type AiProvider } from './ai/providers';
import { clearApiKey, getApiKey } from './ai/secure';

// In-memory keychain so "no key" / "key saved" are real states.
jest.mock('react-native-keychain', () => {
  const store = new Map<string, unknown>();
  return {
    ACCESSIBLE: { AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'x' },
    getGenericPassword: jest.fn(
      async ({ service }: { service: string }) => store.get(service) ?? false,
    ),
    setGenericPassword: jest.fn(
      async (username: string, password: string, o: { service: string }) => {
        store.set(o.service, { username, password });
        return true;
      },
    ),
    resetGenericPassword: jest.fn(async ({ service }: { service: string }) => {
      store.delete(service);
      return true;
    }),
  };
});

const S = createNativeStackNavigator();
type R = ReactTestRenderer.ReactTestRenderer;
let renderer: R | undefined;

afterEach(async () => {
  await ReactTestRenderer.act(async () => renderer?.unmount());
  renderer = undefined;
  setProviderForTests(null);
  await clearApiKey();
  openConversation(null);
  setDb(null);
});

const flush = (ms = 20) => new Promise<void>(res => setTimeout(res, ms));

async function render(initial: string, params?: object) {
  const Stub = () => null;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <Boot>
        <NavigationContainer>
          <S.Navigator
            initialRouteName={initial}
            screenOptions={{ headerShown: false }}
          >
            <S.Screen
              name="Assistant"
              component={AssistantScreen as never}
              initialParams={params}
            />
            <S.Screen
              name="Conversation"
              component={ConversationScreen as never}
              initialParams={params}
            />
            <S.Screen name="AiSettings" component={AiSettingsScreen} />
            <S.Screen name="Urgent" component={Stub} />
            <S.Screen name="ServiceList" component={Stub} />
            <S.Screen name="ResourceList" component={Stub} />
          </S.Navigator>
        </NavigationContainer>
      </Boot>,
    );
    await flush();
  });
  return renderer as R;
}

const textOf = (node: { findAllByType: R['root']['findAllByType'] }) =>
  node
    .findAllByType('Text' as never)
    .map(x => [x.props.children].flat().join(''))
    .join('|');
const all = (r: R) => textOf(r.root);

const find = (r: R, label: string) =>
  r.root.findAll(
    n =>
      n.props.onPress &&
      (n.props.accessibilityLabel === label ||
        (n.props.accessibilityRole === 'button' && textOf(n).includes(label))),
  )[0];

async function press(r: R, label: string) {
  const target = find(r, label);
  if (!target) throw new Error(`No button "${label}" in: ${all(r)}`);
  await ReactTestRenderer.act(async () => {
    target.props.onPress();
    await flush();
  });
}

async function type(r: R, label: string, value: string) {
  const input = r.root.findAll(n => n.props.accessibilityLabel === label)[0];
  await ReactTestRenderer.act(async () => input.props.onChangeText(value));
}

const hasInput = (r: R, label: string) =>
  r.root.findAll(n => n.props.accessibilityLabel === label).length > 0;

async function seedFamily() {
  await installFakeDb();
  await createFamily('T', await newId());
  const kid = await saveChild({ displayName: 'An' }, await newId());
  const today = new Date();
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(
    2,
    '0',
  )}-01`;
  await saveExpense(
    {
      amountVnd: 200_000,
      spentOn: iso,
      description: 'Trị liệu',
      category: 'medical',
      note: null,
      allocations: splitEvenly(200_000, [kid]),
    },
    await newId(),
    '2999-01-01',
  );
}

const answering = (reply: string) => {
  const requests: Parameters<AiProvider['chat']>[0][] = [];
  const provider: AiProvider = {
    chat: async r => {
      requests.push(r);
      return reply;
    },
  };
  return { provider, requests };
};

describe('AssistantScreen', () => {
  test('without a key: setup card, urgent link, no dead chat input', async () => {
    await seedFamily();
    const r = await render('Assistant');
    const t = all(r);
    expect(t).toContain('Thiết lập trợ lý AI');
    expect(t).toContain('Cần hỗ trợ khẩn cấp');
    expect(hasInput(r, 'Câu hỏi của bạn')).toBe(false);
    expect(find(r, 'Gửi câu hỏi')).toBeUndefined();
    // Quick links work without AI.
    expect(find(r, 'Tìm dịch vụ')).toBeDefined();
    expect(find(r, 'Tài liệu')).toBeDefined();
  });

  test('configured: suggestions come from real data and only fill the box', async () => {
    await seedFamily();
    const { provider, requests } = answering('x');
    setProviderForTests(provider);
    const r = await render('Assistant');
    expect(all(r)).toContain('Tháng này mình chi nhiều nhất vào nhóm nào?');
    expect(all(r)).not.toContain('So với tháng trước thế nào?'); // no previous month data
    await press(r, 'Tháng này mình chi nhiều nhất vào nhóm nào?');
    const input = r.root.findAll(n => n.props.label === 'Câu hỏi của bạn')[0];
    expect(input.props.value).toBe(
      'Tháng này mình chi nhiều nhất vào nhóm nào?',
    );
    expect(requests).toHaveLength(0);
  });

  test('no data: no suggestions', async () => {
    await installFakeDb();
    await createFamily('T', await newId());
    setProviderForTests(answering('x').provider);
    const r = await render('Assistant');
    expect(all(r)).not.toContain('Gợi ý từ dữ liệu của bạn');
  });

  test('recent conversations are listed from the local store', async () => {
    await seedFamily();
    setProviderForTests(answering('x').provider);
    await createConversation('Chi phí thuốc tháng này');
    const r = await render('Assistant');
    expect(all(r)).toContain('Chi phí thuốc tháng này');
  });
});

describe('ConversationScreen', () => {
  test('without a key: setup card instead of a composer', async () => {
    await seedFamily();
    const r = await render('Conversation');
    expect(all(r)).toContain('Cần thiết lập trợ lý AI');
    expect(hasInput(r, 'Câu hỏi cho trợ lý')).toBe(false);
  });

  test('first send asks for consent, shows a real preview, then answers with the footer', async () => {
    await seedFamily();
    const { provider, requests } = answering('Tháng này bạn chi 200.000 đ.');
    setProviderForTests(provider);
    const r = await render('Conversation');

    await type(r, 'Câu hỏi cho trợ lý', 'Tháng này chi bao nhiêu?');
    await press(r, 'Gửi');
    expect(all(r)).toContain('Trước khi gửi lần đầu');
    expect(requests).toHaveLength(0); // nothing leaves before consent
    expect(all(r)).toContain('Trẻ 1');

    await press(r, 'Xem trước nội dung gửi đi');
    expect(all(r)).toContain('=== DỮ LIỆU TRÊN MÁY ===');
    expect(all(r)).toContain('200.000 đ');
    expect(all(r)).not.toContain('Trị liệu'); // descriptions are off by default

    await press(r, 'Đồng ý và gửi');
    await ReactTestRenderer.act(async () => flush(50));
    expect(requests).toHaveLength(1);
    expect(all(r)).toContain('Tháng này bạn chi 200.000 đ.');
    expect(all(r)).toContain(
      'Trợ lý AI có thể sai. Không thay thế tư vấn y tế.',
    );

    // Consent is remembered: the second question goes straight out.
    await type(r, 'Câu hỏi cho trợ lý', 'Còn tháng trước?');
    await press(r, 'Gửi');
    await ReactTestRenderer.act(async () => flush(50));
    expect(all(r)).not.toContain('Trước khi gửi lần đầu');
    expect(requests).toHaveLength(2);
  });

  test('declining consent sends nothing and keeps the draft', async () => {
    await seedFamily();
    const { provider, requests } = answering('x');
    setProviderForTests(provider);
    const r = await render('Conversation');
    await type(r, 'Câu hỏi cho trợ lý', 'Giữ lại nhé');
    await press(r, 'Gửi');
    await press(r, 'Không gửi');
    expect(requests).toHaveLength(0);
    const input = r.root.findAll(
      n => n.props.accessibilityLabel === 'Câu hỏi cho trợ lý',
    )[0];
    expect(input.props.value).toBe('Giữ lại nhé');
  });

  test('prompt param asks on arrival (after consent)', async () => {
    await seedFamily();
    const { provider, requests } = answering('Xong');
    setProviderForTests(provider);
    const r = await render('Conversation', { prompt: 'So với tháng trước?' });
    await press(r, 'Đồng ý và gửi');
    await ReactTestRenderer.act(async () => flush(50));
    expect(requests[0].messages.at(-1)?.content).toBe('So với tháng trước?');
    expect(all(r)).toContain('Xong');
  });

  test('an emergency phrase shows the card with a link to Urgent before the answer arrives', async () => {
    await seedFamily();
    // A provider that never answers: the card must not depend on it.
    setProviderForTests({ chat: () => new Promise(() => {}) });
    const r = await render('Conversation');
    await type(r, 'Câu hỏi cho trợ lý', 'Bé bị co giật, phải làm sao?');
    await press(r, 'Gửi');
    await press(r, 'Đồng ý và gửi');
    const t = all(r);
    expect(t).toContain('Gọi 115');
    expect(t).toContain('Gọi 111');
    expect(t).toContain('Đang trả lời…');
    expect(find(r, 'Mở trang hỗ trợ khẩn cấp')).toBeDefined();
  });

  test('Stop aborts the in-flight request and offers a retry', async () => {
    await seedFamily();
    let signal: AbortSignal | undefined;
    setProviderForTests({
      chat: ({ signal: s }) =>
        new Promise((_res, rej) => {
          signal = s as AbortSignal;
          s?.addEventListener('abort', () => rej(new AiError('aborted')));
        }),
    });
    const r = await render('Conversation');
    await type(r, 'Câu hỏi cho trợ lý', 'Câu hỏi dài');
    await press(r, 'Gửi');
    await press(r, 'Đồng ý và gửi');
    expect(signal?.aborted).toBe(false);
    expect(find(r, 'Dừng trả lời')).toBeDefined();

    await press(r, 'Dừng trả lời');
    expect(signal?.aborted).toBe(true);
    expect(all(r)).toContain('Đã dừng');
    expect(find(r, 'Thử lại câu hỏi này')).toBeDefined();
    expect(find(r, 'Gửi')).toBeDefined(); // composer is back to Send
  });

  test('errors: unauthorized offers settings; retry does not duplicate the question', async () => {
    await seedFamily();
    let fail = true;
    const requests: unknown[] = [];
    setProviderForTests({
      chat: async req => {
        requests.push(req);
        if (fail) throw new AiError('unauthorized');
        return 'Đã được';
      },
    });
    const r = await render('Conversation');
    await type(r, 'Câu hỏi cho trợ lý', 'Hỏi một lần');
    await press(r, 'Gửi');
    await press(r, 'Đồng ý và gửi');
    await ReactTestRenderer.act(async () => flush(50));
    expect(all(r)).toContain('Khóa API không được chấp nhận');
    expect(find(r, 'Mở cài đặt AI')).toBeDefined();

    fail = false;
    await press(r, 'Thử lại câu hỏi này');
    await ReactTestRenderer.act(async () => flush(50));
    expect(all(r)).toContain('Đã được');
    expect(all(r).split('Hỏi một lần').length - 1).toBe(1);
  });

  test('network error keeps the question and offers retry only', async () => {
    await seedFamily();
    setProviderForTests({
      chat: async () => {
        throw new AiError('network');
      },
    });
    const r = await render('Conversation');
    await type(r, 'Câu hỏi cho trợ lý', 'Có mạng không');
    await press(r, 'Gửi');
    await press(r, 'Đồng ý và gửi');
    await ReactTestRenderer.act(async () => flush(50));
    expect(all(r)).toContain('Không kết nối được');
    expect(find(r, 'Mở cài đặt AI')).toBeUndefined();
    expect(find(r, 'Thử lại câu hỏi này')).toBeDefined();
  });

  test('opens a stored conversation chosen on the Assistant tab', async () => {
    await seedFamily();
    setProviderForTests(answering('x').provider);
    const id = await createConversation('Cũ');
    await appendMessage({
      conversationId: id,
      role: 'user',
      content: 'Câu hỏi đã lưu',
      status: 'sent',
    });
    openConversation(id);
    const r = await render('Conversation');
    expect(all(r)).toContain('Câu hỏi đã lưu');
    expect(await listMessages(id)).toHaveLength(1);
  });
});

describe('AiSettingsScreen', () => {
  test('cleartext URL is refused with the https message and nothing is saved', async () => {
    await seedFamily();
    const r = await render('AiSettings');
    expect(all(r)).toContain('Điều gì rời khỏi điện thoại?');
    await type(r, 'Địa chỉ máy chủ', 'http://192.168.1.5:11434/v1');
    await type(r, 'Tên mô hình', 'm');
    await press(r, 'Lưu cài đặt');
    expect(all(r)).toContain('https://');
    expect(all(r)).not.toContain('Đã lưu cài đặt');
  });

  test('saving stores settings, puts the key in the keychain only, then clears the field', async () => {
    await seedFamily();
    const r = await render('AiSettings');
    await type(r, 'Tên mô hình', 'my-model');
    await type(r, 'Khóa API', 'sk-test-123');
    await press(r, 'Lưu cài đặt');
    await ReactTestRenderer.act(async () => flush(30));
    expect(all(r)).toContain('Đã lưu cài đặt');
    expect(await getApiKey()).toBe('sk-test-123');
    expect(JSON.stringify(r.toJSON())).not.toContain('sk-test-123');
  });

  test('the key field is masked until the user asks to show it', async () => {
    await seedFamily();
    const r = await render('AiSettings');
    const field = () =>
      r.root.findAll(n => n.props.accessibilityLabel === 'Khóa API')[0];
    expect(field().props.secureTextEntry).toBe(true);
    await press(r, 'Hiện khóa API');
    expect(field().props.secureTextEntry).toBe(false);
  });

  test('privacy toggles default off', async () => {
    await seedFamily();
    const r = await render('AiSettings');
    const sw = (label: string) =>
      r.root.findAll(
        n => n.props.accessibilityLabel === label && 'value' in n.props,
      )[0];
    expect(sw('Gửi tên của trẻ').props.value).toBe(false);
    expect(sw('Gửi mô tả và ghi chú khoản chi').props.value).toBe(false);
  });

  test('test connection without a key explains instead of calling out', async () => {
    await seedFamily();
    const spy = jest.fn();
    global.fetch = spy as never;
    const r = await render('AiSettings');
    await type(r, 'Tên mô hình', 'm');
    await press(r, 'Kiểm tra kết nối');
    await ReactTestRenderer.act(async () => flush(30));
    expect(all(r)).toContain('Chưa có khóa API');
    expect(spy).not.toHaveBeenCalled();
  });

  test('test connection makes one real request and reports success without showing the key', async () => {
    await seedFamily();
    const spy = jest.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'OK' } }] }),
    });
    global.fetch = spy as never;
    const r = await render('AiSettings');
    await type(r, 'Tên mô hình', 'm');
    await type(r, 'Khóa API', 'sk-visible-never');
    await press(r, 'Kiểm tra kết nối');
    await ReactTestRenderer.act(async () => flush(30));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(all(r)).toContain('Kết nối thành công');
    expect(all(r)).not.toContain('sk-visible-never');
  });
});
