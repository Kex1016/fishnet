<script lang="ts">
  // haiiro's Progress: a label, a number and a hairline bar. `share` is 0..1. A breakdown (a server's minis
  // under the server) indents its lines with `indent`; breakdown lines never add up to the line above.
  let {
    label,
    value,
    share,
    ink,
    indent = 0
  }: { label: string; /** the formatted number on the right */ value?: string; share: number; /** an ink class for the label: "c6", "c3" */ ink?: string; /** levels of indent, 0 = none */ indent?: number } = $props();
  const width = $derived(`${Math.round(Math.max(0, Math.min(1, share)) * 1000) / 10}%`);
</script>

<div class="progress" style={indent ? `padding-left: ${indent * 16}px` : undefined}>
  <div class="progress_head"><span class={ink}>{label}</span>{#if value}<span class="progress_num">{value}</span>{/if}</div>
  <div class="progress_track"><div class="progress_fill" style="width: {width}"></div></div>
</div>
