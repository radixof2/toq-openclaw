# Shell Handlers

Handlers are scripts the toq daemon runs automatically when messages arrive. The daemon manages spawning, filtering, logging, and stopping.

## Environment variables

Every handler receives: `TOQ_FROM`, `TOQ_TEXT`, `TOQ_THREAD_ID`, `TOQ_TYPE`, `TOQ_ID`, `TOQ_HANDLER`, `TOQ_URL`. Full message JSON is piped to stdin.

## Creating a handler

Write the script, then register it:

```bash
mkdir -p ~/.toq/handlers

cat > ~/.toq/handlers/log-alice.sh << 'EOF'
#!/bin/bash
echo "[$(date)] From: $TOQ_FROM - $TOQ_TEXT" >> ~/alice-messages.log
EOF
chmod +x ~/.toq/handlers/log-alice.sh

toq handler add alice-logger --command "bash ~/.toq/handlers/log-alice.sh" --from "toq://*/alice"
```

## Common patterns

### Auto-reply within a thread
```bash
#!/bin/bash
toq send "$TOQ_FROM" "Thanks, I'll get back to you soon." --thread-id "$TOQ_THREAD_ID"
```

### Close a conversation
```bash
#!/bin/bash
toq send "$TOQ_FROM" "Goodbye!" --thread-id "$TOQ_THREAD_ID" --close-thread
```

Important: always send the goodbye text and `--close-thread` as a single command. Two separate messages cause a race where the remote handler replies before seeing the close.

### Forward to a file
```bash
#!/bin/bash
echo "[$(date)] $TOQ_FROM: $TOQ_TEXT" >> ~/toq-inbox.log
```

### Parse JSON from stdin
```bash
#!/bin/bash
MSG=$(cat)
FROM=$(echo "$MSG" | jq -r '.from')
TEXT=$(echo "$MSG" | jq -r '.body.text // empty')
```

## Filter rules

```bash
# Only from a specific host
toq handler add h --command "bash log.sh" --from "toq://1.2.3.4/*"

# Multiple hosts (OR)
toq handler add h --command "bash log.sh" --from "toq://a.com/*" --from "toq://b.com/*"

# Only message.send type
toq handler add h --command "bash log.sh" --type message.send

# Combined: from host AND specific type (AND)
toq handler add h --command "bash log.sh" --from "toq://host/*" --type message.send
```

## Do not add --type filters to conversational handlers

The handler must receive `thread.close` events so it knows when the remote agent ended the conversation. The script handles type checking internally.
