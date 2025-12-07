import { getApiBaseUrl } from './tor-detection';
import { generateIdempotencyKey, addIdempotencyKey, generateIdempotencyKeyForCreate } from './idempotency';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || getApiBaseUrl();

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
}

export interface FileItem {
  id: string;
  name: string; // Display name (decrypted filename for files, plain name for folders)
  filename?: string; // Original filename (only for files)
  encryptedFilename?: string; // Encrypted filename (only for files)
  filenameSalt?: string; // Salt used for filename encryption (only for files)
  size?: number; // Only for files
  mimeType?: string; // Only for files
  folderId?: string | null; // Only for files
  parentId?: string | null; // Only for folders
  path?: string; // Only for folders
  type: 'file' | 'folder';
  createdAt: string;
  updatedAt: string;
  shaHash?: string; // File hash (SHA256 or SHA512 depending on algorithm)
  sessionSalt?: string;
  is_shared?: boolean; // Whether this file/folder is currently shared
  encryption?: {
    iv: string;
    salt: string;
    sessionSalt?: string;
    wrappedCek: string;
    fileNoncePrefix: string;
    cekNonce: string;
  };
  // Flat properties for backward compatibility
  encryptionIv?: string;
  encryptionSalt?: string;
  wrappedCek?: string;
  fileNoncePrefix?: string;
}

class ApiClient {
  private baseURL: string;
  private storage: Storage | null = null;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  // Set storage type (localStorage or sessionStorage)
  setStorage(storage: Storage): void {
    this.storage = storage;
  }

  // Get current storage, defaulting to localStorage if not set
  private getStorage(): Storage {
    if (this.storage) return this.storage;
    // Default to localStorage, but only access it on client side
    if (typeof window !== 'undefined') {
      return localStorage;
    }
    // This should never happen in practice, but provide a fallback
    throw new Error('Storage not available');
  }

  private clearAllAuthData(): void {
    if (typeof window === 'undefined') return;

    // Clear token
    this.clearToken();
    
    // Clear all localStorage
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    
    // Clear all sessionStorage
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.clear();
    }
    
