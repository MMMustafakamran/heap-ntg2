<script setup lang="ts">
import { CopilotChat, CopilotKitProvider } from "@copilotkit/vue/v2";
import HeadlessApprovalPanel from "../components/v4/headless/HeadlessApprovalPanel.vue";
</script>

<template>
  <!-- HARNESS: doc runtime-url="/api/copilotkit" (404 on Vite). The page shows no backend, so the agent is the quickstart Antigravity agent (V1 runtime 8146, "default" -> backend/main.py copy on 8142). -->
  <CopilotKitProvider runtime-url="http://localhost:8146/api/copilotkit">
    <HeadlessApprovalPanel />
    <CopilotChat />
  </CopilotKitProvider>
</template>
