<script lang="ts">
  import { page } from "$app/state";
  let { data, children } = $props();
  const tabs = [
    { href: "/admin/names", label: "Names" },
    { href: "/admin/servers", label: "Hidden servers" },
    { href: "/admin/players", label: "Hidden players" }
  ];
</script>

<div class="fp-page">
  {#if data.admin}
    <nav class="admin-tabs" aria-label="Admin">
      <div class="fp-seg">
        {#each tabs as t (t.href)}
          <a href={t.href} aria-current={page.url.pathname === t.href ? "page" : undefined}>{t.label}</a>
        {/each}
      </div>
      <form method="POST" action="/admin?/logout">
        <input type="hidden" name="csrf" value={data.admin.csrf} />
        <button class="fp-btn fp-btn--quiet" type="submit">Sign out</button>
      </form>
    </nav>
  {/if}
  {@render children()}
</div>

<style>
  .admin-tabs { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); flex-wrap: wrap; }
</style>
