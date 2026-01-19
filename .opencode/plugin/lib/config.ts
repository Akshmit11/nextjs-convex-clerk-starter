/**
 * Ralphy Configuration Types and Defaults
 * Mirrors all options from the original ralphy.sh bash script
 */

export interface RalphyConfig {
  // Workflow options
  skipTests: boolean
  skipLint: boolean

  // Execution options
  maxIterations: number // 0 = unlimited
  maxRetries: number // default: 3
  retryDelay: number // seconds, default: 5
  dryRun: boolean

  // Parallel execution
  parallel: boolean
  maxParallel: number // default: 3

  // Git branch options
  branchPerTask: boolean
  baseBranch: string
  createPr: boolean
  draftPr: boolean

  // PRD source options
  prdSource: "markdown" | "yaml" | "github"
  prdFile: string // default: PRD.md
  githubRepo: string
  githubLabel: string

  // Runtime state
  verbose: boolean
}

export const defaultConfig: RalphyConfig = {
  skipTests: false,
  skipLint: false,
  maxIterations: 0,
  maxRetries: 3,
  retryDelay: 5,
  dryRun: false,
  parallel: false,
  maxParallel: 3,
  branchPerTask: false,
  baseBranch: "",
  createPr: false,
  draftPr: false,
  prdSource: "markdown",
  prdFile: "PRD.md",
  githubRepo: "",
  githubLabel: "",
  verbose: false,
}

/**
 * Parse command arguments into config options
 * Supports all flags from the bash script
 */
export function parseArgs(args: string): Partial<RalphyConfig> {
  const config: Partial<RalphyConfig> = {}
  const parts = args.split(/\s+/).filter(Boolean)

  for (let i = 0; i < parts.length; i++) {
    const arg = parts[i]
    switch (arg) {
      // Workflow options
      case "--no-tests":
      case "--skip-tests":
        config.skipTests = true
        break
      case "--no-lint":
      case "--skip-lint":
        config.skipLint = true
        break
      case "--fast":
        config.skipTests = true
        config.skipLint = true
        break

      // Execution options
      case "--dry-run":
        config.dryRun = true
        break
      case "--max-iterations":
        config.maxIterations = parseInt(parts[++i]) || 0
        break
      case "--max-retries":
        config.maxRetries = parseInt(parts[++i]) || 3
        break
      case "--retry-delay":
        config.retryDelay = parseInt(parts[++i]) || 5
        break

      // Parallel execution
      case "--parallel":
        config.parallel = true
        break
      case "--max-parallel":
        config.maxParallel = parseInt(parts[++i]) || 3
        break

      // Git options
      case "--branch-per-task":
        config.branchPerTask = true
        break
      case "--base-branch":
        config.baseBranch = parts[++i] || ""
        break
      case "--create-pr":
        config.createPr = true
        break
      case "--draft-pr":
        config.draftPr = true
        break

      // PRD source options
      case "--prd":
        config.prdSource = "markdown"
        config.prdFile = parts[++i] || "PRD.md"
        break
      case "--yaml":
        config.prdSource = "yaml"
        config.prdFile = parts[++i] || "tasks.yaml"
        break
      case "--github":
        config.prdSource = "github"
        config.githubRepo = parts[++i] || ""
        break
      case "--github-label":
        config.githubLabel = parts[++i] || ""
        break

      // Other
      case "-v":
      case "--verbose":
        config.verbose = true
        break
    }
  }

  return config
}
