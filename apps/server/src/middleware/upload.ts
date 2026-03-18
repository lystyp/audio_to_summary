import crypto from 'crypto';
import path from 'path';
import multer from 'multer';
import { config, storageProvider } from '@daniel/shared';

const ALLOWED_MIME = new Set(['audio/mpeg', 'audio/wav', 'audio/wave', 'audio/x-wav', 'audio/mp4', 'audio/ogg']);
const ALLOWED_EXT = new Set(['.mp3', '.wav', '.ogg', '.m4a']);

const gcsStorage: multer.StorageEngine = {
  _handleFile(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `${crypto.randomUUID()}${ext}`;

    storageProvider
      .upload(filename, file.stream, { contentType: file.mimetype })
      .then((storagePath) => cb(null, { filename, path: storagePath, size: 0 } as Express.Multer.File))
      .catch(cb);
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
