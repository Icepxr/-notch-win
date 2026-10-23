# AI Agent — additive V-Notch page

This addition is on `codex/ai-agent`, based on the completed LocalSend customization. It keeps upstream Spotlight AI chat, its API providers, conversations, settings and usage displays intact. New C# readers were implemented independently for this page; no GPL Islet/Vorssaint implementation files were copied into V-Notch.

## Use

Expand the notch and select the **AI Agent** icon (four squares). It is appended to the existing navigation order. Drag it like the other tabs, or hide/show it in the existing Settings navigation-tab list. The page uses the existing shell, coordinator, outside-click dismissal and reduced-motion behavior. Reopen-last-view also supports it.

- **Today / 7d / 30d** changes the period for observed local records and recent activity.
- **Refresh limits** asks the installed Codex and Claude Code CLIs for account limits. It sends no AI prompt, starts no conversation and signs into no account. There is a 30-second cooldown. Account refresh is manual; opening the page only reads local files.
- Quota windows display **remaining percentage**, reset time and a **Live / Snapshot** label. Hover a window for its source and observation time. Expired windows show a dash and request a refresh. No published reading means no percentage.
- A sign-in-related error can offer **Copy sign-in command**. Paste that command into PowerShell and complete sign-in yourself, then refresh. This page never reads credential files or automates login.
- Local tokens, cached input and response counts are separate from subscription allowances. Missing records show a dash, not zero allowance.
- Each provider now shows **input / output / cached input** separately. Hover totals for exact numbers; cache remains a subset of input and is never added a second time.
- **Usage breakdown** adds local activity bars (two-hour intervals today, daily for 7d/30d), cache share and the three largest observed models. Hover a bar/model for its exact interval, token counts and response count. Gaps mean no observed records, not confirmed zero account usage. **Less detail / More detail** collapses/restores this section without changing the period or resetting when local polling updates.
- Activity shows up to 12 sessions from a bounded 16 per provider, prioritizing explicit Working states. These are recent observed sessions, not an account-wide session total.
- Claude session files are checked against live local PIDs. Explicit busy/idle states become Working/Waiting. Older files without a state say Running. Codex activity comes from recorded task events and is labelled Recorded active/Recent; it is not a process-liveness claim.

![Synthetic fixture preview, not the user's actual account readings.](CustomPreviews/agent-dashboard.png)

![Synthetic scrolled usage breakdown.](CustomPreviews/agent-breakdown.png)

## Claude limit correction

The previous probe injected `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`. On the installed Claude Code 2.1.308, `get_usage` then reported `rate_limits_available: true` but returned an empty `rate_limits`. A controlled read-only comparison with identical tools/hooks/MCP/telemetry restrictions, without that injected blanket flag, returned `five_hour` and `seven_day` windows. A separate `auth status` check confirmed this CLI was already signed in with a Pro subscription; no sign-in was required to fix this case. No credentials or identity fields were printed or copied.

The probe no longer injects the blanket flag. It preserves an explicit inherited or user-settings traffic opt-out and reports it when it prevents a reading. Only allowlisted proxy, CA and traffic-opt-out environment values are read from the user settings JSON; hooks/tools and arbitrary settings environment remain disabled. V-Notch's existing network privacy permission still gates every account check. Missing limits are no longer mislabelled as a definite sign-in problem.

Claude Desktop and Claude Code both use `claude.exe`. Discovery now checks the PE console subsystem, rejecting the Desktop GUI executable, and can locate the Desktop-bundled CLI even without an active Claude process. It never launches Desktop merely to fetch usage.

## Local sources and bounds

The reader honors `CODEX_HOME` and `CLAUDE_CONFIG_DIR`, otherwise using the user's `.codex` and `.claude` directories. It reads session/project JSONL usage fields and Claude session-state JSON files. Conversation text is discarded during parsing, never retained in the snapshot, logged or sent elsewhere.

At most 64 recent JSONL files per provider are read, up to 256 KiB from each tail; an initial Codex metadata line can additionally supply the project label. Truncated tails and skipped/locked files are labelled **partial local coverage**. Observed tokens are therefore not a complete billing total. Repeated cumulative Codex events and streaming Claude response updates are deduplicated. File metadata caches avoid reparsing unchanged logs.

Local polling runs every five seconds only while this page is visible. Closing/hiding it cancels pending work. CLI probes run on worker threads, use bounded responses and a 25-second deadline, close their own input on completion and terminate only their own subprocess tree if it does not exit. Existing agent processes are never stopped. Claude tools, hooks, MCP servers, updater and telemetry are disabled for the short-lived probe process; user configuration is not rewritten.

Account network access uses the existing V-Notch AI privacy permission. Strict Local-Only Mode prevents those checks and revocation cancels them. Local activity remains available without account access. Existing privacy defaults are unchanged.

Protocol references: [official Codex app-server documentation](https://learn.chatgpt.com/docs/app-server), [Anthropic Agent SDK](https://github.com/anthropics/claude-agent-sdk-typescript). Claude's `get_usage` control response is version dependent; unsupported/missing readings are explicit states rather than estimated quota. The provider SVG assets retain their original bytes and provenance in `Assets/Agents/README.md`; the native DrawingImage resources preserve their path data, colors and viewBox clear space.

## Verification

```powershell
./Test-Agents.ps1 -DotNetExe ../dotnet-sdk/dotnet.exe
./Test-LocalSend.ps1 -DotNetExe ../dotnet-sdk/dotnet.exe
./Build-LocalSend.ps1 -DotNetExe ../dotnet-sdk/dotnet.exe
```

- 14 synthetic core cases cover deduplication, cache counting, optional session status, live PID/domain guards, expired/missing quotas, privacy denial, changing files, cancellation, bounded tails, empty Claude responses, traffic opt-out preservation, console/GUI executable selection and model/calendar aggregation.
- 8 isolated WPF/presentation cases cover missing states, narrow/normal layouts, dark rendering, detail disclosure surviving polling, 7d/30d interval changes, selection/collapse across the Agent page and every legacy view, and coordinator transitions. They compile the actual presenter/coordinator sources; only logging/display-preference services are substituted in that isolated harness.
- Existing LocalSend core regression tests pass (24). Its 2 UI cases passed previously; this run's UI rerun was blocked by Windows Application Control (`0x800711C7`) with zero discovered tests. The harness correctly fails that run rather than reporting it as a pass. No alternate packaging, policy changes or trust-store changes were used to bypass the block.
- The complete application and full test project compile. The complete application test assembly remains subject to the previously recorded Windows Application Control test-host limitation; isolated passes are not claimed as a complete regression run.
- After the correction, a read-only live probe using the actual C# account reader returned **Live account / 2 quota windows for both Codex and Claude Code**, alongside local activity. It sends no model prompt and prints counts/status only. Synthetic preview percentages are not the user's real readings.
- The initial sandbox test run could not connect to its local test host and aborted; the same harness completed with ordinary local process/loopback access. No Windows Application Control policy or trust settings were changed.
- Synthetic previews verify layout, not the user's actual quota or every animation timing on physical displays. LocalSend's physical iPad roundtrip is still unverified.

The standalone diagnostic `Tests/Agents.Probe` is opt-in and prints counts/status only. Run with `--accounts` to include explicit read-only account checks; without it, only local files are read. It never prints conversations, identity/account response bodies, keys or tokens.

Only additive view/navigation/presenter hooks and an Agent visibility preference touch the existing application. Music/lyrics receive an auxiliary-view guard so canvas content cannot appear over the Agent page. Existing tab preferences and all existing feature implementations remain in use.
