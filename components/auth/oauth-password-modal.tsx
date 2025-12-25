'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { AlertCircle, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { masterKeyManager } from '@/lib/master-key';
import { 
  deriveEncryptionKey, 
  encryptMasterKeyWithRecoveryKey, 
  deriveRecoveryKeyEncryptionKey,
  generateRecoveryKey,
  encryptRecoveryKey,
  decryptUserPrivateKeys
} from '@/lib/crypto';
import { useRouter } from 'next/navigation';
import { sessionTrackingUtils } from '@/hooks/useSessionTracking';

interface OAuthPasswordModalProps {
  email: string;
  hasAccountSalt?: boolean;
}

export function OAuthPasswordModal({
  email,
  hasAccountSalt = false,
}: OAuthPasswordModalProps) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [isNewUser, setIsNewUser] = useState(!hasAccountSalt); // Determined from prop
  const [isChecking, setIsChecking] = useState(!hasAccountSalt && hasAccountSalt === undefined); // Loading state while checking

  // Check if user is new or existing on mount (fallback if prop not provided)
  useEffect(() => {
    if (hasAccountSalt !== undefined) {
      // Use prop value if provided
      setIsNewUser(!hasAccountSalt);
      setIsChecking(false);
      return;
    }

    const checkUserStatus = async () => {
      try {
        const profileResponse = await apiClient.getProfile();
        
        if (profileResponse.success && profileResponse.data?.user) {
          const user = profileResponse.data.user;
          const userIsNew = !user.account_salt || user.account_salt === 'pending_oauth_setup' || user.account_salt === '';
          
          console.log('OAuth Modal - Initial user check:', { 
            email: user.email,
            hasAccountSalt: !!user.account_salt,
            accountSalt: user.account_salt?.substring(0, 20) + '...',
            isNew: userIsNew 
          });
          
          setIsNewUser(userIsNew);
        }
      } catch (err) {
        console.error('Failed to check user status:', err);
        // Assume new user on error
        setIsNewUser(true);
      } finally {
        setIsChecking(false);
      }
    };

    checkUserStatus();
  }, [email, hasAccountSalt]);

  // For new user: both passwords must match and be 8+ chars
  // For existing user: just need to enter the password
  const isPasswordValid = isNewUser 
    ? password.length >= 8 && password === confirmPassword
    : password.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isPasswordValid) {
      if (isNewUser) {
        setError('Please enter and confirm your password');
      } else {
        setError('Please enter your password');
      }
      return;
    }

    setIsLoading(true);

    try {
      if (isNewUser) {
        // NEW USER: Set password and generate keypairs
        await handleNewUserSetup();
      } else {
        // EXISTING USER: Just verify password and load master key
        await handleExistingUserLogin();
      }
    } catch (err) {
      console.error('OAuth password submit error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewUserSetup = async () => {
    try {
      // Import real keypair generation function (same as signup)
      const { generateAllKeypairs } = await import('@/lib/crypto');
      const { OPAQUERegistration } = await import('@/lib/opaque');

      // Generate real Kyber, Dilithium, X25519, Ed25519 keypairs
      const allKeypairs = await generateAllKeypairs(password);

      // The mnemonic is already generated in generateAllKeypairs
      const mnemonic = allKeypairs.mnemonic;
      const mnemonicHash = allKeypairs.mnemonicHash;

      // Derive RKEK (Recovery Key Encryption Key) from mnemonic
      const rkek = await deriveRecoveryKeyEncryptionKey(mnemonic);

      // Generate a random Recovery Key (RK)
      const rk = generateRecoveryKey();

      // Encrypt the RK with RKEK
      const recoveryKeyEncryption = encryptRecoveryKey(rk, rkek);
      const encryptedRecoveryKey = recoveryKeyEncryption.encryptedRecoveryKey;
      const recoveryKeyNonce = recoveryKeyEncryption.recoveryKeyNonce;

      // Use the SAME salt that was used to encrypt the keypairs
      // This ensures the master key used for decryption matches the one used for encryption
      const accountSalt = allKeypairs.keyDerivationSalt;
      console.log('OAuth Setup - accountSalt:', { length: accountSalt.length, format: accountSalt.substring(0, 20) + '...' });

      // Derive master key from password and salt (this must be the same as what was used in generateAllKeypairs)
      const masterKey = await deriveEncryptionKey(password, accountSalt);
      console.log('OAuth Setup - masterKey derived:', { length: masterKey.length });

      // Encrypt the Master Key with the Recovery Key
      const masterKeyEncryption = encryptMasterKeyWithRecoveryKey(masterKey, rk);
      const encryptedMasterKeyValue = masterKeyEncryption.encryptedMasterKey;
      const masterKeyNonce = masterKeyEncryption.masterKeyNonce;

      // Cache master key locally for immediate use
      masterKeyManager.cacheExistingMasterKey(masterKey, accountSalt);
      console.log('OAuth Setup - master key cached');

      // Store mnemonic for backup page
      localStorage.setItem('recovery_mnemonic', mnemonic);

      // Generate OPAQUE password file for persistent authentication on this device
      const opaqueReg = new OPAQUERegistration();
      const { registrationRequest } = await opaqueReg.step1(password);
      const { registrationResponse } = await opaqueReg.step2(email, registrationRequest);
      const { registrationRecord } = await opaqueReg.step3(registrationResponse);
      console.log('OAuth Setup - OPAQUE password file generated');

      // Convert signup format to OAuth backend format
      const pqcKeypairsPayload = {
        // Kyber keypair
        kyberPublicKey: allKeypairs.pqcKeypairs.kyber.publicKey,
        kyberPrivateKeyEncrypted: allKeypairs.pqcKeypairs.kyber.encryptedPrivateKey,
        kyberEncryptionKey: allKeypairs.pqcKeypairs.kyber.encryptionKey,
        kyberEncryptionNonce: allKeypairs.pqcKeypairs.kyber.encryptionNonce,
        kyberPrivateKeyNonce: allKeypairs.pqcKeypairs.kyber.privateKeyNonce,
        
        // X25519 keypair
        x25519PublicKey: allKeypairs.pqcKeypairs.x25519.publicKey,
        x25519PrivateKeyEncrypted: allKeypairs.pqcKeypairs.x25519.encryptedPrivateKey,
        x25519EncryptionKey: allKeypairs.pqcKeypairs.x25519.encryptionKey,
        x25519EncryptionNonce: allKeypairs.pqcKeypairs.x25519.encryptionNonce,
        x25519PrivateKeyNonce: allKeypairs.pqcKeypairs.x25519.privateKeyNonce,
        
        // Dilithium keypair
        dilithiumPublicKey: allKeypairs.pqcKeypairs.dilithium.publicKey,
        dilithiumPrivateKeyEncrypted: allKeypairs.pqcKeypairs.dilithium.encryptedPrivateKey,
        dilithiumEncryptionKey: allKeypairs.pqcKeypairs.dilithium.encryptionKey,
        dilithiumEncryptionNonce: allKeypairs.pqcKeypairs.dilithium.encryptionNonce,
        dilithiumPrivateKeyNonce: allKeypairs.pqcKeypairs.dilithium.privateKeyNonce,
        
        // Ed25519 keypair
        ed25519PublicKey: allKeypairs.pqcKeypairs.ed25519.publicKey,
        ed25519PrivateKeyEncrypted: allKeypairs.pqcKeypairs.ed25519.encryptedPrivateKey,
        ed25519EncryptionKey: allKeypairs.pqcKeypairs.ed25519.encryptionKey,
        ed25519EncryptionNonce: allKeypairs.pqcKeypairs.ed25519.encryptionNonce,
        ed25519PrivateKeyNonce: allKeypairs.pqcKeypairs.ed25519.privateKeyNonce
      };

      console.log('🔐 OAuth Setup - sending to backend with accountSalt format:', typeof accountSalt);

      // Call backend to complete OAuth registration
      const response = await apiClient.completeOAuthRegistration({
        accountSalt,
        pqcKeypairs: pqcKeypairsPayload,
        mnemonicHash,
        encryptedRecoveryKey,
        recoveryKeyNonce,
        encryptedMasterKey: encryptedMasterKeyValue,
        masterKeySalt: JSON.stringify({
          salt: accountSalt,
          algorithm: 'argon2id',
          masterKeyNonce: masterKeyNonce
        }),
        opaquePasswordFile: registrationRecord,
      });

      if (response.success) {
        console.log('OAuth Setup - backend registration complete, redirecting to dashboard');
        
        // Get the token from sessionStorage (not from apiClient.getAuthToken() which returns null during OAuth setup)
        const token = sessionStorage.getItem('oauth_temp_token');
        
        // Store token in localStorage BEFORE clearing OAuth setup flags
        // This ensures AuthGuard can see the token after the page reloads
        if (token) {
          // Store in standard auth_token format that AuthGuard expects
          localStorage.setItem('auth_token', token);
          // Also set via apiClient so it can find the token
          apiClient.setAuthToken(token);
        }
        
        // Clear OAuth setup state - registration is complete
        // Do this AFTER storing the token so AuthGuard won't reject it
        sessionStorage.removeItem('oauth_temp_token');
        sessionStorage.removeItem('oauth_setup_in_progress');
        sessionStorage.removeItem('oauth_user_id');
        
        // Redirect to dashboard directly (no backup page for OAuth users)
        router.push('/');
      } else {
        setError(
          response.message || 'Failed to complete registration. Please try again.',
        );
      }
    } catch (err) {
      console.error('OAuth Setup - Error:', err);
      setError('An unexpected error occurred. Please try again.');
    }
  };

  const handleExistingUserLogin = async () => {
    try {
      // Fetch user data which includes encrypted_master_key and master_key_salt
      const profileResponse = await apiClient.getProfile();
      
      if (!profileResponse.success || !profileResponse.data) {
        setError('Failed to fetch user data');
        return;
      }

      const user = profileResponse.data.user;
      
      // Get account_salt - it might be at user.account_salt or inside crypto_keypairs
      const accountSalt = user.account_salt || user.crypto_keypairs?.accountSalt;
      
      // Log the full structure for debugging
      const pqcKeypairs = user.crypto_keypairs?.pqcKeypairs;
      console.log('OAuth Existing User Login - Full Response:', {
        hasUser: !!user,
        userKeys: user ? Object.keys(user) : [],
        account_salt_value: accountSalt,
        account_salt_type: typeof accountSalt,
        account_salt_length: accountSalt?.length,
        account_salt_substring: accountSalt?.substring(0, 20),
        hasCryptoKeypairs: !!user.crypto_keypairs,
        hasPqcKeypairs: !!pqcKeypairs,
        pqcKeypairsKeys: pqcKeypairs ? Object.keys(pqcKeypairs) : [],
        hasEd25519: !!pqcKeypairs?.ed25519,
        ed25519Keys: pqcKeypairs?.ed25519 ? Object.keys(pqcKeypairs.ed25519) : [],
      });

      if (!accountSalt) {
        console.error('account_salt is missing from profile response!');
        setError('Account salt not found. Please complete password setup again.');
        return;
      }

      // Check if user has complete crypto keypairs with encrypted private keys
      if (!pqcKeypairs || !pqcKeypairs.ed25519) {
        console.error('User does not have PQC keypairs or ed25519 data');
        setError('Your account setup is incomplete. Please complete the password setup process.');
        return;
      }

      // Check if we have the full encryption metadata needed for decryption
      const ed25519 = pqcKeypairs.ed25519;
      if (!ed25519.encryptedPrivateKey || !ed25519.encryptionKey || !ed25519.encryptionNonce) {
        console.error('User PQC keypairs are incomplete - missing encryption metadata', {
          hasEncryptedPrivateKey: !!ed25519.encryptedPrivateKey,
          hasEncryptionKey: !!ed25519.encryptionKey,
          hasEncryptionNonce: !!ed25519.encryptionNonce,
          hasPrivateKeyNonce: !!ed25519.privateKeyNonce,
          ed25519Keys: Object.keys(ed25519)
        });
        setError('Your account setup is incomplete. Please complete the password setup process.');
        return;
      }

      // Derive master key from password and stored account salt
      const masterKey = await deriveEncryptionKey(password, accountSalt);
      
      console.log('OAuth Login - Master key derived');

      // Validate that the derived master key can actually decrypt the user's data
      // This is a client-side UX check to prevent users from unknowingly using the wrong password
      console.log('OAuth Login - Validating password by testing decryption...');
      try {
        // Temporarily cache the master key so decryptUserPrivateKeys can access it
        masterKeyManager.cacheExistingMasterKey(masterKey, accountSalt);
        
        // Attempt to decrypt one of the user's private keys to validate the password
        // This will throw an error if the password is incorrect
        await decryptUserPrivateKeys(user as Parameters<typeof decryptUserPrivateKeys>[0]);
        
        console.log('OAuth Login - Password validation successful! Decryption works.');
      } catch (validationError) {
        // Clear the cached master key since password validation failed
        masterKeyManager.clearMasterKey();
        
        const errorMsg = validationError instanceof Error ? validationError.message : 'Password validation failed';
        console.error('OAuth Login - Password validation failed:', errorMsg);
        
        // Show user-friendly error message
        setError('The password you entered is incorrect. Please try again.');
        return;
      }

      console.log('OAuth Login - Master key cached');

      // Initialize keyManager with user data (this will use the cached master key to decrypt keypairs)
      const { keyManager } = await import("@/lib/key-manager")
      try {
        if (user.crypto_keypairs) {
          await keyManager.initialize(user)
          console.log('OAuth Login - KeyManager initialized');
        }
      } catch (keyError) {
        console.warn('KeyManager initialization warning:', keyError)
        // Don't fail - keyManager might already be initialized
      }

      // Dispatch event for global state updates
      window.dispatchEvent(new CustomEvent('user-login'));

      // Track login conversion before redirecting
      const sessionId = sessionTrackingUtils.getSessionId();
      if (sessionId) {
        sessionTrackingUtils.trackConversion(sessionId, 'login', user.id);
      }

      // Clear session tracking after successful login
      sessionTrackingUtils.clearSession();
      
      // Get the token before clearing OAuth setup state
      const token = sessionStorage.getItem('oauth_temp_token');

      // Store token in localStorage BEFORE clearing OAuth setup flags
      // This ensures AuthGuard can see the token after password verification
      if (token) {
        // Store in standard auth_token format that AuthGuard expects
        localStorage.setItem('auth_token', token);
        // Also set via apiClient so it can find the token
        apiClient.setAuthToken(token);
      }

      // Clear OAuth setup state - login is complete
      // Do this AFTER storing the token so AuthGuard won't reject it
      sessionStorage.removeItem('oauth_temp_token');
      sessionStorage.removeItem('oauth_setup_in_progress');
      sessionStorage.removeItem('oauth_user_id');

      // Navigate to dashboard
      router.push('/');
    } catch (err) {
      console.error('OAuth login error:', err);
      setError('An unexpected error occurred. Please try again.');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Enter Your Password</CardTitle>
        <CardDescription>
          {isChecking 
            ? 'Checking your account...'
            : isNewUser 
              ? 'Set a password to secure your account'
              : 'Enter your password to continue'
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isChecking ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {error && (
              <div className="flex gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
                <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <FieldGroup>
                <FieldLabel>Email</FieldLabel>
                <Input
                  type="email"
                  value={email}
                  disabled
                  className="bg-muted"
                  autoComplete="username"
                />
              </FieldGroup>

          <FieldGroup>
            <FieldLabel>Password</FieldLabel>
            <PasswordInput
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              autoComplete={isNewUser ? 'new-password' : 'current-password'}
            />
          </FieldGroup>

          {isNewUser && (
            <FieldGroup>
              <FieldLabel>Confirm Password</FieldLabel>
              <PasswordInput
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading}
                autoComplete="new-password"
              />
            </FieldGroup>
          )}

          {isNewUser && (
            <div className="rounded-lg border border-blue-200/50 bg-blue-50/50 dark:border-blue-900/50 dark:bg-blue-950/20 p-3">
              <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
                Your password is used to encrypt your files locally and never stored on our servers.
              </p>
            </div>
          )}

          <Button
            type="submit"
            disabled={!isPasswordValid || isLoading}
            className="w-full"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLoading ? (isNewUser ? 'Setting up...' : 'Verifying...') : 'Continue'}
          </Button>
            </form>
          </>
        )}
      </CardContent>
    </Card>
  );
}
