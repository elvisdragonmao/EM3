# Repository Guidelines

## Commit And PR Guidance

Use Linux kernel/Git-style commit subjects with a concrete area, subsystem, component, directory, package, or file prefix:

```
area: imperative patch summary
sub/sys: imperative patch summary
```

The prefix should name the repository area primarily changed. Prefer specific prefixes such as a directory, package, file, subsystem, or component name.

Do not use generic Conventional Commit prefixes such as `fix:`, `feat:`, `chore:`, `docs:`, or `refactor:` unless they are actual repository areas in this repository. The prefix should describe where the change belongs, not what type of change it is.

Use an imperative verb in the summary after the colon, such as `fix`, `clarify`, `split`, `validate`, `rename`, `remove`, `add`, `update`, `document`, etc. Do not use past tense verbs like `fixed` or `added`.

When a patch spans multiple areas, choose the narrowest common area if one exists. If no clear common area exists, use the primary behavior changed rather than listing multiple unrelated prefixes.

The summary after the colon should briefly describe what the patch does, because it becomes the first line shown in the git changelog. Keep it short, imperative, and specific. Prefer subjects under 72 characters. Use lowercase for the first word after the colon unless it is a proper noun, and do not end the subject with a period.

Examples:

```
storybook: clarify build ownership
web/routes: split route-level chunks
ui/field: fix select menu positioning
server/auth: validate session cookie
githooks.txt: improve the intro section
```

Use a commit body when the reason for the change is not obvious from the diff. Explain why the change is needed, not just what changed.

PRs should describe the changed area, summarize the user-visible or developer-visible impact, list validation commands run, link related issues, and include screenshots for visible web UI changes.

If no validation was run, state that explicitly and explain why. Do not claim to have run commands that were not actually executed.

For UI changes that are not easily captured in a screenshot, describe the visual change and any manual checks performed.

## E3 Test Account And Agent Tools

EM3 talks to the real NYCU E3 (`https://e3p.nycu.edu.tw`, Moodle 4.5 mobile web service). A real student account is stored in `.env.local` as `E3_USERNAME` / `E3_PASSWORD`. The file is gitignored; never commit it, print it, or prefix the variables with `VITE_` (that would ship them in the bundle).

The account belongs to a real student, so all automated work must be read-only:

- Never submit, upload, save drafts, post, reply, delete, change preferences (including the E3 language switch and course-list filters), star or hide courses, mark anything read, or start quiz attempts.
- You may open a submission page or EM3's confirm dialog to inspect it, but never press the final submit.
- Prefer the web service API over clicking around the E3 web UI; when driving a browser, abort every non-GET request to E3.

Helpers:

- `python3 scripts/e3-ws.py <wsfunction> [key=value ...]` calls a web service function and prints JSON. It only allows read verbs (`get`, `search`, `list`, `check`, `can`, `data`). Array params use Moodle syntax, e.g. `'courseids[0]=25283'`.
- `scripts/e3-browser.mjs` exports `openE3()`: a Playwright session on the official E3 web UI that aborts every non-GET request (except read-only AJAX) and GETs that Moodle stores as preferences (`quickgrading`, `perpage`, `filter`, table sorting). Use it for research on real E3 pages; the account is an `editingteacher` in course 23571 with real students.
- `NODE_PATH=$(npm root -g) node scripts/shot.mjs <outdir> <width>x<height> <hash-path>...` screenshots EM3 pages signed in as the test account, with state-changing E3 requests aborted. Run `pnpm dev` first. Uses the globally installed Playwright.

Design rationale, the user research, the server version's design and the accessibility self-assessment are in `DESIGN.md`. Facts about E3's web service measured during that research are below.

## Code Conventions

