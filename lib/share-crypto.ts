import { decryptData } from '@/lib/crypto';

// Helper to decrypt filename using share CEK
export async function decryptShareFilename(encryptedFilename: string, nonce: string, shareCek: Uint8Array): Promise<string> {
    try {
        const { xchacha20poly1305 } = await import('@noble/ciphers/chacha.js');

        const encrypted = new Uint8Array(atob(encryptedFilename).split('').map(c => c.charCodeAt(0)));
        const nonceBytes = new Uint8Array(atob(nonce).split('').map(c => c.charCodeAt(0)));

        const cipher = xchacha20poly1305(shareCek, nonceBytes);
        const decryptedBytes = cipher.decrypt(encrypted);

        const decrypted = new TextDecoder().decode(decryptedBytes);
        // Sanitize control characters and any non-printable characters
        const sanitized = decrypted.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();

        // Additional validation
        if (sanitized.length === 0 || sanitized.length > 255) {
            throw new Error('Decrypted filename is empty or too long');
        }

        return sanitized;
    } catch (err) {
        console.warn('Failed to decrypt filename:', err);
        throw err;
    }
}

// Helper to encrypt filename using share CEK (matches decryptShareFilename)
export async function encryptShareFilename(filename: string, shareCek: Uint8Array): Promise<{ encryptedFilename: string; nonce: string }> {
    try {
        const { xchacha20poly1305 } = await import('@noble/ciphers/chacha.js');

        const nonce = new Uint8Array(24);
        crypto.getRandomValues(nonce);

        const filenameBytes = new TextEncoder().encode(filename);
        const cipher = xchacha20poly1305(shareCek, nonce);
        const encryptedBytes = cipher.encrypt(filenameBytes);

        // helper to convert to base64
        const toBase64 = (arr: Uint8Array) => btoa(String.fromCharCode(...arr));

        return {
            encryptedFilename: toBase64(encryptedBytes),
            nonce: toBase64(nonce)
        };
    } catch (err) {
        console.error('Failed to encrypt share filename:', err);
        throw err;
    }
}

// Helper to check if a string looks like encrypted data (base64 format)
export function looksLikeEncryptedName(name: string): boolean {
    if (!name || typeof name !== 'string' || !name.includes(':')) {
        return false;
    }

    const [encPart, noncePart] = name.split(':');

    // Check if both parts are valid base64 (encrypted names have this format)
    try {
        // Base64 regex check - should only contain [A-Za-z0-9+/=]
        const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
        return base64Regex.test(encPart) && base64Regex.test(noncePart);
    } catch {
        return false;
    }
}

