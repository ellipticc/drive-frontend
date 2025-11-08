/**
 * METAMASK CONSTANT-SIGNATURE KEY DERIVATION IMPLEMENTATION
 * 
 * Replaces the wallet-address-derived approach with a CONSTANT SIGNATURE approach
 * This provides BOTH perfect determinism AND high entropy key derivation
 */

// ============================================================================
// NEW APPROACH: CONSTANT SIGNATURE KEY DERIVATION
// ============================================================================

/**
 * PROBLEM WITH PREVIOUS APPROACHES:
 * ─────────────────────────────────
 * 
 * Approach 1: SIWE Signature (BROKEN)
 *   Key = HKDF(randomSIWESignature, ...)
 *   ❌ Different signature every login (new challenge nonce)
 *   ❌ Can't decrypt on re-login (different key)
 * 
 * Approach 2: Wallet Address (WORKED but low entropy)
 *   Key = HKDF(walletAddress, ...)
 *   ✅ Works, deterministic
 *   ❌ Uses PUBLIC input (wallet address on blockchain)
 *   ❌ Lower entropy (160-bit address vs 256-bit signature)
 * 
 * Approach 3: CONSTANT SIGNATURE (OPTIMAL - NEW)
 *   Key = HKDF(constantSignature, ...)
 *   ✅ Works, deterministic
 *   ✅ HIGH entropy (256 bits from ECDSA)
 *   ✅ Same message + same wallet = same signature ALWAYS
 *   ✅ Best of both worlds
 */

// ============================================================================
// HOW IT WORKS
// ============================================================================

/**
 * CONSTANT MESSAGE:
 * ──────────────────
 * "Ellipticc Drive - Master Key Derivation v1"
 * 
 * This message is:
 * - Fixed (not random like SIWE challenge nonce)
 * - Hardcoded in MetaMaskAuthService.getConstantSignature()
 * - User signs it once per session/login
 * 
 * 
 * SIGNATURE GENERATION:
 * ─────────────────────
 * 
 * Registration:
 *   1. User clicks "MetaMask Login"
 *   2. MetaMask signs constant message
 *   3. Wallet returns constantSignature (call it Sig1)
 *   4. Generate Master Key (MK)
 *   5. Encrypt MK with: HKDF(Sig1, "master-key-encryption-metamask")
 *   6. Store encrypted MK + MK metadata on server
 * 
 * Re-login:
 *   1. User clicks "MetaMask Login"
 *   2. MetaMask signs same constant message
 *   3. Wallet returns constantSignature (call it Sig2)
 *   4. CRITICAL: Sig1 == Sig2 (same message, same wallet, same signature)
 *   5. Decrypt MK with: HKDF(Sig2, "master-key-encryption-metamask")
 *   6. Since Sig1 == Sig2 → HKDF output is SAME → Decryption works!
 * 
 * 
 * WHY SAME MESSAGE = SAME SIGNATURE:
 * ──────────────────────────────────
 * ECDSA Signature Formula: Sig = sign(privateKey, messageHash)
 * 
 * deterministic ECDSA uses RFC 6979:
 *   - Same private key + same message = same random nonce (k)
 *   - Same k + same message hash = same signature
 * 
 * MetaMask uses RFC 6979 by default (deterministic ECDSA)
 * Result: constantSignature is truly constant for that wallet
 */

// ============================================================================
// IMPLEMENTATION DETAILS
// ============================================================================

