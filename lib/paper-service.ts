import apiClient from './api';
import {
    generateKeyDerivationSalt,
    encryptData,
    encryptFilename,
    uint8ArrayToHex
} from './crypto';
import { sha256 } from '@noble/hashes/sha256.js';
// Note: We need masterKey directly or via KeyManager
import { masterKeyManager } from './master-key';
import type { UserKeypairs } from './key-manager';

class PaperService {
    /**
     * Encrypt and Save Paper Content
     * Updates an existing file with new content (overwrites)
     */
    async savePaper(
        fileId: string,
        content: any,
        keypairs: UserKeypairs
    ): Promise<void> {
        try {
            const contentStr = JSON.stringify(content);
            const contentBytes = new TextEncoder().encode(contentStr);
            const fileSize = contentBytes.length;
            const chunkSize = 4 * 1024 * 1024; // 4MB

            // 1. Prepare Encryption Logic (Fresh Keys for Security)
            const masterKey = masterKeyManager.getMasterKey();
            const fileKey = new Uint8Array(32);
            crypto.getRandomValues(fileKey);

            const fileNoncePrefix = new Uint8Array(12);
            crypto.getRandomValues(fileNoncePrefix);
            const fileNoncePrefixHex = uint8ArrayToHex(fileNoncePrefix); // Use helper

            const kyberPubHex = keypairs.kyberPublicKey;

            const wrappedCekData = encryptData(fileKey, masterKey);
            const sessionSalt = generateKeyDerivationSalt();

            const encryptionIv = '00'; // Not used in XChaCha20 but kept for schema

            // 2. Initialize Update Session
            const chunkCount = Math.ceil(fileSize / chunkSize);

            // Dummy filename for metadata compatibility
            const { encryptedFilename, filenameSalt } = await encryptFilename('paper_update', masterKey);

            const initResponse = await apiClient.initializePaperUpdate(fileId, {
                encryptedFilename,
                filenameSalt,
                fileSize,
                chunkCount,
                encryptionIv,
                wrappedCek: wrappedCekData.encryptedData,
                fileNoncePrefix: fileNoncePrefixHex,
                kyberPublicKey: kyberPubHex,
                kyberCiphertext: '', // TODO: proper PQC wrap
                nonceWrapKyber: wrappedCekData.nonce,
                sessionSalt,
                argon2idParams: {}
            });

            if (!initResponse.success || !initResponse.data) {
                throw new Error(initResponse.error || 'Failed to initialize save');
            }

            const { sessionId, encryptionMetadataId, presigned } = initResponse.data;

            // 3. Encrypt and Upload Chunks
            const sha256Hasher = sha256.create();
            sha256Hasher.update(contentBytes);
            const finalShaHash = uint8ArrayToHex(sha256Hasher.digest());

            // Create chunks
            for (let i = 0; i < chunkCount; i++) {
                const start = i * chunkSize;
                const end = Math.min(start + chunkSize, fileSize);
                const chunkData = contentBytes.slice(start, end);

                const encryptedChunk = encryptData(chunkData, fileKey);

                // Upload to B2
                const target = presigned.find(p => p.index === i);
                if (!target) throw new Error(`No presigned URL for chunk ${i}`);

                await fetch(target.putUrl, {
                    method: 'PUT',
                    body: new Uint8Array(Buffer.from(encryptedChunk.encryptedData, 'base64')), // decode base64 back to bytes for upload
                });

                await apiClient.confirmChunkUploads(sessionId, {
                    chunks: [{
                        index: i,
                        chunkSize: encryptedChunk.encryptedData.length,
                        nonce: encryptedChunk.nonce
                    }]
                });
            }

            // 4. Finalize
            await apiClient.finalizePaperUpdate(fileId, {
                sessionId,
                encryptionMetadataId,
                finalShaHash
            });

        } catch (error) {
            console.error('Save Paper Error:', error);
            throw error;
        }
    }
}

export const paperService = new PaperService();
