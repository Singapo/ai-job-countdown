import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { parse } from 'yaml';
import { Context } from '@deepseek-ai/cordis';
import { SkillRegistry } from '@deepseek-ai/dsh-skill';
import * as plugin from '../index.js';

const root = fileURLToPath(new URL('../', import.meta.url));

async function setup(t) {
  const ctx = new Context();
  await ctx.plugin(SkillRegistry);
  t.after(() => ctx.fiber.dispose());
  return ctx;
}

test('real DSH registry discovers and loads the packaged skill outside the repository cwd', async t => {
  const ctx = await setup(t);
  await ctx.plugin(plugin);
  const skills = await ctx.skills.list({ cwd: tmpdir() });
  const summary = skills.find(skill => skill.name === 'ai-job-countdown');
  assert.ok(summary);
  assert.deepEqual(summary.invocation, { modelInvocable: true, userInvocable: true });
  const loaded = await ctx.skills.get(summary.name, { cwd: tmpdir() });
  assert.ok(loaded.content.length > 100);
  assert.ok(!loaded.content.startsWith('---'));
  const methodology = await readFile(join(loaded.resourceBase.path, 'references/methodology.md'), 'utf8');
  assert.ok(methodology.length > 100);
});

test('disabling the plugin removes its skill and re-enabling registers exactly one entry', async t => {
  const ctx = await setup(t);
  const mounted = await ctx.plugin(plugin);
  assert.equal((await ctx.skills.list()).length, 1);
  await mounted.dispose();
  assert.equal((await ctx.skills.list()).length, 0);
  await ctx.plugin(plugin);
  assert.equal((await ctx.skills.list()).length, 1);
});

test('project skills win over the bundled skill and removal restores the bundle', async t => {
  const ctx = await setup(t);
  await ctx.plugin(plugin);
  const local = {
    name: 'ai-job-countdown', description: 'Workspace-specific version',
    invocation: { modelInvocable: true, userInvocable: true },
    source: 'project-dsh', provider: 'workspace-test', rank: 100, locator: 'local',
  };
  const remove = ctx.skills.registerProvider(() => ({
    name: 'workspace-test',
    async list() { return [local]; },
    async get() { return { ...local, content: 'Workspace instructions' }; },
  }));
  assert.equal((await ctx.skills.get(local.name)).content, 'Workspace instructions');
  remove();
  assert.equal((await ctx.skills.get(local.name)).source, 'bundled');
});

test('bundle entry resolves to the shipped plugin and has no installation lifecycle scripts', async () => {
  const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  const patch = parse(await readFile(join(root, manifest.dsh.bundle.patch), 'utf8'));
  assert.equal(patch[0].insert[0].name, manifest.name);
  assert.equal(patch[0].insert[0].id, plugin.name);
  for (const lifecycle of ['preinstall', 'install', 'postinstall', 'prepare']) {
    assert.equal(manifest.scripts[lifecycle], undefined);
  }
  for (const field of ['dependencies', 'devDependencies', 'peerDependencies']) {
    for (const value of Object.values(manifest[field] ?? {})) {
      assert.ok(!/^(workspace:|file:|link:)/u.test(value));
    }
  }
});

test('all shipped Markdown resources have resolvable relative links', async () => {
  const markdown = [
    'README.md', 'docs/LAUNCH.md', 'docs/DSH.md', 'examples/handover-card.md',
    'examples/product-manager-delivery.md', 'examples/product-manager-discovery.md', 'skills/ai-job-countdown/SKILL.md',
    'skills/ai-job-countdown/references/methodology.md',
  ];
  for (const relative of markdown) {
    const file = new URL(`../${relative}`, import.meta.url);
    const content = await readFile(file, 'utf8');
    for (const match of content.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/gu)) {
      if (/^[a-z][a-z\d+.-]*:/iu.test(match[1]) || match[1].startsWith('#')) continue;
      const target = new URL(match[1].split('#')[0], file);
      await readFile(target);
    }
  }
});
