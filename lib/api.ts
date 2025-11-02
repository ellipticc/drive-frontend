const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://drive.ellipticc.com/api/v1';

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
}

export interface FileItem {
  id: string;
  name: string; // Display name (encrypted filename for files, plain name for folders)
  filename?: string; // Original filename (only for files)
  size?: number; // Only for files
  mimeType?: string; // Only for files
  folderId?: string | null; // Only for files
  parentId?: string | null; // Only for folders
  path?: string; // Only for folders
  type: 'file' | 'folder';
  createdAt: string;
  updatedAt: string;
  sha256Hash?: string; // Only for files
  sessionSalt?: string;
  is_shared?: boolean; // Whether this file/folder is currently shared
  encryption?: {
    iv: string;
    salt: string;
    sessionSalt?: string;
    wrappedCek: string;
    fileNoncePrefix: string;
    cekNonce: string;
    nonceWrapClassical: string;
  };
  // Flat properties for backward compatibility
  encryptionIv?: string;
  encryptionSalt?: string;
  wrappedCek?: string;
  fileNoncePrefix?: string;
}

class ApiClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Math.floor(Date.now() / 1000);
      return payload.exp < currentTime;
    } catch (error) {
      // If we can't decode the token, consider it expired
      return true;
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;

    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    // Add authorization header if token exists
    const token = this.getToken();
    if (token) {
      // Check if token is expired
      if (this.isTokenExpired(token)) {
        // Token is expired, clear it and redirect to login
        this.clearToken();
        if (typeof window !== 'undefined') {
          localStorage.removeItem('master_key');
          localStorage.removeItem('account_salt');
          localStorage.removeItem('viewMode');
          window.location.href = '/login';
        }
        return {
          success: false,
          error: 'Session expired. Please log in again.',
        };
      }

      config.headers = {
        ...config.headers,
        'Authorization': `Bearer ${token}`,
      };
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      // Check for 401 Unauthorized (token expired or invalid)
      if (response.status === 401) {
        // Clear token and redirect to login
        this.clearToken();
        if (typeof window !== 'undefined') {
          localStorage.removeItem('master_key');
          localStorage.removeItem('account_salt');
          localStorage.removeItem('viewMode');
          window.location.href = '/login';
        }
        return {
          success: false,
          error: 'Session expired. Please log in again.',
        };
      }

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      // Return successful response in expected format
      return {
        success: true,
        data: data,
      };
    } catch (error) {
      // console.error('API request failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private getToken(): string | null {
    if (typeof window === 'undefined') return null;

    // Try to get from localStorage first
    const token = localStorage.getItem('auth_token');
    if (token) return token;

    // Fallback to cookies
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'auth_token') {
        return decodeURIComponent(value);
      }
    }

    return null;
  }

  private setToken(token: string): void {
    if (typeof window === 'undefined') return;

    localStorage.setItem('auth_token', token);
    // Also set as httpOnly cookie for security
    document.cookie = `auth_token=${encodeURIComponent(token)}; path=/; secure; samesite=strict`;
  }

  private clearToken(): void {
    if (typeof window === 'undefined') return;

    localStorage.removeItem('auth_token');
    document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  }

  // Auth endpoints
  async registerSRP(data: {
    email: string;
    name: string;
    salt: string;
    verifier: string;
    publicKey?: string;
    encryptedPrivateKey?: string;
    keyDerivationSalt?: string;
    pqcKeypairs?: any;
    algorithmVersion?: string;
    encryptedMnemonic?: string;
    mnemonicSalt?: string;
    mnemonicIv?: string;
  }): Promise<ApiResponse<{ userId: string; accountSalt: string }>> {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async srpChallenge(email: string, A: string): Promise<ApiResponse<{
    sessionId: string;
    salt: string;
    B: string;
    signature: string;
    expires_at: number;
  }>> {
    return this.request('/auth/login/challenge', {
      method: 'POST',
      body: JSON.stringify({ email, A }),
    });
  }

  async srpVerify(data: {
    email: string;
    clientProof: string;
    sessionId: string;
  }): Promise<ApiResponse<{
    token: string;
    refreshToken: string;
    M2: string;
    user: any;
    algorithmVersion: string;
  }>> {
    return this.request('/auth/login/verify', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async loginOPAQUEStart(data: {
    email: string;
    clientLogin1: string;
  }): Promise<ApiResponse<{
    sessionId: string;
    serverLogin2: string;
    clientLogin2: string;
  }>> {
    return this.request('/auth/login/start', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async loginOPAQUEFinish(data: {
    email: string;
    clientLogin2: string;
    clientProof: string;
    sessionId: string;
  }): Promise<ApiResponse<{
    token: string;
    refreshToken: string;
    serverProof: string;
    user: any;
  }>> {
    return this.request('/auth/login/finish', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async registerOPAQUE(data: {
    email: string;
    name: string;
    salt: string;
    clientRegStart: string;
    publicKey: string;
    encryptedPrivateKey: string;
    keyDerivationSalt: string;
  }): Promise<ApiResponse<{
    sessionId: string;
    serverRegStart: string;
  }>> {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async registerOPAQUEFinish(data: {
    email: string;
    clientRegFinish: string;
  }): Promise<ApiResponse<{
    userId: string;
    accountSalt: string;
    token: string;
    user: any;
  }>> {
    return this.request('/auth/register/continue', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async sendOTP(email: string): Promise<ApiResponse> {
    return this.request('/auth/otp/send', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async verifyOTP(email: string, otp: string): Promise<ApiResponse<{
    token: string;
    refreshToken: string;
    user: any;
    recoveryChallenge: string;
  }>> {
    return this.request('/auth/otp/verify', {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
    });
  }

  async recoverAccount(data: {
    email: string;
    mnemonic: string; // Now expects SHA256 hash of the mnemonic
    newSalt: string;
    newVerifier: string;
    encryptedMasterKey?: string;
    masterKeySalt?: string;
    masterKeyVersion?: number;
  }): Promise<ApiResponse> {
    return this.request('/recovery/verify', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async initiateRecovery(email: string): Promise<ApiResponse<{
    hasRecovery: boolean;
  }>> {
    return this.request('/recovery/initiate', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async refreshToken(): Promise<ApiResponse<{
    accessToken: string;
    refreshToken: string;
  }>> {
    return this.request('/auth/refresh', {
      method: 'POST',
    });
  }

  async logout(): Promise<ApiResponse> {
    const response = await this.request('/auth/logout', {
      method: 'POST',
    });

    if (response.success) {
      this.clearToken();
      // Also clear the master key and user preferences from localStorage
      if (typeof window !== 'undefined') {
        localStorage.removeItem('master_key');
        localStorage.removeItem('account_salt');
        localStorage.removeItem('viewMode');
      }
    }

    return response;
  }

  async getProfile(): Promise<ApiResponse<{ user: any }>> {
    return this.request('/auth/me');
  }

  async getUserStorage(): Promise<ApiResponse<{
    used_bytes: number;
    quota_bytes: number;
    percent_used: number;
    used_readable: string;
    quota_readable: string;
  }>> {
    return this.request('/auth/storage');
  }

  async storePQCKeys(userId: string, pqcKeypairs: any): Promise<ApiResponse> {
    return this.request('/auth/crypto', {
      method: 'PUT',
      body: JSON.stringify({ userId, pqcKeypairs }),
    });
  }

  async storePQCKeysAfterRegistration(userId: string, pqcKeypairs: any): Promise<ApiResponse> {
    return this.request('/auth/crypto/setup', {
      method: 'POST',
      body: JSON.stringify({ userId, pqcKeypairs }),
    });
  }

  async sendSupportRequest(data: {
    subject: string;
    message: string;
    priority: string;
    category: string;
    timestamp: string;
    userAgent: string;
    url: string;
  }): Promise<ApiResponse> {
    return this.request('/auth/support', {
      method: 'POST',
      body: JSON.stringify({
        subject: data.subject,
        message: data.message,
        priority: data.priority,
        category: data.category,
        // Include technical metadata in the message for debugging
        metadata: {
          timestamp: data.timestamp,
          userAgent: data.userAgent,
          url: data.url
        }
      }),
    });
  }

  // Store authentication token
  setAuthToken(token: string): void {
    this.setToken(token);
  }

  // Get current authentication token
  getAuthToken(): string | null {
    return this.getToken();
  }

  // Clear authentication token
  clearAuthToken(): void {
    this.clearToken();
  }

  // Files endpoints
  async getFiles(params?: {
    folderId?: string;
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<{
    files: FileItem[];
    pagination: {
      limit: number;
      offset: number;
      hasMore: boolean;
    };
  }>> {
    const queryParams = new URLSearchParams();
    if (params?.folderId !== undefined) {
      queryParams.append('folderId', params.folderId);
    }
    if (params?.limit !== undefined) {
      queryParams.append('limit', params.limit.toString());
    }
    if (params?.offset !== undefined) {
      queryParams.append('offset', params.offset.toString());
    }

    const queryString = queryParams.toString();
    const endpoint = `/files${queryString ? `?${queryString}` : ''}`;

    return this.request(endpoint);
  }

  // Folders endpoints
  async createFolder(data: {
    name: string;
    parentId?: string | null;
    manifestJson: string;
    manifestSignatureEd25519: string;
    manifestPublicKeyEd25519: string;
    manifestSignatureDilithium?: string;
    manifestPublicKeyDilithium?: string;
    algorithmVersion?: string;
  }): Promise<ApiResponse<{
    id: string;
    name: string;
    parentId: string | null;
    path: string;
    createdAt: string;
    updatedAt: string;
    signed: boolean;
    signatures: {
      ed25519: boolean;
      dilithium: boolean;
    };
  }>> {
    return this.request('/folders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getFolders(params?: {
    parentId?: string;
  }): Promise<ApiResponse<{
    id: string;
    name: string;
    parentId: string | null;
    path: string;
    createdAt: string;
    updatedAt: string;
  }[]>> {
    const queryParams = new URLSearchParams();
    if (params?.parentId !== undefined) {
      queryParams.append('parentId', params.parentId);
    }

    const queryString = queryParams.toString();
    const endpoint = `/folders${queryString ? `?${queryString}` : ''}`;

    return this.request(endpoint);
  }

  // Get folder contents (both files and folders)
  async getFolderContents(folderId: string = 'root'): Promise<ApiResponse<{
    folders: {
      id: string;
      name: string;
      parentId: string | null;
      path: string;
      type: string;
      createdAt: string;
      updatedAt: string;
    }[];
    files: {
      id: string;
      name: string;
      filename: string;
      size: number;
      mimeType: string;
      folderId: string | null;
      type: string;
      createdAt: string;
      updatedAt: string;
      sha256Hash: string;
    }[];
  }>> {
    const normalizedFolderId = folderId === 'root' ? 'root' : folderId;
    return this.request(`/folders/${normalizedFolderId}/contents`);
  }

  // File operations
  async renameFile(fileId: string, newFilename: string): Promise<ApiResponse<{ newFilename: string }>> {
    return this.request(`/files/${fileId}/rename`, {
      method: 'PUT',
      body: JSON.stringify({ newFilename }),
    });
  }

  async moveFileToFolder(fileId: string, folderId: string | null): Promise<ApiResponse<{
    fileId: string;
    folderId: string | null;
  }>> {
    return this.request(`/files/${fileId}/move`, {
      method: 'PUT',
      body: JSON.stringify({ folderId }),
    });
  }

  async moveFileToTrash(fileId: string): Promise<ApiResponse<{ message: string }>> {
    return this.request(`/files/trash`, {
      method: 'POST',
      body: JSON.stringify({ fileIds: [fileId] }),
    });
  }

  async restoreFileFromTrash(fileId: string): Promise<ApiResponse<{ message: string }>> {
    return this.request(`/files/trash/restore`, {
      method: 'POST',
      body: JSON.stringify({ fileIds: [fileId] }),
    });
  }

  async deleteFile(fileId: string): Promise<ApiResponse<{ message: string }>> {
    return this.request(`/files/trash/delete`, {
      method: 'POST',
      body: JSON.stringify({ fileId }),
    });
  }

  async downloadFile(fileId: string): Promise<ApiResponse<Blob>> {
    // This will return a blob for download
    const response = await fetch(`${this.baseURL}/files/${fileId}/download`, {
      headers: {
        'Authorization': `Bearer ${this.getToken()}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Download failed: ${response.status}`);
    }

    const blob = await response.blob();
    return {
      success: true,
      data: blob,
    };
  }

  async getFileInfo(fileId: string): Promise<ApiResponse<any>> {
    return this.request(`/files/${fileId}/info`);
  }

  // Folder operations
  async renameFolder(folderId: string, newName: string): Promise<ApiResponse<{
    id: string;
    name: string;
    path: string;
    updatedAt: string;
  }>> {
    return this.request(`/folders/${folderId}/rename`, {
      method: 'PUT',
      body: JSON.stringify({ newName }),
    });
  }

  async moveFolder(folderId: string, parentId: string | null): Promise<ApiResponse<{
    id: string;
    name: string;
    parentId: string | null;
    path: string;
    updatedAt: string;
  }>> {
    return this.request(`/folders/${folderId}/move`, {
      method: 'PUT',
      body: JSON.stringify({ parent_id: parentId }),
    });
  }

  async moveFolderToTrash(folderId: string): Promise<ApiResponse<{ message: string }>> {
    return this.request(`/folders/trash`, {
      method: 'POST',
      body: JSON.stringify({ folderIds: [folderId] }),
    });
  }

  async restoreFolderFromTrash(folderId: string): Promise<ApiResponse<{ message: string }>> {
    return this.request(`/folders/trash/restore`, {
      method: 'PUT',
      body: JSON.stringify({ folderIds: [folderId] }),
    });
  }

  async deleteFolder(folderId: string): Promise<ApiResponse<{ message: string }>> {
    return this.request(`/folders/trash`, {
      method: 'DELETE',
      body: JSON.stringify({ folderId }),
    });
  }

  async getFolderInfo(folderId: string): Promise<ApiResponse<any>> {
    return this.request(`/folders/${folderId}`);
  }

  // Sharing operations
  async createShare(data: {
    file_id?: string;
    folder_id?: string;
    wrapped_cek?: string; // Optional for true E2EE
    nonce_wrap?: string;  // Optional for true E2EE
    has_password?: boolean;
    salt_pw?: string;
    expires_at?: string;
    max_views?: number;
    permissions?: string;
    kyber_ciphertext?: string;
    kyber_public_key?: string;
    kyber_wrapped_cek?: string;
    nonce_wrap_kyber?: string;
  }): Promise<ApiResponse<{
    id: string;
    encryption_version?: number;
    reused?: boolean;
    sharedFiles?: number;
  }>> {
    if (data.folder_id) {
      // Create folder share
      return this.request('/shares/folder', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } else {
      // Create file share
      return this.request('/shares', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    }
  }

  async getShare(shareId: string): Promise<ApiResponse<{
    id: string;
    file_id: string;
    has_password: boolean;
    salt_pw?: string;
    expires_at?: string;
    max_views?: number;
    views: number;
    disabled: boolean;
    wrapped_cek?: string; // Optional for true E2EE
    nonce_wrap?: string; // Optional for true E2EE
    kyber_ciphertext?: string;
    kyber_public_key?: string;
    kyber_wrapped_cek?: string;
    nonce_wrap_kyber?: string;
    encryption_version?: number;
    file: {
      id: string;
      filename: string;
      size: number;
      mimetype: string;
      created_at: string;
    };
  }>> {
    return this.request(`/shares/${shareId}`);
  }

  async bulkMoveToTrash(fileIds: string[]): Promise<ApiResponse<{
    message: string;
    movedCount: number;
    requestedCount: number;
  }>> {
    return this.request('/files/trash/move', {
      method: 'POST',
      body: JSON.stringify({ fileIds }),
    });
  }

  async getShareKeyWrap(shareId: string): Promise<ApiResponse<{
    file_id: string;
    wrapped_cek: string;
    nonce_wrap: string;
    encryption_version?: number;
    kyber_ciphertext?: string;
    kyber_public_key?: string;
  }>> {
    return this.request(`/shares/${shareId}/keywrap`);
  }

  async getShareManifest(shareId: string): Promise<ApiResponse<any>> {
    return this.request(`/shares/${shareId}/manifest`);
  }

  async trackShareDownload(shareId: string): Promise<ApiResponse<{ success: boolean }>> {
    return this.request(`/shares/${shareId}/download`, {
      method: 'POST',
    });
  }

  async disableShare(shareId: string): Promise<ApiResponse<{ success: boolean }>> {
    return this.request(`/shares/${shareId}`, {
      method: 'DELETE',
    });
  }

  async revokeShareForUser(shareId: string, userId: string): Promise<ApiResponse<{ success: boolean }>> {
    return this.request(`/shares/${shareId}/user/${userId}`, {
      method: 'DELETE',
    });
  }

  async sendShareEmails(shareId: string, data: {
    recipients: string[];
    share_url: string;
    file_name: string;
    message?: string;
  }): Promise<ApiResponse<{
    success: boolean;
    results: Array<{ email: string; status: string }>;
    errors: Array<{ email: string; error: string }>;
    summary: {
      total: number;
      sent: number;
      failed: number;
    };
  }>> {
    return this.request(`/shares/${shareId}/send`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getMyShares(): Promise<ApiResponse<{
    id: string;
    fileId: string;
    fileName: string;
    fileSize: number;
    createdAt: string;
    expiresAt?: string;
    permissions: string;
    revoked: boolean;
    linkSecret?: string;
    views: number;
    maxViews?: number;
    downloads: number;
    folderPath: string;
    recipients: Array<{
      id: string;
      userId?: string;
      email?: string;
      name?: string;
      status: string;
      createdAt: string;
      revokedAt?: string;
    }>;
  }[]>> {
    return this.request('/shares/mine');
  }

  async getReceivedShares(): Promise<ApiResponse<{
    id: string;
    fileId: string;
    fileName: string;
    fileSize: number;
    sharedAt: string;
    sharedBy: {
      id: string;
      name?: string;
      email: string;
    };
    permissions: string;
    revoked: boolean;
    linkSecret?: string;
  }[]>> {
    return this.request('/shares/received');
  }

  // Trash operations
  async getTrashFiles(params?: {
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<{
    files: {
      id: string;
      filename: string;
      encrypted_filename: string;
      mimetype: string;
      size: number;
      sha256_hash: string;
      chunk_count: number;
      created_at: string;
      updated_at: string;
      deleted_at: string;
    }[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }>> {
    const queryParams = new URLSearchParams();
    if (params?.page !== undefined) {
      queryParams.append('page', params.page.toString());
    }
    if (params?.limit !== undefined) {
      queryParams.append('limit', params.limit.toString());
    }

    const queryString = queryParams.toString();
    const endpoint = `/files/trash${queryString ? `?${queryString}` : ''}`;

    return this.request(endpoint);
  }

  async getTrashFolders(): Promise<ApiResponse<{
    id: string;
    name: string;
    parentId: string | null;
    path: string;
    createdAt: string;
    updatedAt: string;
    deletedAt: string;
  }[]>> {
    return this.request('/folders/trash/list');
  }

  async deleteFilePermanently(fileId: string): Promise<ApiResponse<{ message: string }>> {
    return this.request(`/files/trash/delete`, {
      method: 'POST',
      body: JSON.stringify({ fileIds: [fileId] }),
    });
  }

  async deleteFilesPermanently(fileIds: string[]): Promise<ApiResponse<{ message: string }>> {
    return this.request(`/files/trash/delete`, {
      method: 'POST',
      body: JSON.stringify({ fileIds }),
    });
  }

  async deleteFolderPermanently(folderId: string): Promise<ApiResponse<{ message: string }>> {
    return this.request(`/folders/trash`, {
      method: 'DELETE',
      body: JSON.stringify({ folderIds: [folderId] }),
    });
  }

  async deleteFoldersPermanently(folderIds: string[]): Promise<ApiResponse<{ message: string }>> {
    return this.request(`/folders/trash`, {
      method: 'DELETE',
      body: JSON.stringify({ folderIds }),
    });
  }

  async restoreFilesFromTrash(fileIds: string[]): Promise<ApiResponse<{ message: string }>> {
    return this.request(`/files/trash/restore`, {
      method: 'POST',
      body: JSON.stringify({ fileIds }),
    });
  }

  async restoreFoldersFromTrash(folderIds: string[]): Promise<ApiResponse<{ message: string }>> {
    return this.request(`/folders/trash/restore`, {
      method: 'PUT',
      body: JSON.stringify({ folderIds }),
    });
  }

  // Upload operations
  async initializeUploadSession(data: {
    filename: string;
    mimetype: string;
    fileSize: number;
    chunkCount: number;
    sha256sum: string;
    chunks: Array<{
      index: number;
      sha256: string;
      size: number;
    }>;
    encryptionIv: string;
    encryptionSalt: string;
    dataEncryptionKey: string;
    wrappedCek: string;
    fileNoncePrefix: string;
    folderId?: string | null;
    manifestSignatureEd25519: string;
    manifestPublicKeyEd25519: string;
    manifestSignatureDilithium: string;
    manifestPublicKeyDilithium: string;
    algorithmVersion: string;
    wrappedCekKyber: string;
    nonceWrapKyber: string;
    kyberCiphertext: string;
    kyberPublicKey: string;
  }): Promise<ApiResponse<{
    sessionId: string;
    fileId: string;
    chunkSize: number;
    chunkCount: number;
    totalBatches: number;
    presigned: Array<{
      index: number;
      size: number;
      sha256: string;
      putUrl: string;
      objectKey: string;
    }>;
    manifestVerified: boolean;
    storageType: string;
    endpoint: string;
  }>> {
    return this.request('/files/upload/presigned/initialize', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async finalizeUpload(sessionId: string, data: {
    finalSha256: string;
    manifestSignature: string;
    manifestPublicKey: string;
    manifestSignatureDilithium: string;
    manifestPublicKeyDilithium: string;
    manifestCreatedAt: number;
    algorithmVersion: string;
  }): Promise<ApiResponse<{
    fileId: string;
    message: string;
  }>> {
    return this.request(`/files/upload/presigned/${sessionId}/finalize`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async confirmChunkUploads(sessionId: string, data: {
    chunks: Array<{
      index: number;
      chunkSize: number;
      sha256Hash?: string;
      nonce?: string;
    }>;
  }): Promise<ApiResponse<{
    totalChunks: number;
    confirmedChunks: number;
    failedChunks: number;
    results: Array<{
      index: number;
      success: boolean;
      size?: number;
      objectKey?: string;
      error?: string;
    }>;
  }>> {
    return this.request(`/files/upload/presigned/${sessionId}/confirm-batch`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async getDownloadUrls(fileId: string): Promise<ApiResponse<{
    fileId: string;
    storageKey: string;
    originalFilename: string;
    mimetype: string;
    size: number;
    sha256: string;
    chunkCount: number;
    chunks: Array<{
      index: number;
      size: number;
      sha256: string;
      nonce: string | null;
    }>;
    presigned: Array<{
      chunkIndex: number;
      objectKey: string;
      size: number;
      sha256: string;
      nonce: string | null;
      getUrl: string;
    }>;
    manifest?: any;
    signatures?: any;
    encryption?: any;
    storageType: string;
  }>> {
    return this.request(`/files/download/${fileId}/urls`);
  }

  // Billing endpoints
  async getPricingPlans(): Promise<ApiResponse<{
    plans: Array<{
      id: string;
      name: string;
      description: string;
      price: number;
      currency: string;
      interval: string;
      storageQuota: number;
      features: string[];
      stripePriceId: string;
      popular?: boolean;
    }>;
  }>> {
    return this.request('/billing/plans');
  }

  async getSubscriptionStatus(): Promise<ApiResponse<{
    subscription: {
      id: string;
      status: string;
      currentPeriodStart: number;
      currentPeriodEnd: number;
      cancelAtPeriodEnd: boolean;
      plan: {
        id: string;
        name: string;
        storageQuota: number;
      };
    } | null;
    usage: {
      usedBytes: number;
      quotaBytes: number;
      percentUsed: number;
    };
  }>> {
    return this.request('/billing/subscription');
  }

  async createCheckoutSession(data: {
    priceId: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<ApiResponse<{
    sessionId: string;
    url: string;
  }>> {
    return this.request('/billing/create-checkout-session', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async createPortalSession(data: {
    returnUrl: string;
  }): Promise<ApiResponse<{
    url: string;
  }>> {
    return this.request('/billing/create-portal-session', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
export default apiClient;