// Format: encryptedData:nonce (both base64), salt is used to derive a key from share CEK
export async function decryptManifestItemName(encryptedName: string, nameSalt: string, shareCek: Uint8Array, itemType?: string): Promise<string> {
    try {
        const { xchacha20poly1305 } = await import('@noble/ciphers/chacha.js');

        // Parse encrypted name format: "encryptedData:nonce" (both in base64)
        const [encryptedPart, noncePart] = encryptedName.split(':');
        if (!encryptedPart || !noncePart) {
            // If not in expected format, might be plaintext or differently formatted
            return encryptedName;
        }

        // Decode salt and nonce from base64
        const decodedSalt = new Uint8Array(atob(nameSalt).split('').map(c => c.charCodeAt(0)));
        const nameNonce = new Uint8Array(atob(noncePart).split('').map(c => c.charCodeAt(0)));
        const encryptedBytes = new Uint8Array(atob(encryptedPart).split('').map(c => c.charCodeAt(0)));

        // Derive name-specific key from salt and share CEK using HMAC-SHA256
        // Match the encryption: HMAC(shareCek, salt + 'folder-name-key' or 'file-name-key')
        // If item type is known, use only that variant. Otherwise try both.
        const suffixes = itemType
            ? [itemType === 'folder' ? 'folder-name-key' : 'file-name-key']
            : ['folder-name-key', 'file-name-key'];

        for (const suffix of suffixes) {
            try {
                const suffixBytes = new TextEncoder().encode(suffix);
                const keyMaterial = new Uint8Array(decodedSalt.length + suffixBytes.length);
                keyMaterial.set(decodedSalt, 0);
                keyMaterial.set(suffixBytes, decodedSalt.length);

                const hmacKey = await crypto.subtle.importKey(
                    'raw',
                    shareCek as BufferSource,
                    { name: 'HMAC', hash: 'SHA-256' },
                    false,
                    ['sign']
                );

                const derivedKeyMaterial = await crypto.subtle.sign('HMAC', hmacKey, keyMaterial);
                const nameKey = new Uint8Array(derivedKeyMaterial.slice(0, 32));

                // Try to decrypt with this key
                const decryptedBytes = xchacha20poly1305(nameKey, nameNonce).decrypt(encryptedBytes);
                const decrypted = new TextDecoder().decode(decryptedBytes);

                // Sanitize control characters and any non-printable characters that can cause display issues
                // Remove all control characters (0x00-0x1F, 0x7F-0x9F) and any other problematic chars
                const sanitized = decrypted.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();

                // Additional check: ensure the result contains only valid characters
                if (sanitized.length === 0 || sanitized.length > 255) {
                    throw new Error('Decrypted name is empty or too long');
                }

                return sanitized;
            } catch (e) {
                // Try next suffix
                if (itemType) throw e; // If we know the type and it fails, don't try others
                continue;
            }
        }

        // If both attempts failed
        throw new Error('Could not decrypt with either key variant');
    } catch (err) {
        console.error('Failed to decrypt manifest item name:', err);
        // Return truncated encrypted name as fallback
        return encryptedName.substring(0, 30) + '...';
    }
}

// Helper to decrypt entire encrypted manifest (pre-encrypted on frontend)
export async function decryptEncryptedManifest(
    encryptedManifestData: string | { encryptedData: string; nonce: string },
    shareCek: Uint8Array
): Promise<Record<string, unknown>> {
    try {
        // Handle both formats: object (new) or JSON string (legacy)
        let encryptedData: string;
        let nonce: string;

        if (typeof encryptedManifestData === 'string') {
            // Legacy format: JSON string containing { encryptedData, nonce }
            const parsed = JSON.parse(encryptedManifestData);
            encryptedData = parsed.encryptedData;
            nonce = parsed.nonce;
        } else {
            // New format: object directly
            encryptedData = encryptedManifestData.encryptedData;
            nonce = encryptedManifestData.nonce;
        }

        if (!encryptedData || !nonce) {
            throw new Error('Invalid encrypted manifest structure - missing encryptedData or nonce');
        }

        // Decrypt the entire manifest JSON with share CEK
        const decryptedManifestBytes = decryptData(encryptedData, shareCek, nonce);
        const manifestJson = new TextDecoder().decode(decryptedManifestBytes);
        const manifest = JSON.parse(manifestJson);

        // Now decrypt individual item names using the salt and derived keys
        const decryptedManifest: Record<string, Record<string, unknown>> = {};

        for (const [itemId, item] of Object.entries(manifest)) {
            const manifestItem = item as Record<string, unknown>;
            let decryptedName = itemId;

            // Try to get a plaintext name if available and a string
            if (typeof manifestItem.name === 'string') {
                decryptedName = manifestItem.name as string;
            }

            // Try to decrypt the name if it looks encrypted (contains : and has salt)
            if (typeof manifestItem.name === 'string' && (manifestItem.name as string).includes(':') && manifestItem.name_salt) {
                try {
                    decryptedName = await decryptManifestItemName(manifestItem.name as string, manifestItem.name_salt as string, shareCek);
                } catch (decryptErr) {
                    console.warn(`Failed to decrypt name for ${itemId}:`, decryptErr);
                }
            }

            // Ensure id is always present
            decryptedManifest[itemId] = {
                id: itemId, // Ensure id field is set
                ...manifestItem,
                name: decryptedName
            } as Record<string, unknown>;
        }
        return decryptedManifest;
    } catch (err) {
        console.error('Failed to decrypt encrypted manifest:', err);
        throw err;
    }
}

