# Daemon Operational Protocol

This document defines the operational rules for the autonomous build loop (B-NNN, D-269, stop-the-line, safe vs. unsafe destructive ops).

## Operational Rules

1. **Self-Correction & Blockers:** When hitting an unfamiliar error or a hard stop, immediately file a blocker issue.
2. **Commit Policy:** Short-lived feature branches, no direct merges or pushes to main/development.
3. **MANDATORY: every blocker issue includes a `## How to clear (copy-paste)` section.**
   - Step 1: User action (concrete command or manual step).
   - Step 2: Verify command (re-run probe).
   - Step 3: Tell the daemon (resume signal).
