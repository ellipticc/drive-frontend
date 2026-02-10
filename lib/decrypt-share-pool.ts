import { getWorkerPool } from './worker-resource-manager';

export type DecryptShareResult = {
  cek: ArrayBuffer | null;
  name?: string | null;
};

export async function decryptShareInWorker(message: { id: string; kyberPrivateKey: ArrayBuffer; share: any; }) : Promise<DecryptShareResult> {
  const pool = getWorkerPool('share-decryption');
  return pool.execute<DecryptShareResult>(message);
}
