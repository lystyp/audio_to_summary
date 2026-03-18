import { Readable } from 'stream';
import { Storage } from '@google-cloud/storage';
import { config } from '../config.js';
import { StorageProvider } from './StorageProvider.js';

const storage = new Storage();
const bucket = storage.bucket(config.GCS_BUCKET);

export class GCSStorageProvider implements StorageProvider {
  async upload(filename: string, stream: Readable, options: { contentType: string }): Promise<string> {
    const blob = bucket.file(filename);
    await new Promise<void>((resolve, reject) => {
      stream
        .pipe(blob.createWriteStream({ resumable: false, contentType: options.contentType }))
        .on('error', reject)
        .on('finish', resolve);
    });
    return `gs://${config.GCS_BUCKET}/${filename}`;
  }

  download(storagePath: string): Readable {
    const filename = storagePath.replace(`gs://${config.GCS_BUCKET}/`, '');
    return bucket.file(filename).createReadStream();
  }

  async delete(storagePath: string): Promise<void> {
    const filename = storagePath.replace(`gs://${config.GCS_BUCKET}/`, '');
    await bucket.file(filename).delete();
  }
}
