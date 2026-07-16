<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { ChevronDown } from 'lucide-vue-next';

const props = defineProps({ modelValue: { default: null }, options: { type: Array, default: () => [] }, placeholder: { type: String, default: 'Search or select' } });
const emit = defineEmits(['update:modelValue', 'change']);
const root = ref(null), open = ref(false), query = ref('');
const selected = computed(() => props.options.find((item) => String(item.value) === String(props.modelValue)));
const filtered = computed(() => { const terms=query.value.toLowerCase().trim().split(/\s+/).filter(Boolean); return props.options.filter((item) => !item.disabled && terms.every((term) => item.label.toLowerCase().includes(term))); });
function choose(item) { emit('update:modelValue', item.value); emit('change', item.value); query.value = ''; open.value = false; }
function closeOnOutside(event) { if (open.value && root.value && !root.value.contains(event.target)) { open.value = false; query.value = ''; } }
onMounted(() => document.addEventListener('pointerdown', closeOnOutside));
onBeforeUnmount(() => document.removeEventListener('pointerdown', closeOnOutside));
</script>

<template>
  <div ref="root" class="search-select">
    <input :value="open ? query : (selected?.label || '')" :placeholder="placeholder" @focus="open=true;query=''" @input="open=true;query=$event.target.value" />
    <ChevronDown :size="15" />
    <div v-if="open" class="search-select-options">
      <button v-for="item in filtered" :key="String(item.value)" type="button" @mousedown.prevent="choose(item)">{{ item.label }}</button>
      <span v-if="!filtered.length">No matching options</span>
    </div>
  </div>
</template>

<style scoped>
.search-select{position:relative}.search-select>svg{position:absolute;right:10px;top:13px;color:#8b8d9b;pointer-events:none}.search-select input{padding-right:30px}.search-select-options{position:absolute;top:calc(100% + 4px);z-index:60;width:100%;max-height:230px;overflow:auto;padding:5px;background:#fff;border:1px solid #e5e5eb;border-radius:10px;box-shadow:0 14px 30px #20212d22}.search-select-options button{width:100%;border:0;background:transparent;border-radius:7px;padding:9px;text-align:left;font:inherit;font-size:12px;color:#343540}.search-select-options button:hover{background:#f1efff;color:#5140d5}.search-select-options span{display:block;padding:9px;font-size:11px;color:#8b8d9b}
</style>
