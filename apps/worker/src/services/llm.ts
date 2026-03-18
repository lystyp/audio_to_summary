import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '@daniel/shared';

const genai = new GoogleGenerativeAI(config.GEMINI_API_KEY);
const model = genai.getGenerativeModel({ model: 'gemini-3-flash-preview' });

export async function summarize(transcript: string): Promise<string> {
  const result = await model.generateContent([
     `你是一個專業的摘要助手。
      請將以下內容整理為重點摘要。

      規則：
      - 條列式輸出（使用 -）
      - 每點不超過20字
      - 僅保留關鍵資訊
      - 不要加入主觀解釋
      - 保留原意' `,
      transcript,
  ]);
  return result.response.text();
}
