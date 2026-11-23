<script lang="ts">
  import { page } from "$app/state";
  import PageHead from "#lib/design/PageHead.svelte";
  let { data, children } = $props();
  const tabs = [
    { href: "/admin/names", label: "names" },
    { href: "/admin/servers", label: "hidden servers" },
    { href: "/admin/players", label: "hidden players" }
  ];
</script>

{#if data.admin}
  <PageHead path="admin" cmd="ls" args="--tabs" title="admin">
    <nav class="admin-tabs" aria-label="Admin">
      <div class="seg">
        {#each tabs as t (t.href)}
          <a href={t.href} aria-current={page.url.pathname === t.href ? "page" : undefined}>{t.label}</a>
        {/each}
      </div>
      <form method="POST" action="/admin?/logout">
        <input type="hidden" name="csrf" value={data.admin.csrf} />
        <button class="ink c5" type="submit">sign out</button>
      </form>
    </nav>
  </PageHead>
{/if}
{@render children()}

<style>
  .admin-tabs { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); flex-wrap: wrap; }
  .admin-tabs form { margin: 0; }
</style>
