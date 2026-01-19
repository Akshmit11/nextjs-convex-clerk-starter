/**
 * Prompt Builder
 * Constructs AI prompts for task execution
 * Mirrors the build_prompt function from ralphy.sh
 */

import type { RalphyConfig } from "./config"

/**
 * Build the main task execution prompt
 */
export function buildPrompt(task: string, config: RalphyConfig): string {
  const parts: string[] = []

  // Add context based on PRD source
  switch (config.prdSource) {
    case "markdown":
      parts.push(`Read @${config.prdFile} and @progress.txt for context.`)
      break
    case "yaml":
      parts.push(`Read @${config.prdFile} and @progress.txt for context.`)
      break
    case "github":
      parts.push(`Task from GitHub Issue: ${task}`)
      parts.push(`Read @progress.txt for context.`)
      break
  }

  parts.push("")
  parts.push(`**Current Task:** ${task}`)
  parts.push("")

  // Build numbered steps
  let step = 1

  parts.push(`${step}. Implement this task completely and correctly.`)
  step++

  if (!config.skipTests) {
    parts.push(`${step}. Write tests for the feature.`)
    step++
    parts.push(`${step}. Run tests and ensure they pass before proceeding.`)
    step++
  }

  if (!config.skipLint) {
    parts.push(`${step}. Run linting and ensure it passes before proceeding.`)
    step++
  }

  // Completion step based on source
  switch (config.prdSource) {
    case "markdown":
      parts.push(`${step}. Update ${config.prdFile} to mark the task as complete (change '- [ ]' to '- [x]').`)
      break
    case "yaml":
      parts.push(`${step}. Update ${config.prdFile} to mark the task as completed (set completed: true).`)
      break
    case "github":
      parts.push(`${step}. The task will be marked complete automatically. Just note the completion in progress.txt.`)
      break
  }
  step++

  parts.push(`${step}. Append your progress to progress.txt.`)
  step++

  parts.push(`${step}. Commit your changes with a descriptive message.`)
  step++

  // Add constraints
  parts.push("")
  parts.push("**Important:**")
  parts.push("- ONLY work on this single task.")

  if (!config.skipTests) {
    parts.push("- Do NOT proceed if tests fail.")
  }

  if (!config.skipLint) {
    parts.push("- Do NOT proceed if linting fails.")
  }

  parts.push("")
  parts.push("When finished with this task, continue to the next incomplete task.")
  parts.push("If ALL tasks in the PRD are complete, output: <promise>COMPLETE</promise>")

  return parts.join("\n")
}

/**
 * Build prompt for parallel agent (single task, no continuation)
 */
export function buildParallelPrompt(task: string, agentNum: number, config: RalphyConfig): string {
  const parts: string[] = []

  parts.push(`You are Agent ${agentNum} working on a specific task in parallel with other agents.`)
  parts.push("")
  parts.push(`**Your Task:** ${task}`)
  parts.push("")
  parts.push("Instructions:")
  parts.push("1. Implement this specific task completely")

  if (!config.skipTests) {
    parts.push("2. Write tests if appropriate")
  }

  parts.push("3. Update progress.txt with what you did")
  parts.push("4. Commit your changes with a descriptive message")
  parts.push("")
  parts.push("Do NOT modify the PRD or mark tasks complete - that will be handled separately.")
  parts.push(`Focus only on implementing: ${task}`)

  return parts.join("\n")
}

/**
 * Build prompt for merge conflict resolution
 */
export function buildMergeConflictPrompt(conflictedFiles: string[]): string {
  const parts: string[] = []

  parts.push("You are resolving a git merge conflict. The following files have conflicts:")
  parts.push("")
  parts.push(conflictedFiles.join("\n"))
  parts.push("")
  parts.push("For each conflicted file:")
  parts.push("1. Read the file to see the conflict markers (<<<<<<< HEAD, =======, >>>>>>> branch)")
  parts.push("2. Understand what both versions are trying to do")
  parts.push("3. Edit the file to resolve the conflict by combining both changes intelligently")
  parts.push("4. Remove all conflict markers")
  parts.push("5. Make sure the resulting code is valid and compiles")
  parts.push("")
  parts.push("After resolving all conflicts:")
  parts.push("1. Run 'git add' on each resolved file")
  parts.push("2. Run 'git commit --no-edit' to complete the merge")
  parts.push("")
  parts.push("Be careful to preserve functionality from BOTH branches. The goal is to integrate all features.")

  return parts.join("\n")
}

/**
 * Build the full loop prompt (for /ralphy command)
 */
export function buildLoopPrompt(config: RalphyConfig): string {
  const parts: string[] = []

  parts.push("You are Ralphy, an autonomous AI coding assistant.")
  parts.push("Your job is to work through a PRD and complete ALL tasks.")
  parts.push("")

  // Add options info
  const options: string[] = []
  if (config.skipTests) options.push("tests skipped")
  if (config.skipLint) options.push("lint skipped")
  if (config.dryRun) options.push("dry run mode")
  if (config.parallel) options.push(`parallel mode (${config.maxParallel} agents)`)
  if (config.branchPerTask) options.push("branch per task")
  if (config.createPr) options.push("create PRs")

  if (options.length > 0) {
    parts.push(`**Options:** ${options.join(", ")}`)
    parts.push("")
  }

  parts.push(`Read @${config.prdFile} and @progress.txt to understand the project state.`)
  parts.push("")
  parts.push("## Your Mission")
  parts.push("")
  parts.push("Work through ALL incomplete tasks (marked with `- [ ]`) until the PRD is complete.")
  parts.push("")
  parts.push("## For EACH Task")
  parts.push("")
  parts.push("1. **Implement** the feature completely and correctly")

  if (!config.skipTests) {
    parts.push("2. **Write tests** for the feature")
    parts.push("3. **Run tests** and ensure they pass before proceeding")
  }

  if (!config.skipLint) {
    parts.push("4. **Run linting** and fix any issues")
  }

  parts.push("5. **Update PRD** to mark the task complete (change `- [ ]` to `- [x]`)")
  parts.push("6. **Log progress** by appending to progress.txt")
  parts.push("7. **Commit** your changes with a descriptive message")
  parts.push("8. **Continue** to the next incomplete task")
  parts.push("")
  parts.push("## Rules")
  parts.push("")
  parts.push("- Work on ONE task at a time")

  if (!config.skipTests) {
    parts.push("- Do NOT proceed if tests fail")
  }

  if (!config.skipLint) {
    parts.push("- Do NOT proceed if linting fails")
  }

  parts.push("- After completing ALL tasks, output: <promise>COMPLETE</promise>")
  parts.push("")
  parts.push("## Start Now")
  parts.push("")
  parts.push("Find the first incomplete task and begin working.")

  return parts.join("\n")
}
