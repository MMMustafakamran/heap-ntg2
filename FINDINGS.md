# Findings — Antigravity-vue
Open doc defects only. A finding is proposed first and added only after the owner approves it (Claude Code proposes after the daily review and the owner approves locally: `.qa/instructions/QA-RULES.md` section 6). The entries from the 2026-11-04 Antigravity assignment were logged directly and reviewed by the owner at the end, a one-off exception that does not apply to new findings. Numbers are stable IDs (code cites `FINDINGS.md #N`), so gaps are removed findings.
Stack: `@copilotkit/vue`/`runtime` 1.89.0 (npm latest, CI 2026-11-18), `vue` 3.5.45 (declared ^3.5.42), `vite` 8.3.8 (declared ^8.2.2), `tsx` 4.23.15, backend `ag-ui-antigravity` 0.2.1, `google-antigravity` 0.1.23, `google-genai` 3.5.0, Node 26.7.0, npm 12, Windows 11. Docs: https://docs.copilotkit.ai/vue/google-antigravity (snapshot 2026-11-18)

## Dev blockers (seen with `npm run dev` and normal use of the page)

### [Quickstart](https://docs.copilotkit.ai/vue/google-antigravity/quickstart)
**#9 The Vue quickstart only wires CopilotKit's own BuiltInAgent; no step connects an Antigravity agent.**
- **Doc:** https://docs.copilotkit.ai/vue/google-antigravity/quickstart (the sidebar's Quickstart, `/vue/google-antigravity`, shows the same page). The only runtime is `server.ts` with `default: new BuiltInAgent({ model: "openai:gpt-6-luna", ... })`, and the callout says "If you already have a LangGraph, CrewAI, Mastra, ADK, Pydantic AI, or other agent, use your framework's quickstart for the runtime wiring so it registers your agent instead." This is that framework's quickstart.
- **Result:** the published steps run (re-checked 2026-11-18: `npx tsx server.ts` with an OpenAI key streams a reply), but the chat talks to CopilotKit's own OpenAI agent. There is no Antigravity backend, no `pip install ag-ui-antigravity`, no `HttpAgent` and no Gemini key anywhere on the page, so a reader can't get a Vue app on an Antigravity agent. **Confirmed by harness:** `server.antigravity.ts` (HttpAgent -> own Antigravity backend) is the harness's own guess.

### [Agent Read-Only Context](https://docs.copilotkit.ai/vue/google-antigravity/shared-state/agent-readonly)
**#35 the agent never sees the useAgentContext value (asked which workspace, it answered C:/srv/agents/w1, not northstar). The Antigravity adapter needs experimental_app_context=True on the agent, which the page never mentions.**
- Doc: "Sent to the agent with every run." and "Ask the agent which workspace is active. It answers `northstar`." (useAgentContext({ description: "Active workspace", value: workspaceId }) with workspaceId = "northstar") / Result (re-checked 2026-11-18): asked "Which workspace am I in right now?" the agent replied "You are currently in the workspace: C:/srv/agents/w1"; the context never reaches it. ag_ui_antigravity only exposes useAgentContext values when the agent is built with experimental_app_context=True (get_app_context tool, see agent.py docstring), which the page never mentions.

### [WebMCP](https://docs.copilotkit.ai/vue/google-antigravity/webmcp)
**#46 OrderSearch.vue calls searchOrders(), which the page never defines, and the agent never replies when the tool is used.**
- Doc: `const orders = await searchOrders(status);` in OrderSearch.vue / Result: searchOrders is never defined or imported; the chat never replies when the tool is asked for. The WebMCP side (document.modelContext) needs Chrome 149 + flag, not testable in the probe browser.

### [Sub-Agents](https://docs.copilotkit.ai/vue/google-antigravity/multi-agent/subagents)
**#47 the delegation-log section has no frontend code, and the only one given (Code tab / showcase) is React: no Vue version.**
- Doc: 'Rendering a live delegation log' says "On the frontend, the delegation log is a reactive render of the `delegations` slot." with no code; the page's Code tab shows only `page.tsx` / `delegation-log.tsx` (React) and links the React showcase (showcase/integrations/google-antigravity/src/app/demos/subagents). / Result: the supervisor replies, but a Vue reader has no delegation-log component to render, so no log shows.

