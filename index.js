import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { BUNDLED_SKILL_RANK } from '@deepseek-ai/dsh-skill';

export const name = 'ai-job-countdown';
export const inject = ['skills'];

const skillPath = fileURLToPath(new URL('./skills/ai-job-countdown/SKILL.md', import.meta.url));

export function apply(ctx) {
  const raw = readFileSync(skillPath, 'utf8');
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u.exec(raw);
  if (!frontmatter) throw new Error('ai-job-countdown: missing skill frontmatter');
  const metadata = parse(frontmatter[1]);
  if (metadata?.name !== name || typeof metadata.description !== 'string' || !metadata.description.trim()) {
    throw new Error('ai-job-countdown: invalid skill identity or description');
  }
  const content = raw.slice(frontmatter[0].length).trim();
  if (!content) throw new Error('ai-job-countdown: empty skill body');

  const summary = {
    name,
    description: metadata.description,
    invocation: { modelInvocable: true, userInvocable: true },
    source: 'bundled',
    provider: name,
    path: skillPath,
    resourceBase: { kind: 'directory', path: dirname(skillPath).replaceAll('\\', '/') },
  };
  const candidate = { ...summary, rank: BUNDLED_SKILL_RANK, locator: skillPath };

  ctx.skills.registerProvider(() => ({
    name,
    async list() {
      return [candidate];
    },
    async get(selected) {
      if (selected.name !== name || selected.locator !== skillPath) return undefined;
      return { ...summary, content, metadata };
    },
  }));
}
