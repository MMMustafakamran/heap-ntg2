# Shared State

> Create a two-way connection between your UI and agent state.

## What is shared state? [#what-is-shared-state]

Shared state connects your UI with the agent's run. With shared state you can:

- Display the agent's current progress and intermediate results
- Update the agent's state through UI interactions
- React to state changes in real-time across your application

<ImageZoom
  src="https://cdn.copilotkit.ai/docs/copilotkit/images/coagents/SharedStateCoAgents.gif"
  alt="Shared State Demo"
  width={1000}
  height={1000}
  className="rounded-lg shadow-lg border mt-0"
/>

## When should I use this? [#when-should-i-use-this]

Use shared state when you want the agent and the user to collaborate through the same application state. The agent's outputs are reflected in the UI, and user updates in the UI are reflected in the agent's execution.

<OpsPlatformCTA
  variant="inline"
  title="Building stateful agents?"
  body="Persistent threads ship with CopilotKit Intelligence on the free Developer tier."
  surface="docs_shared_state"
/>

## Reading agent state [#reading-agent-state]

<Steps>
  <Step>
    ### Turn on `get_shared_state` and tell the model to read it

    Antigravity sets an agent's instructions once, when the harness session
    starts, and the adapter forwards only the user's messages. Shared state
    therefore never reaches the prompt on its own. Instead, pass
    `experimental_app_state=True` to `AntigravityAgent`. It gives the agent a
    built-in `get_shared_state()` tool that returns the thread's shared state: what the UI sent with the current run (including edits made
    with `agent.setState`), or what a server tool last stored, whichever is
    newer. Say in the system instructions when to call it:

~~~~python title="shared_state.py"
READ_WRITE_PROMPT = (
    "You are a helpful, concise assistant. Call `get_shared_state` before "
    "every answer. Its `preferences` object holds the user's name, preferred "
    "tone, language and interests, which the user edits in the app: always "
    "respect them, and address the user by name when you know it. Its "
    "`notes` list holds what you have remembered so far. "
    "When the user asks you to remember something, or when you observe "
    "something worth surfacing in the UI, call `set_notes` with the FULL "
    "updated list of short note strings (existing notes + new)."
)


def shared_state_read_write_agent():
    return build(
        system_instructions=READ_WRITE_PROMPT,
        tools=[set_notes],
        experimental_app_state=True,
    )


~~~~

    The tool is silent: it emits no `TOOL_CALL_*` events, so no tool card
    appears in the chat. A tool of your own with the same name replaces it.

  </Step>
  <Step>
    ### Write state from a server tool

    Server tools are plain Python functions passed as `tools=[...]`. Inside
    one, the adapter's `experimental_get_state()` returns the thread's shared state and
    `experimental_set_state()` replaces it. `experimental_set_state()` streams a `STATE_SNAPSHOT` to the
    browser straight away, before the tool's own result, so any component
    subscribed with `useAgent` re-renders while the agent is still running.

~~~~python title="shared_state.py"
def set_notes(notes: list[str]) -> str:
    """Replace the notes array in shared state with the full updated list.

    Use this tool whenever the user asks you to "remember" something, or
    when you have an observation about the user worth surfacing in the
    UI's notes panel. Always pass the FULL notes list (existing notes +
    any new ones), not a diff. Keep each note short (< 120 chars).
    """
    experimental_set_state({**experimental_get_state(), "notes": notes})
    return "Notes updated."


~~~~

    Spread `experimental_get_state()` into the new value, as above: `experimental_set_state()` replaces
    the whole object, so leaving it out drops the keys the UI owns, such as
    `preferences`. Both helpers work only inside a server tool, where the
    adapter knows which thread the call belongs to. Called anywhere else, they
    raise.

  </Step>
</Steps>

<Callout type="warn" title="The model sees state only when it asks">
  Other frameworks can fold the UI's state into the system prompt on every
  run. With Antigravity the model has to call `get_shared_state`. If the
  instructions do not tell it to, UI edits do not reach that answer.
</Callout>

