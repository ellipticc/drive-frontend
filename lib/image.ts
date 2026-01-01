import Compressor from 'compressorjs';

/**
 * Image compression utilities for avatars
 */

/**
 * Compresses an image file to a fixed format and size for deterministic hashing.
 * Output: JPEG, 512x512 max, 0.8 quality.
 */
export async function compressAvatar(file: File): Promise<Blob | File> {
    return new Promise((resolve, reject) => {
        new Compressor(file, {
            quality: 0.8,
            maxWidth: 512,
            maxHeight: 512,
            mimeType: 'image/jpeg',
            success(result) {
                resolve(result);
            },
            error(err) {
                console.error('Compression error:', err.message);
                reject(err);
            },
        });
    });
}
