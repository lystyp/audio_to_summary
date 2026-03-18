import { v2, protos } from '@google-cloud/speech';
import { config } from '@daniel/shared';

const location =  'asia-southeast1'; // 例如: 'us'、'eu'、'asia-south1'

const client = new v2.SpeechClient({
  apiEndpoint: `${location}-speech.googleapis.com`,
});

export async function transcribe(gcsUri: string): Promise<string> {
  const projectId = await client.getProjectId();
  const recognizer = `projects/${projectId}/locations/${location}/recognizers/_`;

  const request: protos.google.cloud.speech.v2.IBatchRecognizeRequest = {
    recognizer,
    config: {
      languageCodes: ["cmn-Hant-TW", "en-US"], // 例如 'en-US' / 'cmn-Hant-TW'
      model: 'chirp_2',
      autoDecodingConfig: {},
      features: {
        enableAutomaticPunctuation: true,
      },
    },
    files: [{ uri: gcsUri }],
    recognitionOutputConfig: {
      inlineResponseConfig: {},
    },
  };

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('STT timeout: exceeded 60s')), 60_000),
  );

  const [operation] = await client.batchRecognize(request);
  const [response] = await Promise.race([operation.promise(), timeout]);

  const fileResult = response.results?.[gcsUri];
  const results = fileResult?.transcript?.results ?? [];

  return results
    .map((r) => r.alternatives?.[0]?.transcript ?? '')
    .filter(Boolean)
    .join('\n');
}