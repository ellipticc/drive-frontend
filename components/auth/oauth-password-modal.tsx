'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Loader2 } from 'lucide-react';
import { deriveEncryptionKey, encryptData, uint8ArrayToHex } from '@/lib/crypto';
import { masterKeyManager } from '@/lib/master-key';
import { apiClient } from '@/lib/api';

interface OAuthPasswordModalProps {
  email: string;
  token: string;
  onComplete?: () => void;
}

/**
 * Modal for OAuth users to set their password
 * Password is used to derive the Master Key for encryption/decryption
 * This happens AFTER successful Google OAuth authentication
 */
export function OAuthPasswordModal({ email, token, onComplete }: OAuthPasswordModalProps) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const validatePassword = () => {
    if (!password) {
      setError('Password is required');
      return false;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return false;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return false;
    }

    // Check password strength
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

    const strengthScore = [hasUppercase, hasLowercase, hasNumbers, hasSpecial].filter(Boolean).length;

    if (strengthScore < 3) {
      setError('Password must contain uppercase, lowercase, numbers, and special characters');
      return false;
    }

    return true;
  };

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validatePassword()) {
      return;
    }

    setLoading(true);

    try {
      // Generate accountSalt (same as OPAQUE users)
      const saltBytes = new Uint8Array(16);
      crypto.getRandomValues(saltBytes);
      const accountSalt = uint8ArrayToHex(saltBytes);

      // Derive Master Key from password (same mechanism as OPAQUE)
      const masterKey = await deriveEncryptionKey(password, accountSalt);

      // Cache the Master Key locally
      await masterKeyManager.cacheExistingMasterKey(masterKey, accountSalt);

      // Generate recovery key (same as OPAQUE users)
      const recoveryKeyBytes = new Uint8Array(32);
      crypto.getRandomValues(recoveryKeyBytes);
      
      const { encryptedData: encryptedRecoveryKey, nonce: recoveryKeyNonce } = encryptData(
        recoveryKeyBytes,
        masterKey
      );

      // Call backend to complete OAuth registration
      const response = await apiClient.completeOAuthRegistration({
        accountSalt,
        encrypted_recovery_key: encryptedRecoveryKey,
        recovery_key_nonce: recoveryKeyNonce
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to complete registration');
      }

      // Show success message
      console.log('OAuth password setup complete');

      // Call onComplete callback if provided
      if (onComplete) {
        onComplete();
      }

      // Redirect to dashboard
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete registration');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl p-8 max-w-md w-full mx-4">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
            Set Your Password
          </h2>
          <p className="text-slate-600 dark:text-slate-400">
            Welcome {email}! Create a strong password to encrypt and secure your files.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md flex gap-2">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        <form onSubmit={handleComplete} className="space-y-4">
          {/* Password field */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your password"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                disabled={loading}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {/* Confirm password field */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Confirm Password
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Confirm your password"
              disabled={loading}
            />
          </div>

          {/* Password strength indicator */}
          {password && (
            <div className="text-sm text-slate-600 dark:text-slate-400">
              <p className="mb-2">Password requirements:</p>
              <ul className="space-y-1 text-xs">
                <li className={password.length >= 8 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                  ✓ At least 8 characters
                </li>
                <li className={/[A-Z]/.test(password) ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                  ✓ Uppercase letter
                </li>
                <li className={/[a-z]/.test(password) ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                  ✓ Lowercase letter
                </li>
                <li className={/\d/.test(password) ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                  ✓ Number
                </li>
                <li className={/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password) ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                  ✓ Special character
                </li>
              </ul>
            </div>
          )}

          {/* Security info */}
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
            <p className="text-xs text-blue-700 dark:text-blue-400">
              🔒 Your password is used to derive your encryption key. We never store your password on our servers. Make it strong and memorable!
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={loading || !password || !confirmPassword}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-600 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? 'Setting up...' : 'Complete Setup'}
            </button>
          </div>
        </form>

        {/* Redirect info */}
        <p className="text-xs text-slate-500 dark:text-slate-400 text-center mt-4">
          This is your first time logging in. You only need to set this password once.
        </p>
      </div>
    </div>
  );
}
