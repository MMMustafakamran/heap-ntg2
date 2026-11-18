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
  // FINDINGS.md #19, #20
  'tool-rendering': {
    evidence: [
      { text: 'return build(system_instructions=SYSTEM_PROMPT, tools=TOOLS)', caption: 'build, SYSTEM_PROMPT and 3 of the 4 tools never shown' },
      { text: 'parameters: z.object({ city: z.string() }),', caption: 'card reads city, backend arg is location' },
    ],
    note: [
      "page says the weather tool call renders as a card",
      "asked weather in tokyo, card shows up but no city name in it",
      "backend uses build, system_prompt and 3 tools that are never shown, so it nameerrors as written and i pulled them from the showcase",
      "card reads city but get_weather takes location, so the names dont match",
    ].join('\n'),
  },
  // FINDINGS.md #35
  'shared-state-readonly': {
    evidence: [
      { text: 'Sent to the agent with every run.', caption: 'the page promises the agent sees the context' },
      { text: 'Ask the agent which workspace is active. It answers northstar', caption: 'the page promises the answer northstar' },
    ],
    note: [
      "page says useagentcontext values are sent to the agent every run and it answers northstar",
      "set workspace to northstar, asked which workspace, the agent answered with some server path and not northstar",
      "the antigravity adapter only passes the context with experimental_app_context=true and the page never mentions it",
      "no backend is shown at all, so the agent never gets the context",
    ].join('\n'),
  },
  // FINDINGS.md #46
  webmcp: {
    evidence: [{ text: 'const orders = await searchOrders(status);', caption: 'searchOrders is never defined' }],
    note: [
      "page says the agent can call ur searchorders tool",
      "asked it to find my open orders, chat never replies",
      "ordersearch.vue calls searchorders but its never defined or imported, and the page shows only that component",
      "so the tool cant run as written",
    ].join('\n'),
    demo: async (page, config, _root, ctx) => {
      await sendPrompt(page, config.prompt, { timeoutMs: 15000 });
      await sleep(30000);
      const text = await page.evaluate(() => document.body.innerText).catch(() => '');
      if (!/order/i.test(text.replace(config.prompt, ''))) ctx.fail('The agent never replied after the searchOrders tool was asked for');
    },
  },
  // FINDINGS.md #47
  subagents: {
    evidence: [
      { text: 'On the frontend, the delegation log is a reactive render of the', caption: 'no frontend code for the delegation log' },
      { text: 'pip install ag-ui-antigravity google-antigravity', caption: 'install step misses httpx' },
      { text: 'from agents._common import MODEL, aimock_headers, api_key, gemini_base_url', caption: 'agents._common never published' },
    ],
    // The supervisor delegates to three sub-agents before it answers: give it two minutes.
    demo: async (page, config, _root, ctx) => {
      if (!(await promptAndWaitFor(page, config, /scatter|Rayleigh|wavelength/i, 120000))) ctx.fail('The supervisor never replied');
    },
    note: [
      "page says the frontend shows a delegation log of the sub agents",
      "with my fixes it replies but theres no delegation log anywhere",
      "as written server crashes,modulenotfound no module named httpx,install step misses it",
      "agents._common never shown and the log section has no code",
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
    await glideClick(page, slot);
    await sleep(8000);
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
