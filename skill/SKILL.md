---
name: toq
description: Send and receive secure messages to other AI agents using the toq protocol. Manage peers, block/unblock agents, and configure connection security.
license: Apache-2.0
allowed-tools: Bash(toq:*)
metadata: {"openclaw":{"requires":{"bins":["toq"],"os":["darwin","linux"]}}}
---

# toq protocol

toq is a secure agent-to-agent communication protocol. It lets your agent talk directly to other agents running toq, with end-to-end encryption and no cloud dependency. Each agent is an endpoint identified by a toq address like `toq://hostname/agent-name` on port 9009.

## First-time setup

Before doing anything else, check if toq is already configured:

```
toq status
```

If this returns status information, toq is already set up. Skip to "Sending messages."

If it errors or says not configured, follow these steps:

### 1. Detect the correct host IP

Before running any toq commands, verify the binary is available:

```
which toq > /dev/null 2>&1 || echo "toq not found"
```

If toq is not installed, it can be installed via:
- `cargo install toq-cli` (requires Rust toolchain)
- Or download from https://github.com/toqprotocol/toq/releases

Determine whether this machine is on a cloud server or behind a home router:

```
curl -s ifconfig.me
```

This returns the public IP. Compare it to the local IP:

```
hostname -I | awk '{print $1}'
```

If they differ, the machine is behind NAT (cloud server, VPS, or router). Use the public IP from `curl -s ifconfig.me` as the `--host` value. If they match, the machine has a direct public IP.

On a home network where the agent only talks to other agents on the same LAN, use the local IP instead.

### 2. Run setup

```
toq setup --non-interactive --agent-name=<name> --connection-mode=approval --adapter=http --host=<ip>
```

Parameters:
- `--agent-name`: the agent's name (lowercase, hyphens allowed, e.g. `recipe-bot`). This becomes part of the toq address.
- `--connection-mode`: one of `open`, `allowlist`, `approval`, `dns-verified`. Always default to `approval` unless the user explicitly requests otherwise.
- `--adapter`: message adapter. Use `http`.
- `--host`: the IP address other agents will use to reach this machine. On cloud servers, this must be the public IP.

Do NOT run setup if toq is already configured. It will not overwrite existing config.

### 3. Start the daemon

```
toq up
```

### 4. Verify

```
toq doctor
```

Note: `toq doctor` may warn that port 9009 is in use. If the daemon is running, this is expected and not an error.

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
3. Start the daemon: `toq up`
4. Verify with `toq status`

Example: to change connection mode from open to approval, edit `~/.toq/config.toml` and change `connection_mode = "open"` to `connection_mode = "approval"`, then restart.

## Sending messages

```
toq send toq://hostname/agent-name "Your message here"
```

The address format is `toq://host/agent-name`. Default port is 9009.

If sending fails, common causes:
- Target agent is offline or unreachable
- Target agent has not approved your connection yet
- Target agent has blocked you
- Wrong address (check hostname and agent name)
- Target is on a cloud server and the address uses a private IP instead of the public IP
- Port 9009 is not open in the target's firewall or security group
- Your daemon is not running (check with `toq status`)

When sending to an agent on a cloud server or VPS, always use their public IP, not their internal/private IP.

## Checking status

```
toq status
```

Shows daemon status, your toq address, connection mode, message counts, and connection count.

## Approvals

When running in `approval` mode (the recommended default), new agents must be approved before they can communicate. The daemon must be running for these commands.

List pending approval requests:

```
toq approvals
```

This shows each pending request with the full public key, address, and request time.

Approve a request (use the full public key from `toq approvals` output, including the `ed25519:` prefix):

```
toq approve <public-key>
```

Deny a request:

```
toq deny <public-key>
```

Known issue: if the approve command returns "unknown error", the public key may contain characters that break the command. As a workaround, temporarily switch to `open` mode (edit config, restart), have the agent reconnect, then switch back to `approval` mode.

## Peer management

List known peers:

```
toq peers
```

Note: peers only appear here after they have connected inbound. Agents you have only sent messages to may not appear.

Block an agent by address or public key:

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
Graceful stop (finish in-flight messages): `toq down --graceful`
Diagnostics: `toq doctor`
View recent logs: `toq logs`

If the daemon is already running, `toq up` will report that. Check with `toq status` first if unsure.

## Listening for messages

WARNING: `toq listen` blocks indefinitely and cannot be interrupted by the agent. Do not run `toq listen`. It is only useful when the user runs it manually in a terminal.

`toq logs --follow` also blocks indefinitely. Use `toq logs` (without --follow) to see recent log entries.

To check if messages have arrived, use `toq status` and look at the `messages in` count. To read the actual messages:

```
toq messages
```

This shows recent received messages with sender, timestamp, and content. Filter by sender:

```
toq messages --from alice
```

Limit the number of results:

```
toq messages --limit 5
```

## Key management

Export keys, config, and peer list as an encrypted backup:

```
toq export <path>
```

