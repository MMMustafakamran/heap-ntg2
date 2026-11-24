/**
 * Finding clips for the Vue pages added 2026-11-10 (AUTORECORDER.md section 2): demo, then the
 * faulty doc text drag-selected, then the hurried Notepad note. Problem text: FINDINGS.md entries.
 * Evidence texts were checked against the rendered doc pages (2026-11-10).
 */
import { type Page } from 'playwright';
import { type ActionContext, type PageActionHandler, type PageRecordConfig } from '../core/types';
import { runStandardAction, sendPrompt } from '../core/actions';
import { sleep } from '../core/overlays/cursor';
import { type DocEvidence, showFinding } from './doc-evidence';
import { registerDocEvidence } from '../core/doc-evidence';
import { glideClick, glideTo } from './glide-click';
import { checkpoint, mark, probeText } from '../core/timeline';

type Demo = (page: Page, config: PageRecordConfig, root: string, ctx: ActionContext) => Promise<void>;

interface NewFinding { evidence: DocEvidence[]; note: string; demo?: Demo }

/** Send the prompt, then wait for `text` to show (or give up after `ms`). */
async function promptAndWaitFor(page: Page, config: PageRecordConfig, text: RegExp, ms: number): Promise<boolean> {
  await sendPrompt(page, config.prompt, { timeoutMs: 15000 });
  const el = page.getByText(text).first();
  const ok = await el.waitFor({ state: 'visible', timeout: ms }).then(() => true).catch(() => false);
  if (ok) await glideTo(page, el, 3000);
  return ok;
}

export const NEW_FINDINGS: Record<string, NewFinding> = {
  // FINDINGS.md #30 (review 2026-11-24: the page's own test fails, 2 CI runs)
  'shared-state-rendering': {
    evidence: [
      { text: 'Ask the agent to mark the prototype item as done.', caption: "the page's test step needs an agent tool that writes items; none is given" },
    ],
    // The doc's check is data-done on the item (not styled, so read it): the reply alone can claim success.
    demo: async (page, config, root, ctx) => {
      await runStandardAction(page, config, root, ctx);
      await sleep(3000);
      const item = page.locator('li', { hasText: 'Build a prototype' }).first();
      const done = await item.getAttribute('data-done').catch(() => null);
      void checkpoint('canvas', 'prototype item data-done == true', () => `data-done=${done}`, { ok: () => done === 'true' });
      await glideTo(page, item, 2500).catch(() => {});
      if (done !== 'true') ctx.fail(`prototype item still data-done=${done} after the agent turn`);
    },
    note: [
      "page says ask the agent to mark the prototype item as done and data-done flips to true on the canvas",
      "agent answers but the prototype item never flips,data-done stays false",
      "page has no backend code at all,the shared state agent it relies on only has set_notes",
      "nothing writes items so u have to guess the tool urself",
    ].join('\n'),
  },
  // FINDINGS.md #47 (re-audit 2026-11-20: blocker is the missing Vue delegation log; httpx / _common are minor)
  subagents: {
    evidence: [
      { text: 'On the frontend, the delegation log is a reactive render of the', caption: 'no Vue frontend code for the delegation log' },
    ],
    // The supervisor delegates to three sub-agents before it answers: give it two minutes.
    demo: async (page, config, _root, ctx) => {
      if (!(await promptAndWaitFor(page, config, /scatter|Rayleigh|wavelength/i, 120000))) ctx.fail('The supervisor never replied');
    },
    note: [
      "page says the frontend shows a live delegation log of the sub agents",
      "supervisor replies but theres no delegation log anywhere",
      "the log section has no code and the only one given,code tab and showcase,is react tsx",
      "no vue version so a vue app cant render the log",
    ].join('\n'),
  },
};

// Each finding's doc evidence is highlighted in the doc step (before the IDE), not after the demo.
registerDocEvidence(Object.fromEntries(Object.entries(NEW_FINDINGS).map(([id, f]) => [id, f.evidence])));

export const runNewFindingAction: PageActionHandler = async (page, config, root, ctx) => {
  const f = NEW_FINDINGS[config.id];
  try {
    await (f.demo ?? runStandardAction)(page, config, root, ctx);
  } finally {
    await showFinding(page, config, f.evidence, f.note);
  }
};

/** Fully Headless UI (✅): the doc's own <input aria-label="Message"> + Send button, replies as <article data-role>. */
export const runHeadlessUiAction: PageActionHandler = async (page, config, _root, ctx) => {
  await sendPrompt(page, config.prompt, {
    inputSelector: 'input[aria-label="Message"]',
    submitSelector: 'button[type="submit"]',
    messageSelector: 'article[data-role="assistant"]',
    timeoutMs: 15000,
  });
  const reply = page.locator('article[data-role="assistant"]').last();
  const ok = await page
    .waitForFunction(() => [...document.querySelectorAll('article[data-role="assistant"]')].some((a) => (a.textContent ?? '').trim().length > 2), null, { timeout: 60000 })
    .then(() => true)
    .catch(() => false);
  if (!ok) ctx.fail('No assistant reply rendered in the headless chat');
  else await glideTo(page, reply, 3000);
};

