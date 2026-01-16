import { generateIdempotencyKey } from './idempotency';
import { getDevicePublicKey, signWithDeviceKey } from './device-keys';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://drive.ellipticc.com/api/v1';

export interface UserData {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  plan?: string;
  // Legacy or API-provided snake_case fields
  account_salt?: string;
  encrypted_master_key_password?: string;
  master_key_password_nonce?: string;
  encryptedMasterKey?: string;
  masterKeySalt?: string;
  masterKeyNonce?: string;
  masterKeyVersion?: number;
  sessionDuration?: number;
  authMethod?: string;
  onboarding_completed?: boolean;
  language?: string;
  appearance_theme?: string;
  theme_sync?: boolean;
  is_verified?: boolean;
  is_checkmarked?: boolean;

  // New metadata fields
  created_at?: string;
  storage_region?: string;
  storage_endpoint?: string;
  crypto_version?: string;
  api_version?: string;
  connectedDevicesCount?: number;
  show_suggestions?: boolean;
  date_format?: string;
  time_format?: string;
  auto_timezone?: boolean;
  timezone?: string;

  storage?: {
    used_bytes: number;
    quota_bytes: number;
    percent_used: number;
    used_readable: string;
    quota_readable: string;
  };
  subscription?: {
    id: string;
    status: string;
    currentPeriodStart: string | Date;
    currentPeriodEnd: string | Date;
    cancelAtPeriodEnd: number;
    plan: {
      id: string;
      name: string;
      storageQuota: number;
      interval: string;
    };
  } | null;
  crypto_keypairs?: {
    accountSalt?: string;
    pqcKeypairs?: PQCKeypairs;
    [key: string]: unknown;
  };
}

export interface FolderTreeItem {
  id: string;
  encryptedName: string;
  nameSalt: string;
  path: string;
  parentId: string | null;
  isFolder: boolean;
  children: FolderTreeItem[];
  files: FileTreeItem[];
}

export interface FileTreeItem {
  id: string;
  encryptedFilename: string;
  filenameSalt: string;
  size: number;
  mimetype: string;
  folderId: string | null;
  wrappedCek: string;
  nonceWrap: string;
}

export interface FileInfo {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  createdAt: string;
  updatedAt: string;
  shaHash: string | null;
  folderId: string | null;
  is_shared: boolean;
  tags?: Tag[];
  encryption?: {
    iv: string;
    salt: string;
    wrappedCek: string;
    fileNoncePrefix: string;
    cekNonce: string;
  };
}

export interface FolderInfo {
  id: string;
  name: string;
  encryptedName?: string;
  nameSalt?: string;
  path: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  is_shared: boolean;
  tags?: Tag[];
}

export interface Tag {
  id: string;
  encrypted_name: string;
  name_salt: string;
  color?: string;
  decryptedName?: string;
}

export interface DownloadUrlsResponse {
  fileId: string;
  storageKey: string;
  originalFilename: string;
  filenameSalt?: string;
  mimetype: string;
  size: number;
  sha256: string | null;
  chunkCount: number;
  chunks: Array<{
    index: number;
    size: number;
    sha256: string | null;
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
  manifest?: unknown;
  signatures?: unknown;
  encryption?: unknown;
  storageType: string;
}

export interface CreateShareParams {
  file_id?: string;
  folder_id?: string;
  paper_id?: string;
  wrapped_cek?: string;
  nonce_wrap?: string;
  has_password: boolean;
  salt_pw?: string;
  expires_at?: string;
  max_views?: number;
  max_downloads?: number;
  permissions?: 'read' | 'write' | 'admin';
  comments_enabled?: boolean;
  encrypted_filename?: string;
  nonce_filename?: string;
  encrypted_foldername?: string;
  nonce_foldername?: string;
  encrypted_manifest?: { encryptedData: string; nonce: string };
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
  status?: number;
  total?: number | string;
  page?: number | string;
  pageSize?: number | string;
}

export interface PQCKeypairs {
  kyber: {
    publicKey: string;
    encryptedPrivateKey: string;
    privateKeyNonce: string;
    encryptionKey: string;
    encryptionNonce: string;
  };
  x25519: {
    publicKey: string;
    encryptedPrivateKey: string;
    privateKeyNonce: string;
    encryptionKey: string;
    encryptionNonce: string;
  };
  dilithium: {
    publicKey: string;
    encryptedPrivateKey: string;
    privateKeyNonce: string;
    encryptionKey: string;
    encryptionNonce: string;
  };
  ed25519: {
    publicKey: string;
    encryptedPrivateKey: string;
    privateKeyNonce: string;
    encryptionKey: string;
    encryptionNonce: string;
  };
}

export interface Space {
  id: string;
  owner_user_id: string;
  encrypted_name: string;
  name_salt: string;
  icon?: string;
  color?: string;
  created_at: string;
  updated_at: string;
  items?: SpaceItem[];
  decryptedName?: string;
}

export interface SpaceItem {
  id: string;
  space_id: string;
  file_id?: string;
  folder_id?: string;
  created_at: string;
  // Metadata for display
  encrypted_filename?: string;
  filename_salt?: string;
  mimetype?: string;
  size?: number;
  encrypted_name?: string;
  name_salt?: string;
  file_folder_id?: string;
  decryptedName?: string;
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
  type: 'file' | 'folder' | 'paper';
  createdAt: string;
  updatedAt: string;
  shaHash?: string | null; // File hash (SHA512)
  sessionSalt?: string;
  is_shared?: boolean; // Whether this file/folder is currently shared
  is_starred?: boolean; // Whether this file/folder is currently in a space (starred)
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
  lockedUntil?: string | null;
  retentionMode?: string | null;
  tags?: Tag[];
}

export interface RecentItem {
  id: string; // The file or folder ID
  recentId: string; // The ID from recent_items table
  type: 'file' | 'folder';
  name: string; // Display name (decrypted or placeholder)
  encryptedName?: string;
  nameSalt?: string;
  mimeType?: string; // For files
  size?: number; // For files
  parentId?: string | null;
  accessedAt: string;
}

export interface FolderContentItem {
  id: string;
  name?: string;
  encryptedName: string;
  nameSalt: string;
  parentId: string | null;
  path: string;
  type: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  is_shared: boolean;
  is_starred: boolean;
  lockedUntil?: string | null;
  retentionMode?: string | null;
  tags?: Tag[];
}

export interface FileContentItem {
  id: string;
  filename?: string; // Optional human-readable filename
  encryptedFilename: string;
  filenameSalt: string;
  // Legacy snake_case aliases
  mimeType?: string;
  mimetype?: string;
  folderId: string | null;
  // Legacy snake_case aliases
  folder_id?: string;
  type: string;
  createdAt: string;
  created_at?: string;
  updatedAt: string;
  updated_at?: string;
  deletedAt?: string;
  deleted_at?: string;
  size?: number;
  shaHash: string | null;
  sha_hash?: string | null;
  is_shared: boolean;
  is_starred: boolean;
  lockedUntil?: string | null;
  tags?: Tag[];
}

export interface ShareItem {
  id: string;
  fileId?: string;
  folderId?: string;
  paperId?: string;
  wrappedCek?: string;
  nonceWrap?: string;
  has_password: boolean;
  salt_pw?: string;
  expires_at?: string;
  max_views?: number;
  max_downloads?: number;
  view_count: number;
  download_count: number;
  permissions: 'read' | 'write' | 'admin';
  revoked: boolean;
  comments_enabled?: boolean;
  encrypted_filename?: string;
  nonce_filename?: string;
  encrypted_foldername?: string;
  nonce_foldername?: string;

  // CamelCase aliases for UI compatibility
  fileName?: string;
  fileSize?: number;
  createdAt?: string;
  linkSecret?: string;
  folderPath?: string;
  folderPathSalt?: string;
  isFolder?: boolean;
  encryptedFilename?: string;
  filenameSalt?: string;
  expiresAt?: string;
  views?: number;
  downloads?: number;
  mimeType?: string;

