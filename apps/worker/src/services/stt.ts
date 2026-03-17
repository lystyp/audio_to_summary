import fs from 'fs';
import OpenAI from 'openai';
import { config } from '@daniel/shared';

const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });

export async function transcribe(storagePath: string): Promise<string> {
  const response = await openai.audio.transcriptions.create({
    model: config.WHISPER_MODEL,
    file: fs.createReadStream(storagePath),
  });
  return response.text;
}
