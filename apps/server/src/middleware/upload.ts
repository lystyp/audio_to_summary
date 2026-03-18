import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { PassThrough } from 'stream';
import { pipeline } from 'stream/promises';
import multer from 'multer';
import ffmpeg from 'fluent-ffmpeg';
import { config, storageProvider } from '@daniel/shared';

const ALLOWED_MIME = new Set(['audio/mpeg', 'audio/wav', 'audio/wave', 'audio/x-wav', 'audio/mp4', 'audio/ogg']);
const ALLOWED_EXT = new Set(['.mp3', '.wav', '.ogg', '.m4a']);

function convertM4aToWav(inputPath: string): PassThrough {
  const passThrough = new PassThrough();
  ffmpeg(inputPath)
    .toFormat('wav')
    .on('error', (err: Error) => passThrough.destroy(err))
    .pipe(passThrough);
  return passThrough;
}

const gcsStorage: multer.StorageEngine = {
  _handleFile(_req, file, cb) {
    file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const ext = path.extname(file.originalname).toLowerCase();
    const isM4a = ext === '.m4a';

    const filename = `${crypto.randomUUID()}${isM4a ? '.wav' : ext}`;
    const contentType = isM4a ? 'audio/wav' : file.mimetype;

    if (!isM4a) {
      storageProvider
        .upload(filename, file.stream, { contentType })
        .then((storagePath) => cb(null, { filename, path: storagePath, size: 0 } as Express.Multer.File))
        .catch(cb);
      return;
    }

    const tmpPath = path.join(os.tmpdir(), `${crypto.randomUUID()}.m4a`);
    const tmpWrite = fs.createWriteStream(tmpPath);

    pipeline(file.stream, tmpWrite)
      .then(() => storageProvider.upload(filename, convertM4aToWav(tmpPath), { contentType }))
      .then((storagePath) => cb(null, { filename, path: storagePath, size: 0 } as Express.Multer.File))
      .catch(cb)
      .finally(() => fs.unlink(tmpPath, () => {}));
  },

  _removeFile(_req, file, cb) {
    storageProvider.delete(file.path).then(() => cb(null), cb);
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
