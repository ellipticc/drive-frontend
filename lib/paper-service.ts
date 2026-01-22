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
            const defaultContent = [{ id: crypto.randomUUID(), type: 'h1', children: [{ text: '' }] }];
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

    private async hashPayload(payload: string): Promise<string> {
        const msgBuffer = new TextEncoder().encode(payload);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashBase64 = btoa(String.fromCharCode(...hashArray));
        return hashBase64;
    }

    /**
     * Trigger a version snapshot explicitly
     */
    async snapshot(paperId: string, triggerType: 'manual' | 'share' | 'export' | 'close'): Promise<void> {
        try {
            await apiClient.savePaperVersion(paperId, false, triggerType);
        } catch (e) {
            console.error('[PaperService] Snapshot failed', e);
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

            // 2. Block-Level Diffing Setup
            let chunksToUpload: { blockId: string; content: any; size: number; payloadStr?: string; uploaded?: boolean; checksum?: string }[] = [];
            let blocksToDelete: string[] = [];
            let manifestPayload: any = null;
            let newManifest: PaperManifest | null = null;

            if (content !== undefined && Array.isArray(contentBlocks)) {
                let currentManifest = this.manifestCache.get(paperId);

                // If no manifest cached (e.g. freshly created or page removed), start empty
                if (!currentManifest) {
                    currentManifest = { version: 1, blocks: [] };
                }

                const newManifestBlocks: ManifestEntry[] = [];
                const existingChunkIds = new Set(currentManifest.blocks.map(b => b.chunkId));
                const seenIds = new Set<string>();

                // Process each block in the new content
                const blocksToProcess: any[] = [];
                for (const block of contentBlocks) {
                    // Ensure Block ID is unique
                    if (!block.id || seenIds.has(block.id)) block.id = crypto.randomUUID();
                    seenIds.add(block.id);
                    blocksToProcess.push(block);
                }

                await Promise.all(blocksToProcess.map(async (block) => {
                    const blockHash = await this.hashBlock(block);

                    // Check if block exists and is unchanged
                    const existingEntry = currentManifest.blocks.find(b => b.id === block.id);

                    if (existingEntry && existingEntry.hash === blockHash) {
                        // UNCHANGED: Keep existing entry
                        newManifestBlocks.push(existingEntry);
                        existingChunkIds.delete(existingEntry.chunkId); // Mark as "kept"
                    } else {
                        // NEW or MODIFIED: Encrypt
                        const blockStr = JSON.stringify(block);
                        const { encryptedContent, iv, salt } = await encryptPaperContent(blockStr, masterKey);

                        // Reuse chunkId if modified, or new if new block
                        const blockId = existingEntry ? existingEntry.chunkId : crypto.randomUUID();

                        // Add to upload queue
                        // Backend expects: Object (will be stringified by backend before storage)
                        const payload = { encryptedContent, iv, salt };
                        const payloadStr = JSON.stringify(payload);
                        const checksum = await this.hashPayload(payloadStr);

                        chunksToUpload.push({
                            blockId: blockId, // Using blockId now
                            content: payload as any,
                            size: new Blob([payloadStr]).size,
                            payloadStr, // Store stringified for direct upload
                            checksum
                        });

                        newManifestBlocks.push({
                            id: block.id,
                            chunkId: blockId,
                            hash: blockHash,
                            iv,
                            salt
                        });

                        if (existingEntry) existingChunkIds.delete(existingEntry.chunkId);
                    }
                }));

                // Prepare Manifest Chunk (Chunk 0)
                // Note: We need to re-order newManifestBlocks to match contentBlocks order
                const orderedManifestBlocks: ManifestEntry[] = [];
                for (const block of contentBlocks) {
                    const entry = newManifestBlocks.find(b => b.id === block.id);
                    if (entry) orderedManifestBlocks.push(entry);
                }

                // Identify Deleted Chunks
                blocksToDelete = Array.from(existingChunkIds);

                newManifest = {
                    version: 1,
                    blocks: orderedManifestBlocks,
                    icon: icon !== undefined ? icon : currentManifest.icon
                };



                // Encrypt Manifest
                const manifestStr = JSON.stringify(newManifest);
                const { encryptedContent: encManifest, iv: ivManifest, salt: saltManifest } = await encryptPaperContent(manifestStr, masterKey);
                manifestPayload = {
                    encryptedContent: encManifest,
                    iv: ivManifest,
                    salt: saltManifest,
                    isManifest: true,
                    // Hint for backend to enable chunk indexing/synchronization for performance
                    // This only reveals which chunks belong to the paper and their order, 
                    // not their content or block types.
                    blocks: newManifest.blocks.map(b => ({ chunkId: b.chunkId }))
                };
            }

            // If no changes at all (no title update, no content update), return early
            if (Object.keys(updateData).length === 0 && chunksToUpload.length === 0 && blocksToDelete.length === 0 && !manifestPayload) {
                return;
            }

            // 3. Parallel Direct Upload Strategy
            // A. Get Presigned URLs
            if (chunksToUpload.length > 0) {
                try {
                    // Fix: Properly access response data
                    const response = await apiClient.getPaperUploadUrls(paperId, chunksToUpload.map(c => ({ blockId: c.blockId, size: c.size, checksum: c.checksum })));

                    if (response.success && response.data) {
                        const urls = response.data?.urls;
                        if (!urls) throw new Error('No upload URLs returned');

                        // B. Upload to B2 (Parallel)
                        await Promise.all(chunksToUpload.map(async (chunk) => {
                            const url = urls[chunk.blockId];
                            if (url) {
                                if (!chunk.checksum) {
                                    console.error(`[PaperService] Chunk ${chunk.blockId} missing checksum!`);
                                    throw new Error(`Missing checksum for chunk ${chunk.blockId}`);
                                }

                                // Upload the stringified payload directly
                                const body = chunk.payloadStr || JSON.stringify(chunk.content);

                                const headers: Record<string, string> = {
                                    'Content-Type': 'application/x-paper',
                                    'x-amz-checksum-sha256': chunk.checksum
                                };

                                // console.log(`[PaperService] Uploading ${chunk.blockId} to B2 with headers:`, headers);

                                const uploadRes = await fetch(url, {
                                    method: 'PUT',
                                    body: body,
                                    headers: headers
                                });

                                if (!uploadRes.ok) {
                                    const errText = await uploadRes.text();
                                    console.error(`[PaperService] B2 Upload Failed ${uploadRes.status}: ${errText}`);
                                    throw new Error(`B2 Upload Failed: ${uploadRes.statusText}`);
                                }

                                // Mark as uploaded so backend doesn't try to upload again
                                chunk.uploaded = true;
                            }
                        }));
                    }
                } catch (err) {
                    console.error('[PaperService] Failed to get/use upload URLs, falling back to legacy upload', err);
                    // Fallback: Do nothing, let chunksToUpload go to savePaperBlocks as before
                }
            }

            // 4. Send Metadata to API (Commit)
            const finalChunksPayload = chunksToUpload.map(c => {
                const base = { chunkId: c.blockId, size: c.size, uploaded: c.uploaded };
                if (c.uploaded) {
                    return base;
                }
                // If not uploaded, include content for legacy upload
                return { ...base, content: c.content };
            });

            const response = await apiClient.savePaperBlocks(paperId, {
                ...updateData,
                manifest: manifestPayload,
                chunksToUpload: finalChunksPayload,
                chunksToDelete: blocksToDelete
            });

            if (!response.success) {
                throw new Error(response.error || 'Failed to save paper');
            }

            // Update Cache ONLY after successful save
            if (manifestPayload && newManifest) {
                this.manifestCache.set(paperId, newManifest);
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
        // Get paper metadata
        const response = await apiClient.getPaper(paperId);
        if (!response.success || !response.data) {
            throw new Error(response.error || 'Failed to fetch paper');
        }

        const paper = response.data;
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

        // 2. Get presigned download URLs for all chunks
        const urlsResponse = await apiClient.getPaperDownloadUrls(paperId);
        if (!urlsResponse.success || !urlsResponse.data) {
            throw new Error('Failed to get download URLs');
        }

        const { urls, chunks: chunkList } = urlsResponse.data;

        // 3. Download chunks directly from S3 using presigned URLs
        const chunks: Record<string, any> = {};
        await Promise.all(
            Object.entries(urls).map(async ([chunkId, url]) => {
                try {
                    const response = await fetch(url as string);
                    if (!response.ok) {
                        console.error(`Failed to download chunk ${chunkId}: ${response.statusText}`);
                        return;
                    }
                    const text = await response.text();
                    chunks[chunkId] = JSON.parse(text);
                } catch (err) {
                    console.error(`Error downloading chunk ${chunkId}:`, err);
                }
            })
        );

        // 4. Decrypt Content (Manifest -> Blocks)
        let content: any[] = [];
        try {
            let manifest: PaperManifest | null = null;

            // Find chunk 0 (manifest)
            const manifestChunk = chunkList.find((c: any) => c.chunkIndex === 0);
            if (manifestChunk && chunks[manifestChunk.id]) {
                const manifestData = chunks[manifestChunk.id];
                
                if (manifestData.encryptedContent && manifestData.iv && manifestData.salt) {
                    const decryptedStr = await decryptPaperContent(
                        manifestData.encryptedContent,
                        manifestData.iv,
                        manifestData.salt,
                        masterKey
                    );
                    if (decryptedStr) {
                        try {
                            const parsed = JSON.parse(decryptedStr);
                            // Check signature
                            if (parsed.version && Array.isArray(parsed.blocks)) {
                                manifest = parsed as PaperManifest;
                            } else {
                                console.error("[PaperService] CORRUPTED MANIFEST: Decrypted data is not a valid PaperManifest.", parsed);
                                throw new Error("Invalid paper format: Decrypted data is not a manifest.");
                            }
                        } catch (parseErr) {
                            console.error("[PaperService] MANIFEST PARSE ERROR: Decrypted string is not valid JSON.", { decryptedStr });
                            throw parseErr;
                        }
                    } else {
                        console.error("[PaperService] DECRYPTION FAILED: Manifest decrypted to empty string.");
                    }
                }
            } else {
                console.warn("[PaperService] NO MANIFEST DATA: Starting with empty doc.");
                manifest = { version: 1, blocks: [] };
            }

            if (manifest) {
                // Cache Manifest
                this.manifestCache.set(paperId, manifest);

                // Rebuild blocks from manifest
                const blocks: any[] = [];

                // Validate that blocks array exists and is an array
                if (!Array.isArray(manifest.blocks)) {
                    console.error("[PaperService] INVALID MANIFEST: blocks is not an array", manifest);
                    manifest.blocks = [];
                }

                // Process in parallel to speed up recovery
                const blockPromises = manifest.blocks.map(async (entry) => {
                    // Validate entry has required properties
                    if (!entry || !entry.chunkId) {
                        console.error("[PaperService] Invalid block entry:", entry);
                        return { 
                            id: entry?.id || crypto.randomUUID(), 
                            type: 'p', 
                            children: [{ text: '[Invalid block entry]' }] 
                        };
                    }

                    let chunkData = chunks[entry.chunkId];

                    // HEALING LOGIC: If missing, try to fetch individually (Recover from "orphaned index" state)
                    if (!chunkData) {
                        try {
                            console.warn(`[PaperService] Chunk ${entry.chunkId} missing from bulk response. Attempting individual recovery...`);
                            const individualRes = await apiClient.getPaperBlock(paperId, entry.chunkId);
                            if (individualRes.success && individualRes.data) {
                                // New format: { url: presignedUrl }
                                if (individualRes.data.url) {
                                    const blockResponse = await fetch(individualRes.data.url);
                                    if (blockResponse.ok) {
                                        chunkData = await blockResponse.json();
                                    }
                                } else {
                                    // Old format: { encryptedContent, iv, salt }
                                    chunkData = individualRes.data as any;
                                }
                                console.log(`[PaperService] Successfully recovered chunk ${entry.chunkId}`);
                            }
                        } catch (recErr) {
                            console.error(`[PaperService] Recovery failed for chunk ${entry.chunkId}`, recErr);
                        }
                    }

                    if (chunkData) {
                        try {
                            // Validate chunkData has required encryption properties
                            if (!chunkData.encryptedContent || !chunkData.iv || !chunkData.salt) {
                                console.error(`[PaperService] Chunk ${entry.chunkId} missing encryption properties`, chunkData);
                                return { 
                                    id: entry.id || crypto.randomUUID(), 
                                    type: 'p', 
                                    children: [{ text: '[Incomplete chunk data]' }] 
                                };
                            }

                            const blockStr = await decryptPaperContent(chunkData.encryptedContent, chunkData.iv, chunkData.salt, masterKey);
                            if (blockStr) {
                                const parsedBlock = JSON.parse(blockStr);
                                
                                // Ensure the parsed block has a valid structure
                                if (!parsedBlock || typeof parsedBlock !== 'object') {
                                    return { 
                                        id: entry.id || crypto.randomUUID(), 
                                        type: 'p', 
                                        children: [{ text: '' }] 
                                    };
                                }
                                
                                // Ensure children array exists
                                if (!Array.isArray(parsedBlock.children)) {
                                    parsedBlock.children = [{ text: '' }];
                                }
                                
                                return parsedBlock;
                            }
                        } catch (err) {
                            console.error(`Failed to decrypt block ${entry.id}`, err);
                            return { id: entry.id || crypto.randomUUID(), type: 'p', children: [{ text: '[Error Decrypting Block]' }] };
                        }
                    } else {
                        console.warn(`Missing chunk data for block ${entry.id || 'unknown'}`);
                        // Push a placeholder so the editor doesn't lose the block position
                        return {
                            id: entry.id || crypto.randomUUID(),
                            type: 'p',
                            children: [{ text: `[Error: Content for this block is missing in this version]` }]
                        };
                    }
                });

                const resolvedBlocks = await Promise.all(blockPromises);
                
                // Filter out any null/undefined blocks and ensure all have proper structure
                blocks.push(...resolvedBlocks.filter(block => {
                    if (!block || typeof block !== 'object') {
                        console.warn('[PaperService] Filtered out invalid block:', block);
                        return false;
                    }
                    // Ensure children exists
                    if (!Array.isArray(block.children)) {
                        console.warn('[PaperService] Block missing children array, adding default:', block);
                        block.children = [{ text: '' }];
                    }
                    return true;
                }));
                
                content = blocks;
            }

            // Final validation: ensure content is an array of valid blocks
            if (!Array.isArray(content)) {
                console.error('[PaperService] Content is not an array, resetting to default');
                content = [{ id: crypto.randomUUID(), type: 'p', children: [{ text: '' }] }];
            } else if (content.length === 0) {
                console.warn('[PaperService] Content array is empty, adding default block');
                content = [{ id: crypto.randomUUID(), type: 'p', children: [{ text: '' }] }];
            } else {
                // Deep validation: ensure every block has children
                content = content.map(block => {
                    if (!block || typeof block !== 'object') {
                        return { id: crypto.randomUUID(), type: 'p', children: [{ text: '' }] };
                    }
                    if (!Array.isArray(block.children)) {
                        block.children = [{ text: '' }];
                    }
                    // Ensure children are valid
                    block.children = block.children.map((child: any) => {
                        if (!child || typeof child !== 'object') {
                            return { text: '' };
                        }
                        // If it's a nested block, ensure it has children
                        if ('children' in child && !Array.isArray(child.children)) {
                            child.children = [{ text: '' }];
                        }
                        return child;
                    });
                    return block;
                });
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
            // Return safe fallback with valid block structure
            return {
                id: paper.id,
                title,
                content: { 
                    content: [{ id: crypto.randomUUID(), type: 'p', children: [{ text: '[Error loading paper content]' }] }], 
                    icon: null 
                },
                folderId: paper.folderId,
                createdAt: paper.createdAt,
                updatedAt: paper.updatedAt
            };
        }

        return {
            id: paper.id,
            title,
            content: { 
                content: [{ id: crypto.randomUUID(), type: 'p', children: [{ text: '' }] }], 
                icon: null 
            },
            folderId: paper.folderId,
            createdAt: paper.createdAt,
            updatedAt: paper.updatedAt
        };
    }
    async getPaperVersion(fileId: string, versionId: string): Promise<any> {
        try {
            const masterKey = masterKeyManager.getMasterKey();

            // 1. Fetch Version Data (includes manifest content + all block URLs)
            const response = await apiClient.getPaperVersion(fileId, versionId);
            if (!response.success || !response.data) {
                throw new Error(response.error || 'Failed to fetch paper version');
            }

            const paperData = response.data;
            const blockUrls = paperData.blockUrls || {}; // Presigned URLs for all blocks

            let manifest: PaperManifest;

            if (paperData.encryptedContent && paperData.iv && paperData.salt) {
                const manifestStr = await decryptPaperContent(
                    paperData.encryptedContent,
                    paperData.iv,
                    paperData.salt,
                    masterKey
                );
                manifest = JSON.parse(manifestStr);
            } else {
                throw new Error("Version Manifest or encryption params missing");
            }

            // 2. Download and decrypt all blocks in parallel using presigned URLs
            const blockPromises = manifest.blocks.map(async (entry) => {
                const blockUrl = blockUrls[entry.chunkId];

                if (!blockUrl) {
                    console.warn(`[getPaperVersion] No URL for block ${entry.chunkId}`);
                    return {
                        id: entry.id,
                        type: 'p',
                        children: [{ text: '[Error: Block URL missing]' }]
                    };
                }

                try {
                    // Download block directly from S3
                    const blockResponse = await fetch(blockUrl);
                    if (!blockResponse.ok) {
                        throw new Error(`Failed to download block: ${blockResponse.statusText}`);
                    }

                    const chunkData = await blockResponse.json();

                    // Decrypt block content
                    const decryptedBlockStr = await decryptPaperContent(
                        chunkData.encryptedContent,
                        chunkData.iv || chunkData.nonce || '',
                        chunkData.salt,
                        masterKey
                    );
                    return JSON.parse(decryptedBlockStr);
                } catch (e) {
                    console.error(`Failed to decrypt block ${entry.id}`, e);
                    return {
                        id: entry.id,
                        type: 'p',
                        children: [{ text: '[Error: Failed to decrypt this block]' }]
                    };
                }
            });

            const blocks = await Promise.all(blockPromises);

            return {
                id: fileId,
                title: (paperData.encryptedTitle && paperData.titleSalt)
                    ? await decryptFilename(paperData.encryptedTitle, paperData.titleSalt, masterKey)
                    : 'Untitled Version',
                content: blocks,
                versionId: versionId
            };

        } catch (err) {
            console.error('PaperService getPaperVersion Error:', err);
            throw err;
        }
    }
}

export const paperService = new PaperService();
export default paperService;