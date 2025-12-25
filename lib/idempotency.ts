/**
 * Idempotency utilities for client-side request deduplication
 *
 * For creation operations, uses the resource ID (fileId/folderId) directly as the Idempotency-Key
 * to ensure retry safety and prevent duplicate resource creation.
 */

import { v5 as uuidv5 } from 'uuid';

// Fixed namespace for deterministic UUID v5 generation
const IDEMPOTENCY_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

/**
 * Generate idempotency key for creation operations
 * For creates: use the resource ID directly (fileId/folderId)
 */
export function generateIdempotencyKeyForCreate(resourceId: string): string {
  return resourceId;
}

/**
 * Generate idempotency key for non-creation operations
 * Uses UUID v5 (deterministic) so same logical operation always gets same key
 * Format: operationType:deterministicIntent
 */
export function generateIdempotencyKey(operationType: string, identifier: string): string {
  const deterministicIntent = uuidv5(identifier, IDEMPOTENCY_NAMESPACE);
  return `${operationType}:${deterministicIntent}`;
}

/**
 * Add idempotency key to fetch request headers
 * @param headers Existing headers object
 * @param idempotencyKey The idempotency key
 * @returns Updated headers with Idempotency-Key
 */
export function addIdempotencyKey(
  headers: Record<string, string>,
  idempotencyKey: string
): Record<string, string> {
  return {
    ...headers,
    'Idempotency-Key': idempotencyKey,
  };
}

/**
 * Make a request with idempotency support for creation operations
 * Uses the resource ID directly as the Idempotency-Key
 */
export async function makeFetchWithIdempotency(
  url: string,
  options: RequestInit,
  resourceId: string
): Promise<Response> {
  // Add resource ID directly as idempotency key
  const headers = addIdempotencyKey(
    (options.headers as Record<string, string>) || {},
    resourceId
  );

  // Make the request
  return fetch(url, {
    ...options,
    headers,
  });
}

/**
 * Example usage in API calls:
 *
 * // When creating a file (deterministic by resource ID)
 * const fileId = crypto.randomUUID();
 * const response = await makeFetchWithIdempotency(
 *   '/api/v1/files/initialize',
 *   {
 *     method: 'POST',
 *     body: JSON.stringify({ ...fileData, clientFileId: fileId }),
 *     headers: { 'Content-Type': 'application/json' }
 *   },
 *   fileId
 * );
 *
 * // When renaming a file (deterministic by operation + identifier)
 * const renameKey = generateIdempotencyKey('renameFile', `${fileId}:${newNameHmac}`);
 * // Same operation will always get same key, even across retries/page reloads
 *
 * // User can safely retry ANY request with the same Idempotency-Key
 * // Server will return existing result if Idempotency-Key matches
 */
