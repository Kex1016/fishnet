<script lang="ts">
  import Notice from "#lib/design/Notice.svelte";
  import PageHead from "#lib/design/PageHead.svelte";
  import Window from "#lib/design/Window.svelte";
  let { form } = $props();
</script>

<PageHead path="admin" cmd="sudo" args="login" title="sign in" lede="Paste the admin token to change stat names and the hidden servers and players. Everyone else sees the site as it is." />

<Window path="admin" args="--login">
  <form method="POST" action="?/login" class="login">
    {#if form?.error}<Notice kind="error">{form.error}</Notice>{/if}
    <label for="token">admin token</label>
    <input id="token" name="token" type="password" autocomplete="current-password" required maxlength="512" />
    <div><button class="ink c3" type="submit">sign in</button></div>
  </form>
</Window>

<style>
  .login { display: flex; flex-direction: column; gap: var(--space-3); max-width: 420px; }
  .login input { width: 100%; min-height: var(--touch); padding: 0 var(--space-2); border: var(--border-hairline) solid var(--color-text); background: var(--color-base); color: var(--color-text); border-radius: var(--radius-none); }
  .login label { color: var(--ink-muted); }
</style>
