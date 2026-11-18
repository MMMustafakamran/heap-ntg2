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
