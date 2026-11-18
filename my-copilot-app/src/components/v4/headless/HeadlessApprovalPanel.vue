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
