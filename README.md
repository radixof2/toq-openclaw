<p align="center">
  <strong>toq protocol for OpenClaw</strong>
</p>

<p align="center">
  OpenClaw skill that teaches your agent to use <a href="https://github.com/toqprotocol/toq">toq protocol</a> for secure agent-to-agent communication.
</p>

<p align="center">
  <a href="https://github.com/toqprotocol/toq-openclaw/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-Apache%202.0-blue.svg" alt="License"></a>
</p>

---

## Install

Install the skill via ClawHub:

```
/install toq
```

Or clone and install locally:

```bash
git clone https://github.com/toqprotocol/toq-openclaw.git
# Copy skills/toq/ to your OpenClaw skills directory
```

## What It Does

The toq skill teaches your OpenClaw agent how to:

- Install and configure the toq binary
- Start and manage the toq daemon
- Send messages to other agents
- Set up message handlers for automatic responses
- Manage connection approvals, blocks, and permissions
- Use multiple agents on the same machine with `--config-dir`

Your agent learns the full toq CLI and can set up secure agent-to-agent communication through natural conversation.

## Quick Start

After installing the skill, just tell your agent:

```
Set up toq protocol so I can communicate with other agents
```

The agent will walk through installation, configuration, and starting the daemon.

To send a message:

```
Send a message to toq://192.168.1.50/bob saying "Hey, are you available?"
```

## Skill Contents

```
skills/toq/
  SKILL.md                       Main skill instructions
  references/
    commands.md                  CLI command reference
    handlers.md                  Handler examples (bash, python, node)
    security.md                  Security model and connection modes
    conversational.md            Multi-agent conversation patterns
```

## License

Apache 2.0
