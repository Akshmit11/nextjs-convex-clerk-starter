/**
 * Task Source Interface
 * Provides unified API for different task sources (markdown, yaml, github)
 */

import type { RalphyConfig } from "../config"
import { MarkdownTaskSource } from "./markdown"
import { YamlTaskSource } from "./yaml"
import { GithubTaskSource } from "./github"

export interface Task {
  title: string
  completed: boolean
  parallelGroup?: number
  body?: string // For GitHub issues
}

export interface TaskSource {
  /**
   * Get all remaining (incomplete) tasks
   */
  getRemainingTasks(): Promise<string[]>

  /**
   * Get all tasks (completed and incomplete)
   */
  getAllTasks(): Promise<Task[]>

  /**
   * Get the next task to work on
   */
  getNextTask(): Promise<string | null>

  /**
   * Count remaining tasks
   */
  countRemaining(): Promise<number>

  /**
   * Count completed tasks
   */
  countCompleted(): Promise<number>

  /**
   * Mark a task as complete
   */
  markComplete(task: string): Promise<void>

  /**
   * Get tasks by parallel group (for YAML source)
   */
  getTasksByGroup?(group: number): Promise<string[]>

  /**
   * Get task body/description (for GitHub issues)
   */
  getTaskBody?(task: string): Promise<string>
}

/**
 * Factory function to get the appropriate task source
 */
export function getTaskSource(config: RalphyConfig, directory: string): TaskSource {
  switch (config.prdSource) {
    case "yaml":
      return new YamlTaskSource(directory, config.prdFile)
    case "github":
      return new GithubTaskSource(config.githubRepo, config.githubLabel)
    default:
      return new MarkdownTaskSource(directory, config.prdFile)
  }
}
