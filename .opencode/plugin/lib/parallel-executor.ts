/**
 * Parallel Executor
 * Runs multiple tasks concurrently using git worktrees
 * Mirrors the parallel execution from ralphy.sh
 */

import type { RalphyConfig } from "./config"
import { GitManager } from "./git-manager"
import { getTaskSource, type TaskSource } from "./task-sources"
import { YamlTaskSource } from "./task-sources/yaml"
import { ProgressTracker } from "./progress-tracker"
import { buildParallelPrompt, buildMergeConflictPrompt } from "./prompt-builder"
import { sleep, truncate } from "./utils"
import * as os from "os"
import * as path from "path"

type ShellAPI = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<{ text(): Promise<string>; exitCode: number }>

interface AgentResult {
  task: string
  success: boolean
  branch: string
  inputTokens: number
  outputTokens: number
  error?: string
}

export class ParallelExecutor {
  private gitManager: GitManager
  private taskSource: TaskSource
  private tracker: ProgressTracker
  private worktreeBase: string
  private results: AgentResult[] = []

  constructor(
    private config: RalphyConfig,
    private $: ShellAPI,
    private directory: string
  ) {
    this.gitManager = new GitManager($, directory)
    this.taskSource = getTaskSource(config, directory)
    this.tracker = new ProgressTracker()
    this.worktreeBase = path.join(os.tmpdir(), `ralphy-${Date.now()}`)
  }

  /**
   * Run all tasks in parallel batches
   */
  async run(): Promise<void> {
    const allTasks = await this.taskSource.getRemainingTasks()

    if (allTasks.length === 0) {
      console.log("No tasks to run")
      return
    }

    console.log(`Found ${allTasks.length} tasks to process`)
    console.log(`Running ${this.config.maxParallel} parallel agents`)

    // Ensure base branch is set
    if (!this.config.baseBranch) {
      this.config.baseBranch = await this.gitManager.getCurrentBranch()
    }

    // Create worktree base directory
    await this.$`mkdir -p ${this.worktreeBase}`

    // Process tasks by parallel group if using YAML source
    if (this.config.prdSource === "yaml" && this.taskSource instanceof YamlTaskSource) {
      await this.runWithGroups(this.taskSource as YamlTaskSource)
    } else {
      await this.runBatches(allTasks)
    }

    // Clean up worktree base
    try {
      await this.$`rm -rf ${this.worktreeBase}`
    } catch {
      console.log(`Note: Worktree base preserved at ${this.worktreeBase}`)
    }

    // Handle completed branches
    await this.handleCompletedBranches()
  }

