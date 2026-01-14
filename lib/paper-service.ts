import apiClient from './api';
import { masterKeyManager } from './master-key';
import {
    encryptPaperContent,
    decryptPaperContent,
    encryptFilename,
    decryptFilename
} from './crypto';

interface ManifestEntry {
    id: string; // Block ID
    chunkId: string; // ID of the chunk storing this block's content
    hash: string; // SHA-256 hash of the block's content
    iv: string; // Encryption IV
    salt: string; // Encryption Salt
}

interface PaperManifest {
    version: number;
    blocks: ManifestEntry[];
    icon?: string;
}

class PaperService {
    private manifestCache = new Map<string, PaperManifest>();

    /**
     * Helper: Generate SHA-256 Hash of a block to detect changes
     */
    private async hashBlock(block: any): Promise<string> {
        const str = JSON.stringify(block);
        const encoder = new TextEncoder();
        const data = encoder.encode(str);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Create a new paper
     */
    async createPaper(
        title: string,
        content: unknown,
        folderId: string | null
    ): Promise<string> {
        try {
            const masterKey = masterKeyManager.getMasterKey();

            // 1. Encrypt Title
            const { encryptedFilename, filenameSalt } = await encryptFilename(title, masterKey);

            // 2. Prepare Initial Block (Chunk 1)
            const defaultContent = [{ id: crypto.randomUUID(), type: 'p', children: [{ text: '' }] }];
            const initialBlock = (content as any[])?.[0] || defaultContent[0];

            // Ensure ID exists
            if (!initialBlock.id) initialBlock.id = crypto.randomUUID();

            const blockStr = JSON.stringify(initialBlock);
            const { encryptedContent, iv, salt } = await encryptPaperContent(blockStr, masterKey);
            const blockHash = await this.hashBlock(initialBlock);
            const chunkId = crypto.randomUUID();

            // 3. Prepare Manifest (Chunk 0)
            const manifest: PaperManifest = {
                version: 1,
                blocks: [{
                    id: initialBlock.id,
                    chunkId: chunkId,
                    hash: blockHash,
                    iv,
                    salt
                }]
            };

            // Send to API (Basic file creation, followed by savePaper for blocks)

            // Step A: Create the "File" entry (Legacy API)
            // We pass empty content to create just the file record + Chunk 0 (which we will overwrite immediately)
            const response = await apiClient.createPaper({
                folderId,
                encryptedTitle: encryptedFilename,
                titleSalt: filenameSalt,
                encryptedContent: '', // Placeholder
                iv: '',
                salt: ''
            });

            if (!response.success || !response.data) {
                throw new Error(response.error || 'Failed to create paper');
            }

            const paperId = response.data.id;

            // Step B: Immediately Save with correct Block Structure
            await this.savePaper(paperId, [initialBlock], title);

            return paperId;
        } catch (err) {
            console.error('Paper creation failed:', err);
            throw err;
        }
    }

    /**
     * Save/Update an existing paper using Block-Level Diffing
     */
    async savePaper(
        paperId: string,
        content: unknown,
        title?: string
    ): Promise<void> {
        try {
            const masterKey = masterKeyManager.getMasterKey();
            const updateData: any = {};
            console.log('[PaperService] savePaper called for:', paperId, 'Content Type:', typeof content);

            // Handle wrapped content (from frontend: { content: blocks, icon: string })
            let contentBlocks: any[] = [];
            let icon: string | undefined = undefined;

            if (content && typeof content === 'object' && !Array.isArray(content) && 'content' in content) {
                contentBlocks = (content as any).content;
                icon = (content as any).icon;
            } else if (Array.isArray(content)) {
                contentBlocks = content;
            }

            // 1. Encrypt Title if provided
            if (title !== undefined) {
                const { encryptedFilename, filenameSalt } = await encryptFilename(title, masterKey);
                updateData.encryptedTitle = encryptedFilename;
                updateData.titleSalt = filenameSalt;
            }

            // 2. Block-Level Diffing
            if (content !== undefined && Array.isArray(contentBlocks)) {
                let currentManifest = this.manifestCache.get(paperId);

                // If no manifest cached (e.g. freshly created or page removed), start empty
                if (!currentManifest) {
                    currentManifest = { version: 1, blocks: [] };
                }

                const newManifestBlocks: ManifestEntry[] = [];
                const chunksToUpload: { chunkId: string; content: string; size: number }[] = [];
                const existingChunkIds = new Set(currentManifest.blocks.map(b => b.chunkId));

                const seenIds = new Set<string>();

                // Process each block in the new content
                console.log('[PaperService] Processing blocks:', contentBlocks?.length);
                for (const block of contentBlocks) {
                    // Ensure Block ID is unique
                    if (!block.id || seenIds.has(block.id)) block.id = crypto.randomUUID();
                    seenIds.add(block.id);

                    const blockHash = await this.hashBlock(block);

                    // Check if block exists and is unchanged
                    const existingEntry = currentManifest.blocks.find(b => b.id === block.id);

                    if (existingEntry && existingEntry.hash === blockHash) {
                        // UNCHANGED: Keep existing entry
                        newManifestBlocks.push(existingEntry);
                        existingChunkIds.delete(existingEntry.chunkId); // Mark as "kept"
                    } else {
                        // NEW or MODIFIED: Encrypt and Upload
                        const blockStr = JSON.stringify(block);
                        const { encryptedContent, iv, salt } = await encryptPaperContent(blockStr, masterKey);

                        // Reuse chunkId if modified, or new if new block
                        const chunkId = existingEntry ? existingEntry.chunkId : crypto.randomUUID();

                        // Add to upload queue
                        // Backend expects: Object (will be stringified by backend before storage)
                        const payload = { encryptedContent, iv, salt };
                        chunksToUpload.push({
                            chunkId,
                            content: payload as any, // Send as object
                            size: new Blob([JSON.stringify(payload)]).size
                        });

                        newManifestBlocks.push({
                            id: block.id,
                            chunkId,
                            hash: blockHash,
                            iv,
                            salt
                        });

                        if (existingEntry) existingChunkIds.delete(existingEntry.chunkId);
                    }
                }

                // Identify Deleted Chunks (Chunks in old manifest that are NOT in new manifest)
                // Any chunkId remaining in existingChunkIds is effectively "orphaned" by this version.
                // We should add them to a delete list.
                const chunksToDelete = Array.from(existingChunkIds);

                // Prepare Manifest Chunk (Chunk 0)
                const newManifest: PaperManifest = {
                    version: 1,
                    blocks: newManifestBlocks,
                    icon: icon !== undefined ? icon : currentManifest.icon
                };

                // Update Cache
                this.manifestCache.set(paperId, newManifest);

                // Encrypt Manifest
                const manifestStr = JSON.stringify(newManifest);
                const { encryptedContent: encManifest, iv: ivManifest, salt: saltManifest } = await encryptPaperContent(manifestStr, masterKey);
                const manifestPayload = {
                    encryptedContent: encManifest,
                    iv: ivManifest,
                    salt: saltManifest,
                    isManifest: true
                };

                // Add Manifest to Uploads (Always replace Chunk 0)
                // We use a special API field or just chunk-0 convention
                updateData.manifest = manifestPayload;
                updateData.chunksToUpload = chunksToUpload;
                updateData.chunksToDelete = chunksToDelete;
            }

            if (Object.keys(updateData).length === 0) {
                console.log('[PaperService] No changes to save.');
                return;
            }

            // 3. Send to API
            console.log('[PaperService] Sending updateData:', JSON.stringify(updateData, null, 2));
            // Note: We need to update the backend to support `chunksToUpload` and `chunksToDelete`
            const response = await apiClient.savePaperBlocks(paperId, updateData); // Using a generalized endpoint or update existing

            if (!response.success) {
                throw new Error(response.error || 'Failed to save paper');
            }
        } catch (err) {
            console.error('Paper save failed:', err);
            throw err;
        }
    }

    /**
     * Get and decrypt a paper (Re-assemble blocks)
     */
    async getPaper(paperId: string): Promise<{
        id: string;
        title: string;
        content: any; // Returns { content: blocks, icon: string }
        folderId: string | null;
        createdAt: string;
        updatedAt: string;
    }> {
        const response = await apiClient.getPaper(paperId);
        if (!response.success || !response.data) {
            throw new Error(response.error || 'Failed to fetch paper');
        }

        const paper = response.data;
        console.log('[PaperService] getPaper response:', paper);
        const masterKey = masterKeyManager.getMasterKey();

        // 1. Decrypt Title
        let title = 'Untitled Paper';
        try {
            if (paper.encryptedTitle && paper.titleSalt) {
                title = await decryptFilename(paper.encryptedTitle, paper.titleSalt, masterKey);
            }
        } catch (e) {
            console.error('Failed to decrypt title', e);
            title = 'Decryption Error';
        }

        // 2. Decrypt Content (Manifest -> Blocks)
        let content: any[] = [];
        try {
            let manifest: PaperManifest | null = null;

            // Attempt to parse Chunk 0 as Manifest
            if (paper.encryptedContent && paper.iv && paper.salt) {
                const decryptedStr = await decryptPaperContent(paper.encryptedContent, paper.iv, paper.salt, masterKey);
                if (decryptedStr) {
                    const parsed = JSON.parse(decryptedStr);
                    // Check signature
                    if (parsed.version && Array.isArray(parsed.blocks)) {
                        manifest = parsed as PaperManifest;
                    } else {
                        console.warn("Paper has corrupted or invalid manifest.");
                        throw new Error("Invalid paper format: Missing Manifest.");
                    }
                }
            } else {
                manifest = { version: 1, blocks: [] };
            }

            if (manifest) {
                // Cache Manifest
                this.manifestCache.set(paperId, manifest);

                // Rebundle Chunks into Blocks
                const chunks = paper.chunks || {};
                const blocks: any[] = [];

                // Sort by manifest order
                for (const entry of manifest.blocks) {
                    const chunkData = chunks[entry.chunkId];
                    if (chunkData) {
                        try {
                            const blockStr = await decryptPaperContent(chunkData.encryptedContent, chunkData.iv, chunkData.salt, masterKey);
                            if (blockStr) {
                                blocks.push(JSON.parse(blockStr));
                            }
                        } catch (err) {
                            console.error(`Failed to decrypt block ${entry.id}`, err);
                            blocks.push({ id: entry.id, type: 'p', children: [{ text: '[Error Decrypting Block]' }] });
                        }
                    } else {
                        console.warn(`Missing chunk data for block ${entry.id}`);
                    }
                }
                content = blocks;
            }

            return {
                id: paper.id,
                title,
                content: { content, icon: manifest?.icon ?? null }, // Return wrapped object
                folderId: paper.folderId,
                createdAt: paper.createdAt,
                updatedAt: paper.updatedAt
            };
        } catch (e) {
            console.error('Failed to decrypt content', e);
        }

        return {
            id: paper.id,
            title,
            content: { content: [], icon: null },
            folderId: paper.folderId,
            createdAt: paper.createdAt,
            updatedAt: paper.updatedAt
        };
    }
}

export const paperService = new PaperService();
export default paperService;