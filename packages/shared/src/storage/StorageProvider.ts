import { Readable } from 'stream';

export interface StorageProvider {
  upload(filename: string, stream: Readable, options: { contentType: string }): Promise<string>;
  download(storagePath: string): Readable;
  delete(storagePath: string): Promise<void>;
}