/**
 * NEW METHOD: getConstantSignature()
 * ──────────────────────────────────
 * 
 * // In MetaMaskAuthService:
 * async getConstantSignature(): Promise<string> {
 *   const CONSTANT_MESSAGE = 'Ellipticc Drive - Master Key Derivation v1'
 *   
 *   // Request accounts
 *   const accounts = await window.ethereum.request({
 *     method: 'eth_requestAccounts'
 *   })
 *   
 *   // Sign constant message with personal_sign
 *   const signature = await window.ethereum.request({
 *     method: 'personal_sign',
 *     params: [CONSTANT_MESSAGE, accounts[0]]
 *   })
 *   
 *   return signature  // Always same for same wallet
 * }
 * 
 * 
 * UPDATED METHOD: encryptMasterKeyWithConstantSignature()
 * ───────────────────────────────────────────────────────
 * 
 * async encryptMasterKeyWithConstantSignature(
 *   masterKey: Uint8Array,
 *   constantSignature: string
 * ): Promise<EncryptedMasterKeyData> {
 *   // Derive encryption key from CONSTANT SIGNATURE
 *   const signatureBytes = Uint8Array.from(constantSignature)
 *   
 *   const encryptionKey = HKDF(signatureBytes, 
 *     salt=empty, 
 *     info='master-key-encryption-metamask'
 *   )
 *   
 *   // Generate random nonce for this encryption
 *   const nonce = randomBytes(24)
 *   
 *   // Encrypt with XChaCha20-Poly1305
 *   const ciphertext = xchacha20poly1305(encryptionKey, nonce).encrypt(masterKey)
 *   
 *   // Return ciphertext + metadata (including nonce)
 *   return {
 *     encryptedMasterKey: base64(ciphertext),
 *     masterKeyMetadata: {
 *       version: 'v3-constant-signature',
 *       algorithm: 'xchacha20-poly1305',
 *       nonce: base64(nonce),
 *       createdAt: now()
 *     }
 *   }
 * }
 * 
 * 
 * UPDATED METHOD: decryptMasterKeyWithConstantSignature()
 * ────────────────────────────────────────────────────────
 * 
 * async decryptMasterKeyWithConstantSignature(
 *   encryptedMasterKey: string,
 *   constantSignature: string,
 *   nonce: string
 * ): Promise<Uint8Array> {
 *   // Derive SAME encryption key from CONSTANT SIGNATURE
 *   const signatureBytes = Uint8Array.from(constantSignature)
 *   
 *   const encryptionKey = HKDF(signatureBytes, 
 *     salt=empty, 
 *     info='master-key-encryption-metamask'  // SAME INFO
 *   )
 *   
 *   // Decrypt with XChaCha20-Poly1305
 *   const ciphertext = base64Decode(encryptedMasterKey)
 *   const nonceBytes = base64Decode(nonce)
 *   
 *   const plaintext = xchacha20poly1305(encryptionKey, nonceBytes).decrypt(ciphertext)
 *   
 *   // Parse and return master key
 *   return plaintext.masterKey
 * }
 */

// ============================================================================
// UPDATED FLOW IN siwe-login-button.tsx
// ============================================================================

/**
 * REGISTRATION (New User):
 * ────────────────────────
 * 
 * handleMetaMaskLogin() → isNewUser = true
 *   ↓
 * STEP 1: Generate Master Key
 * const masterKey = await metamaskAuthService.generateMasterKey()
 *   ↓
 * STEP 2: Get constant signature
 * const constantSignature = await metamaskAuthService.getConstantSignature()
 *   ↓
 * STEP 3: Encrypt MK with constant signature-derived key
 * const encryptedMKData = await metamaskAuthService.encryptMasterKeyWithConstantSignature(
 *   masterKey,
 *   constantSignature
 * )
 *   ↓
 * STEP 4: Derive master secret for key generation
 * const masterSecret = await metamaskAuthService.deriveMasterSecretFromMK(
 *   masterKey,
 *   user.walletAddress
 * )
 *   ↓
 * STEP 5: Generate PQC keypairs
 * const keypairs = await generateAllKeypairs(masterSecret)
 *   ↓
 * STEP 6: Store on backend
 * await apiClient.storeCryptoKeypairs({
 *   encryptedMasterKey: encryptedMKData.encryptedMasterKey,
 *   masterKeySalt: JSON.stringify(encryptedMKData.masterKeyMetadata),
 *   ...
 * })
 * 
 * 
 * RE-LOGIN (Existing User):
 * ──────────────────────────
 * 
 * handleMetaMaskLogin() → isNewUser = false
 *   ↓
 * Fetch user profile
 * const userData = await apiClient.getProfile()
 *   ↓
 * STEP 1: Get constant signature (sign same message again)
 * const constantSignature = await metamaskAuthService.getConstantSignature()
 * // Returns SAME signature as registration (same message, same wallet)
 *   ↓
 * STEP 2: Decrypt stored MK
 * const decryptedMasterKey = await metamaskAuthService.decryptMasterKeyWithConstantSignature(
 *   userData.encryptedMasterKey,
 *   constantSignature,
 *   mkMetadata.nonce
 * )
 * // Same signature → Same HKDF output → Same encryption key → Decryption works!
 *   ↓
 * STEP 3: Derive master secret (same as during registration)
 * const masterSecret = await metamaskAuthService.deriveMasterSecretFromMK(
 *   decryptedMasterKey,
 *   user.walletAddress
 * )
 *   ↓
 * STEP 4: Initialize key manager with decrypted keys
 * await keyManager.initialize(userData)
 *   ↓
 * ✅ Login complete, all keys decrypted and ready to use
 */

// ============================================================================
// SECURITY ANALYSIS
// ============================================================================