  recipients: Array<{
    id: string;
    userId?: string;
    email?: string;
    name?: string;
    status: string;
    createdAt: string;
    revokedAt?: string;
  }>;
}

export interface ShareComment {
  id: string;
  shareId: string;
  userId: string;
  parentId: string | null;
  content: string; // Encrypted (base64)
  createdAt: string;
  updatedAt: string;
  userName: string;
  userEmail?: string;
  avatarUrl: string;
  fingerprint?: string; // HMAC-SHA512 hex
  signature?: string;   // ed25519 signature hex
  publicKey?: string;   // ed25519 public key hex
  attachments?: Array<{
    id: string;
    fileSize: number;
    encryptedFilename: string;
    nonceFilename: string;
    mimetype: string;
    encryptionNonce: string;
    createdAt: string;
  }>;
}

export interface ShareCommentsResponse {
  comments: ShareComment[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface Referral {
  referred_user_id: string;
  referred_name: string;
  referred_email: string;
  avatar_url: string;
  status: string;
  created_at: string;
  completed_at: string | null;
}

export interface Subscription {
  id: string;
  status: string;
  currentPeriodStart: number;
  currentPeriodEnd: number;
  cancelAtPeriodEnd: boolean;
  plan: {
    id: string;
    name: string;
    storageQuota: number;
    // Optional interval (e.g., 'monthly', 'yearly')
    interval?: string | number | null;
  };
}

export interface BillingUsage {
  usedBytes: number;
  quotaBytes: number;
  percentUsed: number;
}

export interface PricingPlan {
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
}

export interface SubscriptionHistory {
  history: Array<{
    id: string;
    status: string;
    planName: string;
    amount: number;
    currency: string;
    interval: string;
    currentPeriodStart: number;
    currentPeriodEnd: number;
    cancelAtPeriodEnd: boolean;
    canceledAt: number | null;
    created: number;
    endedAt: number | null;
    provider?: string;
  }>;
  invoices: Array<{
    id: string;
    number: string;
    status: string;
    amount: number;
    currency: string;
    created: number;
    dueDate: number | null;
    paidAt: number | null;
    invoicePdf: string;
    hostedInvoiceUrl: string;
    subscriptionId: string | null;
    provider?: string;
  }>;
}

export interface SecurityEvent {
  id: string;
  eventType: string;
  status: string;
  ipAddress: string;
  location: string;
  userAgent: string;
  createdAt: string;
  additionalData?: Record<string, unknown>;
  latitude?: number;
  longitude?: number;
  city?: string;
  country?: string;
  region?: string;
  asn?: string;
  isp?: string;
  ipType?: string;
  isVpn?: boolean;
  isProxy?: boolean;
  isTor?: boolean;
  riskLevel?: string;
  riskSignals?: string[];
}

export interface ShareAccessLog {
  id: string;
  session_id: string;
  action: 'VIEW' | 'DOWNLOAD';
  country: string | null;
  device_type: string | null;
  browser: string | null;
  os: string | null;
  user_agent: string | null;
  created_at: string;
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
    const authPages = ['/login', '/signup', '/otp', '/recover', '/recover/otp', '/recover/reset', '/backup', '/totp'];
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
    // Build the request URL
    const requestUrl = `${this.baseURL}${endpoint}`;

    // Extract headers separately to avoid them being overwritten by ...options spread
    const { headers: optionHeaders, ...otherOptions } = options;

    // Only set Content-Type if body is not FormData (FormData needs browser to set boundary)
    const isFormData = otherOptions.body instanceof FormData;

    const config: RequestInit = {
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...optionHeaders,  // Spread headers from options
      },
      credentials: 'include', // Essential for CORS and credentialed requests
      ...otherOptions,  // Spread other options WITHOUT headers
    };

    // Add idempotency key to EVERY request if not already provided
    const headers = config.headers as Record<string, string>;
    if (!headers['X-Idempotency-Key'] && !headers['x-idempotency-key']) {
      headers['X-Idempotency-Key'] = generateIdempotencyKey();
    }

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

      if (typeof window !== 'undefined') {
        const deviceId = localStorage.getItem('device_id');
        const publicKey = await getDevicePublicKey().catch(() => null);

        if (deviceId && publicKey) {
          try {
            const timestamp = Date.now().toString();
            let fullPath = endpoint;

            if (!endpoint.startsWith('http')) {
              try {
                const urlObj = new URL(requestUrl);
                fullPath = urlObj.pathname + urlObj.search;
              } catch {
                fullPath = endpoint;
              }
            }

            const method = (config.method || 'GET').toUpperCase();
            const message = `${method}:${fullPath}:${timestamp}`;
            const signature = await signWithDeviceKey(message);

            if (!config.headers) {
              config.headers = {};
            }

            const headers = config.headers as Record<string, string>;
            headers['X-Device-Id'] = deviceId;
            headers['X-Device-Signature'] = signature;
            headers['X-Device-Timestamp'] = timestamp;

          } catch (err) {
            console.error('Device signature generation failed:', err);
          }
        }
      }
    }

    try {
      const response = await fetch(requestUrl, config);



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
          return { ...data, status: response.status };
        }

        // If backend didn't include success field, add it
        return {
          success: false,
          error: data.error || `HTTP ${response.status}`,
          data: data,
          status: response.status
        };
      }

      // Handle responses that already have success property
      // Some endpoints return: { success: true, data: { user: ... } } (already wrapped)
      // Others return: { success: true, sessionId: ..., presigned: ... } (needs wrapping)
      if (data.success !== undefined) {
        const { success, error, ...responseData } = data;

        // If already has 'data' property (like from /auth/me), return as-is
        if (responseData.data !== undefined) {
          const { data: innerData, total, page, pageSize, ...rest } = responseData;
          return {
            success,
            ...(error && { error }),
            data: innerData as T,
            status: response.status,
            total,
            page,
            pageSize,
            ...rest
          };
        }

        // Otherwise wrap other properties as data (like presigned upload responses)
        return {
          success,
          ...(error && { error }),
          data: responseData as unknown as T,
          status: response.status
        };
      }

