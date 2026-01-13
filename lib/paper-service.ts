import apiClient from './api';
import { masterKeyManager } from './master-key';
import {
    encryptPaperContent,
    decryptPaperContent,
    encryptFilename,
    decryptFilename
} from './crypto';

class PaperService {
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

            // 2. Encrypt Content
            const defaultContent = [{ type: 'p', children: [{ text: '' }] }];
            const contentStr = JSON.stringify(content || defaultContent);
            const { encryptedContent, iv, salt } = await encryptPaperContent(contentStr, masterKey);

            // 3. Send to API
            const response = await apiClient.createPaper({
                folderId,
                encryptedTitle: encryptedFilename,
                titleSalt: filenameSalt,
                encryptedContent: encryptedContent,
                iv,
                salt
            });

            if (!response.success || !response.data) {
                throw new Error(response.error || 'Failed to create paper');
            }

            return response.data.id;
        } catch (err) {
            console.error('Paper creation failed:', err);
            throw err;
        }
    }

    /**
     * Save/Update an existing paper
     */
    async savePaper(
        paperId: string,
        content: unknown,
        title?: string
    ): Promise<void> {
        try {
            const masterKey = masterKeyManager.getMasterKey();
            const updateData: any = {};

            // 1. Encrypt Content if provided
            if (content !== undefined) {
                const contentStr = JSON.stringify(content);
                const { encryptedContent, iv, salt } = await encryptPaperContent(contentStr, masterKey);
                updateData.encryptedContent = encryptedContent;
                updateData.iv = iv;
                updateData.salt = salt;
            }

            // 2. Encrypt Title if provided
            if (title !== undefined) {
                const { encryptedFilename, filenameSalt } = await encryptFilename(title, masterKey);
                updateData.encryptedTitle = encryptedFilename;
                updateData.titleSalt = filenameSalt;
            }

            if (Object.keys(updateData).length === 0) {
                return; // Nothing to update
            }

            // 3. Send to API
            const response = await apiClient.savePaper(paperId, updateData);

            if (!response.success) {
                throw new Error(response.error || 'Failed to save paper');
            }
        } catch (err) {
            console.error('Paper save failed:', err);
            throw err;
        }
    }

    /**
     * Move a paper to trash (soft delete)
     */
    async deletePaper(paperId: string): Promise<void> {
        const response = await apiClient.movePaperToTrash(paperId);
        if (!response.success) {
            throw new Error(response.error || 'Failed to move paper to trash');
        }
    }

    /**
     * Permanently delete a paper
     */
    async deletePaperPermanently(paperId: string): Promise<void> {
        const response = await apiClient.deletePaper(paperId);
        if (!response.success) {
            throw new Error(response.error || 'Failed to delete paper permanently');
        }
    }

    /**
     * Get and decrypt a paper
     */
    async getPaper(paperId: string): Promise<{
        id: string;
        title: string;
        content: any;
        folderId: string | null;
        createdAt: string;
        updatedAt: string;
    }> {
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

        // 2. Decrypt Content
        let content = {};
        try {
            if (paper.encryptedContent && paper.iv && paper.salt) {
                const contentStr = await decryptPaperContent(paper.encryptedContent, paper.iv, paper.salt, masterKey);
                if (contentStr) {
                    content = JSON.parse(contentStr);
                }
            }
        } catch (e) {
            console.error('Failed to decrypt content', e);
            // Return empty content but don't crash, allowing user to maybe see the title
        }

        return {
            id: paper.id,
            title,
            content,
            folderId: paper.folderId,
            createdAt: paper.createdAt,
            updatedAt: paper.updatedAt
        };
    }
}

export const paperService = new PaperService();
export default paperService;
