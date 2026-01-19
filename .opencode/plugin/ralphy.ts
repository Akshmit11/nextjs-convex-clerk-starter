/**
 * Ralphy - Autonomous AI Coding Loop Plugin for OpenCode
 * Version 3.1.0
 *
 * Converts the ralphy.sh bash script functionality into an OpenCode plugin.
 * Runs AI on tasks from a PRD until all tasks are complete.
 *
 * Features:
 * - Autonomous loop execution
 * - Multiple task sources (Markdown, YAML, GitHub Issues)
 * - Parallel execution with git worktrees
 * - Branch-per-task and PR creation
 * - Progress and cost tracking
 */

// Import from lib subfolder
import { defaultConfig, parseArgs } from "./lib/config"
import { getTaskSource } from "./lib/task-sources"
import { buildPrompt, buildLoopPrompt } from "./lib/prompt-builder"
import { GitManager } from "./lib/git-manager"
import { ProgressTracker } from "./lib/progress-tracker"
import { ParallelExecutor } from "./lib/parallel-executor"
import { fileExists, truncate } from "./lib/utils"

const VERSION = "3.1.0"

export const RalphyPlugin = async ({ project, client, $, directory, worktree }) => {
  // Initialize state
  const state = {
    running: false,
    config: { ...defaultConfig },
    iteration: 0,
    currentTask: null,
    taskSource: null,
    tracker: new ProgressTracker(),
    gitManager: null,
    completedBranches: [],
  }

  // Initialize git manager
  state.gitManager = new GitManager($, directory)

  // Logging helper
  const log = async (level, message, extra) => {
    if (level === "debug" && !state.config.verbose) return
    try {
      await client.app.log({
        service: "ralphy",
        level,
        message,
        extra,
      })
    } catch {
      console.log(`[ralphy] ${level}: ${message}`)
    }
  }

  console.log(`[Ralphy] v${VERSION} plugin loaded for ${directory}`)

  // Initialize task source
  const initTaskSource = () => {
    state.taskSource = getTaskSource(state.config, directory)
  }

  // Get next incomplete task
  const getNextTask = async () => {
    if (!state.taskSource) initTaskSource()
    const tasks = await state.taskSource.getRemainingTasks()
    return tasks.length > 0 ? tasks[0] : null
  }

  // Check if all tasks are complete
  const checkCompletion = async () => {
    if (!state.taskSource) initTaskSource()
    const remaining = await state.taskSource.countRemaining()
    return remaining === 0
  }

  // Start the autonomous loop
  const startLoop = async (options) => {
    if (state.running) {
      return "⚠️ Ralphy is already running. Use /ralphy-stop first."
    }

    // Parse options
    if (options) {
      Object.assign(state.config, parseArgs(options))
    }

    // Check PRD file exists
    const prdPath = `${directory}/${state.config.prdFile}`
    if (state.config.prdSource !== "github" && !(await fileExists(prdPath))) {
      return `❌ PRD file not found: ${state.config.prdFile}`
    }

    // Ensure progress.txt exists
    const progressPath = `${directory}/progress.txt`
    if (!(await fileExists(progressPath))) {
      await Bun.write(progressPath, "")
    }

    // Initialize
    state.running = true
    state.iteration = 0
    state.completedBranches = []
    state.tracker.reset()
    initTaskSource()

    // Set base branch
    if (!state.config.baseBranch && state.gitManager) {
      state.config.baseBranch = await state.gitManager.getCurrentBranch()
    }

    await log("info", "Starting Ralphy loop", {
      source: state.config.prdSource,
      file: state.config.prdFile,
      parallel: state.config.parallel,
    })

    // Handle parallel mode
    if (state.config.parallel) {
      const executor = new ParallelExecutor(state.config, $, directory)
      await executor.run()
      state.running = false
      return executor.getSummary()
    }

    // Check for tasks
    const firstTask = await getNextTask()
    if (!firstTask) {
      state.running = false
      return "✅ No tasks found. PRD is already complete!"
    }

    // Build and return the full loop prompt
    const prompt = buildLoopPrompt(state.config)

    return `🚀 Ralphy v${VERSION} Started

Source: ${state.config.prdSource} (${state.config.prdFile})
Base Branch: ${state.config.baseBranch}
${state.config.skipTests ? "Tests: SKIPPED" : ""}
${state.config.skipLint ? "Lint: SKIPPED" : ""}

---

${prompt}`
  }

  // Stop the loop
  const stopLoop = async () => {
    if (!state.running) {
      return "ℹ️ Ralphy is not running."
    }

    state.running = false
    state.currentTask = null

    const summary = state.tracker.getSummary(state.iteration)

    // Return to base branch
    if (state.config.branchPerTask && state.gitManager) {
      await state.gitManager.returnToBaseBranch(state.config.baseBranch)
    }

    await log("info", "Ralphy stopped", { iterations: state.iteration })

    return `🛑 Ralphy Stopped

${summary}`
  }

  // Get current status
  const getStatus = async () => {
    if (!state.taskSource) initTaskSource()

    const completed = await state.taskSource.countCompleted()
    const remaining = await state.taskSource.countRemaining()
    const total = completed + remaining
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0

    const parts = []
    parts.push("📊 Ralphy Status")
    parts.push("━━━━━━━━━━━━━━━━━━━━━━━")
    parts.push(`Running: ${state.running ? "✅ Yes" : "❌ No"}`)
    parts.push(`Current Task: ${state.currentTask || "None"}`)
    parts.push(`Iteration: ${state.iteration}`)
    parts.push("━━━━━━━━━━━━━━━━━━━━━━━")
    parts.push(`Completed: ${completed}/${total} tasks`)
    parts.push(`Remaining: ${remaining} tasks`)
    parts.push(`Progress: ${progress}%`)
    parts.push("")

    // Show progress bar
    const barLength = 20
    const filled = Math.round((progress / 100) * barLength)
    const empty = barLength - filled
    parts.push(`[${"█".repeat(filled)}${"░".repeat(empty)}] ${progress}%`)

    parts.push("")
    parts.push(state.tracker.getTokenSummary())

    // Show next tasks
    if (remaining > 0) {
      parts.push("")
      parts.push("Next tasks:")
      const tasks = await state.taskSource.getRemainingTasks()
      for (let i = 0; i < Math.min(3, tasks.length); i++) {
        parts.push(`  ${i + 1}. ${truncate(tasks[i], 50)}`)
      }
      if (tasks.length > 3) {
        parts.push(`  ... and ${tasks.length - 3} more`)
      }
    }

    return parts.join("\n")
  }

  // Process next task (one-shot)
  const processNextTask = async (specificTask) => {
    if (!state.taskSource) initTaskSource()

    const task = specificTask || await getNextTask()
    if (!task) {
      return "✅ No tasks remaining!"
    }

    state.iteration++
    state.currentTask = task

    // Create branch if needed
    let branchName = ""
    if (state.config.branchPerTask && state.gitManager) {
      branchName = await state.gitManager.createTaskBranch(task, state.config.baseBranch)
      if (branchName) {
        state.completedBranches.push(branchName)
        state.tracker.addBranch(branchName)
      }
    }

    const prompt = buildPrompt(task, state.config)

    const header = branchName
      ? `🔧 Working on: ${truncate(task, 50)}\n📌 Branch: ${branchName}\n\n---\n\n`
      : `🔧 Working on: ${truncate(task, 50)}\n\n---\n\n`

    return header + prompt
  }

  // Mark task complete
  const markComplete = async (task) => {
    if (!state.taskSource) initTaskSource()

    await state.taskSource.markComplete(task)

    // Check if all done
    const remaining = await state.taskSource.countRemaining()

    if (remaining === 0) {
      return `✅ Marked complete: ${truncate(task, 40)}

🎉 All tasks complete!

${state.tracker.getSummary(state.iteration)}`
    }

    return `✅ Marked complete: ${truncate(task, 40)}
📝 ${remaining} tasks remaining`
  }

  // Configure options
  const configureOptions = (options) => {
    Object.assign(state.config, parseArgs(options))

    const active = []
    if (state.config.skipTests) active.push("skip-tests")
    if (state.config.skipLint) active.push("skip-lint")
    if (state.config.parallel) active.push(`parallel:${state.config.maxParallel}`)
    if (state.config.branchPerTask) active.push("branch-per-task")
    if (state.config.createPr) active.push("create-pr")
    if (state.config.dryRun) active.push("dry-run")
    if (state.config.verbose) active.push("verbose")

    return `⚙️ Ralphy Configuration Updated

PRD Source: ${state.config.prdSource}
PRD File: ${state.config.prdFile}
Max Iterations: ${state.config.maxIterations || "unlimited"}
Max Retries: ${state.config.maxRetries}

Active Options: ${active.length > 0 ? active.join(", ") : "none"}`
  }

  // Return plugin hooks and tools
  return {
    // Event handlers
    event: async ({ event }) => {
      // Track session idle for potential loop continuation
      if (event.type === "session.idle" && state.running) {
        await log("debug", "Session idle detected")

        // Check if we should continue
        if (await checkCompletion()) {
          await log("info", "All tasks complete!")
          await stopLoop()
        } else {
          await log("debug", "Tasks remaining, loop can continue...")
        }
      }
    },

    // Custom tools using simple object format (no @opencode-ai/plugin import needed)
    tool: {
      ralphy_start: {
        description: `Start Ralphy autonomous AI coding loop (v${VERSION}). Reads tasks from PRD and works through them until complete. Options: --no-tests --no-lint --fast --parallel --max-parallel N --branch-per-task --create-pr --draft-pr --dry-run --max-iterations N --prd FILE --yaml FILE --github REPO -v`,
        parameters: {
          type: "object",
          properties: {
            options: {
              type: "string",
              description: "Command line options",
            },
          },
        },
        async execute({ options }) {
          return await startLoop(options || "")
        },
      },

      ralphy_stop: {
        description: "Stop the Ralphy autonomous loop and show summary",
        parameters: {
          type: "object",
          properties: {},
        },
        async execute() {
          return await stopLoop()
        },
      },

      ralphy_status: {
        description: "Get current Ralphy task progress and status",
        parameters: {
          type: "object",
          properties: {},
        },
        async execute() {
          return await getStatus()
        },
      },

      ralphy_next: {
        description: "Process the next single task from the PRD (one-shot, does not loop)",
        parameters: {
          type: "object",
          properties: {
            task: {
              type: "string",
              description: "Specific task to work on (leave empty for next task)",
            },
          },
        },
        async execute({ task }) {
          return await processNextTask(task || undefined)
        },
      },

      ralphy_mark_complete: {
        description: "Mark a task as complete in the PRD file",
        parameters: {
          type: "object",
          properties: {
            task: {
              type: "string",
              description: "Task text to mark as complete",
            },
          },
          required: ["task"],
        },
        async execute({ task }) {
          return await markComplete(task)
        },
      },

      ralphy_config: {
        description: "Configure Ralphy options for the current session",
        parameters: {
          type: "object",
          properties: {
            options: {
              type: "string",
              description: "Configuration options (same as ralphy_start)",
            },
          },
          required: ["options"],
        },
        async execute({ options }) {
          return configureOptions(options)
        },
      },
    },
  }
}
