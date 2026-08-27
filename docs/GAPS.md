# COMPLETENESS GAP ANALYSIS — Salesforce-clone spec (9 researcher dumps)

The nine dumps cover the *record model*, *pipeline*, *CPQ*, *case/ticketing*, *resourcing*, *analytics*, *SLDS chrome*, *admin/security*, and *Korean agency economics* well. What follows is what a real Salesforce user touches that **appears nowhere or only as an unexpanded bullet**. Verified against Salesforce Help / Trailhead where noted.

---

## P0 — daily user actions with no feature backing (ship-blockers)

**1. Email engine (templates, send-from-record, logging, mass email, tracking)**
Mechanics: `EmailTemplate` (Text/HTML/Lightning) in folders with merge fields `{!Contact.FirstName}` and letterhead; a **Send Email** quick action on the Case/Lead/Contact/Opportunity publisher that writes an `EmailMessage` row + `ActivityTimeline` entry; `OrgWideEmailAddress` for the From; drafts; attachments via `ContentVersion`; **List Email** (`ListEmail` object) for mass send to a list view or campaign members with per-day caps; open/click tracking fields (First Opened, Last Opened, count); Email-to-Salesforce BCC address; the Outlook/Gmail integration side panel that logs mail against records.
Why: only *Email-to-Case* and *Einstein Activity Capture* appear above. Sending a templated 제안/견적 mail from the record and having it land on the timeline is the single most frequent rep action in Salesforce, and it is 100% unspecified.

**2. Calendar surface and meeting scheduling**
Mechanics: Calendar tab with day/week/month/list; My Calendar + Other Calendars (users, public, resource) + **object calendars** built from any date field on any object (e.g. 캠페인 집행 시작일); `Event` with `EventRelation` invitees, accept/decline status, availability/"View Availability" grid, `IsRecurrence` + RecurrenceType, `ReminderDateTime`; Salesforce Scheduler / Meetings booking link with availability windows.
Why: researcher 8 lists "Calendar and shared team calendars" as one bullet. There is no calendar UI, no invitee model, no recurrence, no reminder anywhere in the spec — yet 광고주 미팅/촬영 일정 is core.

**3. Task work surface (not just the timeline)**
Mechanics: Tasks tab + split view, My Tasks / Delegated / Overdue filters, `Priority`, `Status`, `ReminderDateTime`, recurring tasks, "Create Follow-Up Task" from a completed activity, mass close/reassign from the list, task-count badges on Kanban cards (this last one *is* mentioned, with nothing producing the data).
Why: the Activity Timeline is described as a read surface only. Reps live in a task queue; managers audit it.

**4. Home page / "My Work" landing**
Mechanics: app-scoped Home built in App Builder from: **Assistant** (overdue tasks, leads not contacted in N days, opportunities with no open activity / no activity in 30 days / past close date), **Quarterly Performance** chart (Closed vs Quota vs Open Pipeline with goal line), Today's Events, Today's Tasks, Recent Records, Key Deals, Top Deals, News.
Why: listed as "Home page (app-scoped dashboard)" with zero mechanics. It is the first screen every user sees every morning, and the Assistant is the only place Salesforce *pushes* work at a rep.

**5. Notification engine**
Mechanics: bell tray with per-type read/unread and deep links; **Custom Notification Types** fired from Flow (in-app + mobile push) — the correct mechanism for 승인요청/SLA 임박/예산 소진 알림; @mention notifications; "notify me when a record I follow changes"; email digests (daily/weekly) with per-user subscription settings; snooze/dismiss; delivery-status + retry for the KakaoTalk/email bridge researcher 9 assumes.
Why: one bullet ("Notifications (in-app bell, push, email digest)"). Every SLA, approval, and pacing alert in the spec silently assumes a delivery layer that isn't designed.

**6. User lifecycle, authentication, and license governance**
Mechanics: user provisioning; **deactivate, never delete** (+ forced record reassignment on deactivation); Freeze User; license and permission-set-license consumption counters; MFA; SSO/SAML/OIDC; login IP ranges and login hours; session timeout; password policy; "Login As" with an audit entry; API-only integration users.
Why: `User` appears as an object and nothing else. Offboarding an AE mid-quarter (whose 광고주 and 미수금 must move) has no defined path, and credential/secret handling is a stated org policy requirement — model it as injected credentials (Named Credentials, below), never stored fields.

