---
name: toq-openclaw
description: Secure agent-to-agent communication via toq protocol with native OpenClaw channel integration. Use when the user wants to set up toq, send or receive messages from other AI agents, manage agent connections (approve, block, revoke), check toq status, configure DNS discovery, or define how incoming agent messages should be handled. Also use when the user mentions "toq", "agent-to-agent", or asks about communicating with other agents.
license: Apache-2.0
allowed-tools: Bash(toq:*)
metadata: {"openclaw":{"requires":{"os":["darwin","linux"]}}}
---

# toq protocol (OpenClaw integration)

toq is a secure agent-to-agent communication protocol. It lets your agent talk directly to other agents with end-to-end encryption and no cloud dependency. Each agent is an endpoint identified by a toq address like `toq://hostname/agent-name` on port 9009.

With the OpenClaw integration, incoming toq messages flow directly into your conversations through the toq channel. You process them like any other message. No CLI handlers needed. You decide what to act on, what to reply to, and what to tell the human about.

## Setup

When the user asks to set up toq, follow these steps in order. Guide the user conversationally.

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

### Step 2: Configure

Ask the user for their agent name. Suggest a name based on context. Names must be lowercase, hyphens allowed.

Detect the host IP:
```
PUBLIC_IP=$(curl -4 -s ifconfig.me)
LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || ipconfig getifaddr en0 2>/dev/null)
echo "Public: $PUBLIC_IP Local: $LOCAL_IP"
```

If public and local IPs differ, the machine is behind NAT. Use the public IP.

Run setup:
```
toq setup --non-interactive --agent-name=<name> --connection-mode=approval --adapter=http --host=<ip>
```

For dynamic IPs: `toq config set host auto`.

### Step 3: Start and connect

```
toq up
toq doctor
openclaw channels add --channel toq
openclaw gateway restart
```

Tell the user: "toq is running and connected to OpenClaw. When other agents send you messages, I'll handle them. You can tell me how you want messages from specific agents handled."

### Step 4: Security check

Present the security walkthrough from [references/security.md](references/security.md). This step is critical. Do not skip it.

### Step 5: What's next

Show status with `toq status` and present options:
- "Send a test message" to verify everything works
- "Tell me how to handle messages from specific agents"
- "Configure my allowlist" to pre-approve specific agents
- "Set up DNS" for a human-readable address

Never tell the user to run terminal commands directly. Tell them what to ask you.

## Handling incoming messages

Messages from other agents arrive automatically through the toq channel. You process them like any other conversation.

See [references/routing.md](references/routing.md) for detailed routing patterns and examples.

The user gives you routing rules in natural language. Remember these preferences and apply them consistently:

- "Forward everything from Bob immediately" -> show Bob's messages to the human as they arrive
- "Only notify me when Alice confirms a date" -> handle Alice's messages autonomously, notify only on confirmed dates
- "Handle scheduling requests, just tell me the result" -> manage the full conversation, send a summary when done
- "Ignore messages from unknown agents" -> do not surface messages from unapproved agents

When replying to a toq message, your response goes back through the toq channel automatically. For multi-turn conversations with remote agents, maintain context across messages in the same thread.

When you decide the human should know something, tell them on their primary channel (Telegram, Discord, etc.). You can respond on toq AND notify the human in the same turn.

## Sending messages

To send on behalf of the user:
```
toq send toq://hostname/agent-name "message text"
```

Continue a thread:
```
toq send toq://hostname/agent-name "reply" --thread-id <id>
```

Close a conversation:
```
toq send toq://hostname/agent-name "goodbye" --thread-id <id> --close-thread
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

Wildcards: `toq://*` (all), `toq://host/*` (all on host), `toq://*/name` (name on any host). Block always overrides approve.

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
