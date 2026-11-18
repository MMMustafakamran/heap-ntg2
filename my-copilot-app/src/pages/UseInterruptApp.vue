<script setup lang="ts">
import { CopilotKitProvider } from "@copilotkit/vue/v2";
import MeetingTool from "../components/v4/interrupt/MeetingTool.vue";
</script>

<template>
  <!-- HARNESS: doc runtime-url="/api/copilotkit" (404 on Vite). The page's backend section has no code, so the agent is the quickstart Antigravity agent (V1 runtime 8146, "default" -> backend/main.py copy on 8142). -->
  <CopilotKitProvider runtime-url="http://localhost:8146/api/copilotkit">
    <MeetingTool />
  </CopilotKitProvider>
</template>
