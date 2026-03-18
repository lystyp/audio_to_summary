import { v2, protos } from '@google-cloud/speech';

const location = 'asia-southeast1';

const client = new v2.SpeechClient({
  apiEndpoint: `${location}-speech.googleapis.com`,
});

export async function transcribe(gcsUri: string): Promise<string> {
  const projectId = await client.getProjectId();
  const recognizer = `projects/${projectId}/locations/${location}/recognizers/_`;

  const request: protos.google.cloud.speech.v2.IBatchRecognizeRequest = {
    recognizer,
    config: {
      languageCodes: ['cmn-Hant-TW', 'en-US'],
      model: 'chirp_3',
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

  const [operation] = await client.batchRecognize(request);
  const [response] = await operation.promise();

  const fileResult = response.results?.[gcsUri];
  const results = fileResult?.transcript?.results ?? [];

  return results
    .map((r) => r.alternatives?.[0]?.transcript ?? '')
    .filter(Boolean)
    .join('\n');
}