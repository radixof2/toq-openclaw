---
name: toq-openclaw
description: Secure agent-to-agent communication via toq protocol with native OpenClaw integration. Use when the user wants to set up toq, send or receive messages from other AI agents, manage agent connections (approve, block, revoke), check toq status, configure DNS discovery, register message handlers, or define how incoming agent messages should be handled. Also use when you receive a [toq-inbound] message, when the user mentions "toq", "agent-to-agent", or asks about communicating with other agents.
---

# toq protocol (OpenClaw integration)

toq is a secure agent-to-agent communication protocol. Each agent is an endpoint identified by a toq address like `toq://hostname/agent-name` on port 9009.

The toq-openclaw plugin provides a background service that listens for inbound toq messages and delivers them to you as `[toq-inbound]` triggers. You have tools for common operations. You can also use any CLI command directly.

## Inbound messages

Inbound toq messages arrive as structured triggers:

```
[toq-inbound] endpoint=default from=toq://remote.com/alice text=Can we schedule a meeting?
[toq-inbound] endpoint=default from=toq://remote.com/alice thread=abc123 text=How about Tuesday?
```

Fields: `endpoint` (local endpoint name), `from` (remote address), `thread` (thread ID, if ongoing), `text` (message content).

Do NOT show the raw trigger to the human. Read it, decide what to do based on routing preferences, and present a natural summary if the human needs to know.

## Routing

See [references/routing.md](references/routing.md) for detailed patterns and examples.

When the user hasn't set a preference for a sender, show the message and ask:

> You received a toq message on your "default" endpoint from toq://remote.com/alice:
> "Can we schedule a meeting for tomorrow?"
> How would you like me to handle messages from this sender?

Remember their answer. Apply it to future messages from that sender.

## Tools

Prefer these over CLI commands. They call the toq SDK directly.

- `toq_send` - Send a message. Params: `address`, `text`, `thread_id` (optional), `endpoint` (optional)
- `toq_status` - Check daemon health. Params: `endpoint` (optional)
- `toq_peers` - List known peers. Params: `endpoint` (optional)
- `toq_approve` - Approve a pending connection. Params: `id`, `endpoint` (optional)
- `toq_block` - Block a peer. Params: `id`, `endpoint` (optional)

When replying to an inbound message, use `toq_send` with the `from` address and include the `thread_id` if present.

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

### Step 5: Verify

Use `toq_status` tool to confirm the daemon is running. Tell the user: "toq is running. When other agents send you messages, I'll handle them. Tell me how you want messages from specific agents handled."

## Sending messages

Prefer `toq_send` tool. CLI alternative:
```bash
toq send toq://hostname/agent-name "message text"
toq send toq://hostname/agent-name "reply" --thread-id <id>
toq send toq://hostname/agent-name "goodbye" --thread-id <id> --close-thread
```

## Approvals and permissions

Prefer `toq_approve` and `toq_block` tools. CLI alternatives:
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

Handlers auto-process incoming messages outside of OpenClaw. They run alongside the plugin. Both fire for the same inbound message.

```bash
toq handler add <name> --command "bash script.sh" [--from "toq://*/alice"]
toq handler add <name> --provider <provider> --model <model> --prompt "..." [--auto-close]
toq handler list
toq handler enable|disable <name>
toq handler remove <name>
```

Use cases:
- Log all messages to a file while OpenClaw handles routing
- Forward specific senders to a webhook
- Run an LLM handler for a sender the user doesn't want OpenClaw managing

See [references/handlers.md](references/handlers.md) for shell handler patterns and [references/conversational.md](references/conversational.md) for LLM handlers.

## Common tasks

See [references/commands.md](references/commands.md) for the full reference.

- "What's my toq address?" -> `toq whoami`
- "Is toq running?" -> `toq_status` tool or `toq status`
- "Run diagnostics" -> `toq doctor`
- "Show peers" -> `toq_peers` tool or `toq peers`
- "Discover agents at a domain" -> `toq discover <domain>`
- "Change connection mode" -> `toq config set connection_mode <mode>` then `toq down && toq up`

## Multiple endpoints

If the user runs multiple toq endpoints, the `endpoint` field in triggers identifies which one received the message. Use the `endpoint` param on tools to target the right one.

The user can set different routing rules per endpoint:
- "For my alice endpoint, handle scheduling autonomously"
- "For my secretary endpoint, forward everything immediately"

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
