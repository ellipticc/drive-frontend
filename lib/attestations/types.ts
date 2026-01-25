export interface AttestationKey {
    id: string; // Unique identifier (UUID or hash of public key)
    name: string; // User-friendly name (e.g., "Primary Identity")
    publicKeyPem: string; // PEM formatted public key
    encryptedPrivateKey: string; // Base64 XChaCha20-Poly1305 encrypted private key (PKCS#8)
    privateKeyNonce: string; // Base64 nonce
    certPem: string; // PEM formatted X.509 certificate
    createdAt: number; // Timestamp
    isRevoked: boolean;
    revokedAt?: number;
}
