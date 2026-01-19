/**
 * Progress Tracker
 * Tracks token usage, costs, and provides summaries
 * Mirrors the cost tracking from ralphy.sh
 */

import { formatTokens, calculateCost, formatDuration } from "./utils"

export class ProgressTracker {
  private inputTokens: number = 0
  private outputTokens: number = 0
  private actualCost: number = 0
  private durationMs: number = 0
  private startTime: number = Date.now()
  private completedBranches: string[] = []

  /**
   * Reset the tracker for a new session
   */
  reset(): void {
    this.inputTokens = 0
    this.outputTokens = 0
    this.actualCost = 0
    this.durationMs = 0
    this.startTime = Date.now()
    this.completedBranches = []
  }

  /**
   * Add token usage
   */
  addTokens(input: number, output: number): void {
    this.inputTokens += input
    this.outputTokens += output
  }

  /**
   * Add actual cost (from OpenCode)
   */
  addCost(cost: number): void {
    this.actualCost += cost
  }

  /**
   * Add duration (for tracking API time)
   */
  addDuration(ms: number): void {
    this.durationMs += ms
  }

  /**
   * Record a completed branch
   */
  addBranch(branchName: string): void {
    this.completedBranches.push(branchName)
  }

  /**
   * Get token summary
   */
  getTokenSummary(): string {
    const parts: string[] = []

    if (this.inputTokens > 0 || this.outputTokens > 0) {
      parts.push(`Input tokens:  ${formatTokens(this.inputTokens)}`)
      parts.push(`Output tokens: ${formatTokens(this.outputTokens)}`)
      parts.push(`Total tokens:  ${formatTokens(this.inputTokens + this.outputTokens)}`)

      if (this.actualCost > 0) {
        parts.push(`Actual cost:   $${this.actualCost.toFixed(4)}`)
      } else {
        parts.push(`Est. cost:     ${calculateCost(this.inputTokens, this.outputTokens)}`)
      }
    } else if (this.durationMs > 0) {
      parts.push(`Total API time: ${formatDuration(this.durationMs)}`)
    } else {
      parts.push("No token data recorded")
    }

    return parts.join("\n")
  }

  /**
   * Get full summary
   */
  getSummary(iterations: number): string {
    const elapsed = Date.now() - this.startTime
    const parts: string[] = []

    parts.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    parts.push("📊 Ralphy Summary")
    parts.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    parts.push(`Tasks completed: ${iterations}`)
    parts.push(`Total time: ${formatDuration(elapsed)}`)
    parts.push("")
    parts.push(this.getTokenSummary())

    if (this.completedBranches.length > 0) {
      parts.push("")
      parts.push("Branches created:")
      for (const branch of this.completedBranches) {
        parts.push(`  • ${branch}`)
      }
    }

    parts.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

    return parts.join("\n")
  }

  /**
   * Get current stats
   */
  getStats(): {
    inputTokens: number
    outputTokens: number
    actualCost: number
    durationMs: number
    branches: string[]
  } {
    return {
      inputTokens: this.inputTokens,
      outputTokens: this.outputTokens,
      actualCost: this.actualCost,
      durationMs: this.durationMs,
      branches: [...this.completedBranches],
    }
  }
}