/** Human in the Loop (✅): the time picker card appears in the chat; pick a slot. */
export const runHitlAction: PageActionHandler = async (page, config, _root, ctx) => {
  if (!(await promptAndWaitFor(page, config, /Pick a time/, 90000))) return ctx.fail('No time picker card showed up');
  const slot = page.getByRole('button', { name: /Tomorrow/ }).first();
  if (await slot.isVisible().catch(() => false)) {
    const before = await page.evaluate(() => document.body.innerText.length);
    await glideClick(page, slot);
    // Review 2026-11-24: the take ended while the agent was still answering; wait for the follow-up reply to land and settle.
    let last = before, stable = 0, grew = false;
    for (let i = 0; i < 90 && stable < 5; i++) {
      await sleep(1000);
      const n = await page.evaluate(() => document.body.innerText.length).catch(() => last);
      if (n > before + 20) grew = true;
      stable = grew && n === last ? stable + 1 : 0;
      last = n;
    }
    if (!grew) ctx.warn('No agent reply after picking a time');
    await sleep(2000);
  }
};

// ---------------------------------------------------------------------------------------------
// Threads pages, tested with the CopilotKit Intelligence key (2026-11-10). Runtime:
// my-copilot-app/server.threads.ts on 8154 (the headless page's server.ts). Threads are per user
// and persist between runs, so older rows can already be listed.
// ---------------------------------------------------------------------------------------------
const DRAWER_ROW = 'copilotkit-threads-drawer li[role="option"][data-thread-id]';
const promptHead = (config: PageRecordConfig) => config.prompt.slice(0, 24);

/** Threads Drawer: chat once, the thread is listed, New Conversation resets the chat, the row replays it. */
export const runThreadsDrawerAction: PageActionHandler = async (page, config, root, ctx) => {
  await page.locator('copilotkit-threads-drawer').first().waitFor({ state: 'attached', timeout: 30000 }).catch(() => {});
  await sleep(3000); // the drawer loads its list
  const rowsBefore = await page.locator(DRAWER_ROW).count();
  await runStandardAction(page, config, root, ctx);
  const listed = await page
    .waitForFunction((n) => (document.querySelector('copilotkit-threads-drawer')?.shadowRoot
      ?.querySelectorAll('li[role="option"][data-thread-id]').length ?? 0) > n, rowsBefore, { timeout: 45000, polling: 500 })
    .then(() => true)
    .catch(() => false);
  void checkpoint('thread', 'the new conversation is listed in the drawer', async () => `${await page.locator(DRAWER_ROW).count()} row(s), was ${rowsBefore}`, {
    ok: () => listed,
  });
  if (!listed) {
    ctx.fail('The Threads Drawer did not list the new conversation.');
    return;
  }
  await sleep(4000); // the thread name fills in
  await glideTo(page, page.locator(DRAWER_ROW).first(), 2000);
  mark('click', 'New Conversation');
  await glideClick(page, page.getByText('New Conversation', { exact: true }).first());
  const userBubble = page.getByText(config.prompt, { exact: false }).first();
  const reset = await userBubble.waitFor({ state: 'hidden', timeout: 15000 }).then(() => true).catch(() => false);
  void checkpoint('new', '"New Conversation" clears the chat', async () => reset);
  if (!reset) ctx.fail('"New Conversation" did not reset the chat.');
  await sleep(2500);
  mark('click', 'reopen thread');
  const mine = page.locator(DRAWER_ROW).filter({ hasText: promptHead(config) });
  await glideClick(page, (await mine.count()) > 0 ? mine.first() : page.locator(DRAWER_ROW).first());
  const replayed = await userBubble.waitFor({ state: 'visible', timeout: 20000 }).then(() => true).catch(() => false);
  void checkpoint('replay', 'selecting the thread replays its history', () => probeText(page.getByText(config.prompt, { exact: false })));
  if (!replayed) ctx.fail('Selecting the thread in the drawer did not replay its conversation.');
  await sleep(2500);
  // The page's own "New conversation" toolbar button (useCopilotChatConfiguration().startNewThread()).
  mark('click', 'own New conversation button');
  await glideClick(page, page.getByRole('button', { name: 'New conversation', exact: true }).first());
  const ownReset = await userBubble.waitFor({ state: 'hidden', timeout: 15000 }).then(() => true).catch(() => false);
  void checkpoint('new-button', 'the own "New conversation" button clears the chat', async () => ownReset);
  if (!ownReset) ctx.fail('The own "New conversation" button did not reset the chat.');
  await sleep(3000);
};

