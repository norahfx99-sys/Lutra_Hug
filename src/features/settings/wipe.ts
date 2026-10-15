import { emit, getDb } from '../care-cost/db';
import { clearApiKey } from '../assistant/ai/secure';

/**
 * Deletes everything the user entered on this phone: family data, chat history, AI settings and
 * the AI API key. Keeps meta 'device_id' so the encrypted DB stays valid.
 */
export async function wipeLocalData() {
  await getDb().transaction(async tx => {
    // Children before parents: allocation -> expense/child -> device -> family.
    for (const sql of [
      'DELETE FROM chat_message',
      'DELETE FROM chat_conversation',
      'DELETE FROM expense_allocation',
      'DELETE FROM expense',
      'DELETE FROM child',
      'DELETE FROM monthly_budget',
      'DELETE FROM device',
      'DELETE FROM family',
      'DELETE FROM change_log',
      'DELETE FROM conflict',
      "DELETE FROM meta WHERE key = 'onboarded' OR key LIKE 'ai.%'",
    ])
      await tx.execute(sql);
  });
  try {
    await clearApiKey(); // keychain is outside the SQL transaction; a failure surfaces so the user retries
  } finally {
    emit(); // onboarded flips to false, the root navigator returns to onboarding
  }
}
