# Tools and CLI Reference

## Tools (preferred)

Use these tools for all toq operations. They call the toq SDK directly.

### toq_send
Send a message to a remote agent.
- `address` (required): remote agent address, e.g., `toq://host/agent`
- `text` (required): message text
- `thread_id` (optional): continue an existing conversation
- `endpoint` (optional): local endpoint name, default: "default"

### toq_status
Check daemon health.
- `endpoint` (optional): endpoint name

### toq_peers
List known peers.
- `endpoint` (optional): endpoint name

### toq_approve
Approve a pending connection request.
- `id` (required): peer ID to approve
- `endpoint` (optional): endpoint name

### toq_block
Block a peer from connecting.
- `id` (required): peer ID to block
- `endpoint` (optional): endpoint name

## CLI (for setup and advanced tasks)

These commands are used during setup or for operations not covered by tools.

- `toq setup [--non-interactive] [--agent-name <n>] [--host <h>] [--connection-mode <m>]` - Guided setup
- `toq up [--foreground]` - Start the daemon
- `toq down [--graceful]` - Stop the daemon
- `toq doctor` - Run diagnostics
- `toq whoami` - Show address and public key
- `toq config show` - Print current config
- `toq config set <key> <value>` - Update a config value (requires restart)
- `toq export <path>` - Encrypted backup (Argon2id)
- `toq import <path>` - Restore from backup
- `toq rotate-keys` - Rotate identity keypair
- `toq upgrade` - Check for updates
