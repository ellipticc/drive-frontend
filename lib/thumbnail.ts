import Compressor from 'compressorjs';

export interface ThumbnailResult {
    blob: Blob;
    width: number;
    height: number;
    duration?: number;
}

/**
 * Generate a thumbnail for an image file using CompressorJS
 */
export async function generateImageThumbnail(file: File, maxWidth = 400, maxHeight = 400): Promise<ThumbnailResult> {
    return new Promise((resolve, reject) => {
        new Compressor(file, {
            quality: 0.8,
            maxWidth: maxWidth,
            maxHeight: maxHeight,
            mimeType: 'image/jpeg',
            success(result) {
                // Get original dimensions (approximate from result or reload as image)
                const img = new Image();
                img.onload = () => {
                    resolve({
                        blob: result,
                        width: img.width,
                        height: img.height
                    });
                    URL.revokeObjectURL(img.src);
                };
                img.src = URL.createObjectURL(result);
            },
            error(err) {
                reject(err);
            },
        });
    });
}

/**
 * Generate a thumbnail for a video file
 */
export async function generateVideoThumbnail(file: File, maxWidth = 400, maxHeight = 400): Promise<ThumbnailResult> {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.muted = true;
        video.playsInline = true;

        video.onloadedmetadata = () => {
            // Seek to 1 second (or middle of video)
            const seekTime = Math.min(1, video.duration / 2);
            video.currentTime = seekTime;
        };

        video.onseeked = () => {
            const canvas = document.createElement('canvas');
            let width = video.videoWidth;
            let height = video.videoHeight;

            // Maintain aspect ratio
            if (width > height) {
                if (width > maxWidth) {
                    height *= maxWidth / width;
                    width = maxWidth;
                }
            } else {
                if (height > maxHeight) {
                    width *= maxHeight / height;
                    height = maxHeight;
                }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Failed to get canvas context'));
                return;
            }

            ctx.drawImage(video, 0, 0, width, height);

            canvas.toBlob((blob) => {
                if (blob) {
                    resolve({
                        blob,
                        width: video.videoWidth,
                        height: video.videoHeight,
                        duration: video.duration
                    });
                } else {
                    reject(new Error('Failed to generate video thumbnail blob'));
                }
                URL.revokeObjectURL(video.src);
            }, 'image/jpeg', 0.8);
        };

        video.onerror = (e) => {
            reject(new Error('Failed to load video for thumbnail generation'));
            URL.revokeObjectURL(video.src);
        };

        video.src = URL.createObjectURL(file);
    });
}

/**
 * Main entry point to generate thumbnail based on mime type
 */
export async function generateThumbnail(file: File): Promise<ThumbnailResult | null> {
    const mimeType = file.type;

    try {
        if (mimeType.startsWith('image/')) {
            return await generateImageThumbnail(file);
        } else if (mimeType.startsWith('video/')) {
            return await generateVideoThumbnail(file);
        }
    } catch (error) {
        console.warn('Thumbnail generation failed:', error);
    }

    return null;
}
