/**
 * Idempotency utilities for client-side request deduplication
 *
 * For creation operations, uses the resource ID (fileId/folderId) directly as the Idempotency-Key
 * to ensure retry safety and prevent duplicate resource creation.
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Generate idempotency key for creation operations 
 * (Industry Standard: Use a random UUID per action instance)
 */
export function generateIdempotencyKeyForCreate(): string {
  return uuidv4();
}

/**
 * Generate idempotency key for non-creation operations
 * (Industry Standard: Use a random UUID per action instance)
 */
export function generateIdempotencyKey(): string {
  return uuidv4();
}

/**
 * Add idempotency key to fetch request headers
 * @param headers Existing headers object
 * @param idempotencyKey The idempotency key
 * @returns Updated headers with X-Idempotency-Key
 */
export function addIdempotencyKey(
  headers: Record<string, string>,
  idempotencyKey: string
): Record<string, string> {
  return {
    ...headers,
    'X-Idempotency-Key': idempotencyKey,
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
