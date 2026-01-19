/**
 * Git Manager
 * Handles git branch operations, worktrees, and PR creation
 * Mirrors git functions from ralphy.sh
 */

import { slugify } from "./utils"

type ShellAPI = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<{ text(): Promise<string>; exitCode: number }>

export class GitManager {
  constructor(
    private $: ShellAPI,
    private directory: string
  ) { }

  /**
   * Get the current git branch
   */
  async getCurrentBranch(): Promise<string> {
    try {
      const result = await this.$`git rev-parse --abbrev-ref HEAD`
      return (await result.text()).trim() || "main"
    } catch {
      return "main"
    }
  }

  /**
   * Create a task branch
   */
  async createTaskBranch(task: string, baseBranch: string): Promise<string> {
    const branchName = `ralphy/${slugify(task)}`

    try {
      // Stash any changes
      await this.$`git stash push -m "ralphy-autostash"`

      // Checkout base branch and pull
      await this.$`git checkout ${baseBranch}`
      await this.$`git pull origin ${baseBranch}`

      // Create and checkout new branch
      try {
        await this.$`git checkout -b ${branchName}`
      } catch {
        // Branch might exist, try to checkout
        await this.$`git checkout ${branchName}`
      }

      // Pop stash if we stashed
      try {
        await this.$`git stash pop`
      } catch {
        // Ignore if nothing to pop
      }

      return branchName
    } catch (error) {
      console.error("Failed to create task branch:", error)
      return ""
    }
  }

  /**
   * Return to base branch
   */
  async returnToBaseBranch(baseBranch: string): Promise<void> {
    if (baseBranch) {
      try {
        await this.$`git checkout ${baseBranch}`
      } catch {
        // Ignore errors
      }
    }
  }

  /**
   * Create a pull request using gh CLI
   */
  async createPullRequest(
    branchName: string,
    title: string,
    body: string,
    baseBranch: string,
    draft: boolean = false
  ): Promise<string | null> {
    try {
      // Push branch
      await this.$`git push -u origin ${branchName}`

      // Create PR
      const draftFlag = draft ? "--draft" : ""
      const result = await this.$`gh pr create --base ${baseBranch} --head ${branchName} --title ${title} --body ${body} ${draftFlag}`
      return (await result.text()).trim()
    } catch (error) {
      console.error("Failed to create PR:", error)
      return null
    }
  }

  /**
   * Create a worktree for parallel execution
   */
  async createWorktree(task: string, agentNum: number, worktreeBase: string, baseBranch: string): Promise<{ dir: string; branch: string } | null> {
    const branchName = `ralphy/agent-${agentNum}-${slugify(task)}`
    const worktreeDir = `${worktreeBase}/agent-${agentNum}`

    try {
      // Prune stale worktrees
      await this.$`git worktree prune`

      // Delete branch if exists
      try {
        await this.$`git branch -D ${branchName}`
      } catch {
        // Ignore if doesn't exist
      }

      // Create branch from base
      await this.$`git branch ${branchName} ${baseBranch}`

      // Remove existing worktree dir
      try {
        await this.$`rm -rf ${worktreeDir}`
      } catch {
        // Ignore
      }

      // Create worktree
      await this.$`git worktree add ${worktreeDir} ${branchName}`

      return { dir: worktreeDir, branch: branchName }
    } catch (error) {
      console.error("Failed to create worktree:", error)
      return null
    }
  }

  /**
   * Cleanup a worktree
   */
  async cleanupWorktree(worktreeDir: string): Promise<void> {
    try {
      // Check for uncommitted changes
      const result = await this.$`git -C ${worktreeDir} status --porcelain`
      const status = await result.text()

      if (status.trim()) {
        console.log("Preserving dirty worktree:", worktreeDir)
        return
      }

      // Remove worktree
      await this.$`git worktree remove -f ${worktreeDir}`
    } catch {
      // Ignore errors
    }
  }

  /**
   * Merge a branch into base
   */
  async mergeBranch(branchName: string, baseBranch: string): Promise<boolean> {
    try {
      await this.$`git checkout ${baseBranch}`
      await this.$`git merge --no-edit ${branchName}`
      await this.$`git branch -d ${branchName}`
      return true
    } catch {
      return false
    }
  }

  /**
   * Get list of conflicted files during merge
   */
  async getConflictedFiles(): Promise<string[]> {
    try {
      const result = await this.$`git diff --name-only --diff-filter=U`
      const output = await result.text()
      return output.trim().split("\n").filter(Boolean)
    } catch {
      return []
    }
  }

  /**
   * Abort a merge
   */
  async abortMerge(): Promise<void> {
    try {
      await this.$`git merge --abort`
    } catch {
      // Ignore
    }
  }

  /**
   * Get commit count since base branch
   */
  async getCommitCount(baseBranch: string): Promise<number> {
    try {
      const result = await this.$`git rev-list --count ${baseBranch}..HEAD`
      const count = parseInt((await result.text()).trim())
      return isNaN(count) ? 0 : count
    } catch {
      return 0
    }
  }
}