**7. Multi-currency with dated exchange rates**
Mechanics: `CurrencyIsoCode` on every currency-bearing record; corporate currency + active currency list with rates; converted-amount fields for roll-ups and reports; **Advanced Currency Management** = `DatedConversionRate` ranges applied by Opportunity Close Date to Opportunity, OpportunityLineItem, product schedules, splits and campaign opportunity fields — and explicitly *not* to forecasting or to currency fields on other objects (verified, Salesforce Help "About Advanced Currency Management").
Why: completely absent. Google/Meta/TikTok 집행은 USD 청구, 매체비·수수료·순매출은 KRW. Without dated rates, 마진 and 정산 numbers are unreproducible month to month — this is a correctness bug, not a nicety.

---

## P1 — major Sales Cloud capabilities entirely missing

**8. Enterprise Territory Management**
Mechanics: `Territory2Model` with Planning → Active → Archived states (multiple models coexist for what-if realignment); `Territory2Type` + priority; a territory hierarchy (up to ~99,999 territories per model); `Territory2Rule` assignment rules over account fields with filter logic, run on create/edit or on demand with a preview; `UserTerritory2Association` granting per-territory Account/Opportunity/Case access; `ObjectTerritory2Association`; forecasting rolled up the **territory** hierarchy instead of the role hierarchy.
Why: mentioned only in passing ("role/territory-based forecast hierarchy"). An agency assigns by 업종/매체/지역 and realigns every year; role hierarchy alone cannot express it and cannot model the 재배분 dry-run.

**9. Contacts to Multiple Accounts (`AccountContactRelation`)**
Mechanics: junction between Contact and Account carrying `Roles` (multi-select), `IsActive`, `StartDate/EndDate`, and an `IsDirect` flag distinguishing the primary employer from indirect relationships; surfaces as **Related Contacts** on Account and **Related Accounts** on Contact; enabled by an org setting.
Why: absent. A 마케팅 팀장 who covers three 계열사 브랜드, or moves from advertiser to advertiser, is unrepresentable with one `AccountId` — and losing that relationship history is exactly how agencies lose renewals.

**10. Standard Product Schedules (revenue & quantity)**
Mechanics: `OpportunityLineItemSchedule` rows; a default schedule on the PricebookEntry (`ScheduleType` Divide/Repeat, `InstallmentPeriod` daily/weekly/monthly/quarterly/annual, `NumberOfInstallments`); establish/re-establish/override per line; the editable installment grid UI; the schedule is what makes an Opportunity's amount land in the right *months*.
Why: CPQ Subscriptions are covered, standard schedules are not. 집행 기간이 3개월인 캠페인의 월별 인식·월별 세금계산서 is precisely the Divide-monthly schedule, and researcher 9's `MediaSettlement`/`TaxInvoice` objects have no engine generating their periods.

**11. Record merge (Account / Contact / Lead / Case)**
Mechanics: select up to **3** records, choose a master, field-by-field radio selection of surviving values, re-parent all related records (activities, opportunities, files, campaign members, notes) to the master, losers go to Recycle Bin, merge is auditable and irreversible.
Why: the spec says "compare-and-merge" once, as a UI pattern, with no mechanics. Duplicate detection without merge is a dead end, and Korean advertiser data (㈜ / (주) / 주식회사 / 영문명) duplicates aggressively.

**12. Mass data operations from the UI**
Mechanics: **Mass Transfer Records** (bulk owner change by criteria, with "also transfer open opportunities/cases" options and optional notification email), Mass Delete, **Add to Campaign** as a mass action from a list view or report, mass email from a list view, bulk Change Owner from a list with a "keep team" toggle, and documented selection caps (200 rows selected per list-view mass action).
Why: "mass actions" is named as a UI affordance with no operations behind it. Reassigning one departing AE's book of business is a Monday-morning admin task.

**13. Import / export UX (not just "Data Loader exists")**
Mechanics: Data Import Wizard — drag CSV, column→field **mapping screen**, match by Id / Name / External Id, "assign all to campaign", duplicate-rule handling on import; Data Loader / Bulk API 2.0 upsert by External Id with a per-row error CSV; scheduled weekly data export; report export in Formatted vs Details-Only mode with **encoding choice (UTF-8 with BOM vs EUC-KR)** and delimiter.
Why: bullets only. Every migration begins here, every 매체 실적 backfill runs here, and Korean CSV encoding is the classic silently-corrupting failure.

