import speech from '@google-cloud/speech';
import path from 'path';
import { config } from '@daniel/shared';

const client = new speech.SpeechClient();

const { AudioEncoding } = speech.protos.google.cloud.speech.v1.RecognitionConfig;

const ENCODING_MAP: Record<string, speech.protos.google.cloud.speech.v1.RecognitionConfig.AudioEncoding> = {
  '.mp3': AudioEncoding.MP3,
  '.wav': AudioEncoding.LINEAR16,
  '.ogg': AudioEncoding.OGG_OPUS,
  '.m4a': AudioEncoding.MP3,
};

export async function transcribe(storagePath: string): Promise<string> {
  const ext = path.extname(storagePath).toLowerCase();
  const encoding = ENCODING_MAP[ext] ?? 'ENCODING_UNSPECIFIED';

  const [operation] = await client.longRunningRecognize({
    audio: { uri: storagePath },
    config: {
      encoding,
      languageCode: config.STT_LANGUAGE_CODE,
      enableAutomaticPunctuation: true,
    },
  });

  const [response] = await operation.promise();
  return response.results?.map((r) => r.alternatives?.[0]?.transcript ?? '').join('\n') ?? '';
}
