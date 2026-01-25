/**
 * Generate DiceBear avatar URL using user ID as seed
 * @param userId - The user ID to use as seed
 * @param size - Avatar size in pixels (default: 64)
 * @returns DiceBear avatar URL
 */
export function getDiceBearAvatar(userId: string, size: number = 64): string {
  // Use user ID as seed for consistent avatars
  const seed = encodeURIComponent(userId);
  // Using the "Open Peeps" style with custom styling
  return `https://api.dicebear.com/9.x/open-peeps/svg?seed=${seed}&skinColor=ffffff&clothingColor=000000&size=${size}&headContrastColor=FFFFFF&accessoriesProbability=50&backgroundColor=ffffff&maskProbability=50`;
}