/**
 * Utility functions for Ralphy plugin
 */

/**
 * Read a file and return its contents
 */
export async function readFile(filepath: string): Promise<string> {
  try {
    return await Bun.file(filepath).text()
  } catch {
    return ""
  }
}

/**
 * Write content to a file
 */
export async function writeFile(filepath: string, content: string): Promise<void> {
  await Bun.write(filepath, content)
}

/**
 * Check if a file exists
 */
export async function fileExists(filepath: string): Promise<boolean> {
  try {
    return await Bun.file(filepath).exists()
  } catch {
    return false
  }
}

/**
 * Slugify text for branch names
 * Matches the bash slugify function
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50)
}

/**
 * Escape special regex characters
 */
export function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * Format duration in ms to human readable
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`
  }
  return `${seconds}s`
}

/**
 * Format token count with commas
 */
export function formatTokens(count: number): string {
  return count.toLocaleString()
}

/**
 * Calculate estimated cost based on tokens
 * Uses Claude pricing: $3/1M input, $15/1M output
 */
export function calculateCost(inputTokens: number, outputTokens: number): string {
  const cost = (inputTokens * 0.000003) + (outputTokens * 0.000015)
  return `$${cost.toFixed(4)}`
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, length: number): string {
  if (text.length <= length) return text
  return text.slice(0, length - 3) + "..."
}

/**
 * Sleep for a given number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
