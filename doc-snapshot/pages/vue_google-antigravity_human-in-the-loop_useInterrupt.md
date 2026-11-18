# Pausing the Agent for Input

> Pause an agent run, hand control to a custom Vue component, and resume with the user's answer.

## What is this? [#what-is-this]

Some agent steps need a person's answer before the run can continue, such as approving a payment or picking a meeting time. `useInterrupt` pauses the run, shows your Vue component, and resumes the run with the answer. How the pause works depends on your agent framework.

Some agent frameworks cannot pause a run mid-tool the way LangGraph's `interrupt()` does. Use `useHumanInTheLoop` for the Promise-based frontend-tool path instead: the agent calls the tool, the client holds the request open, and the Promise resolves once the user answers. The user sees the same flow: the agent pauses, the user answers, and the agent continues. Only the mechanism is different.

## When should I use this? [#when-should-i-use-this]

Reach for `useInterrupt` when the pause is a **graph-enforced checkpoint** where the code path _must_ stop and wait for a human, not an LLM-initiated tool call. Typical cases:

- A sensitive action (payments, irreversible writes) must be approved
- A required piece of state isn't known and can only be collected from the user
- The agent explicitly reaches an approval node in a longer workflow
- You want the server-side contract to be `interrupt(...)` and resume with a payload

For LLM-initiated pauses where the model decides on the fly to ask the user, prefer [`useHumanInTheLoop`](../human-in-the-loop).

## The frontend: `useHumanInTheLoop` with a Promise-resolving handler [#the-frontend-usehumanintheloop-with-a-promise-resolving-handler]

`useHumanInTheLoop` registers a frontend tool whose handler stays pending until the rendered Vue component calls `respond(...)`. This is the frontend-tool equivalent of `useInterrupt`'s `event` / `resolve` pair.

```vue title="src/components/MeetingTool.vue"
<script setup lang="ts">
import { z } from "zod";
import { CopilotChat, useHumanInTheLoop } from "@copilotkit/vue/v2";
import MeetingPicker from "./MeetingPicker.vue";

useHumanInTheLoop({
  name: "schedule_meeting",
  description: "Ask the user to pick a meeting time.",
  parameters: z.object({ topic: z.string() }),
  render: MeetingPicker,
});
</script>

<template>
  <CopilotChat />
</template>
```

The picker receives the tool arguments and a `respond` callback. `respond` is defined only while the tool call is executing:

```vue title="src/components/MeetingPicker.vue"
<script setup lang="ts">
const props = defineProps<{
  args: { topic?: string };
  respond?: (result: unknown) => Promise<void>;
}>();
</script>

<template>
  <section>
    <p>Pick a time for {{ props.args.topic ?? "a call" }}</p>
    <button
      :disabled="!props.respond"
      @click="props.respond?.({ chosen_time: '09:00' })"
    >
      Tomorrow at 09:00
    </button>
    <button :disabled="!props.respond" @click="props.respond?.({ cancelled: true })">
      Cancel
    </button>
  </section>
</template>
```

## The backend: agent instructed to call the frontend tool [#the-backend-agent-instructed-to-call-the-frontend-tool]

The agent has no local implementation for the approval tool. The backend instructs the model to call it when input is required; AG-UI routes the tool call to the client, where the Promise-returning handler takes over.

## AG-UI standard interrupt flow vs. legacy [#ag-ui-standard-interrupt-flow-vs-legacy]

This section is a reference for developers who write interrupt UI for their own agent. The [Vue `useInterrupt` reference](/reference/vue/hooks/useInterrupt) lists every option. `useInterrupt` handles two kinds of interrupt, and your agent framework decides which kind it sends.

### Standard flow (`RUN_FINISHED` with `outcome.type === "interrupt"`) [#standard-flow-run_finished-with-outcometype--interrupt]

When the agent backend conforms to the AG-UI protocol, it signals an interrupt by emitting a `RUN_FINISHED` event whose outcome carries the interrupts array:

```text
outcome.type === "interrupt"
outcome.interrupts  // Interrupt[]
```

The composable detects this on `onRunFinishedEvent` and exposes the interrupts after `onRunFinalized` fires. `slotProps.value` contains:

- **`interrupt`**: the primary `Interrupt` (`interrupts[0]`), with shape `{ id, reason, message?, toolCallId?, responseSchema?, expiresAt?, metadata? }`.
- **`interrupts`**: the full open set.
- **`resolve(payload?, interruptId?)`**: records a resolved response for the targeted interrupt. The run resumes once every open interrupt has a response.
- **`cancel(interruptId?)`**: records a cancelled response for the targeted interrupt. The same accumulate-then-submit logic applies.

### Legacy flow (`on_interrupt` custom event) [#legacy-flow-on_interrupt-custom-event]

Agents can emit a custom `on_interrupt` event. The LangGraph adapter does this by default. The composable exposes its payload in `event.value`, with `interrupt` set to `null` and `interrupts` to `[]`. Calling `resolve(payload)` resumes via `forwardedProps.command`. `cancel()` dismisses the interrupt without resuming because the custom-event flow has no cancel response.

### Priority [#priority]

If both signals appear on the same run, the standard flow wins.

### Approve / Cancel example [#approve--cancel-example]

```vue title="src/components/ApprovalPanel.vue"
<script setup lang="ts">
import { useInterrupt } from "@copilotkit/vue/v2";

const { slotProps } = useInterrupt({ renderInChat: false });
</script>

<template>
  <section v-if="slotProps">
    <p>{{ slotProps.interrupt?.message ?? "Approve this action?" }}</p>
    <button @click="slotProps.resolve({ approved: true })">Approve</button>
    <button @click="slotProps.cancel()">Cancel</button>
  </section>
</template>
```

Both methods return the `RunAgentResult` once the run restarts, or `void` while waiting for responses to other open interrupts.

### Multi-interrupt behavior [#multi-interrupt-behavior]

Some agents issue more than one interrupt in a single run. Each interrupt has its own `id`; address them individually:

```vue
<template>
  <ul v-if="slotProps">
    <li v-for="item in slotProps.interrupts" :key="item.id">
      {{ item.message }}
      <button @click="slotProps.resolve({ ok: true }, item.id)">Approve</button>
      <button @click="slotProps.cancel(item.id)">Cancel</button>
    </li>
  </ul>
</template>
```

The agent run resumes only after **every** open interrupt has been addressed. If you omit `interruptId`, the primary interrupt is targeted; Vue warns when several are open.

### `responseSchema`: surface only, no client-side validation [#responseschema-surface-only-no-client-side-validation]

The `Interrupt` type exposes a `responseSchema` JSON Schema that the agent can use to describe the expected payload. `useInterrupt` surfaces it on `interrupt.responseSchema` for your UI to read, but it does **not** validate `resolve` payloads against it. Validation is the agent's responsibility on resume.

## Provider setup [#provider-setup-1]

The component calling `useHumanInTheLoop` must be a descendant of `CopilotKitProvider`:

```vue title="src/App.vue"
<script setup lang="ts">
import { CopilotKitProvider } from "@copilotkit/vue/v2";
import MeetingTool from "./components/MeetingTool.vue";
</script>

<template>
  <CopilotKitProvider runtime-url="/api/copilotkit">
    <MeetingTool />
  </CopilotKitProvider>
</template>
```

Ask the agent to book a call. The picker appears in the chat. Click **Tomorrow at 09:00**, and the agent continues with your choice.
