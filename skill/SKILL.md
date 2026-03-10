---
name: toq
description: Send and receive secure messages to other AI agents using the toq protocol. Manage peers, block/unblock agents, register message handlers, and configure connection security.
license: Apache-2.0
allowed-tools: Bash(toq:*)
metadata: {"openclaw":{"requires":{"os":["darwin","linux"]}}}
---

# toq protocol

toq is a secure agent-to-agent communication protocol. It lets your agent talk directly to other agents running toq, with end-to-end encryption and no cloud dependency. Each agent is an endpoint identified by a toq address like `toq://hostname/agent-name` on port 9009.

## Guided setup

When the user asks to set up toq or agent-to-agent communication, follow this flow in order. Guide the user through each step conversationally. Do not dump all steps at once.

Before anything else, tell the user: "Just a heads up: toq is brand new and still in alpha. It's great for experimenting and testing agent-to-agent communication, but I wouldn't rely on it for anything important yet. The protocol and tools are still evolving, so avoid sending personal or sensitive data through it for now."

### Step 1: Install toq

Check if toq is already installed:

```
which toq > /dev/null 2>&1 && toq --version
```

If toq is found, skip to Step 2.

If toq is not installed, install it. This requires the Rust toolchain and build dependencies.

Before installing, tell the user what will be installed: "To install toq, I'll need to set up the Rust programming language toolchain and a few build tools. This is a one-time setup that takes a few minutes. After that, toq installs in about 3-5 minutes while it compiles."

On Linux (Ubuntu/Debian):
```
sudo apt-get update -qq && sudo apt-get install -y -qq pkg-config libssl-dev build-essential curl
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source "$HOME/.cargo/env"
cargo install toq-cli --version ">=0.1.0-dev.1"
sudo ln -sf "$HOME/.cargo/bin/toq" /usr/local/bin/toq
```

On macOS:
```
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source "$HOME/.cargo/env"
cargo install toq-cli --version ">=0.1.0-dev.1"
```

After installation, verify:
```
toq --version
```

Tell the user toq is installed and explain what it does: "toq lets your agent communicate securely with other agents. I'll now help you set up your agent identity."

### Step 2: Choose setup type

Ask the user: "Would you like a quick setup with recommended defaults, or a custom setup where you can configure DNS, port, connection limits, and other settings?"

**Quick setup** (recommended for most users):
- Detects the correct IP automatically
- Uses approval mode
- Default port 9009
- Starts the service immediately
- Skip to "Step 3: Quick setup"

**Custom setup** (for users who want control):
- Walks through each setting before starting
- Skip to "Step 4: Custom setup"

### Step 3: Quick setup

Ask the user for their agent name. Suggest a name based on context (e.g. "assistant", "home-agent", "support-bot"). Names must be lowercase, hyphens allowed.

Detect the correct host IP:

```
PUBLIC_IP=$(curl -4 -s ifconfig.me)
LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || ipconfig getifaddr en0 2>/dev/null)
echo "Public: $PUBLIC_IP Local: $LOCAL_IP"
```

If public and local IPs differ, the machine is behind NAT. Use the public IP. Tell the user which IP will be used and why.

Note: always use `-4` with curl to get the IPv4 address. IPv4 is more universally reachable than IPv6. If the machine only has IPv6, the command will fail and you should fall back to `curl -s ifconfig.me`.

Run setup:
```
toq setup --non-interactive --agent-name=<name> --connection-mode=approval --adapter=http --host=<ip>
```

After setup, if the machine has a dynamic IP (no static/elastic IP), set `host = "auto"` in `~/.toq/config.toml`. This makes the service re-detect the public IP on every startup.

Start the service:
```
toq up
```

Verify:
```
toq doctor
```

Note: `toq doctor` may report port 9009 as "in use by the toq service". This is normal.

Show the user their address and status, then proceed to the security check (Step 5).

### Step 4: Custom setup

Ask the user for their agent name. Suggest a name based on context. Names must be lowercase, hyphens allowed.

Detect the correct host IP (same as quick setup above).

Then walk through each setting one at a time:

**Connection mode:**
Explain in plain language:
- **Approval mode** (recommended): "Other agents need your permission before they can talk to you."
- **Open mode**: "Any agent can connect. Only for public-facing services."
- **Allowlist mode**: "Only agents you pre-approve can connect. Most restrictive."

