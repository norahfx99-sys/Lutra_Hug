import { emit, getDb, newId } from '../../care-cost/db';

// Device-local chat history. Deliberately NOT written to change_log: it never syncs.

export type MessageStatus = 'pending' | 'sent' | 'failed';

export type Conversation = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  summary: string | null;
  summarizedUpto: number;
};

export type Message = {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
  status: MessageStatus;
};

const conv = (r: Record<string, unknown>): Conversation => ({
  id: String(r.id),
  title: String(r.title),
  createdAt: Number(r.created_at),
  updatedAt: Number(r.updated_at),
  summary: r.summary == null ? null : String(r.summary),
  summarizedUpto: Number(r.summarized_upto),
});

export async function listConversations(limit = 20): Promise<Conversation[]> {
  const { rows } = await getDb().execute(
    'SELECT * FROM chat_conversation ORDER BY updated_at DESC, id LIMIT ?',
    [limit],
  );
  return rows.map(conv);
}

export async function getConversation(id: string) {
  const { rows } = await getDb().execute(
    'SELECT * FROM chat_conversation WHERE id = ?',
    [id],
  );
  return rows[0] ? conv(rows[0]) : null;
}

export async function createConversation(title: string, now = Date.now()) {
  const id = await newId();
  await getDb().execute(
    'INSERT INTO chat_conversation (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)',
    [id, title.trim().slice(0, 60) || 'Cuộc trò chuyện', now, now],
  );
  emit();
  return id;
}

// rowid breaks created_at ties so same-millisecond messages keep insertion order.
export async function listMessages(conversationId: string): Promise<Message[]> {
  const { rows } = await getDb().execute(
    `SELECT id, conversation_id, role, content, created_at, status FROM chat_message
     WHERE conversation_id = ? ORDER BY created_at, rowid`,
    [conversationId],
  );
  return rows.map(r => ({
    id: String(r.id),
    conversationId: String(r.conversation_id),
    role: r.role as Message['role'],
    content: String(r.content),
    createdAt: Number(r.created_at),
    status: r.status as MessageStatus,
  }));
}

export async function appendMessage(
  m: {
    conversationId: string;
    role: Message['role'];
    content: string;
    status: MessageStatus;
  },
  now = Date.now(),
) {
  const id = await newId();
  await getDb().transaction(async tx => {
    await tx.execute(
      `INSERT INTO chat_message (id, conversation_id, role, content, created_at, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, m.conversationId, m.role, m.content, now, m.status],
    );
    await tx.execute(
      'UPDATE chat_conversation SET updated_at = ? WHERE id = ?',
      [now, m.conversationId],
    );
  });
  emit();
  return id;
}

export async function setMessageStatus(id: string, status: MessageStatus) {
  await getDb().execute('UPDATE chat_message SET status = ? WHERE id = ?', [
    status,
    id,
  ]);
  emit();
}

/** The answer and the question's 'sent' flip commit together, so a turn is never half-stored. */
export async function completeTurn(
  conversationId: string,
  questionId: string,
  answer: string,
  now = Date.now(),
) {
  const id = await newId();
  await getDb().transaction(async tx => {
    await tx.execute("UPDATE chat_message SET status = 'sent' WHERE id = ?", [
      questionId,
    ]);
    await tx.execute(
      `INSERT INTO chat_message (id, conversation_id, role, content, created_at, status)
       VALUES (?, ?, 'assistant', ?, ?, 'sent')`,
      [id, conversationId, answer, now],
    );
    await tx.execute(
      'UPDATE chat_conversation SET updated_at = ? WHERE id = ?',
      [now, conversationId],
    );
  });
  emit();
  return id;
}

export async function deleteMessage(id: string) {
  await getDb().execute('DELETE FROM chat_message WHERE id = ?', [id]);
  emit();
}

export async function setSummary(id: string, summary: string, upto: number) {
  await getDb().execute(
    'UPDATE chat_conversation SET summary = ?, summarized_upto = ? WHERE id = ?',
    [summary, upto, id],
  );
  emit();
}

export async function deleteConversation(id: string) {
  await getDb().transaction(async tx => {
    await tx.execute('DELETE FROM chat_message WHERE conversation_id = ?', [
      id,
    ]);
    await tx.execute('DELETE FROM chat_conversation WHERE id = ?', [id]);
  });
  emit();
}

export async function deleteAllConversations() {
  await getDb().transaction(async tx => {
    await tx.execute('DELETE FROM chat_message');
    await tx.execute('DELETE FROM chat_conversation');
  });
  emit();
}
