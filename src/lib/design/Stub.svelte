<script lang="ts">
  // Marks a page skeleton until its unit lands. Remove with the unit's PR.
  let { unit, what }: { unit: string; what: string } = $props();
</script>

<p class="cap">Skeleton: {what} is built by {unit}.</p>
