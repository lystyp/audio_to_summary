export type { StorageProvider } from './StorageProvider.js';
export { GCSStorageProvider } from './GCSStorageProvider.js';

import { GCSStorageProvider } from './GCSStorageProvider.js';
import { StorageProvider } from './StorageProvider.js';

export const storageProvider: StorageProvider = new GCSStorageProvider();
