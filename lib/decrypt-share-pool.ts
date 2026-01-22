import { WorkerPool } from './worker-pool';

let shareDecryptionPool: WorkerPool | null = null;

function getShareDecryptionPool(): WorkerPool {
  if (!shareDecryptionPool) {
    shareDecryptionPool = new WorkerPool(() => new Worker(new URL('./workers/decrypt-share.worker.ts', import.meta.url)));
  }
  return shareDecryptionPool;
}

export type DecryptShareResult = {
  cek: ArrayBuffer | null;
  name?: string | null;
};

export async function decryptShareInWorker(message: { id: string; kyberPrivateKey: ArrayBuffer; share: any; }) : Promise<DecryptShareResult> {
  const pool = getShareDecryptionPool();
  return pool.execute<DecryptShareResult>(message);
}
