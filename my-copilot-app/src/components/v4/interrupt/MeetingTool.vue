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