// Derive password key and decrypt share CEK
export async function verifySharePassword(password: string, saltPw: string): Promise<Uint8Array> {
    // Parse the salt:nonce:ciphertext format with XChaCha20-Poly1305
    const parts = saltPw.split(':');
    if (parts.length !== 3) {
        throw new Error('Invalid password data format');
    }

    const [saltB64, nonceB64, ciphertextB64] = parts;

    // Decode salt, nonce, and ciphertext from base64
    const salt = new Uint8Array(atob(saltB64).split('').map(c => c.charCodeAt(0)));
    const nonce = new Uint8Array(atob(nonceB64).split('').map(c => c.charCodeAt(0)));
    const ciphertext = new Uint8Array(atob(ciphertextB64).split('').map(c => c.charCodeAt(0)));

    // Derive password key using PBKDF2
    // Derive raw bits from password using PBKDF2 (256 bits)
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(password),
        'PBKDF2',
        false,
        ['deriveBits']
    );
    const derivedBits = await crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: 100000,
            hash: 'SHA-256'
        },
        keyMaterial,
        256
    );
    const derivedBytes = new Uint8Array(derivedBits);

    // Use first 32 bytes for XChaCha20
    const xchachaKey = derivedBytes.slice(0, 32);

    // Decrypt share CEK using XChaCha20-Poly1305
    const { xchacha20poly1305 } = await import('@noble/ciphers/chacha.js');
    const shareCekBytes = xchacha20poly1305(xchachaKey, nonce).decrypt(ciphertext);
    const shareCek = new Uint8Array(shareCekBytes);

    if (shareCek.length !== 32) {
        throw new Error('Invalid decrypted share key');
    }

    return shareCek;
}

// Decrypt attachment content
export async function decryptAttachment(
    encryptedBlob: Blob,
    shareCek: Uint8Array,
    nonce: string
): Promise<Blob> {
    try {
        const { xchacha20poly1305 } = await import('@noble/ciphers/chacha.js');

        // Convert Blob to Uint8Array
        const encryptedBytes = new Uint8Array(await encryptedBlob.arrayBuffer());

        // Decode Nonce (base64)
        const nonceBytes = new Uint8Array(atob(nonce).split('').map(c => c.charCodeAt(0)));

        // Decrypt
        const cipher = xchacha20poly1305(shareCek, nonceBytes);
        const decryptedBytes = cipher.decrypt(encryptedBytes);

        return new Blob([decryptedBytes as any]);
    } catch (err) {
        console.error('Failed to decrypt attachment:', err);
        throw err;
    }
}

// Encrypt attachment content
export async function encryptAttachment(
    file: File,
    shareCek: Uint8Array
): Promise<{ encryptedBlob: Blob; nonce: string }> {
    try {
        const { xchacha20poly1305 } = await import('@noble/ciphers/chacha.js');

        // Generate Nonce (24 bytes for XChaCha)
        const nonce = new Uint8Array(24);
        crypto.getRandomValues(nonce);

        // Read file bytes
        const fileBytes = new Uint8Array(await file.arrayBuffer());

        // Encrypt
        const cipher = xchacha20poly1305(shareCek, nonce);
        const encryptedBytes = cipher.encrypt(fileBytes);

        // Encode Nonce to base64
        const toBase64 = (arr: Uint8Array) => btoa(String.fromCharCode(...arr));

        return {
            encryptedBlob: new Blob([encryptedBytes as any]),
            nonce: toBase64(nonce)
        };
    } catch (err) {
        console.error('Failed to encrypt attachment:', err);
        throw err;
    }
}
