/**
 * Markdown Task Source
 * Parses tasks from markdown PRD files with checkbox format:
 * - [ ] Task to do
 * - [x] Completed task
 */

import type { TaskSource, Task } from "./index"
import { readFile, writeFile, escapeRegex } from "../utils"

export class MarkdownTaskSource implements TaskSource {
  constructor(
    private directory: string,
    private filename: string
  ) { }

  private get filepath(): string {
    return `${this.directory}/${this.filename}`
  }

  async getRemainingTasks(): Promise<string[]> {
    const content = await readFile(this.filepath)
    const matches = content.match(/^- \[ \] .+$/gm) || []
    return matches.map(m => m.replace(/^- \[ \] /, ""))
  }

  async getAllTasks(): Promise<Task[]> {
    const content = await readFile(this.filepath)
    const tasks: Task[] = []

    // Match incomplete tasks
    const incomplete = content.match(/^- \[ \] .+$/gm) || []
    for (const match of incomplete) {
      tasks.push({
        title: match.replace(/^- \[ \] /, ""),
        completed: false,
      })
    }

    // Match completed tasks
    const completed = content.match(/^- \[x\] .+$/gm) || []
    for (const match of completed) {
      tasks.push({
        title: match.replace(/^- \[x\] /, ""),
        completed: true,
      })
    }

    return tasks
  }

  async getNextTask(): Promise<string | null> {
    const tasks = await this.getRemainingTasks()
    return tasks.length > 0 ? tasks[0] : null
  }

  async countRemaining(): Promise<number> {
    const content = await readFile(this.filepath)
    return (content.match(/^- \[ \]/gm) || []).length
  }

  async countCompleted(): Promise<number> {
    const content = await readFile(this.filepath)
    return (content.match(/^- \[x\]/gm) || []).length
  }

  async markComplete(task: string): Promise<void> {
    let content = await readFile(this.filepath)

    // Escape special regex characters in task
    const escaped = escapeRegex(task)

    // Replace the task checkbox
    const regex = new RegExp(`^- \\[ \\] ${escaped}`, "m")
    content = content.replace(regex, `- [x] ${task}`)

    await writeFile(this.filepath, content)
  }
}