      // Otherwise wrap raw response in ApiResponse format
      return {
        success: true,
        data: data,
        status: response.status
      };
    } catch (error) {
      console.error('API request failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getThumbnailBlob(fileId: string): Promise<Blob | null> {
    const endpoint = `/photos/${fileId}/thumbnail`;
    const requestUrl = `${this.baseURL}${endpoint}`;

    const config: RequestInit = {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      credentials: 'include'
    };

    const token = this.getToken();
    if (token) {
      if (this.isTokenExpired(token)) {
        return null;
      }
      (config.headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }

    // Add idempotency key
    (config.headers as Record<string, string>)['X-Idempotency-Key'] = generateIdempotencyKey();

    if (typeof window !== 'undefined') {
      const deviceId = localStorage.getItem('device_id');
      const publicKey = await getDevicePublicKey().catch(() => null);

      if (deviceId && publicKey) {
        const timestamp = Date.now().toString();

        // Replicate fullPath logic from request method to match backend expectation
        let fullPath = endpoint;
        if (!endpoint.startsWith('http')) {
          try {
            const urlObj = new URL(requestUrl);
            fullPath = urlObj.pathname + urlObj.search;
          } catch {
            fullPath = endpoint;
          }
        }

        const message = `GET:${fullPath}:${timestamp}`;

        try {
          const signature = await signWithDeviceKey(message);
          const headers = config.headers as Record<string, string>;
          headers['X-Device-Id'] = deviceId;
          headers['X-Device-Signature'] = signature;
          headers['X-Device-Timestamp'] = timestamp;
        } catch (e) {
          console.error("Failed to sign thumbnail request", e);
        }
      }
    }

    try {
      const response = await fetch(requestUrl, config);
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.url) {
          const blobResponse = await fetch(result.url);
          if (blobResponse.ok) {
            return await blobResponse.blob();
          }
        }
      }
      // If 404, just return null (no thumbnail)
      if (response.status === 404) return null;

      console.warn(`Thumbnail fetch failed: ${response.status}`);
      return null;
    } catch (e) {
      console.error("Error fetching thumbnail:", e);
      return null;
    }
  }



  private getToken(): string | null {
    if (typeof window === 'undefined') return null;



    // Try to get from current storage first - check both 'auth_token' and 'auth' formats
    const storage = this.getStorage();

    // First try the standard 'auth_token' format (used by regular login)
    const authToken = storage.getItem('auth_token');
    if (authToken) return authToken;



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
    storage.removeItem('auth_token');
    document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  }

  // Auth endpoints
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
    user: UserData;
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
    user: UserData;
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
    user: UserData;
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
      // Capture device token before clearing storage
      const deviceToken = typeof localStorage !== 'undefined' ? localStorage.getItem('totp_device_token') : null;

      this.clearToken();
      // Clear all localStorage
      if (typeof localStorage !== 'undefined') {
        localStorage.clear();
        // Restore device token to localStorage after clear
        if (deviceToken) {
          localStorage.setItem('totp_device_token', deviceToken);
        }
      }
      // Clear all sessionStorage
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.clear();
      }
      // Clear cookies selectively - DO NOT clear totp_device_token
      if (typeof document !== 'undefined') {
        const cookies = document.cookie.split(';');
        for (const cookie of cookies) {
          const [name] = cookie.trim().split('=');
          if (name === 'totp_device_token') continue; // PERSIST DEVICE TOKEN

          document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; domain=${window.location.hostname}`;
          document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; domain=.${window.location.hostname}`;
          document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
        }
      }
    }

    return response;
  }

  async getProfile(): Promise<ApiResponse<{
    user: UserData;
    limitReached: boolean;
    deviceQuota: { planName: string; maxDevices: number } | null;
  }>> {
    return this.request('/auth/me');
  }

  async completeOnboarding(): Promise<ApiResponse> {
    return this.request('/auth/onboarding/complete', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  async updateProfile(data: {
    name?: string;
    email?: string;
    avatar?: string;
    language?: string;
    appearance_theme?: string;
    theme_sync?: boolean;
    show_suggestions?: boolean;
    date_format?: string;
    time_format?: string;
    auto_timezone?: boolean;
    timezone?: string;
  }): Promise<ApiResponse> {
    return this.request('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * Update user's session duration preference
   */
  async updateSessionDuration(sessionDuration: number): Promise<ApiResponse> {
    return this.request('/auth/session-duration', {
      method: 'POST',
      body: JSON.stringify({ sessionDuration }),
    });
  }

  /**
   * Initiate email change process - sends OTP to new email
   */
  async initiateEmailChange(newEmail: string): Promise<ApiResponse<{ emailChangeToken: string }>> {
    return this.request('/auth/email/change/initiate', {
      method: 'POST',
      body: JSON.stringify({ newEmail }),
    });
  }

  /**
   * Verify email change with OTP
   */
  async verifyEmailChange(emailChangeToken: string, otpCode: string): Promise<ApiResponse> {
    return this.request('/auth/email/change/verify', {
      method: 'POST',
      body: JSON.stringify({ emailChangeToken, otpCode }),
    });
  }

  /**
   * Change password using OPAQUE protocol
   * Client-side OPAQUE operations ensure password is never sent to backend
   */
  async changePassword(data: {
    newOpaquePasswordFile: string;  // New OPAQUE registration record from OPAQUE step 3
    encryptedMasterKey?: string;
    masterKeySalt?: string;
    masterKeyNonce?: string;
    masterKeyVersion?: number;
  }): Promise<ApiResponse> {
    return this.request('/auth/password/change', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async uploadAvatar(formData: FormData, fileHash?: string): Promise<ApiResponse<{ avatarUrl: string }>> {
    const requestHeaders: Record<string, string> = {};
    if (fileHash) {
      requestHeaders['X-Avatar-Hash'] = fileHash;
    }

    return this.request('/auth/avatar', {
      method: 'POST',
      body: formData,
      headers: requestHeaders,
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

  async storePQCKeys(userId: string, pqcKeypairs: PQCKeypairs): Promise<ApiResponse> {
    return this.request('/auth/crypto', {
      method: 'PUT',
      body: JSON.stringify({ userId, pqcKeypairs }),
    });
  }

  async storePQCKeysAfterRegistration(userId: string, pqcKeypairs: PQCKeypairs): Promise<ApiResponse> {
    return this.request('/auth/crypto/setup', {
      method: 'POST',
      body: JSON.stringify({ userId, pqcKeypairs }),
    });
  }

  async storeCryptoKeypairs(data: {
    userId: string;
    accountSalt: string;
    pqcKeypairs: PQCKeypairs;
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
    return this.request('/auth/crypto/setup', {
      method: 'POST',
      body: JSON.stringify(data),
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
    });
  }

  async getSessions(page = 1, limit = 5, onlyActive = true): Promise<ApiResponse<{
    currentSessionId: string;
    sessions: Array<{
      id: string;
      ip_address: string;
      user_agent: string;
      device_info: Record<string, unknown>;
      is_revoked: boolean;
      last_active: string;
      created_at: string;
      isCurrent: boolean;
    }>;
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }>> {
    return this.request(`/auth/sessions?page=${page}&limit=${limit}&onlyActive=${onlyActive}`);
  }

  async revokeSession(sessionId: string): Promise<ApiResponse> {
    return this.request('/auth/sessions/revoke', {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    });
  }

  async revokeAllSessions(): Promise<ApiResponse> {
    return this.request('/auth/sessions/revoke-all', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  // Store or clear authentication token
  setAuthToken(token: string | null): void {
    if (token === null) {
      this.clearToken();
    } else {
      this.setToken(token);
    }
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
    page?: number;
  }): Promise<ApiResponse<{
    files: FileItem[];
    pagination: {
      limit: number;
      offset: number;
      page: number;
      total: number;
      totalPages: number;
      hasMore: boolean; // Keep for backward compatibility if possible, or calculate it
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
    if (params?.page !== undefined) {
      queryParams.append('page', params.page.toString());
    }

    const queryString = queryParams.toString();
    const endpoint = `/files${queryString ? `?${queryString}` : ''}`;

    return this.request(endpoint);
  }

  // Recent items endpoints
  async addRecentItem(data: { id: string; type: 'file' | 'folder' }): Promise<ApiResponse> {
    return this.request('/recent', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Fetch recent items (optional folder scoping)
  async getRecentItems(limit = 15, folderId?: string | null): Promise<ApiResponse<RecentItem[]>> {
    const queryParams = new URLSearchParams();
    queryParams.append('limit', limit.toString());
    if (folderId) queryParams.append('folderId', folderId);
    const endpoint = `/recent${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
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
    clientFolderId?: string;
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
  // Get folder contents (both files and folders)
  async getFolderContents(folderId: string = 'root', params?: { page?: number; limit?: number }): Promise<ApiResponse<{
    folders: FolderContentItem[];
    files: FileContentItem[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }>> {
    const normalizedFolderId = folderId === 'root' ? 'root' : folderId;
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    const queryString = query.toString();
    const endpoint = `/folders/${normalizedFolderId}/contents${queryString ? `?${queryString}` : ''}`;
    return this.request(endpoint);
  }

  // Get folder contents recursively (including all nested folders and files)
  async getFolderContentsRecursive(folderId: string = 'root'): Promise<ApiResponse<{
    folder: FolderTreeItem;
    allFiles: FileTreeItem[];
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
    return this.request(`/files/${fileId}/rename`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async moveFileToFolder(fileId: string, folderId: string | null, nameHmac?: string): Promise<ApiResponse<{
    fileId: string;
    folderId: string | null;
  }>> {
    return this.request(`/files/${fileId}/move`, {
      method: 'PUT',
      body: JSON.stringify({ folderId, nameHmac }),
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
    return this.request(`/trash`, {
      method: 'DELETE',
      body: JSON.stringify({ fileIds: [fileId] }),
    });
  }

  async downloadFile(fileId: string): Promise<ApiResponse<Blob>> {
    // This will return a blob for download
    const response = await fetch(`${this.baseURL}/files/${fileId}/download`, {
      headers: {
        'Authorization': `Bearer ${this.getToken()}`,
        'X-Idempotency-Key': generateIdempotencyKey(),
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

  async getFileInfo(fileId: string): Promise<ApiResponse<FileInfo>> {
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
    return this.request(`/folders/${folderId}/rename`, {
      method: 'PUT',
      body: JSON.stringify(data),
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

  async lockFile(fileId: string, data: { durationDays: number; totpToken: string }): Promise<ApiResponse> {
    return this.request(`/files/${fileId}/lock`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async lockFolder(folderId: string, data: { durationDays: number; totpToken: string }): Promise<ApiResponse> {
    return this.request(`/folders/${folderId}/lock`, {
      method: 'POST',
      body: JSON.stringify(data),
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
      body: JSON.stringify({ folderIds: [folderId] }),
    });
  }

  async getFolderInfo(folderId: string): Promise<ApiResponse<FolderInfo>> {
    return this.request(`/folders/${folderId}`);
  }

  async getFolderPath(folderId: string): Promise<ApiResponse<{ path: Array<{ id: string; encryptedName: string; nameSalt: string }> }>> {
    return this.request(`/folders/${folderId}/path`);
  }

  async createShare(data: CreateShareParams): Promise<ApiResponse<{
    id: string;
    encryption_version?: number;
    reused?: boolean;
    sharedFiles?: number;
  }>> {
    // Use shares endpoint directly for files/papers, shares/folder for folders
    const endpoint = data.folder_id ? '/shares/folder' : '/shares';
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
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
      encrypted_name?: string;
      nonce_name?: string;
    };
    comments_enabled?: boolean;
    comments_locked?: boolean;
    owner_is_checkmarked?: boolean;
  }>> {
    return this.request(`/shares/${shareId}`);
  }

  // Spaces & Starring

  async starFile(fileId: string): Promise<ApiResponse<{ success: boolean }>> {
    return this.request('/files/spaced', {
      method: 'POST',
      body: JSON.stringify({ fileId, isStarred: true }),
    });
  }

  async unstarFile(fileId: string): Promise<ApiResponse<{ success: boolean }>> {
    return this.request('/files/spaced', {
      method: 'POST',
      body: JSON.stringify({ fileId, isStarred: false }),
    });
  }

  // Renaming Alias (for consistency with frontend calls)
  async updateFile(fileId: string, data: {
    encryptedFilename?: string;
    filenameSalt?: string;
    nameHmac?: string;
    // Manifest fields
    manifestHash?: string;
    manifestSignatureEd25519?: string;
    manifestPublicKeyEd25519?: string;
    manifestSignatureDilithium?: string;
    manifestPublicKeyDilithium?: string;
    manifestCreatedAt?: number;
    algorithmVersion?: string;
  }): Promise<ApiResponse<{ success: boolean }>> {
    return this.request(`/files/${fileId}/rename`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
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

  async moveToTrash(folderIds?: string[], fileIds?: string[], paperIds?: string[]): Promise<ApiResponse<{ message: string }>> {
    return this.request('/folders/trash', {
      method: 'POST',
      body: JSON.stringify({ folderIds, fileIds, paperIds }),
    });
  }

  async restorePapersFromTrash(paperIds: string[]): Promise<ApiResponse<{ message: string }>> {
    return this.request('/trash/restore', {
      method: 'POST',
      body: JSON.stringify({ paperIds }),
    });
  }

  async createPaper(data: {
    encryptedTitle: string;
    titleSalt: string;
    folderId?: string | null;
    encryptedContent?: string;
    iv: string;
    salt: string;
  }): Promise<ApiResponse<{ id: string; message: string }>> {
    return this.request('/papers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getPaper(id: string): Promise<ApiResponse<{
    id: string;
    encryptedTitle: string;
    titleSalt: string;
    encryptedContent: string;
    iv: string;
    salt: string;
    createdAt: string;
    updatedAt: string;
    folderId: string | null;
    chunks?: Record<string, { encryptedContent: string; iv: string; salt: string }>;
  }>> {
    return this.request(`/papers/${id}`);
  }

  async savePaperBlocks(paperId: string, data: {
    encryptedTitle?: string;
    titleSalt?: string;
    manifest?: string;
    chunksToUpload?: Array<{ chunkId: string; content: string; size: number }>;
    chunksToDelete?: string[];
  }): Promise<ApiResponse> {
    return this.request(`/papers/${paperId}/blocks`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async getPaperUploadUrls(paperId: string, blocks: Array<{ blockId: string; size: number; checksum?: string }>): Promise<ApiResponse<{ urls: Record<string, string> }>> {
    return this.request(`/papers/${paperId}/s3`, {
      method: 'POST',
      body: JSON.stringify({ blocks })
    });
  }

  async getBlock(paperId: string, blockId: string): Promise<ApiResponse<{ encryptedContent: string; iv: string; salt: string }>> {
    return this.request(`/papers/${paperId}/blocks/${blockId}`);
  }

  async createBlock(paperId: string, blockId: string, data: { content: string; size: number }): Promise<ApiResponse> {
    return this.request(`/papers/${paperId}/blocks/${blockId}`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateBlock(paperId: string, blockId: string, data: { content: string; size: number }): Promise<ApiResponse> {
    return this.request(`/papers/${paperId}/blocks/${blockId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteBlock(paperId: string, blockId: string): Promise<ApiResponse> {
    return this.request(`/papers/${paperId}/blocks/${blockId}`, {
      method: 'DELETE'
    });
  }

  async savePaper(id: string, data: {
    encryptedTitle?: string;
    titleSalt?: string;
  }): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return this.request(`/papers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async movePaperToTrash(id: string): Promise<ApiResponse<{ success: boolean; message: string }>> {
    // Single item move to trash
    return this.request(`/papers/${id}/trash`, {
      method: 'POST'
    });
  }

  async movePaperToFolder(id: string, folderId: string | null): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return this.request(`/papers/${id}/move`, {
      method: 'PUT',
      body: JSON.stringify({ folderId })
    });
  }

  async restorePaper(id: string): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return this.request(`/papers/${id}/restore`, {
      method: 'POST'
    });
  }

  async deletePaper(id: string): Promise<ApiResponse<{ success: boolean; message: string }>> {
    // Single item permanent delete
    return this.request(`/papers/${id}`, {
      method: 'DELETE'
    });
  }

  async deletePapersPermanently(paperIds: string[]): Promise<ApiResponse<{ message: string; storageFreed: number }>> {
    // Bulk permanent delete (using unified endpoint)
    return this.request('/trash', {
      method: 'DELETE',
      body: JSON.stringify({ paperIds }),
    });
  }

  async getTrashPapers(params?: {
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<{
    papers: {
      id: string;
      encryptedTitle: string;
      titleSalt: string;
      createdAt: string;
      updatedAt: string;
      deletedAt: string;
      folderId: string | null;
    }[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }>> {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    return this.request(`/papers/trash?${query.toString()}`);
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

  async getShareManifest(shareId: string): Promise<ApiResponse<unknown>> {
    return this.request(`/shares/${shareId}/manifest`);
  }

  async trackShareDownload(shareId: string): Promise<ApiResponse<{ success: boolean }>> {
    return this.request(`/shares/${shareId}/download`, {
      method: 'POST',
    });
  }

  async trackShareView(shareId: string): Promise<ApiResponse<{ success: boolean }>> {
    return this.request(`/shares/${shareId}/view`, {
      method: 'POST',
    });
  }

  async disableShare(shareIdOrIds: string | string[]): Promise<ApiResponse<{ success: boolean; revokedCount?: number; cascadedFileShares?: number }>> {
    const shareIds = Array.isArray(shareIdOrIds) ? shareIdOrIds : [shareIdOrIds];

    return this.request('/shares/delete', {
      method: 'POST',
      body: JSON.stringify({ shareIds }),
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

  async getMyShares(params?: {
    page?: number;
    limit?: number;
    fileId?: string;
  }): Promise<ApiResponse<{
    data: ShareItem[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }>> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.fileId) queryParams.append('fileId', params.fileId);

    const queryString = queryParams.toString();
    return this.request(`/shares/mine${queryString ? `?${queryString}` : ''}`);
  }

  async getReceivedShares(params?: { page?: number; limit?: number }): Promise<ApiResponse<{
    data: {
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
    }[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }>> {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    return this.request(`/shares/received?${query.toString()}`);
  }

  async reportShare(shareId: string, data: {
    reportType: string;
    description?: string;
    email?: string;
    turnstileToken: string;
  }): Promise<ApiResponse<{
    success: boolean;
    autoDeactivated?: boolean;
    duplicate?: boolean;
  }>> {
    // Use ThumbmarkJS for robust fingerprinting (Exact same process as /authorize device)
    const { getThumbmark } = await import('@thumbmarkjs/thumbmarkjs');
    const fingerprint = await getThumbmark();

    // Hash the fingerprint for storage
    const fingerprintStr = typeof fingerprint === 'string' ? fingerprint : JSON.stringify(fingerprint);
    const fingerprintHash = await this.hashFingerprint(fingerprintStr);

    const metadata = {
      screenRes: `${window.screen.width}x${window.screen.height}`,
      colorDepth: window.screen.colorDepth,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      platform: navigator.platform,
      hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
      touchSupport: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
      fingerprint: fingerprint
    };

    return this.request(`/shares/${shareId}/report`, {
      method: 'POST',
      body: JSON.stringify({
        ...data,
        fingerprintHash,
        metadata
      }),
    });
  }

  // Spaces Management
  async getSpaces(): Promise<ApiResponse<Space[]>> {
    return this.request('/spaces');
  }

  async createSpace(data: {
    encryptedName: string;
    nameSalt: string;
    icon?: string;
    color?: string;
  }): Promise<ApiResponse<{ id: string }>> {
    return this.request('/spaces', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async reorderSpaces(spaceIds: string[]): Promise<ApiResponse<unknown>> {
    return this.request('/spaces/reorder', {
      method: 'POST',
      body: JSON.stringify({ spaceIds })
    });
  }

  async getPhotos(limit = 100, offset = 0): Promise<ApiResponse<unknown[]>> {
    return this.request(`/photos?limit=${limit}&offset=${offset}`, {
      method: 'GET'
    });
  }

  async getThumbnailUrl(fileId: string): Promise<ApiResponse<{ url: string }>> {
    return this.request(`/photos/${fileId}/thumbnail`, {
      method: 'GET'
    });
  }

  async getStarredItems(): Promise<ApiResponse<SpaceItem[]>> {
    return this.request('/files/spaced', { method: 'GET' });
  }

  async setItemStarred(data: {
    fileId?: string;
    folderId?: string;
    paperId?: string;
    fileIds?: string[];
    folderIds?: string[];
    paperIds?: string[];
    isStarred: boolean
  }): Promise<ApiResponse<unknown>> {
    return this.request('/files/spaced', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async renameSpace(spaceId: string, data: {
    encryptedName: string;
    nameSalt: string;
    icon?: string;
    color?: string;
  }): Promise<ApiResponse<{ success: boolean }>> {
    return this.request(`/spaces/${spaceId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteSpace(spaceId: string): Promise<ApiResponse<{ success: boolean }>> {
    return this.request(`/spaces/${spaceId}`, {
      method: 'DELETE',
    });
  }

  async getSpaceItems(spaceId: string): Promise<ApiResponse<SpaceItem[]>> {
    return this.request(`/spaces/${spaceId}/items`);
  }

  async addItemToSpace(spaceId: string, data: {
    fileId?: string;
    folderId?: string;
    fileIds?: string[];
    folderIds?: string[];
  }): Promise<ApiResponse<{ id: string }>> {
    return this.request(`/spaces/${spaceId}/items`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async removeItemFromSpace(spaceId: string, itemId: string): Promise<ApiResponse<unknown>> {
    return this.request(`/spaces/${spaceId}/items/${itemId}`, {
      method: 'DELETE',
    });
  }

  async moveItemToSpace(spaceId: string, itemId: string, targetSpaceId: string): Promise<ApiResponse<unknown>> {
    return this.request(`/spaces/${spaceId}/items/${itemId}/move`, {
      method: 'POST',
      body: JSON.stringify({ targetSpaceId }),
    });
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
      shaHash: string | null;
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

  async getTrashFolders(params?: { page?: number; limit?: number }): Promise<ApiResponse<{
    data: {
      id: string;
      encryptedName: string;
      nameSalt: string;
      parentId: string | null;
      path: string;
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
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());

    const response = await this.request(`/folders/trash/list?${query.toString()}`);

    if (response.success && response.data) {
      const folders = (response.data as { folders?: FolderInfo[] }).folders || [];
      const pagination = (response.data as { pagination?: { total: number; page: number; limit: number; totalPages: number } }).pagination || {
        page: params?.page || 1,
        limit: params?.limit || 50,
        total: folders.length,
        totalPages: 1
      };

      return {
        success: true,
        data: {
          data: folders.map(f => ({
            ...f,
            encryptedName: f.encryptedName || '',
            nameSalt: f.nameSalt || '',
            deletedAt: f.deletedAt || ''
          })),
          pagination
        }
      };
    }
    return {
      success: false,
      error: response.error || 'Failed to fetch trash folders'
    };
  }
  async deleteFilePermanently(fileId: string): Promise<ApiResponse<{ message: string; storageFreed: number }>> {
    return this.request(`/trash`, {
      method: 'DELETE',
      body: JSON.stringify({ fileIds: [fileId] }),
    });
  }

  async deleteFilesPermanently(fileIds: string[]): Promise<ApiResponse<{ message: string; storageFreed: number }>> {
    return this.request(`/trash`, {
      method: 'DELETE',
      body: JSON.stringify({ fileIds }),
    });
  }

  async deleteFolderPermanently(folderId: string): Promise<ApiResponse<{ message: string; storageFreed: number }>> {
    return this.request(`/trash`, {
      method: 'DELETE',
      body: JSON.stringify({ folderIds: [folderId] }),
    });
  }

  async deleteFoldersPermanently(folderIds: string[]): Promise<ApiResponse<{ message: string; storageFreed: number }>> {
    return this.request(`/trash`, {
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

  async deleteFromTrash(folderIds?: string[], fileIds?: string[], paperIds?: string[]): Promise<ApiResponse<{ success: boolean; message: string; deletedCount: number; requestedCount: number }>> {
    return this.request(`/trash`, {
      method: 'DELETE',
      body: JSON.stringify({ folderIds, fileIds, paperIds }),
    });
  }

  async copyFile(fileId: string, folderId: string | null, options?: {
    filename?: string,
    encryptedFilename?: string,
    filenameSalt?: string,
    nameHmac?: string,
    // Manifest fields for signed copied file
    manifestHash?: string,
    manifestSignatureEd25519?: string,
    manifestPublicKeyEd25519?: string,
    manifestSignatureDilithium?: string,
    manifestPublicKeyDilithium?: string,
    manifestCreatedAt?: number,
    algorithmVersion?: string
  }): Promise<ApiResponse<{
    success: boolean;
    message: string;
    file: FileInfo;
    conflictingItemId?: string;
  }>> {
    return this.request(`/files/${fileId}/copy`, {
      method: 'POST',
      body: JSON.stringify({ folderId, ...options }),
    });
  }

  async copyFolder(folderId: string, destinationFolderId: string | null, options?: {
    encryptedName?: string,
    nameSalt?: string,
    nameHmac?: string,
    // Manifest fields for signed copied folder
    manifestHash?: string,
    manifestSignatureEd25519?: string,
    manifestPublicKeyEd25519?: string,
    manifestSignatureDilithium?: string,
    manifestPublicKeyDilithium?: string,
    manifestCreatedAt?: number,
    algorithmVersion?: string
  }): Promise<ApiResponse<{
    success: boolean;
    message: string;
    conflictingItemId?: string;
  }>> {
    return this.request(`/folders/${folderId}/copy`, {
      method: 'POST',
      body: JSON.stringify({ destinationFolderId, ...options }),
    });
  }

  async getShareAttachmentUploadUrl(shareId: string, data: {
    commentId: string;
    filename: string;
    encryptedFilename: string;
    nonceFilename: string;
    fileSize: number;
    mimetype: string;
    encryptionNonce: string;
    contentMd5?: string;
  }): Promise<ApiResponse<{
    attachmentId: string;
    uploadUrl: string;
    requiredHeaders?: Record<string, string>;
  }>> {
    return this.request(`/shares/${shareId}/comments/attachments/s3`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async confirmShareAttachment(shareId: string, attachmentId: string): Promise<ApiResponse> {
    return this.request(`/shares/${shareId}/comments/attachments/${attachmentId}/confirm`, {
      method: 'POST'
    });
  }

  async getShareAttachmentDownloadUrl(shareId: string, attachmentId: string): Promise<ApiResponse<{
    downloadUrl: string;
    filename: string;
    mimetype: string;
  }>> {
    return this.request(`/shares/${shareId}/comments/attachments/${attachmentId}/s3`, {
      method: 'GET'
    });
  }

  async deleteShareAttachment(shareId: string, attachmentId: string): Promise<ApiResponse> {
    return this.request(`/shares/${shareId}/comments/attachments/${attachmentId}`, {
      method: 'DELETE'
    });
  }

  // Upload operations
  async initializeUploadSession(data: {
    encryptedFilename: string;
    filenameSalt: string;
    mimetype: string;
    fileSize: number;
    chunkCount: number;
    shaHash: string | null;
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
    clientFileId?: string;
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
    thumbnailPutUrl?: string | null;
    manifestVerified: boolean;
    manifestCreatedAt?: number;
    storageType: string;
    endpoint: string;
    existingFileId?: string; // ID of the existing file if conflict detected
    isKeepBothConflict?: boolean; // Flag to indicate this is a keepBoth retry scenario
  }>> {
    return this.request('/files/upload/presigned/initialize', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async finalizeUpload(sessionId: string, data: {
    finalShaHash: string | null;
    manifestSignature: string;
    manifestPublicKey: string;
    manifestSignatureDilithium: string;
    manifestPublicKeyDilithium: string;
    manifestCreatedAt: number;
    algorithmVersion: string;
    thumbnailData?: string; // Encrypted base64
    width?: number;
    height?: number;
    duration?: number;
  }, fileId?: string): Promise<ApiResponse<{
    fileId: string;
    message: string;
  }>> {
    return this.request(`/files/upload/presigned/${sessionId}/finalize`, {
      method: 'POST',
      body: JSON.stringify(data),
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
      body: JSON.stringify(data),
    });
  }

  // Paper Update Endpoints
  // Paper Update Endpoints
  async initializePaperUpdate(fileId: string, data: {
    encryptedFilename: string;
    filenameSalt: string;
    fileSize: number;
    chunkCount: number;
    encryptionIv: string;
    wrappedCek: string;
    fileNoncePrefix: string;
    kyberPublicKey: string;
    kyberCiphertext: string;
    nonceWrapKyber: string;
    sessionSalt: string;
    argon2idParams: unknown;
  }): Promise<ApiResponse<{
    sessionId: string;
    fileId: string;
    encryptionMetadataId: string;
    presigned: Array<{
      index: number;
      putUrl: string;
      objectKey: string;
    }>;
    storageType: string;
  }>> {
    return this.request(`/paper/${fileId}/save/initialize`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async finalizePaperUpdate(fileId: string, data: {
    sessionId: string;
    encryptionMetadataId: string;
    finalShaHash: string | null;
  }): Promise<ApiResponse<{ success: boolean; fileId: string }>> {
    return this.request(`/paper/${fileId}/save/finalize`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Paper Versioning Endpoints
  async getPaperVersions(fileId: string): Promise<ApiResponse<{
    versions: Array<{
      id: string;
      versionIndex: number;
      createdAt: string;
      totalSize: number;
      expiresAt: string | null;
    }>
  }>> {
    return this.request(`/papers/${fileId}/versions`);
  }

  async savePaperVersion(fileId: string): Promise<ApiResponse<{
    success: boolean;
    message: string;
    versionId: string;
    skipped?: boolean;
  }>> {
    return this.request(`/papers/${fileId}/versions`, {
      method: 'POST'
    });
  }

  async restorePaperVersion(fileId: string, versionId: string): Promise<ApiResponse<{
    success: boolean;
    message: string;
  }>> {
    return this.request(`/papers/${fileId}/versions/${versionId}/restore`, {
      method: 'POST'
    });
  }

  async deletePaperVersion(fileId: string, versionId: string): Promise<ApiResponse<{
    success: boolean;
    message: string;
  }>> {
    return this.request(`/papers/${fileId}/versions/${versionId}`, {
      method: 'DELETE'
    });
  }

  async getDownloadUrls(fileId: string): Promise<ApiResponse<DownloadUrlsResponse>> {
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
    hasUsedTrial: boolean;
  }>> {
    return this.request('/billing/subscription');
  }

  async cancelSubscription(): Promise<ApiResponse<{
    success: boolean;
    message: string;
    cancelledAt?: number;
  }>> {
    return this.request('/billing/subscription', {
      method: 'DELETE'
    });
  }

  async cancelSubscriptionWithReason(data: {
    reason: string;
    details: string;
  }): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return this.request('/billing/subscription/cancel-reason', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async getSubscriptionHistory(params?: {
    subsPage?: number;
    subsLimit?: number;
    invoicesPage?: number;
    invoicesLimit?: number;
  }): Promise<ApiResponse<{
    history: Array<{
      id: string;
      status: string;
      planName: string;
      amount: number;
      currency: string;
      interval: string;
      currentPeriodStart: number;
      currentPeriodEnd: number;
      cancelAtPeriodEnd: boolean;
      canceledAt: number | null;
      created: number;
      endedAt: number | null;
      provider?: string;
    }>;
    invoices: Array<{
      id: string;
      number: string;
      status: string;
      amount: number;
      currency: string;
      created: number;
      dueDate: number | null;
      paidAt: number | null;
      invoicePdf: string;
      hostedInvoiceUrl: string;
      subscriptionId: string | null;
      provider?: string;
    }>;
    pagination: {
      subs: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      };
      invoices: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      };
    };
  }>> {
    const queryParams = new URLSearchParams();
    if (params?.subsPage) queryParams.append('subsPage', params.subsPage.toString());
    if (params?.subsLimit) queryParams.append('subsLimit', params.subsLimit.toString());
    if (params?.invoicesPage) queryParams.append('invoicesPage', params.invoicesPage.toString());
    if (params?.invoicesLimit) queryParams.append('invoicesLimit', params.invoicesLimit.toString());

    const queryString = queryParams.toString();
    return this.request(`/billing/history${queryString ? `?${queryString}` : ''}`);
  }

  async createCheckoutSession(data: {
    priceId: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<ApiResponse<{
    sessionId?: string;
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

  async createCryptoCheckoutSession(data: {
    planId: string;
    price: number;
    currency?: string;
    period: 'month' | 'year';
  }): Promise<ApiResponse<{
    url: string;
    qr_code?: string;
  }>> {
    return this.request('/billing/crypto/checkout', {
      method: 'POST',
      body: JSON.stringify(data),
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
    return this.request('/totp/setup', {
      method: 'POST',
    });
  }

  async verifyTOTPSetup(token: string): Promise<ApiResponse<{
    recoveryCodes: string[];
  }>> {
    return this.request('/totp/verify', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  }

  async disableTOTP(token?: string, recoveryCode?: string): Promise<ApiResponse<{
    message: string;
  }>> {
    const body: { token?: string; recoveryCode?: string } = {};
    if (token) body.token = token;
    if (recoveryCode) body.recoveryCode = recoveryCode;

    return this.request('/totp/disable', {
      method: 'DELETE',
      body: JSON.stringify(body),
    });
  }

  async verifyTOTPLogin(userId: string, token: string, rememberDevice?: boolean): Promise<ApiResponse<{
    deviceToken?: string;
    token?: string;
  }>> {
    return this.request('/totp/verify-login', {
      method: 'POST',
      body: JSON.stringify({ userId, token, rememberDevice }),
    });
  }

  async autoVerifyTOTP(deviceToken: string): Promise<ApiResponse<{
    token: string;
  }>> {
    return this.request('/totp/auto-verify', {
      method: 'POST',
      body: JSON.stringify({ deviceToken }),
    });
  }

  // Referral endpoints
  async getReferralInfo(page = 1, limit = 5): Promise<ApiResponse<{
    referralCode: string;
    stats: {
      completedReferrals: number;
      pendingReferrals: number;
      totalEarningsMB: number;
      currentBonusMB: number;
      maxBonusMB: number;
      maxReferrals: number;
      totalReferralsCount: number;
    };
    recentReferrals: Array<{
      referred_user_id: string;
      referred_name: string;
      referred_email: string;
      avatar_url: string;
      status: string;
      created_at: string;
      completed_at: string | null;
    }>;
    pagination: {
      total: number;
      page: number;
      limit: number;
    };
  }>> {
    return this.request(`/referrals/info?page=${page}&limit=${limit}`);
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
    return this.request('/totp/verify-device', {
      method: 'POST',
      body: JSON.stringify({ deviceToken }),
    });
  }

  async verifyRecoveryCode(recoveryCode: string, userId?: string): Promise<ApiResponse<{
    valid: boolean;
    token?: string;
  }>> {
    const body: { recoveryCode: string; userId?: string } = { recoveryCode };
    if (userId) body.userId = userId;
    return this.request('/totp/verify-recovery', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  // Recovery OTP endpoints
  async initiateRecovery(email: string): Promise<ApiResponse<{
    hasRecovery: boolean;
  }>> {
    return this.request('/recovery/initiate', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async checkRecoveryTOTPAvailability(email: string): Promise<ApiResponse<{
    hasTOTP: boolean;
  }>> {
    return this.request('/recovery/check-totp', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async sendRecoveryOTP(email: string): Promise<ApiResponse<{
    success: boolean;
  }>> {
    return this.request('/recovery/send-otp', {
      method: 'POST',
      body: JSON.stringify({ email }),
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
    return this.request('/recovery/verify-otp', {
      method: 'POST',
      body: JSON.stringify(data),
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
    return this.request('/recovery/reset-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async sendFeedback(data: {
    message: string;
    path?: string;
  }): Promise<ApiResponse<{
    success: boolean;
    message: string;
  }>> {
    return this.request('/support/feedback', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }



  // Device Authorization
  async authorizeDevice(publicKey: string): Promise<ApiResponse<{
    success: boolean;
    deviceId: string;
    message: string;
    warning?: string;
    limitReached?: boolean;
    deviceQuota?: {
      maxDevices: number;
      planName: string;
      currentDevices: number;
    };
  }>> {
    // Device Recognition (UX only)
    //
    // We derive non-persistent browser characteristics to help users
    // distinguish between their active devices in the security dashboard.
    // These signals are not used for tracking, profiling, or standalone
    // authentication decisions. Cryptographic device keys remain the
    // sole authority for device trust.

    // Use ThumbmarkJS for robust fingerprinting
    const { getThumbmark } = await import('@thumbmarkjs/thumbmarkjs');
    const fingerprint = await getThumbmark();

    // Hash the fingerprint for integrity
    // Ensure fingerprint is a string before hashing
    const fingerprintStr = typeof fingerprint === 'string' ? fingerprint : JSON.stringify(fingerprint);
    const fingerprintHash = await this.hashFingerprint(fingerprintStr);

    // Get stored device ID if exists
    const deviceId = localStorage.getItem('device_id');

    const metadata = {
      screenRes: `${window.screen.width}x${window.screen.height}`,
      colorDepth: window.screen.colorDepth,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      platform: navigator.platform,
      hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
      touchSupport: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
      fingerprint: fingerprint // Store the Thumbmark hash
    };

    const ua = navigator.userAgent;
    let browser = 'Unknown';
    if (ua.indexOf("Firefox") > -1) browser = "Firefox";
    else if (ua.indexOf("SamsungBrowser") > -1) browser = "Samsung Internet";
    else if (ua.indexOf("Opera") > -1 || ua.indexOf("OPR") > -1) browser = "Opera";
    else if (ua.indexOf("Trident") > -1) browser = "Internet Explorer";
    else if (ua.indexOf("Edge") > -1) browser = "Edge";
    else if (ua.indexOf("Chrome") > -1) browser = "Chrome";
    else if (ua.indexOf("Safari") > -1) browser = "Safari";

    let os = "Unknown";
    if (ua.indexOf("Win") !== -1) os = "Windows";
    if (ua.indexOf("Mac") !== -1) os = "macOS";
    if (ua.indexOf("Linux") !== -1) os = "Linux";
    if (ua.indexOf("Android") !== -1) os = "Android";
    if (ua.indexOf("like Mac") !== -1) os = "iOS";

    const response = await this.request<{
      success: boolean;
      deviceId: string;
      message: string;
      warning?: string;
    }>('/auth/device/authorize', {
      method: 'POST',
      body: JSON.stringify({
        publicKey,
        deviceId: deviceId || undefined, // Send existing ID if we have it
        name: `${browser} on ${os}`,
        type: /Mobi|Android/i.test(ua) ? 'mobile' : 'desktop',
        browser,
        os,
        fingerprintHash,
        metadata
      })
    });

    if (response.success && response.data?.deviceId) {
      localStorage.setItem('device_id', response.data.deviceId);
    }

    return response;
  }

  // Device Management
  async getDevices(page = 1, limit = 5, onlyActive = true): Promise<ApiResponse<{
    devices: Array<{
      id: string;
      device_name: string;
      device_type: string;
      browser: string;
      os: string;
      ip_address: string;
      location: string;
      last_active: string;
      created_at: string;
      is_revoked: boolean;
      is_current: boolean;
    }>;
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
    plan: {
      name: string;
      maxDevices: number;
      currentDevices: number;
    };
  }>> {
    return this.request(`/auth/device?page=${page}&limit=${limit}&onlyActive=${onlyActive}`);
  }

  async revokeDevice(deviceId: string): Promise<ApiResponse<{
    success: boolean;
    message: string;
  }>> {
    return this.request(`/auth/device/revoke/${deviceId}`, {
      method: 'POST'
    });
  }

  async renameDevice(deviceId: string, name: string): Promise<ApiResponse<{
    success: boolean;
    message: string;
  }>> {
    return this.request(`/auth/device/${deviceId}/name`, {
      method: 'PATCH',
      body: JSON.stringify({ name })
    });
  }

  private async hashFingerprint(data: string): Promise<string> {
    const msgBuffer = new TextEncoder().encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
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
    signedData?: unknown;
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
      data: unknown;
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

  async getUnseenStatus(): Promise<ApiResponse<{
    hasUnseen: boolean;
  }>> {
    return this.request('/notifications/status');
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

  // Share comment endpoints
  async getShareComments(shareId: string, page = 1, limit = 20): Promise<ApiResponse<ShareCommentsResponse>> {
    return this.request(`/shares/${shareId}/comments?page=${page}&limit=${limit}`);
  }

  async addShareComment(shareId: string, data: {
    content: string;
    parentId?: string | null;
    fingerprint?: string;
    signature?: string;
    publicKey?: string;
  }): Promise<ApiResponse<{ success: boolean; comment: ShareComment }>> {
    return this.request(`/shares/${shareId}/comments`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateShareComment(shareId: string, commentId: string, data: {
    content: string;
    fingerprint?: string;
    signature?: string;
    publicKey?: string;
  }): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return this.request(`/shares/${shareId}/comments/${commentId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteShareComment(shareId: string, commentId: string): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return this.request(`/shares/${shareId}/comments/${commentId}`, {
      method: 'DELETE',
    });
  }

  async getShareCommentCount(shareId: string): Promise<ApiResponse<{ count: number; isOwner?: boolean; isLocked?: boolean; isEnabled?: boolean }>> {
    return this.request(`/shares/${shareId}/comments/count`);
  }

  async updateShareSettings(shareId: string, settings: {
    comments_enabled?: boolean;
    detailed_logging_enabled?: boolean;
    encrypted_filename?: string;
    nonce_filename?: string;
  }): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return this.request(`/shares/${shareId}/settings`, {
      method: 'PATCH',
      body: JSON.stringify(settings),
    });
  }

  async getShareLogs(shareId: string, page: number = 1, limit: number = 50): Promise<ApiResponse<{
    logs: ShareAccessLog[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
    settings: {
      detailed_logging_enabled: boolean;
    };
  }>> {
    return this.request(`/shares/${shareId}/logs?page=${page}&limit=${limit}`);
  }

  async wipeShareLogs(shareId: string): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return this.request(`/shares/${shareId}/logs`, {
      method: 'DELETE',
    });
  }

  async lockComments(shareId: string, locked: boolean): Promise<ApiResponse<{ success: boolean; locked: boolean }>> {
    return this.request(`/shares/${shareId}/comments/lock`, {
      method: 'POST',
      body: JSON.stringify({ locked }),
    });
  }

  async setCommentsEnabled(shareId: string, enabled: boolean): Promise<ApiResponse<{ success: boolean; enabled: boolean }>> {
    return this.request(`/shares/${shareId}/comments/enable`, {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    });
  }

  async banShareUser(shareId: string, userId: string): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return this.request(`/shares/${shareId}/comments/ban`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  }

  async unbanShareUser(shareId: string, userId: string): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return this.request(`/shares/${shareId}/comments/unban`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  }

  async getShareBannedUsers(shareId: string): Promise<ApiResponse<{
    banned: Array<{
      id: string;
      name: string;
      email: string;
      avatarUrl: string;
      bannedAt: string;
    }>
  }>> {
    return this.request(`/shares/${shareId}/comments/banned`);
  }

  async getSecurityEvents(limit = 10, offset = 0, format?: string): Promise<ApiResponse<{
    events: SecurityEvent[];
    pagination: { total: number; limit: number; offset: number; hasMore: boolean };
    csv?: string;
    filename?: string;
  }>> {
    const query = `limit=${limit}&offset=${offset}${format ? `&format=${format}` : ''}`;
    return this.request(`/auth/security/events?${query}`, {
      method: 'GET',
    });
  }

  async getSecurityPreferences(): Promise<ApiResponse<{
    activityMonitorEnabled: boolean;
    detailedEventsEnabled: boolean;
    usageDiagnosticsEnabled: boolean;
    crashReportsEnabled: boolean;
  }>> {
    return this.request('/auth/security/preferences', {
      method: 'GET',
    });
  }

  async updateSecurityPreferences(
    activityMonitorEnabled: boolean,
    detailedEventsEnabled: boolean,
    usageDiagnosticsEnabled?: boolean,
    crashReportsEnabled?: boolean
  ): Promise<ApiResponse<{
    success: boolean;
    message: string;
  }>> {
    return this.request('/auth/security/preferences', {
      method: 'POST',
      body: JSON.stringify({
        activityMonitorEnabled,
        detailedEventsEnabled,
        usageDiagnosticsEnabled: usageDiagnosticsEnabled ?? true, // Default to true if not provided (though backend handles it too)
        crashReportsEnabled: crashReportsEnabled ?? true
      }),
    });
  }

  async wipeSecurityEvents(): Promise<ApiResponse<{
    success: boolean;
    message: string;
  }>> {
    return this.request('/auth/security/events/wipe', {
      method: 'POST',
    });
  }

  // Backup flow tracking
  async trackBackupViewed(): Promise<ApiResponse<{ success: boolean }>> {
    return this.request('/backup/viewed', { method: 'POST' });
  }

  async trackBackupVerified(): Promise<ApiResponse<{ success: boolean }>> {
    return this.request('/backup/verified', { method: 'POST' });
  }

  // Master Key & OPAQUE Tracking
  async trackMasterKeyRevealed(): Promise<ApiResponse<{ success: boolean }>> {
    return this.request('/auth/security/mk/revealed', { method: 'POST' });
  }

  async trackMasterKeyRevealFailed(reason: string): Promise<ApiResponse<{ success: boolean }>> {
    return this.request('/auth/security/mk/failed', {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  }

  // Webhooks (Developer)
  async createWebhook(url: string, events?: string[]): Promise<ApiResponse<{ id: string; url: string; secret: string; enabled: number; events: string[] }>> {
    return this.request('/user/webhooks', {
      method: 'POST',
      body: JSON.stringify({ url, events }),
    });
  }

  async updateWebhook(id: string, data: { url?: string; events?: string[]; enabled?: boolean }): Promise<ApiResponse<{ id: string }>> {
    return this.request(`/user/webhooks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async listWebhooks(): Promise<ApiResponse<any[]>> {
    return this.request('/user/webhooks');
  }

  async deleteWebhook(id: string): Promise<ApiResponse<{ success: boolean }>> {
    return this.request(`/user/webhooks/${id}`, { method: 'DELETE' });
  }

  async testWebhook(id: string): Promise<ApiResponse<any>> {
    return this.request(`/user/webhooks/${id}/test`, { method: 'POST' });
  }

  async listWebhookEvents(id: string, page: number = 1, limit: number = 10): Promise<ApiResponse<any[]>> {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    return this.request(`/user/webhooks/${id}/events?${params.toString()}`);
  }

  async rotateWebhookSecret(id: string): Promise<ApiResponse<{ id: string; secret: string }>> {
    return this.request(`/user/webhooks/${id}/rotate`, { method: 'POST' });
  }

  async deleteWebhookEvent(eventId: string): Promise<ApiResponse<{ success: boolean }>> {
    return this.request(`/user/webhooks/events/${eventId}`, { method: 'DELETE' });
  }

  async resendWebhookEvent(eventId: string): Promise<ApiResponse<{ success: boolean; event: any }>> {
    return this.request(`/user/webhooks/events/${eventId}/resend`, { method: 'POST' });
  }

  async getWebhookEvent(eventId: string): Promise<ApiResponse<any>> {
    return this.request(`/user/webhooks/events/${eventId}`);
  }

  async getWebhookUsage(): Promise<ApiResponse<{ allowed: boolean; usage: number; limit: number; plan: string; }>> {
    return this.request('/user/webhooks/usage');
  }

  async getSecurityEvent(eventId: string): Promise<ApiResponse<SecurityEvent>> {
    return this.request(`/security/events/${eventId}`)
  }

  async reportOpaqueFailure(flow: string, stage: string, error: string): Promise<ApiResponse<{ success: boolean }>> {
    return this.request('/auth/security/opaque/failure', {
      method: 'POST',
      body: JSON.stringify({ flow, stage, error, timestamp: new Date().toISOString() })
    });
  }

  // Tag management
  async attachTag(data: {
    fileId?: string;
    folderId?: string;
    encryptedName: string;
    nameSalt: string;
    color?: string;
  }): Promise<ApiResponse<Tag>> {
    return this.request('/tags/attach', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async detachTag(tagId: string, data: { fileId?: string; folderId?: string }): Promise<ApiResponse<{ success: boolean }>> {
    return this.request(`/tags/detach/${tagId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteTag(tagId: string): Promise<ApiResponse<{ success: boolean }>> {
    return this.request(`/tags/${tagId}`, {
      method: 'DELETE',
    });
  }

  async getTags(): Promise<ApiResponse<Tag[]>> {
    return this.request('/tags');
  }

  async deleteAccount(reason?: string, details?: string): Promise<ApiResponse<{
    success: boolean;
  }>> {
    return this.request('/auth/delete', {
      method: 'DELETE',
      body: JSON.stringify({ reason, details }),
    });
  }

}

export const apiClient = new ApiClient(API_BASE_URL);
export default apiClient;
