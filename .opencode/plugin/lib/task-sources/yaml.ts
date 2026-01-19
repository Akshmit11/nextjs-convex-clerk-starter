/**
 * YAML Task Source
 * Parses tasks from YAML files with format:
 * tasks:
 *   - title: Task description
 *     completed: false
 *     parallel_group: 1  # Optional
 * 
 * Uses a simple inline parser to avoid npm dependencies.
 */

import type { TaskSource, Task } from "./index"
import { readFile, writeFile } from "../utils"

interface YamlTask {
  title: string
  completed?: boolean
  parallel_group?: number
}

interface YamlTaskFile {
  tasks: YamlTask[]
}

/**
 * Simple YAML parser for task files
 * Only handles the specific format we need:
 * tasks:
 *   - title: "Task name"
 *     completed: false
 *     parallel_group: 1
 */
function parseSimpleYaml(content: string): YamlTaskFile {
  const result: YamlTaskFile = { tasks: [] }
  const lines = content.split('\n')

  let currentTask: YamlTask | null = null
  let inTasks = false

  for (const line of lines) {
    const trimmed = line.trim()

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) continue

    // Check for tasks: section
    if (trimmed === 'tasks:') {
      inTasks = true
      continue
    }

    if (!inTasks) continue

    // New task item (starts with -)
    if (trimmed.startsWith('- ')) {
      // Save previous task
      if (currentTask && currentTask.title) {
        result.tasks.push(currentTask)
      }

      currentTask = { title: '', completed: false }

      // Check if title is on same line: - title: "value"
      const restOfLine = trimmed.substring(2).trim()
      if (restOfLine.startsWith('title:')) {
        currentTask.title = parseValue(restOfLine.substring(6))
      }
      continue
    }

    // Task properties
    if (currentTask && trimmed.includes(':')) {
      const colonIndex = trimmed.indexOf(':')
      const key = trimmed.substring(0, colonIndex).trim()
      const value = trimmed.substring(colonIndex + 1).trim()

      switch (key) {
        case 'title':
          currentTask.title = parseValue(value)
          break
        case 'completed':
          currentTask.completed = value === 'true'
          break
        case 'parallel_group':
          currentTask.parallel_group = parseInt(value, 10) || 0
          break
      }
    }
  }

  // Add last task
  if (currentTask && currentTask.title) {
    result.tasks.push(currentTask)
  }

  return result
}

/**
 * Parse a YAML value (handles quoted strings)
 */
function parseValue(value: string): string {
  value = value.trim()
  // Remove quotes if present
  if ((value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1)
  }
  return value
}

/**
 * Serialize tasks back to YAML format
 */
function stringifyYaml(data: YamlTaskFile): string {
  let output = 'tasks:\n'

  for (const task of data.tasks) {
    output += `  - title: "${task.title}"\n`
    output += `    completed: ${task.completed ? 'true' : 'false'}\n`
    if (task.parallel_group !== undefined) {
      output += `    parallel_group: ${task.parallel_group}\n`
    }
  }

  return output
}

export class YamlTaskSource implements TaskSource {
  constructor(
    private directory: string,
    private filename: string
  ) { }

  private get filepath(): string {
    return `${this.directory}/${this.filename}`
  }

  private async parseFile(): Promise<YamlTaskFile> {
    const content = await readFile(this.filepath)
    if (!content) {
      return { tasks: [] }
    }
    try {
      return parseSimpleYaml(content)
    } catch {
      return { tasks: [] }
    }
  }

  async getRemainingTasks(): Promise<string[]> {
    const data = await this.parseFile()
    return data.tasks
      .filter(t => !t.completed)
      .map(t => t.title)
  }

  async getAllTasks(): Promise<Task[]> {
    const data = await this.parseFile()
    return data.tasks.map(t => ({
      title: t.title,
      completed: t.completed ?? false,
      parallelGroup: t.parallel_group,
    }))
  }

  async getNextTask(): Promise<string | null> {
    const tasks = await this.getRemainingTasks()
    return tasks.length > 0 ? tasks[0] : null
  }

  async countRemaining(): Promise<number> {
    const data = await this.parseFile()
    return data.tasks.filter(t => !t.completed).length
  }

  async countCompleted(): Promise<number> {
    const data = await this.parseFile()
    return data.tasks.filter(t => t.completed).length
  }

  async markComplete(task: string): Promise<void> {
    const data = await this.parseFile()

    // Find and update the task
    const taskItem = data.tasks.find(t => t.title === task)
    if (taskItem) {
      taskItem.completed = true
    }

    // Write back to file
    const content = stringifyYaml(data)
    await writeFile(this.filepath, content)
  }

  async getTasksByGroup(group: number): Promise<string[]> {
    const data = await this.parseFile()
    return data.tasks
      .filter(t => !t.completed && (t.parallel_group ?? 0) === group)
      .map(t => t.title)
  }

  /**
   * Get all unique parallel groups
   */
  async getParallelGroups(): Promise<number[]> {
    const data = await this.parseFile()
    const groups = new Set<number>()
    for (const task of data.tasks) {
      if (!task.completed) {
        groups.add(task.parallel_group ?? 0)
      }
    }
    return Array.from(groups).sort((a, b) => a - b)
  }
}
