import crypto from 'crypto';
import multer from 'multer';
import path from 'path';
import { config } from '@daniel/shared';

const ALLOWED_MIME = new Set(['audio/mpeg', 'audio/wav', 'audio/wave', 'audio/x-wav', 'audio/mp4', 'audio/ogg']);
const ALLOWED_EXT = new Set(['.mp3', '.wav', '.ogg', '.m4a']);

const storage = multer.diskStorage({
  destination: config.UPLOAD_DIR,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

export const upload = multer({
  storage,
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