    // Clear auth cookies
    if (typeof document !== 'undefined') {
      const cookies = document.cookie.split(';');
      for (const cookie of cookies) {
        const [name] = cookie.trim().split('=');
        document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; domain=${window.location.hostname}`;
        document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; domain=.${window.location.hostname}`;
        document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
      }
    }
  }

  private shouldRedirectToLogin(): boolean {
    if (typeof window === 'undefined') return false;
    
    const pathname = window.location.pathname;
    const authPages = ['/login', '/signup', '/otp', '/recover', '/recover/otp', '/recover/reset', '/backup', '/totp', '/auth/oauth/callback'];
    return !authPages.some(page => pathname.includes(page)) && !pathname.startsWith('/s/');
  }

  private isTokenExpired(token: string): boolean {
    try {
      // Validate token structure: should have 3 parts separated by dots
      const parts = token.split('.');
      if (parts.length !== 3) {
        console.warn('Invalid token structure: expected 3 parts (header.payload.signature)');
        return true;
      }

      // Decode and parse the payload
      const payload = JSON.parse(atob(parts[1]));
      
      // Check if payload has exp claim
      if (typeof payload.exp !== 'number') {
        console.warn('Token missing or invalid exp claim');
        return true;
      }

      const currentTime = Math.floor(Date.now() / 1000);
      return payload.exp < currentTime;
    } catch (error) {
      // Log the error for debugging but don't immediately logout
      console.warn('Token validation error:', error instanceof Error ? error.message : 'Unknown error');
      // Only consider token expired if we're absolutely sure it's invalid
      // Return false to allow the request to proceed and let the server handle validation
      return false;
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    // Build the request URL, handling proxy paths for TOR
    // /api/proxy + /auth/login -> /api/proxy/v1/auth/login
    let requestUrl = `${this.baseURL}${endpoint}`;
    if (this.baseURL === '/api/proxy') {
      // Using TOR proxy: construct full path including /v1/
      requestUrl = `/api/proxy/v1${endpoint}`;
    }

    // Extract headers separately to avoid them being overwritten by ...options spread
    const { headers: optionHeaders, ...otherOptions } = options;

    // Only set Content-Type if body is not FormData (FormData needs browser to set boundary)
    const isFormData = otherOptions.body instanceof FormData;
    
    const config: RequestInit = {
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...optionHeaders,  // Spread headers from options
      },
      credentials: 'include', // Essential for CORS with TOR and cross-origin requests
      ...otherOptions,  // Spread other options WITHOUT headers
    };

    // Add authorization header if token exists
    const token = this.getToken();
    if (token) {
      // Check if token is definitely expired (don't clear on validation errors)
      if (this.isTokenExpired(token)) {
        // Token is definitely expired based on exp claim
        console.log('Token is expired, clearing auth data');
        this.clearAllAuthData();
        if (this.shouldRedirectToLogin()) {
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
      const startTime = Date.now();
      const response = await fetch(requestUrl, config);
      const duration = Date.now() - startTime;
      
      const data = await response.json();

      // Check for 401 Unauthorized (token expired or invalid from server)
      if (response.status === 401) {
        console.warn('Received 401 from server', { endpoint, error: data.error });
        // Return 401 error but don't immediately clear everything
        // Let components decide whether to logout based on context
        // Only specific components (like AuthGuard) should trigger full logout on 401
        return {
          success: false,
          error: data.error || 'Session expired. Please log in again.',
        };
      }

      if (!response.ok) {
        console.error('API Error:', { endpoint, status: response.status, error: data.error });
        
        // Return error response as-is (don't throw) so callers like initializeUploadSession can handle 409 conflicts
        // The response should already have success: false from the backend
        if (data.success !== undefined) {
          return data;  // Return the backend response directly with success: false
        }
        
        // If backend didn't include success field, add it
        return {
          success: false,
          error: data.error || `HTTP ${response.status}`,
          data: data
        };
      }

      // Handle responses that already have success property
      // Some endpoints return: { success: true, data: { user: ... } } (already wrapped)
      // Others return: { success: true, sessionId: ..., presigned: ... } (needs wrapping)
      if (data.success !== undefined) {
        const { success, error, ...responseData } = data;
        
        // If already has 'data' property (like from /auth/me), return as-is
        if (responseData.data !== undefined) {
          return {
            success,
            ...(error && { error }),
            data: responseData.data,
          };
        }
        
        // Otherwise wrap other properties as data (like presigned upload responses)
        return {
          success,
          ...(error && { error }),
          data: responseData,
        };
      }
      
      // Otherwise wrap raw response in ApiResponse format
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

    // CRITICAL: During OAuth setup, use the temporary sessionStorage token
    // This allows API calls to work during password verification without storing in localStorage
    if (sessionStorage.getItem('oauth_setup_in_progress') === 'true') {
      const oauthToken = sessionStorage.getItem('oauth_temp_token');
      if (oauthToken) return oauthToken;
    }

    // Try to get from current storage first - check both 'auth_token' and 'auth' formats
    const storage = this.getStorage();

    // First try the standard 'auth_token' format (used by regular login)
    const authToken = storage.getItem('auth_token');
    if (authToken) return authToken;

    // Then try the 'auth' object format (used by OAuth completion)
    const authData = storage.getItem('auth');
    if (authData) {
      try {
        const parsed = JSON.parse(authData);
        if (parsed.accessToken) return parsed.accessToken;
      } catch (e) {
        // Invalid JSON, ignore
      }
    }

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

    this.getStorage().setItem('auth_token', token);
    // Also set as httpOnly cookie for security
    document.cookie = `auth_token=${encodeURIComponent(token)}; path=/; secure; samesite=strict`;
  }

  private clearToken(): void {
    if (typeof window === 'undefined') return;

    const storage = this.getStorage();
    storage.removeItem('auth_token');
    storage.removeItem('auth'); // Also clear OAuth-style auth object
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
    mnemonic: string; // SHA256 hash of the mnemonic
    encryptedMasterKey?: string;
    masterKeySalt?: string;
    encryptedRecoveryKey?: string; // RK encrypted with RKEK from mnemonic
    recoveryKeyNonce?: string; // Nonce for RK decryption
    masterKeyVersion?: number;
    // OPAQUE password reset - OPAQUE protocol ensures no plaintext password sent
    newOpaquePasswordFile?: string; // New OPAQUE registration record (derived from password client-side)
  }): Promise<ApiResponse<{
    token?: string;
    refreshToken?: string;
  }>> {
    return this.request('/recovery/verify', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async logout(): Promise<ApiResponse> {
    const response = await this.request('/auth/logout', {
      method: 'POST',
    });

    if (response.success) {
      this.clearToken();
      // Clear all localStorage
      if (typeof localStorage !== 'undefined') {
        localStorage.clear();
      }
      // Clear all sessionStorage
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.clear();
      }
      // Clear all cookies
      if (typeof document !== 'undefined') {
        const cookies = document.cookie.split(';');
        for (const cookie of cookies) {
          const [name] = cookie.trim().split('=');
          document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; domain=${window.location.hostname}`;
          document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; domain=.${window.location.hostname}`;
          document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
        }
      }
    }

    return response;
  }

  async getProfile(): Promise<ApiResponse<{ user: any }>> {
    return this.request('/auth/me');
  }

  async updateUserProfile(data: {
    name?: string;
    email?: string;
    avatar?: string;
  }): Promise<ApiResponse> {
    const idempotencyKey = generateIdempotencyKey('updateProfile', 'current');
    const headers = addIdempotencyKey({}, idempotencyKey);
    return this.request('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
      headers,
    });
  }

  /**
   * Update user's session duration preference
   */
  async updateSessionDuration(sessionDuration: number): Promise<ApiResponse> {
    const idempotencyKey = generateIdempotencyKey('updateSessionDuration', sessionDuration.toString());
    const headers = addIdempotencyKey({}, idempotencyKey);
    return this.request('/auth/session-duration', {
      method: 'POST',
      body: JSON.stringify({ sessionDuration }),
      headers,
    });
  }

  /**
   * Initiate email change process - sends OTP to new email
   */
  async initiateEmailChange(newEmail: string): Promise<ApiResponse<{ emailChangeToken: string }>> {
    const idempotencyKey = generateIdempotencyKey('initiateEmailChange', newEmail);
    const headers = addIdempotencyKey({}, idempotencyKey);
    return this.request('/auth/email/change/initiate', {
      method: 'POST',
      body: JSON.stringify({ newEmail }),
      headers,
    });
  }

  /**
   * Verify email change with OTP
   */
  async verifyEmailChange(emailChangeToken: string, otpCode: string): Promise<ApiResponse> {
    const idempotencyKey = generateIdempotencyKey('verifyEmailChange', emailChangeToken);
    const headers = addIdempotencyKey({}, idempotencyKey);
    return this.request('/auth/email/change/verify', {
      method: 'POST',
      body: JSON.stringify({ emailChangeToken, otpCode }),
      headers,
    });
  }

  /**
   * Change password using OPAQUE protocol
   * Client-side OPAQUE operations ensure password is never sent to backend
   */
  async changePassword(data: {
    newOpaquePasswordFile: string;  // New OPAQUE registration record from OPAQUE step 3
  }): Promise<ApiResponse> {
    const idempotencyKey = generateIdempotencyKey('changePassword', 'current');
    const headers = addIdempotencyKey({}, idempotencyKey);
    return this.request('/auth/password/change', {
      method: 'POST',
      body: JSON.stringify(data),
      headers,
    });
  }

  async uploadAvatar(formData: FormData): Promise<ApiResponse<{ avatarUrl: string }>> {
    const idempotencyKey = generateIdempotencyKey('uploadAvatar', 'current');
    const headers = addIdempotencyKey({}, idempotencyKey);
    return this.request('/auth/avatar', {
      method: 'POST',
      body: formData,
      headers: {
        // Don't set Content-Type for FormData, let the browser set it with boundary
        ...headers,
      },
    });
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
    const idempotencyKey = generateIdempotencyKey('storePQCKeys', userId);
    const headers = addIdempotencyKey({}, idempotencyKey);
    return this.request('/auth/crypto', {
      method: 'PUT',
      body: JSON.stringify({ userId, pqcKeypairs }),
      headers,
    });
  }

  async storePQCKeysAfterRegistration(userId: string, pqcKeypairs: any): Promise<ApiResponse> {
    const idempotencyKey = generateIdempotencyKey('storePQCKeysAfterRegistration', userId);
    const headers = addIdempotencyKey({}, idempotencyKey);
    return this.request('/auth/crypto/setup', {
      method: 'POST',
      body: JSON.stringify({ userId, pqcKeypairs }),
      headers,
    });
  }

  async storeCryptoKeypairs(data: {
    userId: string;
    accountSalt: string;
    pqcKeypairs: any;
    mnemonicHash?: string;    // SHA256(mnemonic) for zero-knowledge verification
    masterKeyVerificationHash?: string; // HMAC-SHA256 for master key integrity validation
    encryptedMasterKey?: string;  // For MetaMask users / recovery
    masterKeySalt?: string;        // For MetaMask users / recovery (can include masterKeyNonce in JSON)
    masterKeyNonce?: string;       // Nonce for encrypting master key with recovery key
    encryptedRecoveryKey?: string; // RK encrypted with RKEK(mnemonic)
    recoveryKeyNonce?: string;     // Nonce for decrypting recovery key
    encryptedMasterKeyPassword?: string;  // MK encrypted with password-derived key (for login)
    masterKeyPasswordNonce?: string;      // Nonce for password-encrypted MK
    referralCode?: string;         // Referral code for signup attribution
  }): Promise<ApiResponse> {
    const idempotencyKey = generateIdempotencyKey('storeCryptoKeypairs', data.userId);
    const headers = addIdempotencyKey({}, idempotencyKey);
    return this.request('/auth/crypto/setup', {
      method: 'POST',
      body: JSON.stringify(data),
      headers,
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
    const idempotencyKey = generateIdempotencyKey('sendSupportRequest', data.timestamp);
    const headers = addIdempotencyKey({}, idempotencyKey);
    return this.request('/support/request', {
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
      headers,
    });
  }

  // Store authentication token
  setAuthToken(token: string): void {
    this.setToken(token);
  }

  // Get current authentication token
  getAuthToken(): string | null {
    // CRITICAL: During OAuth setup, don't return any token to prevent bypass
    // This ensures users must complete password verification before gaining access
    if (typeof window !== 'undefined' && sessionStorage.getItem('oauth_setup_in_progress') === 'true') {
      return null;
    }
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
    encryptedName?: string;
    nameSalt?: string;
    parentId?: string | null;
    manifestHash: string;
    manifestCreatedAt: number;
    manifestSignatureEd25519: string;
    manifestPublicKeyEd25519: string;
    manifestSignatureDilithium: string;
    manifestPublicKeyDilithium: string;
    algorithmVersion?: string;
    nameHmac: string;
    clientFolderId?: string; // Client-generated folderId for idempotency
  }): Promise<ApiResponse<{
    id: string;
    encryptedName: string;
    nameSalt: string;
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
    // Use clientFolderId as idempotency key for duplicate prevention
    const idempotencyKey = data.clientFolderId 
      ? generateIdempotencyKeyForCreate(data.clientFolderId)
      : generateIdempotencyKey('createFolder', data.nameHmac || 'unknown');
    const headers = addIdempotencyKey({}, idempotencyKey);
    return this.request('/folders', {
      method: 'POST',
      body: JSON.stringify(data),
      headers,
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
      encryptedName: string;
      nameSalt: string;
      parentId: string | null;
      path: string;
      type: string;
      createdAt: string;
      updatedAt: string;
      is_shared: boolean;
    }[];
    files: {
      id: string;
      encryptedFilename: string;
      filenameSalt: string;
      size: number;
      mimeType: string;
      folderId: string | null;
      type: string;
      createdAt: string;
      updatedAt: string;
      shaHash: string;
      is_shared: boolean;
    }[];
  }>> {
    const normalizedFolderId = folderId === 'root' ? 'root' : folderId;
    return this.request(`/folders/${normalizedFolderId}/contents`);
  }

  // Get folder contents recursively (including all nested folders and files)
  async getFolderContentsRecursive(folderId: string = 'root'): Promise<ApiResponse<{
    folder: {
      id: string;
      encryptedName: string;
      nameSalt: string;
      path: string;
      parentId: string | null;
      isFolder: boolean;
      children: any[];
      files: any[];
    };
    allFiles: {
      id: string;
      encryptedFilename: string;
      filenameSalt: string;
      size: number;
      mimetype: string;
      folderId: string | null;
      wrappedCek: string;
      nonceWrap: string;
    }[];
    totalFiles: number;
    totalFolders: number;
  }>> {
    const normalizedFolderId = folderId === 'root' ? 'root' : folderId;
    return this.request(`/folders/${normalizedFolderId}/contents/recursive`);
  }

  // File operations
  async renameFile(fileId: string, data: {
    encryptedFilename: string;
    filenameSalt: string;
    manifestHash: string;
    manifestCreatedAt: number;
    manifestSignatureEd25519: string;
    manifestPublicKeyEd25519: string;
    manifestSignatureDilithium: string;
    manifestPublicKeyDilithium: string;
    algorithmVersion: string;
    nameHmac: string;
  }): Promise<ApiResponse<{ newFilename: string }>> {
    // Use fileId + nameHmac as unique intent (renaming same file to same name)
    const idempotencyKey = generateIdempotencyKey('renameFile', `${fileId}:${data.nameHmac}`);
    const headers = addIdempotencyKey({}, idempotencyKey);
    return this.request(`/files/${fileId}/rename`, {
      method: 'PUT',
      body: JSON.stringify(data),
      headers,
    });
  }

  async moveFileToFolder(fileId: string, folderId: string | null, nameHmac?: string): Promise<ApiResponse<{
    fileId: string;
    folderId: string | null;
  }>> {
    // Use fileId + target folder as unique intent
    const targetFolder = folderId || 'root';
    const intent = nameHmac ? `${fileId}:${targetFolder}:${nameHmac}` : `${fileId}:${targetFolder}`;
    const idempotencyKey = generateIdempotencyKey('moveFile', intent);
    const headers = addIdempotencyKey({}, idempotencyKey);
    return this.request(`/files/${fileId}/move`, {
      method: 'PUT',
      body: JSON.stringify({ folderId, nameHmac }),
      headers,
    });
  }

  async moveFileToTrash(fileId: string): Promise<ApiResponse<{ message: string }>> {
    // Use fileId as unique intent (moving same file to trash)
    const idempotencyKey = generateIdempotencyKey('deleteFile', fileId);
    const headers = addIdempotencyKey({}, idempotencyKey);
    return this.request(`/files/trash`, {
      method: 'POST',
      body: JSON.stringify({ fileIds: [fileId] }),
      headers,
    });
  }

  async restoreFileFromTrash(fileId: string): Promise<ApiResponse<{ message: string }>> {
    // Use fileId as unique intent (restoring same file)
    const idempotencyKey = generateIdempotencyKey('restoreFile', fileId);
    const headers = addIdempotencyKey({}, idempotencyKey);
    return this.request(`/files/trash/restore`, {
      method: 'POST',
      body: JSON.stringify({ fileIds: [fileId] }),
      headers,
    });
  }

  async deleteFile(fileId: string): Promise<ApiResponse<{ message: string }>> {
    // Use fileId as unique intent (permanently deleting same file)
    const idempotencyKey = generateIdempotencyKey('deleteFilePermanent', fileId);
    const headers = addIdempotencyKey({}, idempotencyKey);
    return this.request(`/files/trash/delete`, {
      method: 'POST',
      body: JSON.stringify({ fileId }),
      headers,
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
  async renameFolder(folderId: string, data: {
    encryptedName: string;
    nameSalt: string;
    manifestHash: string;
    manifestCreatedAt: number;
    manifestSignatureEd25519: string;
    manifestPublicKeyEd25519: string;
    manifestSignatureDilithium: string;
    manifestPublicKeyDilithium: string;
    algorithmVersion?: string;
    nameHmac: string;
  }): Promise<ApiResponse<{
    id: string;
    name: string;
    path: string;
    updatedAt: string;
  }>> {
    // Use folderId + nameHmac as unique intent
    const idempotencyKey = generateIdempotencyKey('renameFolder', `${folderId}:${data.nameHmac}`);
    const headers = addIdempotencyKey({}, idempotencyKey);
    return this.request(`/folders/${folderId}/rename`, {
      method: 'PUT',
      body: JSON.stringify(data),
      headers,
    });
  }

  async moveFolder(folderId: string, parentId: string | null): Promise<ApiResponse<{
    id: string;
    name: string;
    parentId: string | null;
    path: string;
    updatedAt: string;
  }>> {
    // Use folderId + target parent as unique intent
    const targetParent = parentId || 'root';
    const idempotencyKey = generateIdempotencyKey('moveFolder', `${folderId}:${targetParent}`);
    const headers = addIdempotencyKey({}, idempotencyKey);
    return this.request(`/folders/${folderId}/move`, {
      method: 'PUT',
      body: JSON.stringify({ parent_id: parentId }),
      headers,
    });
  }

  async moveFolderToTrash(folderId: string): Promise<ApiResponse<{ message: string }>> {
    // Use folderId as unique intent
    const idempotencyKey = generateIdempotencyKey('deleteFolder', folderId);
    const headers = addIdempotencyKey({}, idempotencyKey);
    return this.request(`/folders/trash`, {
      method: 'POST',
      body: JSON.stringify({ folderIds: [folderId] }),
      headers,
    });
  }

  async restoreFolderFromTrash(folderId: string): Promise<ApiResponse<{ message: string }>> {
    // Use folderId as unique intent
    const idempotencyKey = generateIdempotencyKey('restoreFolder', folderId);
    const headers = addIdempotencyKey({}, idempotencyKey);
    return this.request(`/folders/trash/restore`, {
      method: 'PUT',
      body: JSON.stringify({ folderIds: [folderId] }),
      headers,
    });
  }

  async deleteFolder(folderId: string): Promise<ApiResponse<{ message: string }>> {
    // Use folderId as unique intent
    const idempotencyKey = generateIdempotencyKey('deleteFolderPermanent', folderId);
    const headers = addIdempotencyKey({}, idempotencyKey);
    return this.request(`/folders/trash`, {
      method: 'DELETE',
      body: JSON.stringify({ folderIds: [folderId] }),
      headers,
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
    encrypted_filename?: string; // Filename encrypted with share CEK
    nonce_filename?: string;  // Nonce for filename encryption
    encrypted_foldername?: string; // Folder name encrypted with share CEK
    nonce_foldername?: string;  // Nonce for folder name encryption
    encrypted_manifest?: { encryptedData: string; nonce: string } | string;  // Encrypted folder manifest (for folder shares)
  }): Promise<ApiResponse<{
    id: string;
    encryption_version?: number;
    reused?: boolean;
    sharedFiles?: number;
  }>> {
    const idempotencyKey = generateIdempotencyKey('createShare', `${data.file_id || data.folder_id || ''}:${data.permissions || 'read'}`);
    const headers = addIdempotencyKey({}, idempotencyKey);
    if (data.folder_id) {
      // Create folder share
      return this.request('/shares/folder', {
        method: 'POST',
        body: JSON.stringify(data),
        headers,
      });
    } else {
      // Create file share
      return this.request('/shares', {
        method: 'POST',
        body: JSON.stringify(data),
        headers,
      });
    }
  }

  async getShare(shareId: string): Promise<ApiResponse<{
    id: string;
    file_id: string;
    folder_id?: string;
    is_folder: boolean;
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
    encrypted_filename?: string; // Filename encrypted with share CEK
    nonce_filename?: string; // Nonce for filename encryption
    encrypted_foldername?: string; // Folder name encrypted with share CEK
    nonce_foldername?: string; // Nonce for folder name encryption
    encrypted_manifest?: { encryptedData: string; nonce: string } | string; // E2EE folder manifest
    file?: {
      id: string;
      filename: string;
      size: number;
      mimetype: string;
      created_at: string;
    };
    folder?: {
      id: string;
      name: string;
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
    // Use sorted file IDs as unique intent for bulk operation
    const intent = fileIds.sort().join(',');
    const idempotencyKey = generateIdempotencyKey('bulkDeleteFiles', intent);
    const headers = addIdempotencyKey({}, idempotencyKey);
    return this.request('/files/trash/move', {
      method: 'POST',
      body: JSON.stringify({ fileIds }),
      headers,
    });
  }

  async moveToTrash(folderIds?: string[], fileIds?: string[]): Promise<ApiResponse<{ message: string }>> {
    // Use sorted IDs as unique intent for bulk operation
    const folders = (folderIds || []).sort().join(',');
    const files = (fileIds || []).sort().join(',');
    const intent = `folders:${folders}|files:${files}`;
    const idempotencyKey = generateIdempotencyKey('bulkDelete', intent);
    const headers = addIdempotencyKey({}, idempotencyKey);
    return this.request('/folders/trash', {
      method: 'POST',
      body: JSON.stringify({ folderIds, fileIds }),
      headers,
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
    // Use shareId as unique intent (tracking download for same share)
    const idempotencyKey = generateIdempotencyKey('trackShareDownload', shareId);
    const headers = addIdempotencyKey({}, idempotencyKey);
    return this.request(`/shares/${shareId}/download`, {
      method: 'POST',
      headers,
    });
  }

  async disableShare(shareIdOrIds: string | string[]): Promise<ApiResponse<{ success: boolean; revokedCount?: number; cascadedFileShares?: number }>> {
    const shareIds = Array.isArray(shareIdOrIds) ? shareIdOrIds : [shareIdOrIds];
    
    // Use sorted shareIds as unique intent for consistent idempotency
    const idempotencyKey = generateIdempotencyKey('disableShare', shareIds.sort().join(':'));
    const headers = addIdempotencyKey({}, idempotencyKey);
    return this.request('/shares/delete', {
      method: 'POST',
      headers,
      body: JSON.stringify({ shareIds }),
    });
  }

  async revokeShareForUser(shareId: string, userId: string): Promise<ApiResponse<{ success: boolean }>> {
    // Use shareId + userId as unique intent
    const idempotencyKey = generateIdempotencyKey('revokeShare', `${shareId}:${userId}`);
    const headers = addIdempotencyKey({}, idempotencyKey);
    return this.request(`/shares/${shareId}/user/${userId}`, {
      method: 'DELETE',
      headers,
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
    // Use shareId + sorted recipients as unique intent
    const intent = `${shareId}:${data.recipients.sort().join(',')}`;
    const idempotencyKey = generateIdempotencyKey('sendShareEmails', intent);
    const headers = addIdempotencyKey({}, idempotencyKey);
    return this.request(`/shares/${shareId}/send`, {
      method: 'POST',
      body: JSON.stringify(data),
      headers,
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
    isFolder: boolean;
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
      encryptedFilename: string;
      filenameSalt: string;
      mimetype: string;
      size: number;
      shaHash: string;
      chunkCount: number;
      createdAt: string;
      updatedAt: string;
      deletedAt: string;
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
    encryptedName: string;
    nameSalt: string;
    parentId: string | null;
    path: string;
    createdAt: string;
    updatedAt: string;
    deletedAt: string;
  }[]>> {
    const response = await this.request('/folders/trash/list') as any;
    // The backend returns {folders: [...], files: [...]}, but we only want folders
    if (response.success && response.data && response.data.folders) {
      return {
        success: true,
        data: response.data.folders
      };
    }
    return {
      success: false,
      error: response.error || 'Failed to fetch trash folders'
    };
  }

  async deleteFilePermanently(fileId: string): Promise<ApiResponse<{ message: string; storageFreed: number }>> {
    const idempotencyKey = generateIdempotencyKey('deleteFilePermanent', fileId);
    const headers = addIdempotencyKey({}, idempotencyKey);
    return this.request(`/files/trash/delete`, {
      method: 'POST',
      body: JSON.stringify({ fileIds: [fileId] }),
      headers,
    });
  }

  async deleteFilesPermanently(fileIds: string[]): Promise<ApiResponse<{ message: string; storageFreed: number }>> {
    const intent = fileIds.sort().join(',');
    const idempotencyKey = generateIdempotencyKey('deleteFilesPermanent', intent);
    const headers = addIdempotencyKey({}, idempotencyKey);
    return this.request(`/files/trash/delete`, {
      method: 'POST',
      body: JSON.stringify({ fileIds }),
      headers,
    });
  }

  async deleteFolderPermanently(folderId: string): Promise<ApiResponse<{ message: string; storageFreed: number }>> {
    const idempotencyKey = generateIdempotencyKey('deleteFolderPermanent', folderId);
    const headers = addIdempotencyKey({}, idempotencyKey);
    return this.request(`/folders/trash`, {
      method: 'DELETE',
      body: JSON.stringify({ folderIds: [folderId] }),
      headers,
    });
  }

  async deleteFoldersPermanently(folderIds: string[]): Promise<ApiResponse<{ message: string; storageFreed: number }>> {
    const intent = folderIds.sort().join(',');
    const idempotencyKey = generateIdempotencyKey('deleteFoldersPermanent', intent);
    const headers = addIdempotencyKey({}, idempotencyKey);
    return this.request(`/folders/trash`, {
      method: 'DELETE',
      body: JSON.stringify({ folderIds }),
      headers,
    });
  }

  async restoreFilesFromTrash(fileIds: string[]): Promise<ApiResponse<{ message: string }>> {
    const intent = fileIds.sort().join(',');
    const idempotencyKey = generateIdempotencyKey('restoreFiles', intent);
    const headers = addIdempotencyKey({}, idempotencyKey);
    return this.request(`/files/trash/restore`, {
      method: 'POST',
      body: JSON.stringify({ fileIds }),
      headers,
    });
  }

  async restoreFoldersFromTrash(folderIds: string[]): Promise<ApiResponse<{ message: string }>> {
    const intent = folderIds.sort().join(',');
    const idempotencyKey = generateIdempotencyKey('restoreFolders', intent);
    const headers = addIdempotencyKey({}, idempotencyKey);
    return this.request(`/folders/trash/restore`, {
      method: 'PUT',
      body: JSON.stringify({ folderIds }),
      headers,
    });
  }

  // Upload operations
  async initializeUploadSession(data: {
    encryptedFilename: string;
    filenameSalt: string;
    mimetype: string;
    fileSize: number;
    chunkCount: number;
    shaHash: string;
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
    manifestHash: string;
    manifestSignatureEd25519: string;
    manifestPublicKeyEd25519: string;
    manifestSignatureDilithium: string;
    manifestPublicKeyDilithium: string;
    manifestCreatedAt?: number;
    algorithmVersion: string;
    nonceWrapKyber: string;
    kyberCiphertext: string;
    kyberPublicKey: string;
    nameHmac?: string; // Filename HMAC for zero-knowledge duplicate detection
    forceReplace?: boolean; // Force replace existing file with same HMAC
    existingFileIdToDelete?: string; // File ID to delete when replacing
    isKeepBothAttempt?: boolean; // Flag to indicate this is a keepBoth retry scenario
    clientFileId?: string; // Client-generated fileId for idempotency
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
    manifestCreatedAt?: number;
    storageType: string;
    endpoint: string;
    existingFileId?: string; // ID of the existing file if conflict detected
    isKeepBothConflict?: boolean; // Flag to indicate this is a keepBoth retry scenario
  }>> {
    const idempotencyKey = data.clientFileId 
      ? generateIdempotencyKeyForCreate(data.clientFileId)
      : generateIdempotencyKey('initializeUploadSession', data.shaHash);
    const headers = addIdempotencyKey({}, idempotencyKey);
    return this.request('/files/upload/presigned/initialize', {
      method: 'POST',
      body: JSON.stringify(data),
      headers,
    });
  }

  async finalizeUpload(sessionId: string, data: {
    finalShaHash: string;
    manifestSignature: string;
    manifestPublicKey: string;
    manifestSignatureDilithium: string;
    manifestPublicKeyDilithium: string;
    manifestCreatedAt: number;
    algorithmVersion: string;
  }, fileId?: string): Promise<ApiResponse<{
    fileId: string;
    message: string;
  }>> {
    // Use fileId with operation prefix as idempotency key to distinguish from initialize
    const idempotencyKey = fileId ? generateIdempotencyKey('finalizeUpload', fileId) : undefined;
    const headers = idempotencyKey ? addIdempotencyKey({}, idempotencyKey) : {};
    return this.request(`/files/upload/presigned/${sessionId}/finalize`, {
      method: 'POST',
      body: JSON.stringify(data),
      headers
    });
  }

  async confirmChunkUploads(sessionId: string, data: {
    chunks: Array<{
      index: number;
      chunkSize: number;
      shaHash?: string;
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
    const intent = `${sessionId}:${data.chunks.map(c => c.index).sort().join(',')}`;
    const idempotencyKey = generateIdempotencyKey('confirmChunkUploads', intent);
    const headers = addIdempotencyKey({}, idempotencyKey);
    return this.request(`/files/upload/presigned/${sessionId}/confirm-batch`, {
      method: 'POST',
      body: JSON.stringify(data),
      headers,
    });
  }

  async getDownloadUrls(fileId: string): Promise<ApiResponse<{
    fileId: string;
    storageKey: string;
    originalFilename: string;
    filenameSalt?: string;
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
    // Use priceId as unique intent (creating checkout for same plan)
    const idempotencyKey = generateIdempotencyKey('createCheckout', data.priceId);
    const headers = addIdempotencyKey({}, idempotencyKey);
    return this.request('/billing/create-checkout-session', {
      method: 'POST',
      body: JSON.stringify(data),
      headers,
    });
  }

  async createPortalSession(data: {
    returnUrl: string;
  }): Promise<ApiResponse<{
    url: string;
  }>> {
    // Use returnUrl as unique intent (creating portal session)
    const idempotencyKey = generateIdempotencyKey('createPortal', data.returnUrl);
    const headers = addIdempotencyKey({}, idempotencyKey);
    return this.request('/billing/create-portal-session', {
      method: 'POST',
      body: JSON.stringify(data),
      headers,
    });
  }

  // TOTP endpoints
  async getTOTPStatus(userId?: string): Promise<ApiResponse<{
    enabled: boolean;
    hasRecoveryCodes: boolean;
  }>> {
    const params = userId ? `?userId=${encodeURIComponent(userId)}` : '';
    return this.request(`/totp/status${params}`);
  }

  async setupTOTP(): Promise<ApiResponse<{
    secret: string;
    totpUri: string;
    qrCode: string;
    recoveryCodes: string[];
  }>> {
    // Use user ID as unique intent (setting up TOTP for same user)
    const userId = 'current'; // Could be extracted from auth token if needed
    const idempotencyKey = generateIdempotencyKey('setupTOTP', userId);
    const headers = addIdempotencyKey({}, idempotencyKey);
    return this.request('/totp/setup', {
      method: 'POST',
      headers,
    });
  }

  async verifyTOTPSetup(token: string): Promise<ApiResponse<{
    recoveryCodes: string[];
  }>> {
    // Use token hash as unique intent (verifying same setup)
    const intent = token.substring(0, 8); // First 8 chars as intent identifier
    const idempotencyKey = generateIdempotencyKey('verifyTOTPSetup', intent);
    const headers = addIdempotencyKey({}, idempotencyKey);
    return this.request('/totp/verify', {
      method: 'POST',
      body: JSON.stringify({ token }),
      headers,
    });
  }

  async disableTOTP(token?: string, recoveryCode?: string): Promise<ApiResponse<{
    message: string;
  }>> {
    // Use user ID as unique intent (disabling TOTP for same user)
    const userId = 'current';
    const idempotencyKey = generateIdempotencyKey('disableTOTP', userId);
    const headers = addIdempotencyKey({}, idempotencyKey);
    const body: any = {};
    if (token) body.token = token;
    if (recoveryCode) body.recoveryCode = recoveryCode;

    return this.request('/totp/disable', {
      method: 'DELETE',
      body: JSON.stringify(body),
      headers,
    });
  }

  async verifyTOTPLogin(userId: string, token: string, rememberDevice?: boolean): Promise<ApiResponse<{
    deviceToken?: string;
    token?: string;
  }>> {
    // Use a unique timestamp-based key for each TOTP attempt to avoid idempotency caching blocking retries
    const idempotencyKey = generateIdempotencyKey('verifyTOTPLogin', `${userId}:${Date.now()}`);
    const headers = addIdempotencyKey({}, idempotencyKey);
    return this.request('/totp/verify-login', {
      method: 'POST',
      body: JSON.stringify({ userId, token, rememberDevice }),
      headers,
    });
  }

  // Referral endpoints
  async getReferralInfo(): Promise<ApiResponse<{
    referralCode: string;
    referralLink: string;
    statistics: {
      totalReferrals: number;
      completedReferrals: number;
      totalEarningsMB: number;
      totalEarningsBytes: number;
    };
    recentReferrals: Array<{
      id: string;
      referredUser: {
        id: string;
        name: string;
        email: string;
      };
      status: string;
      earningsMB: number;
      createdAt: string;
      completedAt: string | null;
    }>;
  }>> {
    return this.request('/referrals/info');
  }

  async getReferralLeaderboard(limit?: number): Promise<ApiResponse<{
    leaderboard: Array<{
      rank: number;
      name: string;
      email: string;
      totalReferrals: number;
      totalEarningsMB: number;
      codeCreatedAt: string;
    }>;
  }>> {
    return this.request(`/referrals/leaderboard${limit ? `?limit=${limit}` : ''}`);
  }

  async getReferralEarningsHistory(limit?: number): Promise<ApiResponse<{
    earnings: Array<{
      id: string;
      earningsMB: number;
      description: string;
      createdAt: string;
      referredUser: {
        name: string;
        email: string;
      };
    }>;
  }>> {
    return this.request(`/referrals/earnings${limit ? `?limit=${limit}` : ''}`);
  }

  async validateReferralCode(code: string): Promise<ApiResponse<{
    valid: boolean;
    referrer: {
      id: string;
      name: string;
      email: string;
    };
  }>> {
    return this.request(`/referrals/validate/${code}`);
  }

  async verifyDeviceToken(deviceToken: string): Promise<ApiResponse<{
    isValidDevice: boolean;
  }>> {
    const idempotencyKey = generateIdempotencyKey('verifyDeviceToken', deviceToken.substring(0, 8));
    const headers = addIdempotencyKey({}, idempotencyKey);
    return this.request('/totp/verify-device', {
      method: 'POST',
      body: JSON.stringify({ deviceToken }),
      headers,
    });
  }

  async verifyRecoveryCode(recoveryCode: string, userId?: string): Promise<ApiResponse<{
    valid: boolean;
    token?: string;
  }>> {
    // Use a unique timestamp-based key for each recovery code attempt to avoid idempotency caching blocking retries
    const idempotencyKey = generateIdempotencyKey('verifyRecoveryCode', `${Date.now()}`);
    const headers = addIdempotencyKey({}, idempotencyKey);
    const body: any = { recoveryCode };
    if (userId) body.userId = userId;
    return this.request('/totp/verify-recovery', {
      method: 'POST',
      body: JSON.stringify(body),
      headers,
    });
  }

  // Recovery OTP endpoints
  async initiateRecovery(email: string): Promise<ApiResponse<{
    hasRecovery: boolean;
  }>> {
    const idempotencyKey = generateIdempotencyKey('initiateRecovery', email);
    const headers = addIdempotencyKey({}, idempotencyKey);
    return this.request('/recovery/initiate', {
      method: 'POST',
      body: JSON.stringify({ email }),
      headers,
    });
  }

  async checkRecoveryTOTPAvailability(email: string): Promise<ApiResponse<{
    hasTOTP: boolean;
  }>> {
    const idempotencyKey = generateIdempotencyKey('checkRecoveryTOTPAvailability', email);
    const headers = addIdempotencyKey({}, idempotencyKey);
    return this.request('/recovery/check-totp', {
      method: 'POST',
      body: JSON.stringify({ email }),
      headers,
    });
  }

  async sendRecoveryOTP(email: string): Promise<ApiResponse<{
    success: boolean;
  }>> {
    const idempotencyKey = generateIdempotencyKey('sendRecoveryOTP', email);
    const headers = addIdempotencyKey({}, idempotencyKey);
    return this.request('/recovery/send-otp', {
      method: 'POST',
      body: JSON.stringify({ email }),
      headers,
    });
  }

  async verifyRecoveryOTP(data: {
    email: string;
    mnemonicHash: string;
    method: 'email' | 'totp' | 'backup';
    code: string;
  }): Promise<ApiResponse<{
    success: boolean;
    token?: string;
  }>> {
    const idempotencyKey = generateIdempotencyKey('verifyRecoveryOTP', `${data.email}:${data.method}:${data.code}`);
    const headers = addIdempotencyKey({}, idempotencyKey);
    return this.request('/recovery/verify-otp', {
      method: 'POST',
      body: JSON.stringify(data),
      headers,
    });
  }

  async resetPasswordWithRecovery(data: {
    email: string;
    newOpaquePasswordFile: string;
    encryptedMasterKey: string;
    masterKeyNonce: string;
    encryptedRecoveryKey: string;
    recoveryKeyNonce: string;
    encryptedMasterKeyPassword?: string;
    masterKeyPasswordNonce?: string;
    masterKeyVerificationHash?: string;
  }): Promise<ApiResponse<{
    success: boolean;
    token?: string;
    message?: string;
  }>> {
    // CRITICAL: Include newOpaquePasswordFile in idempotency key so each reset attempt has a unique key
    // If we only use email, the second reset would return cached response from first reset
    const idempotencyKey = generateIdempotencyKey('resetPasswordWithRecovery', data.email + data.newOpaquePasswordFile.substring(0, 32));
    const headers = addIdempotencyKey({}, idempotencyKey);
    return this.request('/recovery/reset-password', {
      method: 'POST',
      body: JSON.stringify(data),
      headers,
    });
  }

  // OAuth endpoints
  async getGoogleOAuthUrl(referralCode?: string): Promise<ApiResponse<{
    authUrl: string;
  }>> {
    const params = referralCode ? `?referralCode=${encodeURIComponent(referralCode)}` : '';
    return this.request(`/auth/oauth/google/url${params}`, {
      method: 'GET',
    });
  }

  async handleGoogleOAuthCallback(code: string, state: string): Promise<ApiResponse<{
    token: string;
    user: {
      id: string;
      email: string;
      has_account_salt: boolean;
    };
  }>> {
    return this.request(`/auth/oauth/google/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`, {
      method: 'GET',
    });
  }

  async completeOAuthRegistration(data: {
    accountSalt: string;
    pqcKeypairs?: any;
    mnemonicHash?: string;
    encryptedRecoveryKey?: string;
    recoveryKeyNonce?: string;
    encryptedMasterKey?: string;
    masterKeySalt?: string;
    algorithmVersion?: string;
    opaquePasswordFile?: string;
  }): Promise<ApiResponse<{
    success: boolean;
    message?: string;
  }>> {
    const idempotencyKey = generateIdempotencyKey('completeOAuthRegistration', 'current');
    const headers = addIdempotencyKey({}, idempotencyKey);
    return this.request('/auth/oauth/complete-registration', {
      method: 'POST',
      body: JSON.stringify(data),
      headers,
    });
  }

  // File signature verification endpoint
  async verifyFileSignature(fileId: string): Promise<ApiResponse<{
    success: boolean;
    verified: boolean;
    status: string;
    message: string;
    signer: {
      id: string;
      email: string;
      name: string;
    } | null;
    signatureResults?: {
      ed25519: boolean;
      dilithium: boolean;
    };
    signedData?: any;
  }>> {
    return this.request(`/files/${fileId}/verify`);
  }

  // Folder signature verification endpoint
  async verifyFolderSignature(folderId: string): Promise<ApiResponse<{
    success: boolean;
    verified: boolean;
    status: string;
    message: string;
    signer: {
      id: string;
      email: string;
      name: string;
    } | null;
    signatureResults?: {
      ed25519: boolean;
      dilithium: boolean;
    };
  }>> {
    return this.request(`/folders/${folderId}/verify`);
  }

  // Notification endpoints
  async getNotifications(params?: {
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<{
    notifications: Array<{
      id: string;
      type: string;
      title: string;
      message: string;
      data: any;
      read_at: string | null;
      created_at: string;
    }>;
    pagination: {
      limit: number;
      offset: number;
      hasMore: boolean;
    };
  }>> {
    const queryParams = new URLSearchParams();
    if (params?.limit !== undefined) {
      queryParams.append('limit', params.limit.toString());
    }
    if (params?.offset !== undefined) {
      queryParams.append('offset', params.offset.toString());
    }

    const queryString = queryParams.toString();
    const endpoint = `/notifications${queryString ? `?${queryString}` : ''}`;

    return this.request(endpoint);
  }

  async getNotificationStats(): Promise<ApiResponse<{
    total: number;
    unread: number;
  }>> {
    return this.request('/notifications/stats');
  }

  async markNotificationAsRead(notificationId: string): Promise<ApiResponse<{
    success: boolean;
    message: string;
  }>> {
    return this.request(`/notifications/${notificationId}/read`, {
      method: 'PUT',
    });
  }

  async markAllNotificationsAsRead(): Promise<ApiResponse<{
    success: boolean;
    message: string;
    markedCount: number;
  }>> {
    return this.request('/notifications/read-all', {
      method: 'PUT',
    });
  }

  async deleteNotification(notificationId: string): Promise<ApiResponse<{
    success: boolean;
    message: string;
  }>> {
    return this.request(`/notifications/${notificationId}`, {
      method: 'DELETE',
    });
  }

  async getNotificationPreferences(): Promise<ApiResponse<{
    inApp: boolean;
    email: boolean;
    login: boolean;
    fileShare: boolean;
    billing: boolean;
  }>> {
    return this.request('/notifications/preferences');
  }

  async updateNotificationPreferences(preferences: {
    inApp: boolean;
    email: boolean;
    login: boolean;
    fileShare: boolean;
    billing: boolean;
  }): Promise<ApiResponse<{
    success: boolean;
    message: string;
  }>> {
    return this.request('/notifications/preferences', {
      method: 'PUT',
      body: JSON.stringify(preferences),
    });
  }

}

export const apiClient = new ApiClient(API_BASE_URL);
export default apiClient;