**14. Recycle Bin, undelete, and data recovery**
Mechanics: soft delete (`IsDeleted`) with a 15-day window, My Recycle Bin vs Org Recycle Bin views, restore-with-relationships, mass undelete, storage counting rules, and an explicit statement that beyond the window recovery is a paid/lossy process.
Why: one clause inside researcher 1's platform-columns paragraph. Deleting a 캠페인 with 3 months of PerformanceDaily rows and having no restore path is an operational disaster.

**15. Search depth beyond "SOSL exists"**
Mechanics: recent-items dropdown, Top Results + per-object result tabs driven by **Search Layouts**, result-page filters and sort, "search this list", searchable file *content*, spell correction/synonym/nickname handling, index latency semantics (search is eventually consistent), Einstein Search natural-language queries and personalization — and critically **CJK tokenization**: Korean/Japanese/Chinese are indexed with morphological/bigram segmentation, so substring search behavior differs from English.
Why: researcher 8 covers the SOSL syntax and stops. A clone that naively does `LIKE '%검색어%'` will be both slow and wrong for Korean.

**16. Files & deliverable versioning depth**
Mechanics: `ContentVersion` chain with version history and "upload new version" (V1→V2 with the same `ContentDocumentId`), preview renditions, public **file share links** with password + expiry, Libraries/Workspaces with library permissions, per-file sharing (Viewer/Collaborator/Owner), file size limits, `ContentNote` rich-text notes vs legacy Attachments.
Why: the spec says only "ContentDocumentLink is polymorphic". A production team's whole life is 시안 v1 → v2 → 최종 → 최종_진짜최종, plus sending a preview link to the 광고주 without giving them a login.

**17. Consent, privacy, and PII handling layer**
Mechanics: `Individual` (HasOptedOutOfTracking / HasOptedOutOfProfiling / ShouldForget), `ContactPointTypeConsent` / `ContactPointConsent` / `PartyConsent` keyed by **channel × purpose** (Email-Marketing, SMS-Marketing, Call), `Contact.HasOptedOutOfEmail` / `DoNotCall`, the Data Protection & Privacy setup toggle, right-to-be-forgotten execution, field-level encryption and masking in reports/exports.
Why: entirely absent across nine dumps. For a Korean agency this is legal exposure (개인정보보호법 + 정보통신망법 광고성 정보 수신동의, 야간 전송 제한) and it also satisfies the standing requirement that PII be masked in generated documents and reports.

**18. Approver experience (the other half of Approvals)**
Mechanics: the **approver inbox** (pending `ProcessInstanceWorkitem` list with mass approve/reject), delegated approver + out-of-office reassignment, approve/reject **by email reply**, mobile approval, reminder/escalation on a stalled step, "skip if approver = submitter", and the actual notification path.
Why: the *definition* side (ProcessDefinition, steps, locking, recall) is well covered; the daily manager side is not. 전자결재가 결재자 화면 없이 존재할 수 없습니다.

**19. Current-generation AI layer (Agentforce / Prompt Builder / Trust Layer)**
Mechanics: a grounded assistant side panel with record context and defined **agent actions** (invoke Flow/Apex, retrieve records); **Prompt Builder** templates bound to a field or a record page that write generated text back (e.g. 광고주 브리프 요약, 월간 리포트 초안, 통화 요약); Einstein Sales Emails; and the **Trust Layer** — prompt/response masking of PII, zero-retention, toxicity screening, and an audit trail of every prompt.
Why: the dumps stop at 2023-era scoring (1–99 + factors). The Trust Layer specifically is the piece that lets an AI feature coexist with the PII/masking policy.

---

## P2 — cross-cutting concerns the spec never touches