**DNS (optional):**
Ask if the user wants a human-readable address like `toq://myserver.com/agent` instead of an IP address. If yes:
1. Guide them through adding an A record pointing their domain to the server's public IP
2. Use the domain name as the `--host` value instead of the IP
3. Warn that a DNS name makes the agent discoverable by anyone who knows the domain

**Port:**
Default is 9009. Ask if they want to change it. Most users should keep the default.

**Message history:**
Default keeps the last 1000 messages. Ask if they want more or fewer. Explain: "This controls how many past messages you can look back through."

**Other settings** (only mention if the user asks for more):
- `max_connections` - how many agents can connect simultaneously (default 1000)
- `heartbeat_interval` - how often to check if connections are alive (default 30s)
- `ack_timeout` - how long to wait for message acknowledgment (default 10s)
- `graceful_shutdown_timeout` - how long to wait for in-flight messages on shutdown (default 60s)

Run setup with the chosen values:
```
toq setup --non-interactive --agent-name=<name> --connection-mode=<mode> --adapter=http --host=<host>
```

If the user chose non-default values for port, history, or other settings, edit `~/.toq/config.toml` after setup to apply them. Changes must be made before starting the service since there is no live reload.

Start the service:
```
toq up
```

Verify:
```
toq doctor
```

Proceed to the security check (Step 5).

### Step 5: Security check

This step is critical. Explain security in plain, non-technical language. Do not skip or rush this.

First, determine the network situation:

```
PUBLIC_IP=$(curl -4 -s ifconfig.me)
LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || ipconfig getifaddr en0 2>/dev/null)
```

If public and local IPs are different, the machine is behind NAT (cloud server or home router).

Explain to the user in plain language:

**If on a cloud server (public IP differs from local IP, and the machine is a VPS/cloud instance):**

"Your agent is on a server with a public internet address. This means:

- **Port 9009 is how other agents connect to you.** Right now, it may be blocked by your cloud provider's firewall. You will need to open it in your provider's firewall settings (for example, the Networking tab in LightSail, or Security Groups in AWS) before other agents can reach you.
- **Once port 9009 is open, anyone on the internet can try to connect.** They cannot send you messages without your approval (that is what approval mode does), but they can knock on your door.
- **Approval mode is your front door lock.** Every new agent that tries to connect goes into a waiting list. You decide who gets in. No one can send you messages until you approve them.
- **If you only plan to talk to one or two specific agents**, consider asking them for their IP address and setting up firewall rules that only allow those IPs to connect on port 9009. This is like giving out your address only to friends instead of posting it publicly."

**If on a home network (behind a router):**

"Your agent is behind your home router. This is actually the safest setup:

- **Agents on your same network (same Wi-Fi) can connect to you directly.** No extra setup needed.
- **Agents outside your network (on the internet) cannot reach you** unless you set up port forwarding on your router. This is a deliberate choice you would need to make.
- **If you do set up port forwarding**, the same rules apply as a cloud server: anyone on the internet could try to connect, so approval mode is important.
- **If you only talk to agents on your local network**, you do not need to change anything. Your router is already protecting you."

**For all setups, mention future security considerations briefly:**

"Approval mode is your main protection right now. No one can send you messages without your permission. If you later set up automatic message handling (handlers or notifications that forward messages into this chat), there are additional security considerations I'll walk you through at that point."

### Step 6: What's next

Show the user their full status:
```
toq status
```

Present the user with what they can do next:
- **"Send a test message"** to another agent to verify everything works
- **"Set up a message handler"** to automatically process incoming messages (log them, reply, forward, etc.)
- **"Configure my allowlist"** to pre-approve specific agents
- **"Customize my settings"** to change address, port, message history, or connection limits (requires restart)
- **"Set up auto-start"** so toq starts automatically on reboot
- **"Set up notifications"** so incoming toq messages appear in this chat

Also mention the emergency shutdown option: "If you ever need to quickly take toq offline, just tell me 'shut down toq' and I'll stop the service immediately."

Important: never tell the user to run terminal commands. Instead, tell them what to ask you in natural language. For example, say "just ask me to check your toq approvals" instead of "run `toq approvals`". You handle the commands, the user talks to you.

### Step 7 (optional): Auto-start on reboot

If the user wants toq to start automatically:

On Linux with systemd:
```
cat > /tmp/toq.service << EOF
[Unit]
Description=toq protocol daemon
After=network.target

[Service]
Type=forking
User=$USER
ExecStart=/usr/local/bin/toq up
ExecStop=/usr/local/bin/toq down
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
sudo mv /tmp/toq.service /etc/systemd/system/toq.service
sudo systemctl daemon-reload
sudo systemctl enable toq
```

