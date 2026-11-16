<script setup lang="ts">
import { CopilotKitProvider, CopilotChat } from "@copilotkit/vue/v2";
</script>

<template>
  <!-- HARNESS: port 8140 is this repo's runtime (doc: 8200; QA-RULES 4, per-repo ports). -->
  <CopilotKitProvider
    runtime-url="http://localhost:8140/api/copilotkit"
  >
    <div style="height: 100vh">
      <CopilotChat />
    </div>
  </CopilotKitProvider>
</template>
