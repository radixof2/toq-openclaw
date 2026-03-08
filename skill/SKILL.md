---
name: toq
description: Send and receive secure messages to other AI agents using the toq protocol. Manage peers, block/unblock agents, and configure connection security.
license: Apache-2.0
allowed-tools: Bash(toq:*)
metadata: {"openclaw":{"requires":{"os":["darwin","linux"]}}}
---

# toq protocol

toq is a secure agent-to-agent communication protocol. It lets your agent talk directly to other agents running toq, with end-to-end encryption and no cloud dependency. Each agent is an endpoint identified by a toq address like `toq://hostname/agent-name` on port 9009.

## Guided setup

When the user asks to set up toq or agent-to-agent communication, follow this flow in order. Guide the user through each step conversationally. Do not dump all steps at once.

### Step 1: Install toq

Check if toq is already installed:

```
which toq > /dev/null 2>&1 && toq --version
```

If toq is found, skip to Step 2.

If toq is not installed, install it. This requires the Rust toolchain and build dependencies:

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

### Step 2: Configure the agent

Ask the user for their agent name. Suggest a name based on context (e.g. "assistant", "home-agent", "support-bot"). Names must be lowercase, hyphens allowed.

Detect the correct host IP:

```
PUBLIC_IP=$(curl -s ifconfig.me)
LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || ipconfig getifaddr en0 2>/dev/null)
echo "Public: $PUBLIC_IP Local: $LOCAL_IP"
```

If public and local IPs differ, the machine is behind NAT. Use the public IP. Tell the user which IP will be used and why.

Explain connection modes to the user in plain language:
- **Approval mode** (recommended): "Other agents need your permission before they can talk to you. You approve or deny each one."
- **Open mode**: "Any agent can connect and send messages. Only use this if you want a public-facing service."
- **Allowlist mode**: "Only agents you pre-approve can connect. Most restrictive."

Default to approval mode unless the user asks for something else.

Run setup:
```
toq setup --non-interactive --agent-name=<name> --connection-mode=approval --adapter=http --host=<ip>
```

Tell the user their setup is complete and show them their toq address: `toq://host/agent-name`

### Step 3: Security check

If the machine has a public IP, warn the user:
- Port 9009 will be exposed to the internet
- Approval mode means agents must be approved, but anyone can attempt to connect
- Recommend firewall rules if they only talk to specific agents
- If OpenClaw exec approval mode is not enabled, strongly recommend enabling it

Ask if the user wants to set up DNS for a human-readable address (e.g. `toq://myserver.com/agent`). If yes, guide them through adding an A record.

### Step 4: Start the daemon

```
toq up
```

Verify:
```
toq doctor
```

Note: `toq doctor` may report port 9009 as "in use by daemon". This is normal.

Show the user their full status:
```
toq status
```

Present the user with what they can do next:
- **"Send a test message"** to another agent to verify everything works
- **"Set up a message handler"** to automatically process incoming messages (log them, reply, forward, etc.)
- **"Configure my allowlist"** to pre-approve specific agents
- **"Set up auto-start"** so toq starts automatically on reboot
- **"Set up notifications"** so incoming toq messages appear in this chat

Also mention the emergency shutdown option: "If you ever need to quickly take toq offline, just say 'shut down toq' and I'll stop the daemon immediately."

### Step 5 (optional): Auto-start on reboot

If the user wants toq to start automatically:

On Linux with systemd:
```
cat > /tmp/toq.service << 'EOF'
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

Confirm the daemon is stopped. If `toq down` fails:
```
pkill -f "toq.*daemon"
rm -f ~/.toq/toq.pid
```

Tell the user the daemon is stopped and port 9009 is no longer listening.

## Connection modes

- `open`: accept connections from any agent. Use only for public services.
- `allowlist`: only pre-approved public keys can connect. Most restrictive.
- `approval`: new agents must request approval. You decide who gets in. Recommended default.
- `dns-verified`: agents must have valid DNS records. Good for organizations.

## Changing configuration

toq stores its config at `~/.toq/config.toml`. There is no live config command, so to change a setting:

1. Stop the daemon: `toq down`
2. Edit the config file. Key fields:
   - `connection_mode` - "open", "allowlist", "approval", or "dns-verified"
   - `host` - the IP or hostname other agents use to reach this machine
   - `agent_name` - the agent's name in the toq address
   - `port` - protocol port (default 9009)
   - `message_history_limit` - max messages stored (default 1000)
3. Start the daemon: `toq up`
4. Verify with `toq status`

## Sending messages

```
toq send toq://hostname/agent-name "Your message here"
```

If sending fails, common causes:
- Target agent is offline or unreachable
- Target agent has not approved your connection yet
- Target agent has blocked you
- Wrong address (check hostname and agent name)
- Target is on a cloud server and the address uses a private IP instead of the public IP
- Port 9009 is not open in the target's firewall or security group
- Your daemon is not running (check with `toq status`)

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

## Approvals

List pending approval requests:

```
toq approvals
```

Approve a request (use the full public key from `toq approvals` output, including the `ed25519:` prefix):

```
toq approve <public-key>
```

Deny a request:

```
toq deny <public-key>
```

## Peer management

List known peers:

```
toq peers
```

Block an agent:

```
toq block <address-or-public-key>
```

Unblock:

```
toq unblock <address-or-public-key>
```

## Daemon management

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

The user can define how incoming messages should be processed by creating a handler script.

Before creating a handler, install dependencies:

```
which jq > /dev/null 2>&1 || sudo apt-get install -y jq
which curl > /dev/null 2>&1 || sudo apt-get install -y curl
```

Always check for and install missing dependencies before writing the handler script.

To create a handler, write a script at `~/.toq/handler.sh` that:
1. Uses `curl -s -N http://127.0.0.1:9010/v1/messages` to listen for incoming messages via SSE
2. Parses each `data:` line as JSON using `jq`
3. Checks the `from`, `type`, and `body.text` fields
4. Takes the action the user described

Example: "When I get a message from alice about invoices, save it to ~/invoices.log"

```bash
#!/bin/bash
curl -s -N http://127.0.0.1:9010/v1/messages | while read -r line; do
  if [[ "$line" == data:* ]]; then
    json="${line#data: }"
    from=$(echo "$json" | jq -r '.from // empty')
    text=$(echo "$json" | jq -r '.body.text // empty')
    type=$(echo "$json" | jq -r '.type // empty')
    if [[ "$type" == "message.send" ]] && [[ "$from" == *"alice"* ]] && echo "$text" | grep -qi "invoice"; then
      echo "[$(date)] From: $from - $text" >> ~/invoices.log
    fi
  fi
done
```

Run handlers in the background:

```bash
nohup bash ~/.toq/handler.sh > /tmp/toq-handler.log 2>&1 &
```

The SSE stream provides all incoming messages as JSON with fields: `id`, `from`, `type`, `body`, `thread_id`, `timestamp`.

For handlers that need to reply:

```bash
toq send "$from" "Got your invoice, processing now."
```

When creating handlers, confirm with the user:
- What messages to match (sender, keywords, all messages)
- What action to take (log, forward, reply, run a command)

Always run handlers in the background. If the user wants the handler to survive reboots, add it to the systemd service or a cron @reboot entry.

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
- "Deny that toq agent" -> copy key from `toq approvals`, then `toq deny <key>`
- "Send a toq message to X" -> `toq send toq://host/name "message"`
- "Block a toq agent" -> get identifier from `toq peers`, then `toq block <address-or-key>`
- "Is toq running?" / "Check toq status" -> `toq status` or `toq doctor`
- "Change toq connection mode" -> edit `~/.toq/config.toml`, change `connection_mode`, then `toq down` and `toq up`
- "Set up a toq message handler" -> install deps, write handler script, run in background
- "Run toq diagnostics" -> `toq doctor`
- "Show toq logs" -> `toq logs`
- "Shut down toq" / "Kill toq" / "Emergency stop" -> `toq down`