## Minor notes
- #19 Tool Rendering: backend snippet calls build() and SYSTEM_PROMPT and lists 3 tools it never shows; works with get_weather on your own agent
- #47 Sub-Agents (minor part): subagents.py imports httpx, not in the install step; agents._common comes from the linked showcase
- #5 Frontend Tools: `zod` is imported but no Vue install step adds it. It resolves only transitively (3.25.76).
- #4 Frontend Tools: `runtime-url="/api/copilotkit"` is relative; a Vite app has no `/api` route, so `/api/copilotkit/info` 404s and the chat sends nothing until it points at the runtime server.
- #8 When the model call fails, the Vue chat shows nothing: no error, no message (re-checked 2026-11-12 with an invalid Gemini key: the backend logs `Antigravity run failed`, the chat stays blank under the user message).
- #10 Prebuilt Components: agent-id="my-agent" is never registered by the Vue quickstart runtime (it registers default); reader must add it
- #11 Prebuilt Components: runtime-url="/api/copilotkit" is relative, 404 on a Vite app (same as other Vue pages)
- #12 Slots (Subcomponents): disclaimer slot snippet uses CopilotChatInput without importing it; other snippets are template fragments (CustomMessageView, CustomToolbarAction undefined)
- #13 Fully Headless UI: same unregistered my-agent id / relative runtime-url as Prebuilt Components
- #15 Inspector: only code block for disabling Inspector is React (<CopilotKit enableInspector>), Vue gets one prose line
- #17 Headless Threads: sidebar uses class="flex" (Tailwind) with no Tailwind setup on the page
- #48 Threads Drawer: page shows no runtime code for Intelligence and agent-id="support" is never registered; public-license-key="ck_pub_..." is a placeholder (not needed once the runtime has CPK_INTELLIGENCE_API_KEY)
- #49 Headless Threads: server.ts uses agent and verifyAppSession without defining them and registers only default, while App.vue uses agent-id="my-agent"
- #18 Components as Tools: imports zod but no install step adds it (present only transitively)
- #20 Tool Rendering: WeatherToolCard reads parameters.city, backend arg is location: card shows result JSON with no city name
- #23 MCP Apps: runtime `mcpApps` server url is the placeholder `https://mcp.example.com/mcp`; with a real MCP server (Excalidraw) the app renders in the chat (re-checked 2026-11-12)
- #24 MCP Apps: server snippet: `agent` never defined
- #25 Shared State: backend snippet calls build(...) which the page never defines or imports (same as React #8)
- #26 Shared State: set_notes snippet uses experimental_get_state/experimental_set_state without imports
- #27 Shared State: two separate blocks both titled src/components/SharedWorkspace.vue; the second (setTone) uses agent and WorkspaceState it never defines, merge is left to the reader
- #30 Render agent state in your app: page has no backend code; relies on the Shared State page's agent
- #36 Agent Read-Only Context: page shows no backend code at all
- #39 Human in the Loop: hitl.py imports agents._common.build, never published
- #40 Human in the Loop: backend prompt names book_call, the Vue snippet registers schedule_meeting (model still called schedule_meeting)
- #43 Pausing the Agent for Input / Headless Interrupts: runtime-url /api/copilotkit 404 on Vite, and the backend section is prose only (works with the quickstart agent, which picks up the frontend tool)
- #51 State streaming links are dead: Shared State, Render agent state in your app and Agent Read-Only Context link `/vue/shared-state/streaming` (308 to the LangGraph Python page), Sub-Agents links `/vue/google-antigravity/shared-state/streaming` (308 back to Shared State); the page is gone (2026-11-18).
- #45 Governed Actions: no backend shown: nothing makes the agent call approve_governed_action or emit an interrupt with metadata.action; executeSideEffect in handleApproval undefined

## Build-only (`vue-tsc` / `vite build`; `npm run dev` runs fine)
