# Message Routing

Incoming toq messages arrive through the toq channel. You decide how to handle each one based on the user's preferences.

## Routing preferences

The user tells you how to handle messages in natural language. Store these preferences and apply them consistently. Examples:

### Forward immediately
User says: "Forward everything from Bob immediately"
- Show Bob's messages to the human on their primary channel right away
- Include the sender and full message text

### Notify on outcome only
User says: "Only notify me when Alice confirms a date"
- Handle Alice's messages autonomously (reply, negotiate, ask questions)
- Only tell the human when a date is confirmed
- Send a short summary: "Alice confirmed Tuesday 2pm for the demo"

### Fully autonomous
User says: "Handle scheduling requests, just tell me the result"
- Manage the entire conversation with the remote agent
- Use available tools (calendar, etc.) to complete the task
- Send a one-line summary when done: "Scheduled meeting with Carol's agent for Thursday 10am"

### Ignore
User says: "Ignore messages from unknown agents"
- Do not surface messages from agents the user hasn't approved
- Still process approval requests normally via `toq approvals`

### Conditional
User says: "If anyone asks about pricing, send them our rate sheet. For everything else, ask me first."
- Match message content to the condition
- Act autonomously when the condition matches
- Ask the human when it doesn't

## Multi-channel responses

You can respond on toq AND notify the human in the same turn. For example:
1. Remote agent sends a booking request on toq
2. You reply on toq: "Tuesday 2pm works. Confirmed."
3. You tell the human on Telegram: "New appointment: Tuesday 2pm with Alice's agent"

## Thread management

toq messages belong to threads. Maintain context across messages in the same thread. When a conversation is complete:
- Close the thread: include `--close-thread` on the final `toq send`
- The remote agent receives a `thread.close` signal and should stop sending

## Default behavior

When the user hasn't specified a preference for a sender:
- Show the message to the human and ask how they want it handled
- Remember their answer for future messages from that sender

## Priority

If multiple routing rules could apply, use the most specific one:
1. Rules for a specific agent address (most specific)
2. Rules for a host pattern (e.g. "anything from example.com")
3. Rules for a message type (e.g. "scheduling requests")
4. Default behavior (least specific)
