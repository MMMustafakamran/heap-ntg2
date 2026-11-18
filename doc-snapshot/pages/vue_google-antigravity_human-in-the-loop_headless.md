# Headless Interrupts

> Resolve agent interrupts from any UI, without a chat interrupt slot.

## What is this? [#what-is-this]

Some approvals belong outside the chat, such as a dashboard button, a modal, or a test fixture. This page shows how to render the pending request anywhere in your Vue tree. The UI can be a button grid, a form, a modal, or a keyboard shortcut.

For promise-based integrations there is no native interrupt primitive. Build the same headless experience with [`useHumanInTheLoop`](/vue/human-in-the-loop):

- The frontend-tool handler holds a Promise open.
- Your application state renders the picker outside the chat.
- The user's answer resolves the tool call.

## When should I use this? [#when-should-i-use-this]

- **Testing / Playwright fixtures**: a deterministic, chat-less button grid is easier to drive than a picker that appears after an LLM call.
- **Non-chat UIs**: dashboards, side panels, inspector surfaces, or any place where you want the agent's interrupt without the transcript.
- **Custom flow control**: when you need to know exactly when the interrupt arrived and when it was resolved.
- **Research / debugging**: when you want to observe raw interrupt state without the chat abstraction.

If you just want a picker in chat, use [`useInterrupt`](./useInterrupt) with the default `renderInChat: true` and the `#interrupt` slot.

## The primitives [#the-primitives-1]

Register a `useHumanInTheLoop` tool with a Vue render component that reflects the pending request into application state. The tool's handler remains pending until something calls `respond(...)`. No runtime interrupt is involved.

Keep the pending request in a shared ref:

```ts title="src/approval-store.ts"
import { ref } from "vue";

export const pendingApproval = ref<{
  toolCallId: string;
  reason: string;
  respond: (result: unknown) => Promise<void>;
} | null>(null);
```

The render component receives `respond` only while the tool call is executing. It hands the request to the store and renders nothing in the chat:

```vue title="src/components/ApprovalBridge.vue"
<script setup lang="ts">
import { watchEffect } from "vue";
import { pendingApproval } from "../approval-store";

const props = defineProps<{
  toolCallId: string;
  args: { reason?: string };
  respond?: (result: unknown) => Promise<void>;
}>();

watchEffect(() => {
  if (props.respond) {
    pendingApproval.value = {
      toolCallId: props.toolCallId,
      reason: props.args.reason ?? "",
      respond: props.respond,
    };
  }
});
</script>

<template></template>
```

Register the tool, and render the picker from the store anywhere in your app:

```vue title="src/components/HeadlessApprovalPanel.vue"
<script setup lang="ts">
import { z } from "zod";
import { useHumanInTheLoop } from "@copilotkit/vue/v2";
import ApprovalBridge from "./ApprovalBridge.vue";
import { pendingApproval } from "../approval-store";

useHumanInTheLoop({
  name: "request_approval",
  description: "Ask the user to approve an action before it runs.",
  parameters: z.object({ reason: z.string() }),
  render: ApprovalBridge,
});

async function answer(approved: boolean) {
  const pending = pendingApproval.value;
  if (!pending) return;
  pendingApproval.value = null;
  await pending.respond({ approved });
}
</script>

<template>
  <section v-if="pendingApproval">
    <p>{{ pendingApproval.reason }}</p>
    <button @click="answer(true)">Approve</button>
    <button @click="answer(false)">Reject</button>
  </section>
</template>
```

Keep these rules:

- If the agent can call the tool several times at once, key pending requests by tool-call id.
- Clear the pending state after the user responds.
- If the picker lives elsewhere, render nothing from the render component.

## Provider setup [#provider-setup]

The chat renders tool calls, so it mounts the render component. Keep `<CopilotChat>` mounted, even if the picker lives elsewhere:

```vue title="src/App.vue"
<script setup lang="ts">
import { CopilotChat, CopilotKitProvider } from "@copilotkit/vue/v2";
import HeadlessApprovalPanel from "./components/HeadlessApprovalPanel.vue";
</script>

<template>
  <CopilotKitProvider runtime-url="/api/copilotkit">
    <HeadlessApprovalPanel />
    <CopilotChat />
  </CopilotKitProvider>
</template>
```

Ask the agent to do something that needs approval. The panel shows the reason with Approve and Reject. Click **Approve**, and the agent continues with `{ approved: true }`.
