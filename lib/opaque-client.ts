/**
 * This module dynamically imports OPAQUE functionality
 * It's designed to only be used client-side and accessed via dynamic import
 */

// Check that we're in browser context
if (typeof window === 'undefined') {
  throw new Error('opaque-client can only be used in browser');
}

export async function getOPAQUE() {
  return import('./opaque').then(m => m.default);
}

export async function getOPAQUERegistration() {
  return import('./opaque').then(m => m.OPAQUERegistration);
}

export async function getOPAQUELogin() {
  return import('./opaque').then(m => m.OPAQUELogin);
}
