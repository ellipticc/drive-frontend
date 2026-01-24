/**
 * Generate DiceBear avatar URL using user ID as seed
 * @param userId - The user ID to use as seed
 * @param size - Avatar size in pixels (default: 64)
 * @returns DiceBear avatar URL
 */
export function getDiceBearAvatar(userId: string, size: number = 64): string {
  // Use user ID as seed for consistent avatars
  const seed = encodeURIComponent(userId);
  // Using the "notionists" style which creates nice avatars
  return `https://api.dicebear.com/9.x/notionists/svg?seed=${seed}&size=${size}&backgroundColor=ffffff&textColor=000000&fontSize=40`;
}