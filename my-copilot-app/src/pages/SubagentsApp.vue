<script setup lang="ts">
// ADDED: the Sub-Agents page's "Rendering a live delegation log" section has no code at all.
// ADDED: plain provider + chat (quickstart) against the page's subagents.py supervisor.
import { CopilotChat, CopilotKitProvider } from "@copilotkit/vue/v2";
</script>
<template>
  <!-- CHANGED: V4 runtime on 8149 -> backend 8145/subagents -->
  <CopilotKitProvider runtime-url="http://localhost:8149/subagents/api/copilotkit">
    <CopilotChat />
  </CopilotKitProvider>
</template>
