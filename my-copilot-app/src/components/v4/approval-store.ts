import { ref } from "vue";

export const pendingApproval = ref<{
  toolCallId: string;
  reason: string;
  respond: (result: unknown) => Promise<void>;
} | null>(null);
