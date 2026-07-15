<script setup>
import { Pencil, Trash2, LockKeyhole } from 'lucide-vue-next';

defineProps({
  disabled: { type: Boolean, default: false },
  compact: { type: Boolean, default: false }
});
defineEmits(['edit', 'remove']);
</script>

<template>
  <div class="admin-actions" :class="{ compact }">
    <span v-if="disabled" class="locked-action" title="Closed cycles cannot be changed"><LockKeyhole :size="14"/> Locked</span>
    <template v-else>
      <button type="button" class="edit-action" @click="$emit('edit')"><Pencil :size="14"/><span>Edit</span></button>
      <button type="button" class="delete-action" @click="$emit('remove')"><Trash2 :size="14"/><span>Delete</span></button>
    </template>
  </div>
</template>

<style scoped>
.admin-actions{display:flex;align-items:center;gap:6px;white-space:nowrap}.admin-actions button{height:32px;border-radius:8px;padding:0 10px;border:1px solid #e5e5eb;background:#fff;display:inline-flex;align-items:center;gap:6px;font-size:10px;font-weight:700;transition:.18s}.edit-action{color:#6555dc}.edit-action:hover{background:#f5f3ff;border-color:#cfc9ff}.delete-action{color:#d35454}.delete-action:hover{background:#fff3f3;border-color:#ffcaca}.locked-action{display:inline-flex;align-items:center;gap:5px;color:#9a9ba6;font-size:10px;background:#f4f4f7;border-radius:8px;padding:7px 9px}.compact button{width:32px;padding:0;justify-content:center}.compact button span{display:none}
</style>