**20. Integration architecture and secret handling**
Mechanics: **Named Credentials + External Credentials** (auth injected at call time — never hardcoded keys or plain env vars), Platform Events and Change Data Capture for outbound streaming, Salesforce Connect / External Objects (OData) for read-only 매체 실적, Bulk API ingestion jobs with scheduling/retry/dead-letter, inbound webhook receivers with signature verification, and per-connector sync-status records.
Why: "API + governor limits" is the entire treatment. Researcher 9 assumes daily Naver/Kakao/Meta/Google/TikTok performance ingestion with no ingestion contract, no idempotency key, no backfill/restatement rule (ad platforms *revise* yesterday's numbers), and no failure surface.

**21. External-facing portal (Experience Cloud equivalent)**
Mechanics: branded external site, portal/community licenses, guest user + sharing sets, an advertiser-facing view of 캠페인 실적/견적 승인/세금계산서, and an external production-vendor view of their 발주 tickets.
Why: "Advertiser Report Generator" and "Outsourced Production Vendor Management" both imply external readers, but no dump gives an external user any way to see anything. Today that gap is filled by PPT over KakaoTalk — the exact pain the product claims to solve.

**22. Keyboard, accessibility, and Korean input ergonomics**
Mechanics: documented shortcut set with a `?` cheat-sheet overlay, keyboard navigation of the SLDS data table (arrow keys, Enter to edit, Esc to cancel, Tab to commit), console shortcuts for tabs, focus management in modals, WCAG 2.1 AA contrast/labels/roles, screen-reader announcements for toasts and inline-edit save, browser zoom, and **Korean IME behavior** — composition events must not fire type-ahead lookups or inline-edit commits mid-조합.
Why: zero coverage in the SLDS dump. IME-versus-typeahead is a guaranteed bug class in every lookup field and list-view search box you have specified.

**23. Clone, printable view, and other everyday record actions**
Mechanics: **Clone** and **Clone with Related** (an Opportunity cloned *with* its line items — the mechanism behind 월별/재계약 캠페인 복제), Change Owner with a notification checkbox, reopen a Closed opportunity, Printable View / record PDF (with embedded Korean fonts so 견적서/제안서 render), Sharing button on a record, "Follow", Favorites.
Why: several are named as chrome but Clone-with-related exists nowhere, and it is one of the top-5 buttons a rep presses.

**24. Limits, storage, retention, and performance model**
Mechanics: data vs file storage accounting, report row caps (UI vs export), list-view and Kanban record caps (Kanban is capped at 200 — stated once, with no general policy), API call limits, archival strategy for high-volume tables, and a retention/aggregation policy.
Why: `PerformanceDaily` will be, by an order of magnitude, the largest table in this system (일자 × 매체 × 캠페인 × 소재). No dump defines pre-aggregation, partitioning, or retention, and every dashboard in researcher 4's spec reads from it.

**25. Environments, release management, and configuration deployment**
Mechanics: sandbox tiers (Dev / Dev Pro / Partial Copy / Full) with refresh cadence and data-masking on copy, change sets vs source-driven deploy, scratch orgs, seasonal releases with a preview window, and the ability to move *metadata* (layouts, flows, validation rules, record types) between environments.
Why: one bullet. The whole spec is "configuration is data" — which is worthless if configuration cannot be safely promoted from test to production.

**26. Manager-side forecast discipline and rep scorecard**
Mechanics: **forecast submission with period lock and submission history** (what did this rep commit on week 1 vs week 4 vs actual → forecast accuracy over time), weekly pipeline snapshots for "what changed since last Monday" per rep, a rep activity scorecard (calls/meetings/new opps/created pipeline per week, leaderboard), ramp and attainment tracking, deal-review checklists, and structured win/loss review capture.
Why: Pipeline Inspection and the forecast grid are specified as *live* views; nothing captures the **commitment as a versioned artifact**, which is the one thing a sales manager is measured on. This is the clearest rep-centric blind spot in the whole spec.

---

### Two corrections to existing research, not gaps

- Researcher 3 states Lightning list views are "single-page (no pagination)". Modern Lightning list views page/lazy-load in chunks with a row-count cap; a clone that renders every row will die on a 50,000-row 광고주 list. Specify pagination + server-side sort/filter explicitly.
- Researcher 1 says Amount becomes "a read-only roll-up" once a line item exists — true, but it is also governed by the price book pin and by product schedules (gap #10); the roll-up rule must be stated together with the schedule engine or monthly revenue will not reconcile with `Amount`.

Sources: [Contacts to Multiple Accounts](https://help.salesforce.com/s/articleView?language=en_US&id=sales.shared_contacts_set_up.htm&type=5) · [Product Schedules](https://help.salesforce.com/s/articleView?language=en_US&id=sales.products_schedules_def.htm&type=5) · [Advanced Currency Management](https://help.salesforce.com/s/articleView?id=sf.administration_about_advanced_currency_management.htm&language=en_US&type=5) · [Enterprise Territory Management](https://trailhead.salesforce.com/content/learn/modules/advanced-territory-management/get-tips-and-tricks-for-enterprise-territory-management) · [Consent data model](https://trailhead.salesforce.com/content/learn/modules/consent-management-with-salesforce/manage-your-consent-data-model) · [Briefcase Builder / mobile offline](https://developer.salesforce.com/docs/atlas.en-us.mobile_offline.meta/mobile_offline/dx_onboard_wizard_briefcase.htm) · [Agentforce / Prompt Builder](https://www.salesforce.com/agentforce/einstein-copilot/)