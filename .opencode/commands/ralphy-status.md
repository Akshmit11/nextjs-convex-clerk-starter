---
description: Show Ralphy task progress and status
---

Read @PRD.md and analyze the current task status.

## Count Tasks

- **Completed tasks**: Count lines matching `- [x]`
- **Remaining tasks**: Count lines matching `- [ ]`
- **Total tasks**: Sum of completed + remaining

## Calculate Progress

Progress percentage = (completed / total) × 100

## Display Summary

Show the following formatted status:

```
📊 Ralphy Status
━━━━━━━━━━━━━━━━━━━━━━━
Completed: N tasks
Remaining: N tasks
Progress: X%
━━━━━━━━━━━━━━━━━━━━━━━

[████████░░░░░░░░░░░░] X%
```

## Show Next Tasks

If there are remaining tasks, list the next 3 incomplete tasks:

```
Next tasks:
1. First incomplete task
2. Second incomplete task
3. Third incomplete task
```

## Also Show

- Read progress.txt and show the last 5 lines of recent activity
