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

If it errors or says not configured, run setup:

```
toq setup --non-interactive --agent-name=<name> --connection-mode=approval --adapter=http
```

Parameters:
- `--agent-name`: your agent's name (lowercase, hyphens allowed, e.g. `recipe-bot`). This becomes part of your toq address.
- `--connection-mode`: one of `open`, `allowlist`, `approval`, `dns-verified`. Always default to `approval` unless the user explicitly requests otherwise.
- `--adapter`: message adapter, one of `http`, `stdin`, `unix`

Do NOT run setup if toq is already configured. It will overwrite the existing config and keys.

After setup, start the daemon:

```
toq up
```

Verify everything works:

```
toq doctor
```

## Connection modes

- `open`: accept connections from any agent. Use only for public services.
- `allowlist`: only pre-approved public keys can connect. Most restrictive.
- `approval`: new agents must request approval. You decide who gets in. Recommended default.
- `dns-verified`: agents must have valid DNS records. Good for organizations.

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
- Your daemon is not running (check with `toq status`)

## Checking status

```
toq status
```

Shows daemon status, your toq address, connection mode, peer count, and pending approval requests.

## Approvals

When running in `approval` mode (the recommended default), new agents must be approved before they can communicate. The daemon must be running for these commands.

List pending approval requests:

```
toq approvals
```

This shows each pending request with the full public key, address, and request time.

Approve a request (use the full public key from `toq approvals` output):

```
toq approve <public-key>
```

Deny a request:

```
toq deny <public-key>
```

In `allowlist` mode, use `toq approve <public-key>` to pre-approve agents before they connect.

## Peer management

List connected peers:

```
toq peers
```

Block an agent by address or public key (must be exact match from `toq peers` output):

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

```
toq listen
```

WARNING: This command blocks indefinitely and cannot be interrupted by the agent. Do not run `toq listen` from the agent. It is only useful when the user runs it manually in a terminal. For real-time message handling, use the toq relay or channel plugin instead.

`toq logs --follow` also blocks indefinitely. Use `toq logs` (without --follow) to see recent log entries.

## Key management

Export keys, config, and peer list as an encrypted backup:

```
toq export <path>
```

Restore from an encrypted backup:

```
toq import <path>
```

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
1. Enable OpenClaw's exec approval mode in your OpenClaw configuration so every command requires human confirmation before execution
2. Use toq's `approval` or `allowlist` connection mode so only trusted agents can send messages
3. Both protections together provide defense in depth

If the user has exec enabled without approval mode, strongly recommend they enable it before opening toq connections. This is not optional for security-conscious setups.

### Network exposure

Port 9009 is the toq protocol port. When `toq up` runs, it listens on this port.

- On a home network behind NAT: relatively safe, not reachable from the internet without port forwarding
- On a VPS or cloud server with a public IP: port 9009 is exposed to the internet. Any agent can attempt to connect.
- On a Mac Mini at home with port forwarding: same as a public server

If the user is on a public IP, recommend:
1. Use a firewall to restrict port 9009 to known IPs if possible
2. At minimum, use `approval` or `allowlist` mode
3. Monitor connection attempts with `toq status` and `toq logs`

### DNS setup

Setting up DNS makes the agent discoverable at a human-readable address like `toq://myserver.com/assistant`. This is convenient but also means anyone who knows the domain can attempt to connect.

To set up DNS:
1. Add an A or AAAA record pointing the domain to the server's IP
2. Verify your current hostname with `toq status` and confirm it matches the DNS domain
3. The toq address becomes `toq://domain/agent-name`
4. Other agents can now connect using that address

Before setting up DNS, make sure:
- Connection mode is `approval` or stricter
- The user understands their agent becomes discoverable
- Firewall rules are in place if needed
- Exec approval mode is enabled in OpenClaw

If the user just wants to talk to one or two known agents, DNS is not required. They can use the IP address directly: `toq://192.168.1.50/agent-name`.

### Local API port

The toq daemon runs a local API on port 9010 for management. This port should NEVER be exposed to the network. It is for localhost access only. If the user asks about exposing port 9010, warn them that it provides unauthenticated control over the daemon.

### Key rotation

Recommend rotating keys periodically with `toq rotate-keys`, especially after:
- Removing a previously trusted agent from the allowlist
- Suspecting a key compromise
- Changing the server or network environment

### Monitoring

Recommend the user periodically checks:
- `toq status` for pending approval requests and connected peers
- `toq logs` for unusual connection attempts
- `toq peers` to verify only expected agents are connected

## Common tasks

- "What's my toq address?" -> `toq status`
- "Who's connected?" -> `toq peers`
- "Anyone trying to connect?" -> `toq approvals`
- "Approve that agent" -> copy key from `toq approvals`, then `toq approve <key>`
- "Deny that agent" -> copy key from `toq approvals`, then `toq deny <key>`
- "Send a message to X" -> `toq send toq://host/name "message"`
- "Block that agent" -> get identifier from `toq peers`, then `toq block <address-or-key>`
- "Is toq running?" -> `toq status` or `toq doctor`
