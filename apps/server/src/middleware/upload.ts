import crypto from 'crypto';
import path from 'path';
import { Writable } from 'stream';
import { Storage } from '@google-cloud/storage';
import multer from 'multer';
import { config } from '@daniel/shared';

const ALLOWED_MIME = new Set(['audio/mpeg', 'audio/wav', 'audio/wave', 'audio/x-wav', 'audio/mp4', 'audio/ogg']);
const ALLOWED_EXT = new Set(['.mp3', '.wav', '.ogg', '.m4a']);

const storage = new Storage();
const bucket = storage.bucket(config.GCS_BUCKET);

const gcsStorage: multer.StorageEngine = {
  _handleFile(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `${crypto.randomUUID()}${ext}`;
    const blob = bucket.file(filename);
    const writeStream: Writable = blob.createWriteStream({
      resumable: false,
      contentType: file.mimetype,
    });

    file.stream
      .pipe(writeStream)
      .on('error', (err: Error) => cb(err))
      .on('finish', () => {
        cb(null, {
          filename,
          path: `gs://${config.GCS_BUCKET}/${filename}`,
          size: blob.metadata.size ? Number(blob.metadata.size) : 0,
        } as Partial<Express.Multer.File> & { path: string });
      });
  },

  _removeFile(_req, file, cb) {
    bucket.file(file.filename).delete().then(() => cb(null), cb);
  },
};

export const upload = multer({
  storage: gcsStorage,
  limits: { fileSize: config.MAX_FILE_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_MIME.has(file.mimetype) || ALLOWED_EXT.has(ext)) {
      cb(null, true);
    } else {
      cb(new Error('僅支援 .mp3 / .wav 音訊格式'));
    }
  },
});
