import { ml_kem768 } from '@noble/post-quantum/ml-kem.js';
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';

function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

function base64ToUint8Array(b64: string): Uint8Array {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

function decryptDataLocal(encryptedData: string, key: Uint8Array, nonce: string): Uint8Array {
  const encryptedBytes = base64ToUint8Array(encryptedData);
  const nonceBytes = base64ToUint8Array(nonce);
  return xchacha20poly1305(key, nonceBytes).decrypt(encryptedBytes);
}

// Worker message handler
self.onmessage = async (e: MessageEvent) => {
  const { id, kyberPrivateKey, share } = e.data;
  try {
    if (!share || (!share.kyberCiphertext && !share.kyber_ciphertext) || !share.encryptedCek && !share.encrypted_cek) {
      self.postMessage({ id, success: false, error: 'Missing encryption material in share' });
      return;
    }

    // Convert provided kyber private key to Uint8Array
    const kyberPriv = new Uint8Array(kyberPrivateKey);
    const kyberCipherHex = share.kyberCiphertext || share.kyber_ciphertext;
    const kyberCiphertext = hexToUint8Array(kyberCipherHex);

    const sharedSecret = ml_kem768.decapsulate(kyberCiphertext, kyberPriv);

    const encryptedCek = share.encryptedCek || share.encrypted_cek;
    const encryptedCekNonce = share.encryptedCekNonce || share.encrypted_cek_nonce;

    const cek = decryptDataLocal(encryptedCek, new Uint8Array(sharedSecret), encryptedCekNonce);

    let decryptedName: string | null = null;
    // Handle both share.item.encryptedName/nameSalt and share.encrypted_filename/nonce_filename
    const encName = (share.item && share.item.encryptedName) || share.encrypted_filename || share.encryptedFilename;
    const nameSalt = (share.item && share.item.nameSalt) || share.nonce_filename || share.nonceFilename || share.nameSalt;
    if (encName && nameSalt) {
      try {
        const nameBytes = decryptDataLocal(encName, cek, nameSalt);
        decryptedName = new TextDecoder().decode(nameBytes);
      } catch (e) {
        decryptedName = null;
      }
    }

    // Transfer cek buffer back as ArrayBuffer for efficient transfer
    const cekBuf = cek.buffer ? cek.buffer.slice(cek.byteOffset, cek.byteOffset + cek.byteLength) : new Uint8Array(cek).buffer;

    self.postMessage({ id, success: true, result: { cek: cekBuf, name: decryptedName } }, [cekBuf]);
  } catch (err: any) {
    self.postMessage({ id, success: false, error: err?.message || String(err) });
  }
};