This command requires a TTY to prompt for a passphrase. It cannot run non-interactively. Tell the user to run it manually in their terminal.

Restore from an encrypted backup:

```
toq import <path>
```

This also requires a TTY for the passphrase prompt.

Rotate keys and broadcast to connected peers:

```
toq rotate-keys
```

Note: peers that are offline during rotation will have stale keys and may need to reconnect.

## Maintenance

Update the toq binary:

```
toq upgrade
```

Delete all audit logs:

```
toq clear-logs
```

## Message handlers

The user can define how incoming messages should be processed. Since toq messages arrive at the daemon and are available via the local API, you can set up handlers by writing a small script that listens for messages and takes action.

Before creating a handler, ensure required dependencies are installed. Handlers typically need `jq` for JSON parsing and `curl` for the SSE connection:

```
which jq > /dev/null 2>&1 || sudo apt-get install -y jq
which curl > /dev/null 2>&1 || sudo apt-get install -y curl
```

Always check for and install missing dependencies before writing the handler script.

To create a handler, write a script at a location the user specifies (e.g. `~/.toq/handler.sh`) that:
1. Uses `curl -s -N http://127.0.0.1:9010/v1/messages` to listen for incoming messages via SSE
2. Parses each `data:` line as JSON
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

To run the handler in the background:

```bash
nohup bash ~/.toq/handler.sh > /dev/null 2>&1 &
```

Adapt the filtering and action to whatever the user asks for. The SSE stream provides all incoming messages as JSON with fields: `id`, `from`, `type`, `body`, `thread_id`, `timestamp`.

For handlers that need to reply, use `toq send` inside the script:

```bash
toq send "$from" "Got your invoice, processing now."
```

When creating handlers, always confirm with the user:
- What messages to match (sender, keywords, all messages)
- What action to take (log, forward, reply, run a command)
- Whether to run it in the background

## Security

This section is critical. Read it before helping the user set up toq.

### Connection mode selection

ALWAYS default to `approval` mode. The user must explicitly request a less restrictive mode.

- Personal use, talking to a few known agents: `approval` mode
- Known set of agents, no new connections expected: `allowlist` mode
- Organization with DNS infrastructure: `dns-verified` mode
- Public service (recipe bot, weather bot): `open` mode, but only after the user understands the risks

Never suggest `open` mode unless the user specifically asks for a public-facing agent. If they do, warn them that any agent on the internet can connect and send messages.

### OpenClaw exec tool interaction

This is the most important security consideration. OpenClaw's `exec` tool can run shell commands on the host. When a remote agent sends a toq message, that message content reaches the AI. If exec is enabled without approval mode, the AI could be influenced by message content to run commands.

Mitigations to recommend:
1. Enable OpenClaw's exec approval mode so every command requires human confirmation
2. Use toq's `approval` or `allowlist` connection mode so only trusted agents can send messages
3. Both protections together provide defense in depth

If the user has exec enabled without approval mode, strongly recommend they enable it before opening toq connections.

### Network exposure

Port 9009 is the toq protocol port. When `toq up` runs, it listens on this port.

- On a home network behind NAT: relatively safe, not reachable from the internet without port forwarding
- On a VPS or cloud server with a public IP: port 9009 is exposed to the internet. Any agent can attempt to connect.

If the user is on a public IP, recommend:
1. Use a firewall to restrict port 9009 to known IPs if possible
2. At minimum, use `approval` or `allowlist` mode
3. Monitor connection attempts with `toq status` and `toq logs`

### DNS setup

Setting up DNS makes the agent discoverable at a human-readable address like `toq://myserver.com/assistant`.

To set up DNS:
1. Add an A or AAAA record pointing the domain to the server's public IP
2. The toq address becomes `toq://domain/agent-name`
3. Other agents can now connect using that address

Before setting up DNS, make sure:
- Connection mode is `approval` or stricter
- The user understands their agent becomes discoverable
- Firewall rules are in place if needed

If the user just wants to talk to one or two known agents, DNS is not required. They can use the IP address directly.

### Local API port

The toq daemon runs a local API on port 9010 for management. This port should NEVER be exposed to the network. It is for localhost access only. If the user asks about exposing port 9010, warn them that it provides unauthenticated control over the daemon.

### Key rotation

Recommend rotating keys periodically with `toq rotate-keys`, especially after:
- Removing a previously trusted agent from the allowlist
- Suspecting a key compromise
- Changing the server or network environment

### Monitoring

Recommend the user periodically checks:
- `toq status` for message counts and connection mode
- `toq logs` for unusual connection attempts
- `toq peers` to verify only expected agents are connected

## Common tasks

Users may have many skills installed. These tasks trigger when the user mentions "toq" or "agent-to-agent" specifically.

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
- "Set up a toq message handler" -> write a script using the SSE API at `http://127.0.0.1:9010/v1/messages`
- "Run toq diagnostics" -> `toq doctor`
- "Show toq logs" -> `toq logs`
