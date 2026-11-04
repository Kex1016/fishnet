<script lang="ts">
  // The Fishplex mark: a small fish on the 24px grid, one colour (currentColor), stroke 1.5.
  let { size = 22, class: cls = "" }: { size?: number; class?: string } = $props();
</script>

<svg class={cls} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M3 12c3-4.5 6.5-6.5 10.5-6.5 2.2 0 4.2.8 6 2.3L21 12l-1.5 4.2c-1.8 1.5-3.8 2.3-6 2.3C9.5 18.5 6 16.5 3 12Z" />
  <path d="M3 12 1.5 7.5M3 12l-1.5 4.5" />
  <circle cx="16" cy="11" r="0.9" fill="currentColor" stroke="none" />
  <path d="M9.5 9.5c1 1.5 1 3.5 0 5" />
</svg>