- **i18n.** Every user-facing string lives in the feature's `messages.ts(x)`, declared with `defineMessages` from `src/i18n` in four locales: `zh-TW` (the source, Taiwanese usage), `en`, `ja` and `emoji` (emoji only). `tsc` fails when a locale misses a key or changes a function's signature. E3 content and the Chinese strings EM3 matches in E3 responses are not translated. Code that tests import must use relative imports, because `tsx` has no `@/` alias.
- **Accessibility (WCAG 2.1 AA and Taiwan's badge, AA).** Secondary text at least `text-base-content/65`; every control has a name, and icon-only buttons an `aria-label` (Phosphor icons are `aria-hidden` through `IconContext`); async results go to an always-mounted `role="status"` or `role="alert"`; dialogs are `<dialog>` + `showModal()` with `aria-labelledby`; no heading skips; no px font sizes; `target="_blank"` links carry `tc("openInNewTab")`; form errors use `aria-invalid` + `aria-describedby`.
- **Images.** Photos and screenshots are WebP at quality 80, at most twice their largest displayed size (`scripts/screens-to-webp.py`). Icons and the share image stay PNG/JPG because platforms require those formats.

## E3 Web Service Notes

Facts measured on the real E3 (Moodle 4.5.4+, Build 20250417, theme `boost_union`) during the 2026-10 research. "Untested" means inferred from Moodle 4.5 source, not observed on E3.

### Test data

- The account has 42 enrolments: 1141 ×10, 1142 ×13, 114X ×1, 1151 ×10, ICT ×5, `114.freshman`, `CTLD_TA`, `GEEOC2022`.
- Teaching course 23571 (`ICT.20260316`, 26 participants, 1 section): assignment 「期末報告」 is cmid 218500 / assignid 40340. Its news forum is 28034 and its Q&A forum is 28268 (empty). Course 23502 has no assignments.
- 23571 has no groups, no groupings, no quizzes, no file-submission assignments, no marking workflow and no team submission. editpdf, group grading and quiz editing cannot be observed there.

### Transport and errors

- Errors come back as HTTP 200 with `{"exception","errorcode","message"}`; `message` is in the user's language. Seen: `invalidtoken`, `requireloginerror`, `invalidparameter`, `nopermissions`.
- `/webservice/rest/server.php` returns `access-control-allow-origin: *` on both the preflight and the real request.
- Site info: `usermaxuploadfilesize=1073741824`, `userquota=104857600`, `messaging=0`. Blogs, badges, global search and tags are off. `enablecompletion=1`, but every module has `completion: 0`.

### Files

- WS `fileurl`s point to `/webservice/pluginfile.php/...`, and some already carry `?forcedownload=1`. Append `token=` with `?` or `&` to match.
- Without a token, the server answers 200 with JSON `missingparam`, not a 4xx. Non-WS `/pluginfile.php/...?token=` 303s to the login page, so always rewrite to `/webservice/pluginfile.php`.
- Headers: `access-control-allow-origin: *`, `access-control-allow-headers: range`, `accept-ranges: bytes`, so mp4 streams directly.
- Disposition: WS PDFs are `inline` even with `forcedownload=1`, while `text/plain` is `attachment`. On the web UI, `/pluginfile.php?...forcedownload=1` is `attachment` and the same URL without the flag is `inline`.
- The folder form defaults to 「強制下載檔案」 on. That is why course-page PDF links download instead of opening.
- HTML in forum posts, folder intros and assign intros contains `<img src>` and `<a href>` to `webservice/pluginfile.php` without a token. It never contains `@@PLUGINFILE@@`.
- `mimetype` is unreliable (`.f3d` → `application/zip`, `.dxf` → `text/plain`, `.exe`/`.py` → `document/unknown`). Use the file extension.
- Sizes: median ~1.6 MB. Course mp4s run up to 271 MB, and folder `introfiles` videos up to ~478 MB. `?preview=thumb` thumbnails are untested.

### Courses and semesters

- Semester courses use shortname `^(\d{3})([12X])\.(\d{6})$` (1 = 上, 2 = 下, X = 暑). The fullname starts with the shortname: `1151.515505.演算法概論 Introduction to Algorithms`.
- Course codes are 6 digits. 515xxx covers several units, so the prefix is not a department.
- Non-semester shortnames: `ICT.0106`, `ICT.20260316`, `ICT.0112-NN`, `114.freshman`, `CTLD_TA`, `GEEOC2022`. ICT fullnames start with `ICT微學分課程_`.
- `ICT.0112-NN` are personal sub-courses in category 「測試區」 whose fullname is a real person's name plus student id. Never display or screenshot them.
- `classification=inprogress` includes perpetual courses (`GEEOC2022` ends 2040, `CTLD_TA` has `enddate=0`). Terms also overlap: 1142 ends 2026-09-12 and 1151 starts 2026-09-07. Take the current term as the highest term code among in-progress courses.
- `courseimage` in timeline results and calendar events is a base64 SVG of 4–15 KB per course, about 500 KB of a 526 KB timeline response. Strip it before caching. `courses_by_field` returns it as a URL instead.
- `core_course_get_courses_by_field field=ids` accepts a CSV of ids (32 ids → 53 KB). At NYCU, `summary`, `customfields` and `overviewfiles` are always empty.
- `categoryname` and `coursecategory` can have trailing spaces, so trim them.
- The category tree is `/<term>/<college>/<dept>` and is rebuilt every term, so category ids change between terms. Root names look like `115上學期` or `114暑期`, plus 「學校業務支援」 and 「測試區」; they can serve as a fallback semester source.
- Teacher names in `contacts[].fullname`, forum `userfullname` and similar fields are formatted `系所 / 英文縮寫 姓名`. Administrative units have no abbreviation.
- Timeline has no role field. Use `core_user_get_course_user_profiles` `roles[].shortname`, because `roles[].name` contains raw `{mlang zh_tw}…{mlang}{mlang en}…{mlang}`.

### Course contents

- 27 of 34 semester courses have only section 0 「一般」. Week names are hand-typed: one course skips Week 4, and another lists the newest week first.
- `core_course_get_contents` omits folder intros because `showdescription` is off. Empty folders (23 seen) keep Google links and embedded mp4s in `intro`/`introfiles`, available only from `mod_folder_get_folders_by_courses`.
- Folder subdirectories are rare (`filepath` like `/1009講義/`). Some folder names carry a legacy `[參考資料]` prefix.
- E3 relabels `modplural`: folder 「教材」, resource 「整包教材檔案」, url 「超連結」, supervideo 「超級影片」, quiz 「測驗卷」, page 「線上編輯文件」.
- `dates[]` labels are localized. Key on `dataid` (`allowsubmissionsfromdate`, `duedate`, `timeclose`).
- Resource `afterlink` holds E3's 「上傳於 …」 HTML. `customdata` is a JSON string that can contain PHP-serialized strings.
- `mod_supervideo` exposes no source URL. Its only WS functions, `view_supervideo` and `progress_save_mobile`, both write state. Supervideos still appear as grade items.
- The 「課程講義 / 參考資料」 split on E3's 教材列表 page is not exposed by any WS. It is not derived from the name prefix.
- `core_course_get_updates_since(courseid, since)` returns `instances[{contextlevel: module, id: cmid, updates[{name: discussions|configuration|submissions|grades|gradeitems}]}]`.

### Assignments (student side)

- Nearly every assignment uses file submission only, and `submissiondrafts=0` on all of them. `cansubmit` is therefore always false; use `canedit`.
- There is no late flag. Compare `duedate` with `submission.timemodified`.
- 76% of assignments have `cutoffdate=0`, so late submission stays open.
- Some assignments are grade items only (comments plugin only, or `nosubmissions=1`). Keep them out of to-do lists.
- `filetypeslist` can name Moodle groups (`document`, `archive`, `presentation`) instead of extensions. Whether `core_form_get_filetypes_browser_data` is available is untested.
- About 52% put the task sheet in `introattachments`. Due times cluster at 23:59, but `00:00` is common (7 of 19 this term).
- `feedback` appears only after grading. `gradefordisplay` is HTML (`&nbsp;/&nbsp;`). editpdf output sits in `partial`/`download` (`combined.pdf`) and `pages`.
- Students cannot get class-wide submitted counts; those need grader capability.

### Calendar and notifications

- `core_calendar_get_action_events_by_timesort` lists only unsubmitted items. It sets `overdue: true` on late-but-open work and `action.actionable: false` before opening.
- `core_calendar_get_calendar_upcoming_view` also includes attempted quizzes. Five events take ~99 KB because every event embeds the full `course` object.
- `event.instance` is the cmid, not the assign id. `mod_assign_get_submission_status` takes the assign id.
- Quiz event `name` carries a suffix (`… 關閉`), so use `activityname`. `formattedtime` and `description` are HTML.
- `message_popup_get_popup_notifications` types: `assign_due_soon`, `assign_overdue`, `assign_due_digest`, `coursecontentupdated`. New forum posts never produce a notification.

### Forums

- Every course has exactly one `type=news` forum named 「公告」 (`forcesubscribe=1`, `maxattachments=9`). Students have `cancreatediscussions=false`.
- Forum tracking is off (`istracked=false`, `unreadpostscount=null`), so read state must be local.
- Q&A forums use `forcesubscribe=0`: staff who don't subscribe get no mail.
- Site news is `forumid=1`. Filter out posts whose `timeend` has passed.
- `mod_forum_get_discussion_posts` returns newest first, so the root post comes last; build threads from `parentid`.
- Messages are HTML and often contain bare, unlinked URLs.
- E3-internal links to intercept: `/mod/forum/view.php?f=`, `/mod/forum/discuss.php?d=`, `/mod/folder/view.php?id=`, `/blocks/dcpc_news/news/news_view.php?d=<discussionid>`.
- Announcements per course per term: median ~5, max 27, so `perpage=50` covers all of them.
- `mod_forum_add_discussion` options are only `discussionsubscribe`, `discussionpinned`, `inlineattachmentsid` and `attachmentsid`. There is no scheduling (`timestart`) and no `mailnow`.

### Quizzes and grades

- For closed quizzes, `mod_quiz_get_quizzes_by_courses` returns fewer fields (`navmethod` and `hasquestions` come back null).
- Readable quiz settings for teacher checks: `timeopen`, `timeclose`, `timelimit`, `attempts`, `grademethod`, `hasquestions`, `sumgrades`, `visible`.
- As a student, `gradereport_user_get_grade_items` fails with `nopermissions` unless you pass `userid=<siteinfo.userid>`. As a teacher, it returns the whole class with `gradeishidden`, `gradehiddenbydate` and `gradeislocked`.
- `gradereport_overview_get_course_grades` covers every course in one call; ungraded is `grade:"-"`, `rawgrade:null`. `gradereport_user_get_grades_table` returns HTML cells only.
- Courses have 3–10 `manual` grade items. Calculated items can expose ranges like `-10000–10000`.

### Teacher-side ids and rosters

- `mod_assign_list_participants` covers only active enrolments, so it can miss students who submitted. In 23571 there were 22 `submitted` in `get_submissions` against 18 in participants.
- `list_participants` also includes `guest` (旁聽生) roles. It has no username or idnumber, and its `recordid` is not the participant number.
- `list_participants` embeds `enrolledcourses` for every user (26 users → 166 KB).
- `mod_assign_get_submissions` returns only the latest attempt.
- In `mod_assign_get_grades`, grades are strings and `"-1.00000"` with `grader: -1` means ungraded.
- 「參與者編號」, the number used in download folder names, worksheets and feedback zips, equals `mod_assign_get_user_mappings` `id`. It is per assignment, and mappings include past members (32 vs 26).
- Student ids (學號) come only from `core_grades_get_gradable_users` `username`/`idnumber`, usually 9 digits but sometimes 7. `core_enrol_get_enrolled_users` returns them empty.
- `core_user_get_users_by_field field=username` returns `[]` for other users; `field=email` works. Student emails mix `@nycu.edu.tw` with external domains.
- `core_grading_get_definitions` and `save_definitions` are missing from the mobile service, so `advancedgradingdata` (rubric, marking guide) cannot be filled.
- `mod_assign_save_grade` has no notify parameter. Notification follows the assignment's 「通知學生」 default, which is on (untested).
- `core_message_send_instant_messages` exists, but core messaging is disabled. It is not dcpcmail, and it is untested.
- `local_dcpcmail_get_index type=course itemid=<courseid>` lists one course's mail. dcpcmail has no send, reply, label or star function.

### E3 download and upload formats

- The download-all zip is named `{course shortname}-{assignment name}-{cmid}.zip`. With folders, each entry is `{display name}_{參與者編號}_assignsubmission_{plugin}/{file}`. Online text arrives as `onlinetext.html`.
- The display name is `學號 系所  縮寫 姓名`: the `/` becomes two spaces, and some names have 3 segments. The first segment is not always the student id.
- Offline worksheet: `?id=<cmid>&plugin=offline&pluginsubtype=assignfeedback&action=viewpluginpage&pluginaction=downloadgrades` downloads it even when the menu hides it (`assignfeedback_offline` disabled). The file is UTF-8 with BOM and LF line endings.
- Worksheet rows are matched by `識別碼` = `參與者N`. Column headers and dates are localized, and status is a combined string (`已繳交 - 過期N 小時…`).
- Feedback zip import (Moodle `importziplib`, untested on E3): names are split on `_` into 5 segments, and segment 2 is the participant number. If the plugin segments are invalid, the file is skipped silently.
- The importer ignores unchanged and dot files and fails on an extra outer folder. Imported files become feedback files only: no editpdf, no grade.
- `/grade/import/csv/index.php?id=` can match by `username` (the student id). Grades imported this way override the gradebook, and the assignment page does not show them.
- Assignment settings freeze once a submission exists: team submission and blind marking become read-only text. Marking allocation stays hidden until marking workflow is on.

### Requests with side effects (beyond the list above)

- `?lang=en` / `?lang=zh_tw` (the header EN/TW links) saves the account language.
- The 我的課程 grouping dropdown POSTs `/r.php/api/rest/v2/user/current/preferences/block_myoverview_user_grouping_preference`.
- Opening `action=grader` POSTs the `assign_filter` preference. If you block it, the grader shows "TypeError: Failed to fetch" and its panels never load.
- These also save preferences: grading-table `status=notsubmitted`, `downloadasfolders`, section collapse/「全部收合」, skipping the gradebook tour, calendar 事件金鑰 toggles, and dcpcmail per-page links (they carry `sesskey`).
- `local/dcpcmail/create.php?sesskey=` creates a draft on open. `action=grantextension` opens a write form, and `/editmode.php` is a POST.
- The notification popover's ✓ marks everything read.
- `/course/mod.php?delete=<cmid>` without `sesskey` probably shows a confirmation page. Untested.

### Rendering and quiz import

- MathJax and TeX filters are on (`core_filters_get_available_in_context`). E3 also treats `$…$` as inline math, along with `\(…\)` and `$$…$$`. Math renders only after save.
- Question import offers Moodle XML, GIFT, Aiken, CSV (the extra `qformat_csv` plugin), Blackboard, multianswer and missingword. 「從檔案中取得類別」 is on by default, so `$course$/top/<name>` categories apply.
- In imports, `fraction` must be a value Moodle accepts (100, 50, 33.33333, 25, 20…) or the import fails. The question name, labelled 「概念/能力指標」, is required.
- GIFT special characters `{}=~#:` clash with LaTeX braces; Moodle XML with CDATA does not.

## Server Version

The server version (see `DESIGN.md`, 伺服器版) is the Worker in `worker/`, with D1 tables in `migrations/`. Local development:

```sh
node scripts/server-keys.mjs > .dev.vars   # once; TOKEN_KEY, VAPID keys, DEV_ORIGIN (gitignored)
pnpm db:migrate                            # apply migrations to the local D1 in .wrangler/
pnpm dev:server                            # wrangler dev on :8787
pnpm dev                                   # Vite on :5173, proxies /api to :8787
```

- Trigger the cron locally with `curl "localhost:8787/cdn-cgi/handler/scheduled?cron=*/15+*+*+*+*"` (`/__scheduled` is served the SPA because only `/api/*` runs the Worker first).
- Run a single `wrangler dev` per `.wrangler` state; two instances on the same local D1 fail with `SQLITE_BUSY`. Use `--port` and `--persist-to` for a second, isolated one.
- `DEV_ORIGIN` (local only) lets the Vite proxy's `Origin` through and enables localhost mocks for push services and Discord. Never set it in production.
- Get a server session for curl by posting the test account's token to `POST /api/session` (see `DESIGN.md`). Never print the token.
- The Worker must never write to the real E3 from a local run: release (`mod_assign_save_grades`) and reminders are tested with stubbed `fetch` in `tests/`. Playwright can't intercept requests the Worker makes.
- Worker code and anything it imports from `src/` must not pull in the app's DOM code; shared modules such as `src/lib/moodle/sites.ts` and `params.ts` have no imports for that reason.
- New tables or columns go in a new numbered migration; never edit an applied one.

## Deploy

`main` deploys to Cloudflare Workers at `https://e3.emtech.cc` via the `deploy` job in `.github/workflows/ci.yml`, which applies D1 migrations (`wrangler d1 migrations apply em3 --remote`) and then runs `wrangler deploy`. It needs the `CLOUDFLARE_API_TOKEN` repository secret with Workers and D1 edit permissions. Manual deploy: `pnpm run deploy` (uses `wrangler.jsonc`).

Production secrets, set once with `wrangler secret put`: `TOKEN_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (generate with `node scripts/server-keys.mjs`; leave out `DEV_ORIGIN`). Don't rotate them casually: a new `TOKEN_KEY` makes every stored token unreadable, and a new VAPID key drops every push subscription.
