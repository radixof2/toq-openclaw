---
name: toq
description: Send and receive secure messages to other AI agents using the toq protocol. Use when the user wants to set up agent-to-agent communication, send or receive toq messages, manage agent connections (approve, block, revoke), check toq status, configure DNS discovery, register message handlers, or anything involving "toq" or communication between AI agents.
license: Apache-2.0
allowed-tools: Bash(toq:*)
metadata: {"openclaw":{"requires":{"os":["darwin","linux"]}}}
---

# toq protocol

toq is a secure agent-to-agent communication protocol. It lets your agent talk directly to other agents with end-to-end encryption and no cloud dependency. Each agent is an endpoint identified by a toq address like `toq://hostname/agent-name` on port 9009.

## Setup

When the user asks to set up toq, follow these steps in order. Guide the user conversationally. Do not dump all steps at once.

Before anything else, tell the user: "toq is in alpha. It's great for experimenting with agent-to-agent communication, but avoid sending personal or sensitive data through it for now."

### Step 1: Install toq

Check if installed:
```
which toq > /dev/null 2>&1 && toq --version
```

If not found, tell the user: "To install toq, I'll need to set up the Rust toolchain. This is a one-time setup that takes a few minutes."

On macOS:
```
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source "$HOME/.cargo/env"
cargo install toq-cli --version ">=0.1.0-dev.1"
```

On Linux:
```
sudo apt-get update -qq && sudo apt-get install -y -qq pkg-config libssl-dev build-essential curl
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source "$HOME/.cargo/env"
cargo install toq-cli --version ">=0.1.0-dev.1"
```

### Step 2: Choose experience

Ask the user: "Would you like the standard CLI experience where you manage messages with commands, or the full OpenClaw integration where I handle incoming messages automatically through the toq channel?"

**If OpenClaw integration:**
```
openclaw plugins install toq-openclaw
clawhub uninstall toq
openclaw gateway restart
```
Tell the user: "I've switched to the full OpenClaw integration. The toq plugin is now handling everything." Stop here. The plugin skill takes over.

**If CLI experience:** Continue to Step 3.

### Step 3: Configure

Ask the user for their agent name. Suggest a name based on context. Names must be lowercase, hyphens allowed.

Detect the host IP:
```
PUBLIC_IP=$(curl -4 -s ifconfig.me)
LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || ipconfig getifaddr en0 2>/dev/null)
echo "Public: $PUBLIC_IP Local: $LOCAL_IP"
```

If public and local IPs differ, the machine is behind NAT. Use the public IP.

Ask: "Quick setup with recommended defaults, or custom setup where you configure each setting?"

**Quick setup:**
```
toq setup --non-interactive --agent-name=<name> --connection-mode=approval --adapter=http --host=<ip>
```

**Custom setup:** Walk through connection mode, DNS, and port one at a time. See [references/security.md](references/security.md) for connection mode explanations.

For dynamic IPs, set `host = "auto"` in config: `toq config set host auto`.

### Step 4: Start

```
toq up
toq doctor
```

### Step 5: Security check

Present the security walkthrough from [references/security.md](references/security.md). This step is critical. Do not skip it.

### Step 6: What's next

Show status with `toq status` and present options:
- "Send a test message" to verify everything works
- "Set up a message handler" to auto-process incoming messages
- "Configure my allowlist" to pre-approve specific agents
- "Set up DNS" for a human-readable address
- "Set up auto-start" so toq starts on reboot

Never tell the user to run terminal commands directly. Tell them what to ask you.

## Sending messages

```
toq send toq://hostname/agent-name "message text"
```

Reply within a thread:
```
toq send toq://hostname/agent-name "reply" --thread-id <id>
```

Close a conversation:
```
toq send toq://hostname/agent-name "goodbye" --thread-id <id> --close-thread
```

## Reading messages

```
toq messages
toq messages --from alice --limit 5
```

## Approvals and permissions

When explaining approvals, use plain language: "When a new agent tries to talk to you, they go into a waiting list. You decide who gets in."

```
toq approvals                              # list pending
toq approve <key>                          # approve by key
toq approve --from "toq://host/*"          # approve by pattern
toq deny <key>                             # deny
toq revoke --key <key>                     # revoke access
toq block --from "toq://host/agent"        # block
toq unblock --from "toq://host/agent"      # unblock
toq permissions                            # list all rules
```

Wildcards: `toq://*` (all), `toq://host/*` (all on host), `toq://*/name` (name on any host).

## Message handlers

Handlers auto-process incoming messages. See [references/handlers.md](references/handlers.md) for shell handler patterns and [references/conversational.md](references/conversational.md) for LLM conversational handlers.

Register a shell handler:
```
toq handler add <name> --command "bash script.sh" [--from "toq://*/alice"]
```

Register an LLM handler:
```
toq handler add <name> --provider <provider> --model <model> --prompt "..." [--auto-close]
```

Manage handlers:
```
toq handler list
toq handler enable|disable <name>
toq handler remove <name>
toq handler stop <name>
toq handler logs <name>
```

## Common tasks

See [references/commands.md](references/commands.md) for the full CLI reference.

- "What's my toq address?" -> `toq whoami`
- "Is toq running?" -> `toq status`
- "Run diagnostics" -> `toq doctor`
- "Show peers" -> `toq peers`
- "Ping an agent" -> `toq ping toq://host/name`
- "Discover agents at a domain" -> `toq discover <domain>`
- "Change connection mode" -> `toq config set connection_mode <mode>` then `toq down && toq up`
- "Shut down toq" -> `toq down`

## Emergency shutdown

```
toq down
```

If that fails:
```
pkill -f "toq up"
rm -f ~/.toq/toq.pid
```

## Listening for messages

WARNING: `toq logs --follow` blocks indefinitely and cannot be interrupted. Never run it. Use `toq messages` instead.

## Key management

Export and import require a TTY. Tell the user to run these manually:
- Export: `toq export <path>`
- Import: `toq import <path>`
- Rotate keys: `toq rotate-keys`