<Callout type="info" title="Experimental">
  `experimental_app_state`, `experimental_get_state()` and
  `experimental_set_state()` are experimental. Their names and behaviour may
  change in a later release of the adapter.
</Callout>

Subscribe a component to the agent's state with `useAgent`. Any time the agent mutates its state, for example via a tool call, the composable updates its reactive `agent` ref and your UI re-renders with the new values.

```vue title="src/components/SharedWorkspace.vue"
<script setup lang="ts">
import { computed } from "vue";
import { useAgent, UseAgentUpdate } from "@copilotkit/vue/v2";

type WorkspaceState = {
  notes?: string[];
  preferences?: { tone?: string };
};

const { agent } = useAgent({
  agentId: "workspace",
  updates: [UseAgentUpdate.OnStateChanged],
});
const state = computed(
  () => (agent.value?.state ?? {}) as WorkspaceState,
);
</script>

<template>
  <ul>
    <li v-for="note in state.notes ?? []" :key="note">{{ note }}</li>
  </ul>
</template>
```

The returned `agent.value.state` is a plain object. Read it like any other reactive application data and render the parts you care about: agent-written notes, structured outputs, progress indicators, or anything else the agent has put there.

## Writing agent state [#writing-agent-state]

The same agent object exposes `setState`. Calling it from a UI event handler pushes the new value into shared state, and the agent reads it back on its next turn. The UI's writes visibly steer the model.

```vue title="src/components/SharedWorkspace.vue"
<script setup lang="ts">
function setTone(tone: string) {
  const current = agent.value;
  if (!current) return;

  const previous = (current.state ?? {}) as WorkspaceState;
  current.setState({
    ...previous,
    preferences: { ...previous.preferences, tone },
  });
}
</script>

<template>
  <button @click="setTone('concise')">Prefer concise answers</button>
</template>
```

The UI can also send the agent new inputs, such as preferences, selections, or partial work, without the chat.

## Rendering shared state in the UI [#rendering-shared-state-in-the-ui]

Because `agent.state` is plain data exposed through a Vue ref, the UI layer is ordinary Vue. The example above wires the agent's outputs into a list and feeds user edits back through `setState`.

Nothing about this is chat-specific: `useAgent` works in any component under `CopilotKitProvider`, so you can render shared state in your main view or canvas, not just inside the chat panel. See **[Render agent state in your app](/vue/shared-state/rendering-in-app)** for the full main-view pattern.

```vue title="src/App.vue"
<script setup lang="ts">
import { CopilotChat, CopilotKitProvider } from "@copilotkit/vue/v2";
import SharedWorkspace from "./components/SharedWorkspace.vue";
</script>

<template>
  <CopilotKitProvider runtime-url="/api/copilotkit">
    <SharedWorkspace />
    <CopilotChat agent-id="workspace" />
  </CopilotKitProvider>
</template>
```

## Streaming partial state updates [#streaming-partial-state-updates]

By default, shared state only updates *between* backend checkpoints, so a long-running tool call appears as one big burst at the end. State streaming copies a tool argument into a state key while the model writes it, so the UI can watch the answer assemble token-by-token. The sample below is the LangGraph (Python) version.

> **Not available for Google Antigravity yet.** The Shared State: Streaming demo for Google Antigravity can't run yet, so its code isn't shown here.

See **[State streaming](/vue/shared-state/streaming)** for the full walkthrough, including the corresponding `useAgent` subscription on the frontend.

## Read-only context [#read-only-context]

When a value is **UI-owned** and the agent should read it but never write it back, such as current user, selected record, or scroll position, reach for `useAgentContext` instead of full shared state. It publishes values as a one-way UI-to-agent channel that auto-unregisters on unmount.

`useAgentContext` is a separate read-only capability; it does not replace the bidirectional `agent.state` / `agent.setState(...)` contract above.

See **[Agent read-only context](/vue/shared-state/agent-readonly)** for the full pattern.

<IntegrationGrid path="shared-state" exclude={["agno", "agent-spec", "spring-ai", "langroid"]} />
