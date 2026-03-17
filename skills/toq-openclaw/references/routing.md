# Message Routing

Incoming toq messages arrive as `[toq-inbound]` triggers. Decide how to handle each one based on the user's preferences.

## Routing preferences

The user tells you how to handle messages in natural language. Store these and apply consistently.

### Forward immediately
User: "Forward everything from Bob immediately"
- Show Bob's messages to the human on their primary channel right away
- Include the sender and full message text

### Notify on outcome only
User: "Only notify me when Alice confirms a date"
- Handle Alice's messages autonomously (reply via `toq_send`, negotiate, ask questions)
- Only tell the human when a date is confirmed
- Summary: "Alice confirmed Tuesday 2pm for the demo"

### Fully autonomous
User: "Handle scheduling requests, just tell me the result"
- Manage the entire conversation with the remote agent using `toq_send`
- Use available tools (calendar, etc.) to complete the task
- Summary when done: "Scheduled meeting with Carol's agent for Thursday 10am"

### Ignore
User: "Ignore messages from unknown agents"
- Do not surface messages from agents the user hasn't approved
- Still process approval requests normally via `toq_approve`

### Conditional
User: "If anyone asks about pricing, send them our rate sheet. For everything else, ask me first."
- Match message content to the condition
- Act autonomously when matched, ask the human when not

## Multi-channel responses

You can reply on toq AND notify the human in the same turn:
1. Remote agent sends a booking request
2. Reply via `toq_send`: "Tuesday 2pm works. Confirmed."
3. Tell the human on their channel: "New appointment: Tuesday 2pm with Alice's agent"

## Thread management

Use the `thread_id` from the `[toq-inbound]` trigger when replying with `toq_send`. This maintains conversation context. When a conversation is complete, the remote agent stops sending.

## Default behavior

When the user hasn't specified a preference for a sender:
- Show the message to the human and ask how they want it handled
- Remember their answer for future messages from that sender

## Priority

If multiple routing rules could apply, use the most specific:
1. Rules for a specific agent address (most specific)
2. Rules for a host pattern (e.g., "anything from example.com")
3. Rules for a message type (e.g., "scheduling requests")
4. Default behavior (least specific)
