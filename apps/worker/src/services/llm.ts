import OpenAI from 'openai';
import { config } from '@daniel/shared';

const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });

export async function summarize(transcript: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: config.OPENAI_CHAT_MODEL,
    messages: [
      {
        role: 'system',
        content: '你是一個專業的會議記錄助理。請用繁體中文將以下逐字稿整理成簡潔的摘要，條列重點。',
      },
      { role: 'user', content: transcript },
    ],
  });
  return response.choices[0]?.message.content ?? '';
}
