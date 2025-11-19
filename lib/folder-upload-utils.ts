/**
 * Folder Upload Utilities
 * Handles extraction of folder structure from dropped/selected files and
 * creates the necessary folder hierarchy for uploads
 */

import { apiClient } from './api';
import { encryptFilename, createSignedFolderManifest, decryptFilename } from './crypto';
import { keyManager } from './key-manager';
import { masterKeyManager } from './master-key';

export interface FolderStructure {
  [folderPath: string]: File[];
}

export interface FolderHierarchy {
  folderPath: string;
  parentFolderId: string | null;
  folderName: string;
}

export interface CreatedFolder {
  id: string;
  name: string;
  encryptedName: string;
  nameSalt: string;
  parentId: string | null;
  path: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Extract folder structure from FileList with webkitRelativePath support
 * Groups files by their folder path
 */
export function extractFolderStructure(files: FileList): FolderStructure {
  const structure: FolderStructure = {};

  Array.from(files).forEach(file => {
    // Get the folder path from webkitRelativePath
    const relativePath = (file as any).webkitRelativePath || '';
    
    if (!relativePath) {
      // Regular file without folder structure
      structure[''] = structure[''] || [];
      structure[''].push(file);
      return;
    }

    // Extract folder path (everything except the filename)
    const parts = relativePath.split('/');
    const folderPath = parts.slice(0, -1).join('/');
    const fileName = parts[parts.length - 1];

    // Group files by folder
    if (!structure[folderPath]) {
      structure[folderPath] = [];
    }
    structure[folderPath].push(file);
  });

  return structure;
}

/**
 * Create folder hierarchy in the backend
 * Returns mapping of folder paths to folder IDs
 * Encrypts folder names and signs manifests for zero-knowledge security
 * Calls onFolderCreated callback immediately when each folder is created
 */
export async function createFolderHierarchy(
  folderStructure: FolderStructure,
  baseFolderId: string | null = null,
  onFolderCreated?: (folder: CreatedFolder) => void
): Promise<Map<string, string | null>> {
  const folderMap = new Map<string, string | null>();
  
  if (baseFolderId) {
    folderMap.set('', baseFolderId); // Root folder mapping
  } else {
    folderMap.set('', null); // Root is null for root folder
  }

  // Get user keys for encryption and signing
  const userKeys = await keyManager.getUserKeys();

  // Get master key for decryption (for display purposes)
  let masterKey: Uint8Array | null = null;
  try {
    masterKey = masterKeyManager.getMasterKey();
  } catch (err) {
    console.warn('Could not retrieve master key for folder name decryption', err);
  }

  // Sort folder paths by depth to create parents before children
  const sortedPaths = Object.keys(folderStructure)
    .filter(path => path !== '') // Skip root
    .sort((a, b) => a.split('/').length - b.split('/').length);

  // Create folders in order (parents before children ensures parent IDs exist)
  for (const folderPath of sortedPaths) {
    const parts = folderPath.split('/');
    const folderName = parts[parts.length - 1];
    const parentPath = parts.slice(0, -1).join('/');
    const parentFolderId = folderMap.get(parentPath) || baseFolderId || null;

    try {
      // Create signed folder manifest
      // Note: createSignedFolderManifest handles encryption internally
      const manifestData = await createSignedFolderManifest(
        folderName,
        parentFolderId,
        {
          ed25519PrivateKey: userKeys.keypairs.ed25519PrivateKey,
          ed25519PublicKey: userKeys.keypairs.ed25519PublicKey,
          dilithiumPrivateKey: userKeys.keypairs.dilithiumPrivateKey,
          dilithiumPublicKey: userKeys.keypairs.dilithiumPublicKey
        }
      );

      // Create folder with encrypted name and signed manifest
      // manifestData contains manifestHash, signatures, and encryptedName/nameSalt
      const folderId = crypto.randomUUID(); // Generate folderId client-side for idempotency
      const response = await apiClient.createFolder({
        encryptedName: manifestData.encryptedName,
        nameSalt: manifestData.nameSalt,
        parentId: parentFolderId,
        manifestHash: manifestData.manifestHash,
        manifestCreatedAt: manifestData.manifestCreatedAt,
        manifestSignatureEd25519: manifestData.manifestSignatureEd25519,
        manifestPublicKeyEd25519: manifestData.manifestPublicKeyEd25519,
        manifestSignatureDilithium: manifestData.manifestSignatureDilithium,
        manifestPublicKeyDilithium: manifestData.manifestPublicKeyDilithium,
        algorithmVersion: manifestData.algorithmVersion,
        nameHmac: manifestData.nameHmac,
        clientFolderId: folderId // Pass client-generated folderId for idempotency
      });

      if (response.success && response.data?.id) {
        folderMap.set(folderPath, response.data.id);
        
        // Immediately notify about folder creation with plaintext name for UI display
        if (onFolderCreated) {
          onFolderCreated({
            id: response.data.id,
            name: folderName, // Plaintext name for UI display
            encryptedName: manifestData.encryptedName,
            nameSalt: manifestData.nameSalt,
            parentId: parentFolderId,
            path: response.data.path || folderPath,
            createdAt: response.data.createdAt || new Date().toISOString(),
            updatedAt: response.data.updatedAt || new Date().toISOString()
          });
        }
        
        console.log(`✅ Created folder: ${folderPath} (ID: ${response.data.id})`);
      } else {
        console.error(`❌ Failed to create folder: ${folderPath}`, response.error);
        throw new Error(`Failed to create folder: ${folderPath}`);
      }
    } catch (error) {
      console.error(`Error creating folder ${folderPath}:`, error);
      throw error;
    }
  }

  return folderMap;
}

/**
 * Get the folder ID for a given file's folder path
 */
export function getFolderIdForFile(folderPath: string, folderMap: Map<string, string | null>): string | null {
  return folderMap.get(folderPath) || null;
}

/**
 * Prepare files for upload with their correct folder IDs
 * Returns array of {file, folderId} pairs
 * Calls onFolderCreated callback immediately when folders are created
 */
export async function prepareFilesForUpload(
  files: FileList,
  baseFolderId: string | null = null,
  onFolderCreated?: (folder: CreatedFolder) => void
): Promise<Array<{ file: File; folderId: string | null }>> {
  // Extract folder structure from files
  const folderStructure = extractFolderStructure(files);

  // Create folder hierarchy and get folder IDs
  const folderMap = await createFolderHierarchy(folderStructure, baseFolderId, onFolderCreated);

  // Prepare files with their folder IDs
  const filesForUpload: Array<{ file: File; folderId: string | null }> = [];

  Object.entries(folderStructure).forEach(([folderPath, folderFiles]) => {
    const folderId = folderMap.get(folderPath) || null;
    folderFiles.forEach(file => {
      filesForUpload.push({ file, folderId });
    });
  });

  return filesForUpload;
}
