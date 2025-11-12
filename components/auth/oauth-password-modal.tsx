'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
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
import { Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { masterKeyManager } from '@/lib/master-key';
import { 
  deriveEncryptionKey, 
  encryptMasterKeyWithRecoveryKey, 
  uint8ArrayToHex,
  deriveRecoveryKeyEncryptionKey,
  generateRecoveryKey,
  encryptRecoveryKey
} from '@/lib/crypto';
import { useRouter } from 'next/navigation';

interface OAuthPasswordModalProps {
  email: string;
}

export function OAuthPasswordModal({
  email,
}: OAuthPasswordModalProps) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [isNewUser, setIsNewUser] = useState(true); // Will be determined after first API call
  const [isChecking, setIsChecking] = useState(true); // Loading state while checking user status

  // Check if user is new or existing on mount
  useEffect(() => {
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
  }, [email]);

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

      // CRITICAL: Use the SAME salt that was used to encrypt the keypairs
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
      const pqcKeypairs = {
        kyberPublicKey: allKeypairs.pqcKeypairs.kyber.publicKey,
        kyberPrivateKeyEncrypted: allKeypairs.pqcKeypairs.kyber.encryptedPrivateKey,
        kyberEncryptionKey: allKeypairs.pqcKeypairs.kyber.encryptionKey,
        kyberEncryptionNonce: allKeypairs.pqcKeypairs.kyber.encryptionNonce,
        kyberPrivateKeyNonce: allKeypairs.pqcKeypairs.kyber.privateKeyNonce,
        x25519PublicKey: allKeypairs.pqcKeypairs.x25519.publicKey,
        x25519PrivateKeyEncrypted: allKeypairs.pqcKeypairs.x25519.encryptedPrivateKey,
        x25519EncryptionKey: allKeypairs.pqcKeypairs.x25519.encryptionKey,
        x25519EncryptionNonce: allKeypairs.pqcKeypairs.x25519.encryptionNonce,
        x25519PrivateKeyNonce: allKeypairs.pqcKeypairs.x25519.privateKeyNonce,
        dilithiumPublicKey: allKeypairs.pqcKeypairs.dilithium.publicKey,
        dilithiumPrivateKeyEncrypted: allKeypairs.pqcKeypairs.dilithium.encryptedPrivateKey,
        dilithiumEncryptionKey: allKeypairs.pqcKeypairs.dilithium.encryptionKey,
        dilithiumEncryptionNonce: allKeypairs.pqcKeypairs.dilithium.encryptionNonce,
        dilithiumPrivateKeyNonce: allKeypairs.pqcKeypairs.dilithium.privateKeyNonce,
        ed25519PublicKey: allKeypairs.pqcKeypairs.ed25519.publicKey,
        ed25519PrivateKeyEncrypted: allKeypairs.pqcKeypairs.ed25519.encryptedPrivateKey,
        ed25519EncryptionKey: allKeypairs.pqcKeypairs.ed25519.encryptionKey,
        ed25519EncryptionNonce: allKeypairs.pqcKeypairs.ed25519.encryptionNonce,
        ed25519PrivateKeyNonce: allKeypairs.pqcKeypairs.ed25519.privateKeyNonce,
      };

      console.log('🔐 OAuth Setup - sending to backend with accountSalt format:', typeof accountSalt);

      // Call backend to complete OAuth registration
      const response = await apiClient.completeOAuthRegistration({
        accountSalt,
        pqcKeypairs,
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
      
      console.log('OAuth Existing User Login - Full Response:', {
        hasUser: !!user,
        userKeys: user ? Object.keys(user) : [],
        account_salt_value: user.account_salt,
        account_salt_type: typeof user.account_salt,
        account_salt_length: user.account_salt?.length,
        account_salt_substring: user.account_salt?.substring(0, 20)
      });

      if (!user.account_salt) {
        console.error('account_salt is missing from profile response!');
        setError('Account salt not found. Please complete password setup again.');
        return;
      }

      // Derive master key from password and stored account salt
      const masterKey = await deriveEncryptionKey(password, user.account_salt);
      
      console.log('OAuth Login - Master key derived');

      // Cache master key locally for immediate use
      masterKeyManager.cacheExistingMasterKey(masterKey, user.account_salt);
      
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

      // Navigate to dashboard
      router.push('/');
    } catch (err) {
      console.error('OAuth login error:', err);
      setError('Incorrect password. Please try again.');
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
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                autoComplete={isNewUser ? 'new-password' : 'current-password'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                disabled={isLoading}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </FieldGroup>

          {isNewUser && (
            <FieldGroup>
              <FieldLabel>Confirm Password</FieldLabel>
              <Input
                type={showPassword ? 'text' : 'password'}
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
