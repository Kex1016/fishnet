<script lang="ts">
  import Notice from "#lib/design/Notice.svelte";
  let { form } = $props();
</script>

<header class="fp-hero">
  <span class="t-kicker">Admin</span>
  <h1 class="t-display">Sign in</h1>
  <p class="fp-lede">Paste the admin token to change stat names and the hidden servers and players. Everyone else sees the site as it is.</p>
</header>

<form method="POST" action="?/login" class="login">
  {#if form?.error}<Notice kind="error">{form.error}</Notice>{/if}
  <label class="t-kicker" for="token">Admin token</label>
  <div class="fp-field">
    <input id="token" name="token" type="password" autocomplete="current-password" required maxlength="512" />
  </div>
  <div><button class="fp-btn fp-btn--primary" type="submit">Sign in</button></div>
</form>

<style>
  .login { display: flex; flex-direction: column; gap: var(--space-3); max-width: 420px; }
</style>
