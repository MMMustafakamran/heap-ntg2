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