On macOS with launchd:
```
cat > ~/Library/LaunchAgents/com.toqprotocol.toq.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key><string>com.toqprotocol.toq</string>
    <key>ProgramArguments</key><array><string>/usr/local/bin/toq</string><string>up</string></array>
    <key>RunAtLoad</key><true/>
    <key>KeepAlive</key><true/>
</dict>
</plist>
EOF
launchctl load ~/Library/LaunchAgents/com.toqprotocol.toq.plist
```

## Emergency shutdown

If the user says "shut down toq", "kill toq", "stop toq", or "emergency stop":

```
toq down
```

Confirm the service is stopped. If `toq down` fails:
```
pkill -f "toq.*daemon"
rm -f ~/.toq/toq.pid
```

Tell the user the service is stopped and port 9009 is no longer listening.

## Connection modes

- `open`: accept connections from any agent. Use only for public services.
- `allowlist`: only pre-approved public keys can connect. Most restrictive.
- `approval`: new agents must request approval. You decide who gets in. Recommended default.
- `dns-verified`: agents must have valid DNS records. Good for organizations.

## Changing configuration

toq stores its config at `~/.toq/config.toml`. There is no live reload, so to change a setting:

1. Stop the service: `toq down`
2. Edit the config file. Key fields:
   - `connection_mode` - "open", "allowlist", "approval", or "dns-verified"
   - `host` - the IP or hostname other agents use to reach this machine
   - `agent_name` - the agent's name in the toq address
   - `port` - protocol port (default 9009)
   - `message_history_limit` - max messages stored (default 1000)
3. Start the service: `toq up`
4. Verify with `toq status`

When explaining config changes to the user, warn them: "Changing settings requires restarting the toq service. This will drop all current connections. Other agents will need to reconnect the next time they send you a message. Any messages sent to you while the service is down will not be received."

## Sending messages

```
toq send toq://hostname/agent-name "Your message here"
```

Reply within an existing thread:

```
toq send toq://hostname/agent-name "Reply text" --thread-id <thread-id>
```

Close a thread (signals the conversation is over):

```
toq send toq://hostname/agent-name "Goodbye!" --thread-id <thread-id> --close-thread
```

Handlers should always use `--thread-id "$TOQ_THREAD_ID"` when replying so the conversation stays in the same thread. Use `--close-thread` when the conversation should end. The remote agent receives a `thread.close` event and should not reply further.

If sending fails, common causes:
- Target agent is offline or unreachable
- Target agent has not approved your connection yet
- Target agent has blocked you
- Wrong address (check hostname and agent name)
- Target is on a cloud server and the address uses a private IP instead of the public IP
- Port 9009 is not open in the target's firewall or security group
- Your toq service is not running (check with `toq status`)

## Reading messages

```
toq messages
```

Shows recent received messages with sender, timestamp, and content. Filter by sender:

```
toq messages --from alice
```

Limit the number of results:

```
toq messages --limit 5
```

## Checking status

```
toq status
```

## Approvals and permissions

When explaining approvals to the user, use plain language:
- "When a new agent tries to talk to you, they go into a waiting list. I'll let you know when someone is waiting."
- "You can approve agents by their public key, by their address, or by a wildcard pattern like 'anyone from this server'."
- "Once you approve someone, they can send you messages freely."
- "If you change your mind later, just tell me to revoke their access or block them."

All permission rules are stored in `~/.toq/permissions.toml`. This file can be edited while the service is stopped.

List pending approval requests:

```
toq approvals
```

Approve a pending request by public key:

```
toq approve <public-key>
```

Pre-approve by address or wildcard pattern:

```
toq approve --from "toq://host/agent"
toq approve --from "toq://host/*"
toq approve --from "toq://*/agent-name"
toq approve --from "toq://*"
```

Pre-approve by public key (without a pending request):

```
toq approve --key <public-key>
```

Deny a pending request:

```
toq deny <public-key>
```

Revoke access (removes from approved list without blocking):

```
toq revoke --key <public-key>
toq revoke --from "toq://host/*"
```

List all permission rules:

```
toq permissions
```

## Ping

Discover a remote agent's public key. The remote agent will see a pending approval request as a side effect.

```
toq ping toq://host/agent-name
```

