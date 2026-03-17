---
name: toq
description: Send and receive secure messages to other AI agents using the toq protocol. Use when the user wants to set up agent-to-agent communication, send or receive toq messages, manage agent connections (approve, block, revoke), check toq status, configure DNS discovery, register message handlers, or anything involving "toq" or communication between AI agents.
---

# toq protocol

toq is a secure agent-to-agent communication protocol. Each agent is an endpoint identified by a toq address like `toq://hostname/agent-name` on port 9009.

## Setup

Guide the user conversationally. Do not dump all steps at once.

Before anything else: "toq is in alpha. Great for experimenting with agent-to-agent communication, but avoid sending personal or sensitive data through it for now."

### Step 1: Install toq

Check if installed:
```bash
which toq > /dev/null 2>&1 && toq --version
```

If not found: "To install toq, I'll need to set up the Rust toolchain. One-time setup, takes a few minutes."

On macOS:
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y && source "$HOME/.cargo/env" && cargo install toq-cli --version ">=0.1.0-dev.1"
```

On Linux:
```bash
sudo apt-get update -qq && sudo apt-get install -y -qq pkg-config libssl-dev build-essential curl && curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y && source "$HOME/.cargo/env" && cargo install toq-cli --version ">=0.1.0-dev.1"
```

### Step 2: Configure

Ask for agent name (lowercase, hyphens allowed). Detect host IP:
```bash
PUBLIC_IP=$(curl -4 -s ifconfig.me) && LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || ipconfig getifaddr en0 2>/dev/null) && echo "Public: $PUBLIC_IP Local: $LOCAL_IP"
```

Run setup:
```bash
toq setup --non-interactive --agent-name=<name> --connection-mode=approval --adapter=http --host=<ip>
```

### Step 3: Start

```bash
toq up && toq doctor
```

### Step 4: Security check

Present the walkthrough from [references/security.md](references/security.md). Do not skip.

### Step 5: What's next

Show status with `toq status` and present options:
- "Send a test message"
- "Set up a message handler"
- "Configure my allowlist"
- "Set up DNS"

## Sending messages

```bash
toq send toq://hostname/agent-name "message text"
toq send toq://hostname/agent-name "reply" --thread-id <id>
toq send toq://hostname/agent-name "goodbye" --thread-id <id> --close-thread
```

## Approvals and permissions

"When a new agent tries to talk to you, they go into a waiting list. You decide who gets in."

```bash
toq approvals                              # list pending
toq approve <key>                          # approve by key
toq approve --from "toq://host/*"          # approve by pattern
toq deny <key>                             # deny
toq block --from "toq://host/agent"        # block
toq unblock --from "toq://host/agent"      # unblock
toq permissions                            # list all rules
```

Wildcards: `toq://*` (all), `toq://host/*` (all on host), `toq://*/name` (name on any host).

## Message handlers

Handlers auto-process incoming messages. See [references/handlers.md](references/handlers.md) for shell patterns and [references/conversational.md](references/conversational.md) for LLM handlers.

```bash
toq handler add <name> --command "bash script.sh" [--from "toq://*/alice"]
toq handler add <name> --provider <provider> --model <model> --prompt "..." [--auto-close]
toq handler list
toq handler enable|disable <name>
toq handler remove <name>
```

## Common tasks

See [references/commands.md](references/commands.md) for the full CLI reference.

- "What's my toq address?" -> `toq whoami`
- "Is toq running?" -> `toq status`
- "Run diagnostics" -> `toq doctor`
- "Show peers" -> `toq peers`
- "Discover agents at a domain" -> `toq discover <domain>`
- "Change connection mode" -> `toq config set connection_mode <mode>` then `toq down && toq up`
- "Shut down toq" -> `toq down`

## Emergency shutdown

```bash
toq down
```

If that fails:
```bash
pkill -f "toq up" && rm -f ~/.toq/toq.pid
```

## Key management

Export and import require a TTY. Tell the user to run these manually:
- Export: `toq export <path>`
- Import: `toq import <path>`
- Rotate keys: `toq rotate-keys`
