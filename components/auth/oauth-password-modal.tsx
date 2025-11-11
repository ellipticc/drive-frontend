'use client';

import { useState } from 'react';
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
import { deriveEncryptionKey, encryptMasterKeyWithRecoveryKey, uint8ArrayToHex } from '@/lib/crypto';
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

  // Password validation
  const isPasswordValid = password.length >= 8 && password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isPasswordValid) {
      setError('Please enter and confirm your password');
      return;
    }

    setIsLoading(true);

    try {
      // Import real keypair generation function (same as signup)
      const { generateAllKeypairs } = await import('@/lib/crypto');

      // Generate real Kyber, Dilithium, X25519, Ed25519 keypairs
      const allKeypairs = await generateAllKeypairs(password);

      // Generate account salt (for password derivation) - 32 bytes like signup
      const accountSaltBytes = new Uint8Array(32);
      globalThis.crypto.getRandomValues(accountSaltBytes);
      const accountSalt = uint8ArrayToHex(accountSaltBytes);

      // Derive master key from password and salt
      const masterKey = await deriveEncryptionKey(password, accountSalt);

      // Generate recovery key (for master key backup)
      const recoveryKeyBytes = new Uint8Array(32);
      globalThis.crypto.getRandomValues(recoveryKeyBytes);

      // Encrypt master key with recovery key
      const { encryptedMasterKey, masterKeyNonce } =
        encryptMasterKeyWithRecoveryKey(masterKey, recoveryKeyBytes);

      // Cache master key locally for immediate use
      masterKeyManager.cacheExistingMasterKey(masterKey, accountSalt);

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

      // Call backend to complete OAuth registration
      const response = await apiClient.completeOAuthRegistration({
        accountSalt,
        pqcKeypairs,
        encryptedMasterKey,
        encryptedRecoveryKey: uint8ArrayToHex(recoveryKeyBytes),
        recoveryKeyNonce: '',  // No separate nonce for OAuth recovery key
        masterKeySalt: JSON.stringify({
          salt: accountSalt,
          algorithm: 'argon2id',
          masterKeyNonce: masterKeyNonce
        }),
      });

      if (response.success) {
        // Redirect to backup page immediately
        router.push('/backup');
      } else {
        setError(
          response.message || 'Failed to complete registration. Please try again.',
        );
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set Your Password</CardTitle>
        <CardDescription>
          Secure your account with a password
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
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
                autoComplete="new-password"
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

          <div className="rounded-lg border border-blue-200/50 bg-blue-50/50 dark:border-blue-900/50 dark:bg-blue-950/20 p-3">
            <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
              Your password is used to encrypt your files locally and never stored on our servers.
            </p>
          </div>

          <Button
            type="submit"
            disabled={!isPasswordValid || isLoading}
            className="w-full"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLoading ? 'Setting up...' : 'Continue'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