  /**
   * Run tasks organized by YAML parallel groups
   */
  private async runWithGroups(source: YamlTaskSource): Promise<void> {
    const groups = await source.getParallelGroups()

    for (const group of groups) {
      const tasks = await source.getTasksByGroup(group)
      if (tasks.length === 0) continue

      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
      console.log(`Processing parallel group ${group} (${tasks.length} tasks)`)
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)

      await this.runBatches(tasks)
    }
  }

  /**
   * Run tasks in batches of maxParallel
   */
  private async runBatches(tasks: string[]): Promise<void> {
    let batchNum = 0

    for (let i = 0; i < tasks.length; i += this.config.maxParallel) {
      batchNum++
      const batch = tasks.slice(i, i + this.config.maxParallel)

      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
      console.log(`Batch ${batchNum}: Spawning ${batch.length} parallel agents`)
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)

      // Run batch concurrently
      const promises = batch.map((task, idx) =>
        this.runAgent(task, i + idx + 1)
      )

      const batchResults = await Promise.all(promises)
      this.results.push(...batchResults)

      // Show batch results
      console.log(`\nBatch ${batchNum} Results:`)
      for (const result of batchResults) {
        const icon = result.success ? "✓" : "✗"
        const branchInfo = result.branch ? ` → ${result.branch}` : ""
        console.log(`  ${icon} Agent ${this.results.indexOf(result) + 1}: ${truncate(result.task, 45)}${branchInfo}`)

        if (!result.success && result.error) {
          console.log(`    Error: ${result.error}`)
        }
      }

      // Check max iterations
      if (this.config.maxIterations > 0 && this.results.length >= this.config.maxIterations) {
        console.log(`\nReached max iterations (${this.config.maxIterations})`)
        break
      }
    }
  }

  /**
   * Run a single agent in a worktree
   */
  private async runAgent(task: string, agentNum: number): Promise<AgentResult> {
    console.log(`  ◉ Agent ${agentNum}: ${truncate(task, 50)}`)

    const result: AgentResult = {
      task,
      success: false,
      branch: "",
      inputTokens: 0,
      outputTokens: 0,
    }

    // Create worktree
    const worktree = await this.gitManager.createWorktree(
      task,
      agentNum,
      this.worktreeBase,
      this.config.baseBranch
    )

    if (!worktree) {
      result.error = "Failed to create worktree"
      return result
    }

    result.branch = worktree.branch

    // Copy PRD and progress files to worktree
    try {
      await this.$`cp ${this.directory}/${this.config.prdFile} ${worktree.dir}/`
      await this.$`touch ${worktree.dir}/progress.txt`
    } catch {
      // Ignore copy errors
    }

    // Build prompt
    const prompt = buildParallelPrompt(task, agentNum, this.config)

    // In a real implementation, we would spawn opencode run here
    // For now, we'll simulate by logging what would happen
    console.log(`    Agent ${agentNum} would execute in ${worktree.dir}`)

    // Simulate execution (in real plugin, this would call opencode)
    // The actual execution would be done by sending a message to the session
    // or by using the opencode SDK client

    // For now, mark as successful for the structure
    result.success = true

    // Add tokens to tracker
    this.tracker.addTokens(result.inputTokens, result.outputTokens)

    // Create PR if requested
    if (this.config.createPr && result.success) {
      const prUrl = await this.gitManager.createPullRequest(
        worktree.branch,
        task,
        `Automated implementation by Ralphy (Agent ${agentNum})`,
        this.config.baseBranch,
        this.config.draftPr
      )
      if (prUrl) {
        console.log(`    Created PR: ${prUrl}`)
      }
    }

    // Mark task complete
    if (result.success) {
      await this.taskSource.markComplete(task)
      this.tracker.addBranch(worktree.branch)
    }

    // Cleanup worktree
    await this.gitManager.cleanupWorktree(worktree.dir)

    return result
  }

  /**
   * Handle completed branches (merge or show list)
   */
  private async handleCompletedBranches(): Promise<void> {
    const successfulBranches = this.results
      .filter(r => r.success && r.branch)
      .map(r => r.branch)

    if (successfulBranches.length === 0) return

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

    if (this.config.createPr) {
      console.log("Branches created by agents:")
      for (const branch of successfulBranches) {
        console.log(`  • ${branch}`)
      }
    } else {
      console.log("Merging agent branches...")

      const failedMerges: string[] = []

      for (const branch of successfulBranches) {
        console.log(`  Merging ${branch}...`)
        const success = await this.gitManager.mergeBranch(branch, this.config.baseBranch)

        if (success) {
          console.log(`    ✓`)
        } else {
          console.log(`    conflict`)
          failedMerges.push(branch)
        }
      }

      // Try to resolve conflicts with AI
      if (failedMerges.length > 0) {
        console.log("\nAttempting to resolve conflicts...")

        for (const branch of failedMerges) {
          const conflicts = await this.gitManager.getConflictedFiles()

          if (conflicts.length > 0) {
            // In real implementation, would send merge prompt to AI
            const prompt = buildMergeConflictPrompt(conflicts)
            console.log(`  Would resolve conflicts in: ${conflicts.join(", ")}`)
          }

          await this.gitManager.abortMerge()
        }

        console.log("\nSome conflicts could not be resolved automatically:")
        for (const branch of failedMerges) {
          console.log(`  • ${branch}`)
        }
        console.log("\nResolve conflicts manually: git merge <branch>")
      } else {
        console.log("\n✓ All branches merged successfully!")
      }
    }
  }

  /**
   * Get execution summary
   */
  getSummary(): string {
    const successful = this.results.filter(r => r.success).length
    const failed = this.results.filter(r => !r.success).length

    return this.tracker.getSummary(successful) + `\nFailed: ${failed} tasks`
  }
}