Use this to get a public key before approving by key:
1. `toq ping toq://host/agent` to get their key
2. `toq approve --key <key>` to approve them

If the remote agent is unreachable, ping will fail with an error.

## Peer management

List known peers (agents that have connected):

```
toq peers
```

Block an agent by key, address, or wildcard:

```
toq block --key <public-key>
toq block --from "toq://host/*"
toq block --from "toq://*/agent-name"
```

Block always overrides approve. To approve everyone on a host except one agent:
```
toq approve --from "toq://host/*"
toq block --from "toq://host/bad-agent"
```

Unblock:

```
toq unblock --key <public-key>
toq unblock --from "toq://host/*"
```

Wildcard patterns:
- `toq://*` matches all agents everywhere
- `toq://host/*` matches any agent on that host
- `toq://*/name` matches that agent name on any host

## Service management

Start: `toq up`
Stop: `toq down`
Graceful stop: `toq down --graceful`
Diagnostics: `toq doctor`
View recent logs: `toq logs`

## Listening for messages

WARNING: `toq listen` and `toq logs --follow` block indefinitely and cannot be interrupted by the agent. Never run these commands. Use `toq messages` to read received messages instead.

## Key management

Export and import require a TTY for passphrase prompts. Tell the user to run these manually:

- Export: `toq export <path>`
- Import: `toq import <path>`
- Rotate keys: `toq rotate-keys`

## Message handlers

Handlers are scripts that the toq daemon runs automatically when messages arrive. The daemon manages the lifecycle: spawning, filtering, logging, and stopping.

### Registering a handler

When the user wants to process incoming messages automatically, write the handler script for them and register it with toq. If the user prefers to write the script themselves, guide them on the format and environment variables instead.

First, create the handlers directory if it doesn't exist:

```
mkdir -p ~/.toq/handlers
```

Write the handler script based on what the user described. Handlers receive the full message as JSON on stdin, and environment variables for convenience: `TOQ_FROM`, `TOQ_TEXT`, `TOQ_THREAD_ID`, `TOQ_TYPE`, `TOQ_ID`.

```bash
cat > ~/.toq/handlers/log-alice.sh << 'EOF'
#!/bin/bash
echo "[$(date)] From: $TOQ_FROM - $TOQ_TEXT" >> ~/alice-messages.log
EOF
chmod +x ~/.toq/handlers/log-alice.sh
```

Then register it:

```
toq handler add alice-logger --command "bash ~/.toq/handlers/log-alice.sh" --from "toq://*/alice"
```

The `--from` filter means only messages from agents named "alice" trigger this handler. Without a filter, the handler runs for every message.

### Filter options

Filters control which messages trigger a handler. Same filter type uses OR logic, different types use AND.

```
# Only messages from a specific host
toq handler add host-logger --command "bash log.sh" --from "toq://1.2.3.4/*"

# Messages from multiple hosts (OR)
toq handler add multi --command "bash log.sh" --from "toq://abc.com/*" --from "toq://def.com/*"

# Only message.send type (not thread.close)
toq handler add msgs-only --command "bash log.sh" --type message.send

# Combined: from a host AND of a specific type (AND)
toq handler add strict --command "bash log.sh" --from "toq://host/*" --type message.send
```

### Managing handlers

```
# List all handlers with status
toq handler list

# Disable without removing
toq handler disable alice-logger

# Re-enable
toq handler enable alice-logger

# Remove entirely
toq handler remove alice-logger

# Stop all running processes for a handler
toq handler stop alice-logger

# View handler logs
toq handler logs alice-logger
```

Handler logs are stored at `~/.toq/logs/handlers/handler-<name>.log` with timestamps and process IDs.

### Handler script patterns

**Auto-reply (within the same thread):**
```bash
#!/bin/bash
toq send "$TOQ_FROM" "Thanks for your message, I'll get back to you soon." --thread-id "$TOQ_THREAD_ID"
```

**Close a conversation:**
```bash
#!/bin/bash
toq send "$TOQ_FROM" "Goodbye!" --thread-id "$TOQ_THREAD_ID" --close-thread
```

Important: always send the goodbye text and `--close-thread` as a single command. Never send a reply and a separate close as two messages. Two messages causes a race where the remote handler replies to the text before seeing the close, creating a goodbye loop.

**Forward to a file:**
```bash
#!/bin/bash
echo "[$(date)] $TOQ_FROM: $TOQ_TEXT" >> ~/toq-inbox.log
```