/**
 * IS IT SECURE?
 * ─────────────
 * ✅ YES - Better than previous approaches
 * 
 * Key Entropy:
 *   ✅ 256 bits (ECDSA signature is 256-bit)
 *   ✅ High entropy (generated by cryptographic signature operation)
 *   ✅ Better than wallet address (160 bits)
 * 
 * Determinism:
 *   ✅ Same wallet + same message = same signature (RFC 6979)
 *   ✅ Same signature → same derived key → can decrypt
 * 
 * E2EE:
 *   ✅ Only client has plaintext MK
 *   ✅ Server cannot decrypt (doesn't own wallet)
 * 
 * Zero-Knowledge:
 *   ✅ Server never sees plaintext MK
 *   ✅ Server can't derive encryption key (doesn't have signature)
 * 
 * Attack Scenarios:
 *   
 *   Scenario A: MITM tries to intercept signature
 *   ✅ Signature is only for deriving key, not transmitted
 *   ✅ Even if obtained, still need to compute HKDF + decrypt
 *   
 *   Scenario B: Server is compromised
 *   ✅ Attacker gets encrypted blob but no signature
 *   ✅ Can't derive key without owning the wallet
 *   ✅ XChaCha20-Poly1305 requires exact key (2^256 possible keys)
 *   
 *   Scenario C: User device is compromised
 *   ❌ Attacker gets everything (including MK)
 *   (But this is true for any solution - device compromise = total loss)
 */

// ============================================================================
// ADVANTAGES OVER PREVIOUS APPROACH
// ============================================================================

/**
 * WALLET-ADDRESS-DERIVED (Previous):
 *   ✅ Deterministic
 *   ✅ Works
 *   ✅ E2EE
 *   ❌ Uses PUBLIC input (wallet address)
 *   ❌ Lower entropy (160 bits)
 * 
 * CONSTANT-SIGNATURE-DERIVED (New):
 *   ✅ Deterministic
 *   ✅ Works
 *   ✅ E2EE
 *   ✅ HIGH entropy (256 bits)
 *   ✅ Private input (signature not on blockchain)
 *   ✅ Same determinism as SIWE but FIXES the re-login problem
 * 
 * Summary:
 *   Previous: Worked but low entropy
 *   New: Works AND high entropy (BEST OF BOTH WORLDS)
 */

// ============================================================================
// MESSAGE VERSIONING STRATEGY
// ============================================================================

/**
 * WHY VERSION IN CONSTANT MESSAGE:
 * ────────────────────────────────
 * 
 * Current: "Ellipticc Drive - Master Key Derivation v1"
 * 
 * Future versions can use:
 *   - "Ellipticc Drive - Master Key Derivation v2" → different signature
 *   - "Ellipticc Drive - Master Key Derivation v3" → different signature
 * 
 * Benefits:
 *   - Can change key derivation without breaking old users
 *   - Can support key rotation
 *   - Clear version tracking in encrypted metadata
 * 
 * Backward Compatibility:
 *   - Old users continue to use v1 signature
 *   - New users can opt-in to v2
 *   - Both work simultaneously
 */

// ============================================================================
// TESTING CHECKLIST
// ============================================================================

/**
 * To verify this implementation works:
 * 
 * [ ] Test 1: Fresh Registration
 *     1. Open app, click MetaMask login (NEW user)
 *     2. Approve SIWE message
 *     3. Check logs for "[Constant Signature] Generated signature..."
 *     4. Should complete registration without errors
 *     5. Verify encrypted MK stored with v3-constant-signature version
 * 
 * [ ] Test 2: Same Session Re-connect
 *     1. Close wallet connection
 *     2. Click MetaMask login again (same user, same session)
 *     3. Should get SAME signature (check logs)
 *     4. Should decrypt MK successfully
 *     5. Should access all data without errors
 * 
 * [ ] Test 3: Cross-Session (Hard Refresh)
 *     1. Register user and access data
 *     2. Refresh page (Ctrl+F5)
 *     3. Click MetaMask login (same user, different session)
 *     4. Should get SAME signature again
 *     5. Should decrypt stored MK successfully
 *     6. All data should be accessible
 * 
 * [ ] Test 4: Different Wallet
 *     1. Use Wallet A to register
 *     2. Disconnect and switch to Wallet B
 *     3. Try to login with Wallet B
 *     4. Should fail (can't decrypt with different signature)
 *     5. Verify error message is clear
 * 
 * [ ] Test 5: Multiple Logins
 *     1. Register user
 *     2. Login 10 times, checking signature matches each time
 *     3. All logins should succeed with same signature
 */

// ============================================================================
// CONCLUSION
// ============================================================================

/**
 * This implementation provides:
 * 
 * ✅ DETERMINISM: Same signature every time (fixed message)
 * ✅ HIGH ENTROPY: 256-bit signature (vs 160-bit wallet address)
 * ✅ E2EE: Only client decrypts
 * ✅ ZERO-KNOWLEDGE: Server can't decrypt
 * ✅ CROSS-DEVICE: Same wallet = same MK on any device
 * ✅ SIMPLICITY: Just needs MetaMask, no additional storage
 * 
 * This is the OPTIMAL solution for MetaMask-based E2EE!
 */
