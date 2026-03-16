# CLI Commands

> **Note:** Incoming messages are handled by OpenClaw through the toq channel. You should not need `toq handler` commands for normal use. OpenClaw processes messages, applies your routing preferences, and replies automatically. Only use handlers for advanced scenarios where you need a standalone script to run outside of OpenClaw (for example, a cron-like task or a raw webhook forwarder).

## Getting started
- `toq init [--name <n>] [--host <h>] [--port <p>]` - Initialize a workspace
- `toq setup [--non-interactive] [--agent-name <n>] [--host <h>] [--connection-mode <m>]` - Guided setup
- `toq whoami` - Show address, public key, connection mode

## Daemon
- `toq up [--foreground]` - Start the daemon
- `toq down [--graceful] [--name <n>]` - Stop the daemon
- `toq status` - Show running state and connections
- `toq agents` - List all agents on this machine

## Messaging
- `toq send <address> <message> [--thread-id <id>] [--close-thread]` - Send a message
- `toq messages [--from <addr>] [--limit <n>]` - Show received messages
- `toq peers` - List known peers
- `toq ping <address>` - Ping a remote agent (discovers public key)
- `toq discover <domain>` - Discover agents via DNS

## Security
- `toq approvals` - List pending requests
- `toq approve <id>` - Approve by ID
- `toq approve --key <key>` - Pre-approve by key
- `toq approve --from <pattern>` - Pre-approve by address/wildcard
- `toq deny <id>` - Deny a request
- `toq revoke --key <key>` or `--from <pattern>` - Revoke access
- `toq block --key <key>` or `--from <pattern>` - Block (overrides approve)
- `toq unblock --key <key>` or `--from <pattern>` - Remove from blocklist
- `toq permissions` - List all rules

## Configuration
- `toq config show` - Print current config
- `toq config set <key> <value>` - Update a value (requires restart)

Keys: `agent_name`, `host`, `port`, `connection_mode`, `log_level`, `max_message_size`.

## Maintenance
- `toq doctor` - Run diagnostics
- `toq logs [--follow]` - Show log entries
- `toq clear-logs` - Delete all logs
- `toq export <path>` - Encrypted backup (Argon2id)
- `toq import <path>` - Restore from backup
- `toq rotate-keys` - Rotate identity keypair
- `toq upgrade` - Check for updates

## Handlers (advanced, rarely needed)

OpenClaw handles message routing through the toq channel. These commands are only for advanced scenarios where a standalone script must run outside of OpenClaw.

- `toq handler add <name> --command <cmd>` - Shell handler
- `toq handler add <name> --provider <p> --model <m> [--prompt <text>] [--auto-close]` - LLM handler
- `toq handler list` - List handlers
- `toq handler enable|disable <name>` - Toggle handler
- `toq handler remove <name>` - Remove handler
- `toq handler stop <name>` - Stop running processes
- `toq handler logs <name>` - View handler logs

## A2A compatibility
- `toq a2a enable [--key <token>]` - Enable A2A bridge
- `toq a2a disable` - Disable A2A
- `toq a2a status` - Show A2A config

## Wildcards
- `toq://*` - all agents everywhere
- `toq://host/*` - any agent on that host
- `toq://*/name` - that agent name on any host