/** Headless Threads: chat once, the useThreads list shows it, selecting another row switches the chat, and back. */
export const runHeadlessThreadsAction: PageActionHandler = async (page, config, root, ctx) => {
  await runStandardAction(page, config, root, ctx);
  // The doc's ThreadSidebar: <li><button>{name}</button><button>Rename</button><button>Archive</button><button>Delete</button></li>
  const rows = page.locator('li:has(> button:text-is("Rename")) > button:first-child');
  const listed = await rows.first().waitFor({ state: 'visible', timeout: 45000 }).then(() => true).catch(() => false);
  void checkpoint('thread', 'the useThreads list shows the thread (Rename / Archive / Delete row)', async () => `${await rows.count()} row(s)`, {
    ok: () => listed,
  });
  if (!listed) {
    ctx.fail('The chat ran, but the useThreads list shows no threads.');
    return;
  }
  await sleep(4000); // the thread name fills in
  const userBubble = page.getByText(config.prompt, { exact: false }).first();
  const other = rows.filter({ hasNotText: promptHead(config) });
  if ((await other.count()) > 0) {
    mark('click', 'other thread');
    await glideClick(page, other.first());
    const switched = await userBubble.waitFor({ state: 'hidden', timeout: 20000 }).then(() => true).catch(() => false);
    void checkpoint('switch', 'selecting another thread switches the chat away from this one', async () => switched);
    if (!switched) ctx.fail('Selecting another thread did not switch the chat.');
    await sleep(3000);
  }
  mark('click', 'reopen thread');
  const mine = rows.filter({ hasText: promptHead(config) });
  await glideClick(page, (await mine.count()) > 0 ? mine.first() : rows.first());
  const replayed = await userBubble.waitFor({ state: 'visible', timeout: 20000 }).then(() => true).catch(() => false);
  void checkpoint('replay', 'selecting the thread replays its history', () => probeText(page.getByText(config.prompt, { exact: false })));
  if (!replayed) ctx.fail('Selecting the thread did not replay its conversation.');
  await sleep(4000);
};

/**
 * MCP Apps (✅ since 2026-11-12): the thing under test is the MCP App frame (Excalidraw) in the chat.
 * The model often ends its turn with only the tool call and no text, so the take waits for the
 * frame instead of a text reply (the standard action would call a silent-but-rendered turn a failure).
 */
export const runMcpAppsAction: PageActionHandler = async (page, config, _root, ctx) => {
  await sendPrompt(page, config.prompt, { timeoutMs: 15000 });
  const frame = page.locator('iframe').last();
  const shown = await frame.waitFor({ state: 'visible', timeout: 120000 }).then(() => true).catch(() => false);
  void checkpoint('render', 'the MCP App frame renders in the chat', async () => (shown ? 'iframe visible' : null), { ok: () => shown });
  if (!shown) {
    ctx.fail('The MCP App frame never appeared in the chat.');
    return;
  }
  await sleep(8000); // the drawing fills in
  await glideTo(page, frame, 4000);
  await sleep(6000); // an optional text reply after the tool call
};

/** Pausing the Agent for Input (✅ since 2026-11-18): the doc's MeetingPicker shows in the chat; pick the slot. */
export const runUseInterruptAction: PageActionHandler = async (page, config, _root, ctx) => {
  if (!(await promptAndWaitFor(page, config, /Pick a time for/, 90000))) return ctx.fail('No meeting picker showed up');
  const slot = page.getByRole('button', { name: 'Tomorrow at 09:00' }).first();
  if (await slot.isEnabled().catch(() => false)) {
    mark('click', 'Tomorrow at 09:00');
    await glideClick(page, slot);
    await sleep(10000);
  }
};

/** Headless Interrupts: the doc's HeadlessApprovalPanel shows the reason outside the chat; click Approve. */
export const runHeadlessInterruptAction: PageActionHandler = async (page, config, _root, ctx) => {
  await sendPrompt(page, config.prompt, { timeoutMs: 15000 });
  const approve = page.getByRole('button', { name: 'Approve', exact: true }).first();
  const shown = await approve.waitFor({ state: 'visible', timeout: 90000 }).then(() => true).catch(() => false);
  void checkpoint('render', 'the headless approval panel shows Approve / Reject', async () => (shown ? 'Approve visible' : null), { ok: () => shown });
  if (!shown) return ctx.fail('The headless approval panel never appeared');
  await glideTo(page, approve, 2500);
  mark('click', 'Approve');
  await glideClick(page, approve);
  await sleep(10000);
};