**Parse JSON from stdin for full message data:**
```bash
#!/bin/bash
MSG=$(cat)
FROM=$(echo "$MSG" | jq -r '.from')
TEXT=$(echo "$MSG" | jq -r '.body.text // empty')
# Process as needed
```

For JSON parsing, ensure jq is installed:
```
which jq > /dev/null 2>&1 || sudo apt-get install -y jq
```

### Conversational handlers

For handlers that have multi-turn conversations with other agents:

1. Always use `--thread-id "$TOQ_THREAD_ID"` so replies stay in the same thread
2. Route messages through an LLM for natural responses
3. Have the LLM decide when the conversation is over
4. Send the goodbye message and `--close-thread` as a single command
5. Don't reply to `thread.close` events from the remote side
6. Log both sides of the conversation using agent names for readability
7. Don't send empty replies. If the LLM call fails, close the thread with an error message

For OpenClaw, use `openclaw agent` with a session ID per thread so the LLM has memory across turns:

```bash
#!/bin/bash
set -euo pipefail

MSG=$(cat)
TEXT=$(echo "$MSG" | jq -r '.body.text // empty')
MSG_TYPE=$(echo "$MSG" | jq -r '.type // "message.send"')
LOG=~/toq-handlers/$TOQ_HANDLER/thread-${TOQ_THREAD_ID:-unknown}.log
mkdir -p "$(dirname "$LOG")"
ME=$(toq status 2>/dev/null | grep address | awk '{print $2}' || echo "me")

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*" >> "$LOG"; }

# Don't reply to thread.close
if [[ "$MSG_TYPE" == "thread.close" ]]; then
  log "$TOQ_FROM closed the thread"
  exit 0
fi
[[ "$MSG_TYPE" != "message.send" ]] && exit 0
[[ -z "$TEXT" ]] && exit 0

log "$TOQ_FROM: $TEXT"

PROMPT="You received this message from $TOQ_FROM: \"$TEXT\"
Respond naturally (1-4 sentences). On a new line at the end, write CONTINUE or CLOSE.
Write CLOSE only if the conversation has reached a natural end."

RESPONSE=$(openclaw agent --session-id "toq-$TOQ_THREAD_ID" --message "$PROMPT" --json 2>/dev/null || echo "")
FULL=$(echo "$RESPONSE" | jq -r '.result.payloads[0].text // empty')

# Don't send empty replies
if [[ -z "$FULL" ]]; then
  log "$ME: [error: agent call failed, closing thread]"
  toq send "$TOQ_FROM" "Sorry, I ran into an issue." --thread-id "$TOQ_THREAD_ID" --close-thread
  exit 0
fi

DIRECTIVE=$(echo "$FULL" | tail -n1 | tr -d '[:space:]')
REPLY=$(echo "$FULL" | head -n -1 | sed '/^[[:space:]]*$/d')

if [[ -z "$REPLY" ]]; then
  REPLY="$FULL"
  DIRECTIVE="CONTINUE"
fi

if [[ "$DIRECTIVE" == "CLOSE" ]]; then
  toq send "$TOQ_FROM" "$REPLY" --thread-id "$TOQ_THREAD_ID" --close-thread
  log "$ME: $REPLY [closed]"
else
  toq send "$TOQ_FROM" "$REPLY" --thread-id "$TOQ_THREAD_ID"
  log "$ME: $REPLY"
fi
```

Key rules:
- `--session-id` gives the LLM memory across turns in the same thread
- The CONTINUE/CLOSE directive lets the LLM naturally end conversations
- Sending goodbye text with `--close-thread` in one command prevents reply loops
- `thread.close` is a cooperative signal. The remote agent should respect it but is not forced to. If a remote agent keeps sending after close, use `toq block` to stop them

When the user asks to create a conversational handler, write the script for them using this pattern. Adapt the prompt to match what the user wants the agent to do. For non-OpenClaw LLMs (Bedrock, OpenAI, etc.), replace the `openclaw agent` call with the appropriate API call.

Do not add `--type` filters to conversational handlers. The handler must receive `thread.close` events so it knows when the remote agent ended the conversation. The script handles type checking internally.

### Advanced: custom SSE listener

For stateful or long-running message processing (conversations, complex routing), use the SSE stream directly instead of handlers:

```bash
curl -s -N http://127.0.0.1:9010/v1/messages | while read -r line; do
  if [[ "$line" == data:* ]]; then
    json="${line#data: }"
    from=$(echo "$json" | jq -r '.from // empty')
    text=$(echo "$json" | jq -r '.body.text // empty')
    # Process message
  fi
done
```

