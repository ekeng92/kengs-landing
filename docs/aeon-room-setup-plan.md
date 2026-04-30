# AEON Watch Dedicated PC Setup Plan

Goal: turn the gaming PC into a stable always-on AEON Watch node so OpenClaw is not dependent on Eric's Mac staying awake.

## Recommended shape

Preferred OS: Ubuntu Desktop or Ubuntu Server LTS.

Why: easiest service management, SSH-first setup, stable Node/tooling, fewer GUI sleep surprises. Windows + WSL2 is workable if the PC must stay a normal Windows machine.

## Eric does first

1. Power on the PC and connect it to the network.
2. Choose OS path:
   - Dedicated node: install Ubuntu.
   - Shared gaming PC: keep Windows, enable WSL2 Ubuntu.
3. Create a normal user account, preferably `aeon` or Eric's usual account.
4. Enable SSH.
5. Send AEON:
   - hostname/IP
   - username
   - whether it is Ubuntu native or WSL2
6. Keep secrets out of chat where possible; use one-time paste only when needed.

## AEON can do after SSH works

1. Baseline audit
   - OS version, disk, RAM, GPU, network, sleep settings.
   - Confirm firewall posture.

2. Install core tools
   - `git`, `curl`, `jq`, `ripgrep`, `tmux`, `gh`
   - Node.js LTS or current OpenClaw-compatible version
   - OpenClaw CLI/Gateway

3. Create workspace
   - `~/.openclaw/workspace`
   - copy curated identity files, not everything blindly
   - set up `memory/`, `state/`, backups

4. Clone project repos
   - `~/Projects/kengs-landing`
   - `~/Projects/chatkey`
   - `~/Projects/kengs-stories`

5. Configure OpenClaw
   - Telegram direct channel
   - GitHub CLI auth
   - web search/fetch
   - coding agents if desired
   - safe tool approval policy

6. Service setup
   - run OpenClaw Gateway under `systemd`
   - auto-start on boot
   - health check command
   - log rotation

7. Security posture
   - SSH keys only when possible
   - firewall allow only needed ports
   - no public exposure unless explicitly designed
   - secrets in env/config files, never committed

8. Backup posture
   - workspace backup
   - project repo remotes stay authoritative
   - optional encrypted snapshot job later

## First useful automations

- Morning Keng's Landing digest: top 3 tasks, blockers, today-friendly next action.
- Weekly task board sweep: stale In Progress, Waiting follow-ups, missing tax docs.
- OpenClaw health audit: failed tasks, stale cron, gateway status.
- Keng's Landing tax readiness score.

## Open questions for tomorrow

- Ubuntu dedicated or Windows + WSL2?
- Should this PC host OpenClaw Gateway as the primary Telegram endpoint, replacing the Mac?
- Should Mac stay as a secondary node for Apple-only tools: Notes, Reminders, iMessage, Peekaboo?
- How much autonomous notification is okay: morning digest only, blockers only, or proactive reminders?
