/**
 * GitHub Issues Task Source
 * Fetches tasks from GitHub issues using the gh CLI
 */

import type { TaskSource, Task } from "./index"

export class GithubTaskSource implements TaskSource {
  constructor(
    private repo: string,
    private label: string = ""
  ) { }

  private async runGhCommand(args: string[]): Promise<string> {
    const proc = Bun.spawn(["gh", ...args], {
      stdout: "pipe",
      stderr: "pipe",
    })

    const output = await new Response(proc.stdout).text()
    await proc.exited
    return output.trim()
  }

  async getRemainingTasks(): Promise<string[]> {
    const args = ["issue", "list", "--repo", this.repo, "--state", "open", "--json", "number,title"]

    if (this.label) {
      args.push("--label", this.label)
    }

    const output = await this.runGhCommand(args)
    if (!output) return []

    try {
      const issues = JSON.parse(output) as Array<{ number: number; title: string }>
      return issues.map(i => `${i.number}:${i.title}`)
    } catch {
      return []
    }
  }

  async getAllTasks(): Promise<Task[]> {
    const tasks: Task[] = []

    // Get open issues
    const openArgs = ["issue", "list", "--repo", this.repo, "--state", "open", "--json", "number,title"]
    if (this.label) openArgs.push("--label", this.label)

    const openOutput = await this.runGhCommand(openArgs)
    if (openOutput) {
      try {
        const issues = JSON.parse(openOutput) as Array<{ number: number; title: string }>
        for (const issue of issues) {
          tasks.push({
            title: `${issue.number}:${issue.title}`,
            completed: false,
          })
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Get closed issues
    const closedArgs = ["issue", "list", "--repo", this.repo, "--state", "closed", "--json", "number,title"]
    if (this.label) closedArgs.push("--label", this.label)

    const closedOutput = await this.runGhCommand(closedArgs)
    if (closedOutput) {
      try {
        const issues = JSON.parse(closedOutput) as Array<{ number: number; title: string }>
        for (const issue of issues) {
          tasks.push({
            title: `${issue.number}:${issue.title}`,
            completed: true,
          })
        }
      } catch {
        // Ignore parse errors
      }
    }

    return tasks
  }

  async getNextTask(): Promise<string | null> {
    const tasks = await this.getRemainingTasks()
    return tasks.length > 0 ? tasks[0] : null
  }

  async countRemaining(): Promise<number> {
    const tasks = await this.getRemainingTasks()
    return tasks.length
  }

  async countCompleted(): Promise<number> {
    const args = ["issue", "list", "--repo", this.repo, "--state", "closed", "--json", "number"]
    if (this.label) args.push("--label", this.label)

    const output = await this.runGhCommand(args)
    if (!output) return 0

    try {
      const issues = JSON.parse(output) as Array<{ number: number }>
      return issues.length
    } catch {
      return 0
    }
  }

  async markComplete(task: string): Promise<void> {
    // Extract issue number from "number:title" format
    const issueNum = task.split(":")[0]
    if (!issueNum) return

    await this.runGhCommand(["issue", "close", issueNum, "--repo", this.repo])
  }

  async getTaskBody(task: string): Promise<string> {
    const issueNum = task.split(":")[0]
    if (!issueNum) return ""

    const output = await this.runGhCommand([
      "issue",
      "view",
      issueNum,
      "--repo",
      this.repo,
      "--json",
      "body",
    ])

    if (!output) return ""

    try {
      const data = JSON.parse(output) as { body: string }
      return data.body || ""
    } catch {
      return ""
    }
  }
}