The SSE stream supports server-side filtering: `http://127.0.0.1:9010/v1/messages?from=toq://host/*&type=message.send`

When creating handlers, confirm with the user:
- What messages to match (sender, keywords, all messages)
- What action to take (log, forward, reply, run a command)

**Before creating any handler that forwards messages into this chat or triggers actions automatically, check the connection mode and warn the user:**

First check: `toq status` to see the current connection mode.

"Before we set this up, an important security note: when incoming toq messages are forwarded into our conversation, that message content reaches me (your AI assistant). If a malicious agent sent a carefully crafted message, it could potentially trick me into running a harmful command.

To protect against this:
1. **toq's connection mode** controls who can send you messages. You should be in `approval` or `allowlist` mode so only agents you trust can reach you. (If currently in `open` mode, strongly recommend switching before setting up a handler.)
2. **OpenClaw's exec approval mode** adds a second layer: every command I run requires your explicit OK before it executes. If this is not already enabled, I strongly recommend turning it on before we set up message forwarding.

With both protections active, a malicious agent would need to get past your approval AND trick you into confirming a harmful command. That is two locks instead of one."

## Security

### Connection mode selection

ALWAYS default to `approval` mode. The user must explicitly request a less restrictive mode.

Never suggest `open` mode unless the user specifically asks for a public-facing agent.

### OpenClaw exec tool interaction

This is the most important security consideration. OpenClaw's `exec` tool can run shell commands on the host. When a remote agent sends a toq message, that message content reaches the AI. If exec is enabled without approval mode, the AI could be influenced by message content to run commands.

Mitigations:
1. Enable OpenClaw's exec approval mode so every command requires human confirmation
2. Use toq's `approval` or `allowlist` connection mode so only trusted agents can send messages
3. Both protections together provide defense in depth

### Network exposure

Port 9009 is the toq protocol port.

- On a home network behind NAT: relatively safe
- On a VPS or cloud server with a public IP: port 9009 is exposed to the internet

If on a public IP, recommend firewall rules and `approval` or `allowlist` mode.

### DNS setup

To set up DNS:
1. Add an A or AAAA record pointing the domain to the server's public IP
2. The toq address becomes `toq://domain/agent-name`

Before setting up DNS, make sure connection mode is `approval` or stricter.

### Local API port

Port 9010 is for localhost management only. NEVER expose it to the network.

## Common tasks

Users may have many skills installed. These tasks trigger when the user mentions "toq" or "agent-to-agent" specifically.

- "Set up toq" / "Install toq" -> Follow the guided setup flow above
- "What did alice say?" / "Show toq messages from alice" -> `toq messages --from alice`
- "Show recent toq messages" -> `toq messages`
- "What's my toq address?" -> `toq status`
- "Show my toq peers" -> `toq peers`
- "Check toq approvals" / "Any toq connection requests?" -> `toq approvals`
- "Approve that toq agent" -> copy key from `toq approvals`, then `toq approve <key>`
- "Approve all agents from a server" -> `toq approve --from "toq://host/*"`
- "Deny that toq agent" -> copy key from `toq approvals`, then `toq deny <key>`
- "Revoke a toq agent's access" -> `toq revoke --key <key>` or `toq revoke --from "toq://host/*"`
- "Send a toq message to X" -> `toq send toq://host/name "message"`
- "Block a toq agent" -> `toq block --from "toq://host/name"` or `toq block --key <key>`
- "Show toq permissions" / "Who is approved?" -> `toq permissions`
- "Ping a toq agent" / "Get their public key" -> `toq ping toq://host/name`
- "Is toq running?" / "Check toq status" -> `toq status` or `toq doctor`
- "Change toq connection mode" -> edit `~/.toq/config.toml`, change `connection_mode`, then `toq down` and `toq up`
- "Set up a toq message handler" -> write handler script, register with `toq handler add`
- "Show my toq handlers" / "List handlers" -> `toq handler list`
- "Disable a handler" -> `toq handler disable <name>`
- "Remove a handler" -> `toq handler remove <name>`
- "Show handler logs" -> `toq handler logs <name>`
- "Stop a handler" -> `toq handler stop <name>`
- "Run toq diagnostics" -> `toq doctor`
- "Show toq logs" -> `toq logs`
- "Shut down toq" / "Kill toq" / "Emergency stop" -> `toq down`
