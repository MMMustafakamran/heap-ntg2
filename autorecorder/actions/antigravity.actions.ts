import { type PageActionHandler } from '../core/types';
import { sendPrompt, waitForAgentResponseCompletion } from '../core/actions';
import { sleep } from '../core/overlays/cursor';
import { glideTo } from './glide-click';

/** Vue Frontend Tools: the agent calls filter_incidents and "Current filter" changes. */
export const runVueFrontendToolsAction: PageActionHandler = async (page, config, _root, ctx) => {
  const label = page.getByText(/Current filter:/).first();
  const msgCount = await sendPrompt(page, config.prompt, { timeoutMs: 15000 });
  const changed = await page
    .waitForFunction(() => !/Current filter: all\b/.test(document.body.innerText), null, { timeout: 60000 })
    .then(() => true)
    .catch(() => false);
  if (!changed) ctx.fail('filter_incidents never ran: "Current filter" stayed "all".');
  try {
    await waitForAgentResponseCompletion(page, 2500, msgCount);
  } catch (e) {
    ctx.warn(`Reply did not complete cleanly: ${String(e).slice(0, 160)}`);
  }
  await glideTo(page, label, 3000);
  await sleep(1500);
};

import { runStandardAction } from '../core/actions';
import { type DocEvidence, showFinding } from './doc-evidence';
import { registerDocEvidence } from '../core/doc-evidence';

export const FINDING_EVIDENCE: Record<string, DocEvidence[]> = {
  // FINDINGS.md #9 (texts checked on the rendered page 2026-11-18)
  quickstart: [
    { text: "use your framework's quickstart for the runtime wiring so", caption: 'The Antigravity Vue quickstart sends agent owners to their framework quickstart, i.e. this page' },
    { text: 'default: new BuiltInAgent({', caption: 'The only runtime on the page registers BuiltInAgent (OpenAI), no Antigravity agent' },
  ],
};
// Highlighted in the doc step (before the IDE). This repo has no level-2 (KNOWN_ISSUE) pages, so no skip list.
registerDocEvidence(FINDING_EVIDENCE);

/** Finding clips end with the finding typed into Notepad (REPOS.md Rule 6). */
const QUICKSTART_FINDING = [
  "antigravity vue quickstart should hook a vue app up to an antigravity agent",
  "it only wires copilotkits own builtinagent with an openai model",
  "no step connects an antigravity agent,no backend no pip install no httpagent",
  "and the callout says if u already have an agent use ur frameworks quickstart,thats this page",
  "so i had to wire the antigravity agent into the runtime myself",
].join('\n');

export const runVueQuickstartAction: PageActionHandler = async (page, config, root, ctx) => {
  try {
    await runStandardAction(page, config, root, ctx);
  } finally {
    await showFinding(page, config, FINDING_EVIDENCE[config.id], QUICKSTART_FINDING, 'finding-vue-quickstart.txt');
  }
};
