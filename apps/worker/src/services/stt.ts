import OpenAI, { toFile } from 'openai';
import { config, storageProvider } from '@daniel/shared';
import path from 'path';

const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });

export async function transcribe(storagePath: string): Promise<string> {
  const stream = storageProvider.download(storagePath);
  const filename = path.basename(storagePath);
  const response = await openai.audio.transcriptions.create({
    model: config.WHISPER_MODEL,
    file: await toFile(stream, filename),
  });
  return response.text;
}
