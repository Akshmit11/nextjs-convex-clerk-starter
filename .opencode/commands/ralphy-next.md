---
description: Process the next Ralphy task (one-shot, single task only)
---

Read @PRD.md and find the **FIRST** incomplete task (marked with `- [ ]`).
Read @progress.txt for context on what has been done.

$ARGUMENTS

## Instructions

If an argument was provided, work on that specific task.
Otherwise, work on the first incomplete task from the PRD.

## Steps

1. **Implement** the task completely and correctly
2. **Write tests** for the feature (if applicable)
3. **Run tests** and ensure they pass
4. **Run linting** and fix any issues
5. **Update PRD.md** to mark the task complete (change `- [ ]` to `- [x]`)
6. **Append** your progress to progress.txt
7. **Commit** your changes with a descriptive message

## Important

- Work on **this ONE task only**, then **STOP**
- Do NOT continue to the next task
- After completing, show what you did and stop

## Output

When done, output:

```
✅ Task completed: [task description]

Changes made:
- [list of changes]

Committed: [commit message]
```
