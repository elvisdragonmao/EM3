import { defineMessages } from "@/i18n";
import type { ReactNode } from "react";

// Headings are string lists: each item is one line, joined with <br />.

export const t = defineMessages({
	"zh-TW": {
		docTitle: "更快、更人類的 Moodle",
		openEm3: "打開 EM3",
		signInSchool: "用學校帳號登入",
		signIn: "登入",
		starOnGitHub: "在 GitHub 上給顆星",
		starCount: (n: number) => `（目前 ${n} 顆星）`,
		heroTitle: ["E3 拉完了，", "寫個給人用的吧。"],
		heroBody: "EM3 是陽明交大課務系統 E3 的客戶端，設計給無論是老師還是學生。打開就知道這週要交什麼、現在這堂課的投影片在哪，作業拖進來就交。不用安裝，用原本的 E3 帳號登入。",
		dashboardAlt: "EM3 首頁：上課中的課程、這週行事曆與即將截止的作業",
		focusTitle: ["打開毫無重點，", "什麼都找不到。"],
		focusBody: [
			"原本的 E3 首頁要往下捲整個畫面，才看得到沒有課名的「未來事件」。EM3 的第一個畫面就是這週：哪門課、交了沒、還剩多久。",
			"設定好課表之後，正在上的那堂課會放在最上面，還有幾分鐘下課、教材、作業、公告，一目瞭然。"
		],
		timeTitle: ["時間用講的，", "不用心算。"],
		timeBody: "左邊是 E3 上實際看到的寫法。午夜截止的作業會顯示成隔天的「AM 12:00」，很容易以為還有一天。EM3 一律寫成前一天的 24:00，日期換成昨天、上星期幾這種說法。",
		// Left: strings copied from the official E3 pages. Right: what EM3 shows (as seen on Thursday 10/15).
		timeBefore: ["10月 22日 星期四, AM 12:00", "10月 21日 星期三, PM 11:59", "今天, PM 12:00", "10月 14日", "10 10月 2026"],
		timeAfter: ["下星期三 10/21 24:00", "下星期三 10/21 23:59", "今天 12:00", "昨天 星期三", "10/10 上星期六"],
		timeBeforeLabel: "E3 的寫法：",
		timeAfterLabel: "EM3 的寫法：",
		filesTitle: ["一個檔案，", "就是一個檔案"],
		filesBody: ["E3 的「教材」其實是資料夾，而大部分資料夾裡只有一份投影片。EM3 把它們攤平，最新的放最上面，一週內的新檔案會標出來。", "PDF、圖片、影片直接在旁邊打開，不用每次都下載。"],
		materialsAlt: "EM3 課程頁：教材依時間排列，PDF 可直接預覽",
		submitTitle: ["上傳檔案，", "交出去，", "很難嗎？"],
		submitBody: ["沒有沒人用的維基圖庫、沒有授權條款下拉選單、沒有「儲存更改」。允許的檔案類型寫在拖放區裡，選錯當場就會提醒。", "按下繳交前會列出 E3 上最後會有哪些檔案；逾期的話也會先告訴你。"],
		submitAlt: "EM3 作業頁：拖放檔案後按繳交",
		coursesTitle: ["學期過了，", "課程就不見", "是三小。"],
		coursesBody: ["依學期分組，本學期在最上面；微學分、線上課程分開放。每門課有自己的顏色和圖示，名字太長可以取簡稱，不想看的可以藏起來。", "這些設定只存在你的瀏覽器，可以匯出成檔案帶到別台電腦。"],
		coursesAlt: "EM3 課程列表：依學期分組，每門課有自己的顏色與圖示",
		timetableTitle: ["知道你在哪堂課", "快速獲得資源"],
		timetableBody: "貼上課綱上的時間代碼，像是 T34R7-EC022，或直接在格子上點。之後側欄和首頁會自動把正在上的課標出來，連下課倒數都有。",
		timetableAlt: "EM3 課表編輯器",
		teacherTitle: ["老師那一側的 E3，", "一樣拉完了。"],
		teacherBody: "評分表在 1920 寬的螢幕上一列都塞不下；下載全部的資料夾用的是對不回學號的「參與者編號」；有四份選課已失效的學生交的作業，根本不在評分表裡。",
		gradingTitle: ["J、K、⌘↵，", "下一位。"],
		gradingBody: [
			"左邊名單、右邊作業，打分數、寫評語、⌘↵ 存檔跳下一位。評語可以用按鈕排版或直接寫 Markdown，常用的句子存成片語一鍵插入。",
			"下載全部會照「學號_姓名」分資料夾、附成績表；改好的檔案拖回來自動對回每位學生，成績用 CSV 匯入、寫入前先給你看新舊對照。Excel 存成 Big5 也讀得懂。"
		],
		gradingAlt: "EM3 評分工作台：左邊學生名單，右邊繳交內容與評分",
		quizTitle: ["出題有 136 個欄位，", "是在開飛機？"],
		quizBody: [
			"在 EM3 打題目，或直接從 Excel 貼上，下載 Moodle XML 丟進 E3 題庫，一份小考從一百多次點擊變成幾分鐘。",
			"公告用 Markdown 寫，程式碼、數學式都留得住；發布前先看學生會看到的樣子。E3 沒開放新增教材的 API，所以教材在這裡寫好、一鍵複製貼回 E3。"
		],
		quizAlt: "EM3 小考出題：題目卡片與 Moodle XML 匯出",
		announceAlt: "EM3 發布公告：Milkdown 編輯器",
		keyboardTitle: "全鍵盤操作，有手就行",
		keyboardBody: (mod: string) => `每個按鈕都能用 Tab 走到，常用的事都有單鍵快捷鍵。忘了的時候，按 ${mod} / 就會列出來。`,
		keyLabels: ["跳到任何一門課", "切換頁面", "上下移動", "切換課程分頁", "選檔案上傳", "看全部快捷鍵"],
		shortcutsAlt: "EM3 鍵盤快捷鍵列表",
		mobileTitle: "通勤路上也看得清楚",
		mobileBody: "手機上是底部導覽列和精簡的週曆，點日期就列出當天要交的東西。PDF 交給手機自己的檢視器開。",
		mobileDashboardAlt: "EM3 手機版首頁",
		mobileCourseAlt: "EM3 手機版課程頁",
		themesTitle: (n: number) => `${n} 個主題，點一下就換`,
		themesBody: "daisyUI 的全部主題，加上 EM3 自己的淺色和深色。現在就可以試，這一頁會跟著變。",
		themesGroup: "主題",
		followSystem: "跟隨系統",
		privacyTitle: ["你的帳號，", "你決定放在哪裡"],
		dataChoice: ["兩個版本，你選。", "本機版的瀏覽器直接呼叫學校的 Moodle，完全不經過 EM3 伺服器。伺服器版為了提醒、同步和助教協作，會把登入憑證加密保存在 EM3 伺服器，隨時可以在設定裡刪除。"],
		noPassword: ["不存密碼。", "密碼只會送到學校的 Moodle，用來換一組登入憑證；憑證放在這個網站的 cookie，登出就清掉。"],
		noAutoRead: ["不替你按已讀。", "公告的已讀狀態只記在你的瀏覽器（站內信例外，打開時會像在 E3 一樣標為已讀）；EM3 不會在你按下繳交之前碰你的作業，老師的評分也要按下儲存才會寫入。"],
		openSource: "程式碼全部公開。",
		openSourceBody: (link: ReactNode) => <>{link}，有疑慮可以自己看，也可以自己架一份。</>,
		outroTitle: "今天要交什麼？",
		outroBody: "登入看看。覺得好用的話，到 GitHub 給一顆星，讓更多同學找到它。",
		footer: (author: ReactNode) => <>EM3 由{author}製作，與國立陽明交通大學無關。</>
	},
	en: {
		docTitle: "A faster, more human Moodle",
		openEm3: "Open EM3",
		signInSchool: "Sign in with your school account",
		signIn: "Sign in",
		starOnGitHub: "Star on GitHub",
		starCount: (n: number) => ` (${n} ${n === 1 ? "star" : "stars"})`,
		heroTitle: ["E3 is a mess.", "Let's build one people can use."],
		heroBody:
			"EM3 is a new client for E3, NYCU's course system, made for students and teachers alike. Open it and you know what's due this week and where the slides for your current class are. Drag your homework in and it's submitted. Nothing to install: sign in with the E3 account you already have.",
		dashboardAlt: "EM3 home page: the class in session, this week's calendar and upcoming deadlines",
		focusTitle: ["Everything on screen,", "nothing you need."],
		focusBody: [
			"On E3's home page you scroll down a whole screen just to reach “Upcoming events”, which don't even show course names. EM3 opens on this week: which course, whether you've handed it in, and how long you have left.",
			"Once your timetable is set up, the class you're in sits at the top, with how many minutes are left, its materials, assignments and announcements, all at a glance."
		],
		timeTitle: ["Times in plain words,", "no mental math."],
		timeBody:
			"On the left is what E3 actually shows. A deadline at midnight appears as “12:00 AM” on the following day, so it's easy to think you have one more day. EM3 always writes it as 24:00 on the day before, and says “yesterday” or “last Saturday” instead of a bare date.",
		timeBefore: ["Thursday, 22 October, 12:00 AM", "Wednesday, 21 October, 11:59 PM", "Today, 12:00 PM", "14 October", "10 October 2026"],
		timeAfter: ["Next Wednesday, 10/21 24:00", "Next Wednesday, 10/21 23:59", "Today 12:00", "Yesterday", "Last Saturday, 10/10"],
		timeBeforeLabel: "On E3: ",
		timeAfterLabel: "On EM3: ",
		filesTitle: ["A file", "is just a file"],
		filesBody: [
			"On E3, “materials” are really folders, and most of them hold a single slide deck. EM3 flattens them, puts the newest on top and marks anything added in the past week.",
			"PDFs, images and videos open right alongside, so you don't download them every time."
		],
		materialsAlt: "EM3 course page: materials sorted by date, with a PDF previewed in place",
		submitTitle: ["Upload a file,", "hand it in.", "How hard can it be?"],
		submitBody: [
			"No wiki image library nobody uses, no license dropdown, no “Save changes”. The allowed file types are written in the drop zone, and you're told on the spot if you pick the wrong kind.",
			"Before you submit, EM3 lists exactly which files will end up on E3, and tells you up front if you're late."
		],
		submitAlt: "EM3 assignment page: files dropped in, ready to submit",
		coursesTitle: ["The semester ends", "and your courses vanish?", "What the hell."],
		coursesBody: [
			"Courses are grouped by semester, with this one on top; micro-credit and online courses get their own groups. Every course has its own color and icon, long names can get a nickname, and the ones you don't need can be hidden.",
			"These settings stay in your browser, and you can export them to a file to take to another computer."
		],
		coursesAlt: "EM3 course list grouped by semester, each course with its own color and icon",
		timetableTitle: ["Knows which class you're in,", "gets you there fast"],
		timetableBody:
			"Paste the time code from the course catalog, like T34R7-EC022, or just click the grid. From then on the sidebar and home page highlight the class in session, right down to a countdown to the end of class.",
		timetableAlt: "EM3 timetable editor",
		teacherTitle: ["E3 for teachers?", "Just as much of a mess."],
		teacherBody:
			"The grading table can't fit a single row on a 1920-pixel-wide screen. “Download all” names folders by “participant ID”, which you can't match back to student IDs. And four submissions from students whose enrollment had lapsed weren't in the grading table at all.",
		gradingTitle: ["J, K, ⌘↵.", "Next."],
		gradingBody: [
			"Students on the left, their work on the right. Enter a grade, write feedback, and ⌘↵ saves and moves on to the next student. Format feedback with buttons or write Markdown, and save phrases you use a lot for one-click insertion.",
			"“Download all” sorts submissions into “studentID_name” folders with a grade sheet. Drag your marked-up files back and each one finds its student. Import grades from CSV and check the before-and-after before anything is written. Excel files saved as Big5 work too."
		],
		gradingAlt: "EM3 grading workspace: student list on the left, submission and grade on the right",
		quizTitle: ["136 fields to write a quiz?", "Are we flying a plane?"],
		quizBody: [
			"Type questions in EM3 or paste them straight from Excel, then download Moodle XML and drop it into the E3 question bank. A quiz goes from a hundred-plus clicks to a few minutes.",
			"Write announcements in Markdown, with code and math intact, and preview what students will see before you post. E3 has no API for adding materials, so you write them here and copy them back to E3 in one click."
		],
		quizAlt: "EM3 quiz builder: question cards and Moodle XML export",
		announceAlt: "Writing an announcement in EM3's Milkdown editor",
		keyboardTitle: "Run it all from the keyboard",
		keyboardBody: (mod: string) => `Every button is reachable with Tab, and everyday actions have single-key shortcuts. Forgot one? Press ${mod} / to see them all.`,
		keyLabels: ["Jump to any course", "Switch pages", "Move up and down", "Switch course tabs", "Pick a file to upload", "Show all shortcuts"],
		shortcutsAlt: "EM3 keyboard shortcut list",
		mobileTitle: "Easy to read on the commute",
		mobileBody: "On your phone you get a bottom tab bar and a compact week view; tap a date to see everything due that day. PDFs open in your phone's own viewer.",
		mobileDashboardAlt: "EM3 home page on a phone",
		mobileCourseAlt: "EM3 course page on a phone",
		themesTitle: (n: number) => `${n} themes, one click away`,
		themesBody: "Every daisyUI theme, plus EM3's own light and dark. Try one now and this page changes with it.",
		themesGroup: "Theme",
		followSystem: "Match system",
		privacyTitle: ["Your account,", "where you choose"],
		dataChoice: [
			"Two versions, your call.",
			" In the local version your browser talks to your school's Moodle directly and never to the EM3 server. For reminders, sync and TA collaboration, the server version keeps your sign-in token encrypted on the EM3 server; you can delete it in Settings at any time."
		],
		noPassword: ["No stored passwords.", " Your password only ever goes to your school's Moodle, to get a sign-in token. The token lives in this site's cookie and is cleared when you sign out."],
		noAutoRead: [
			"Nothing gets marked read behind your back.",
			" Which announcements you've read is kept in your browser only (messages are the exception: opening one marks it read, just like on E3). EM3 won't touch your submission until you press Submit, and teachers' grades are written only when they press Save."
		],
		openSource: "Fully open source.",
		openSourceBody: (link: ReactNode) => <> The code is at {link}. If you have doubts, read it yourself, or host your own copy.</>,
		outroTitle: "What's due today?",
		outroBody: "Sign in and see. If you like it, give it a star on GitHub so more classmates can find it.",
		footer: (author: ReactNode) => <>EM3 is made by {author} and is not affiliated with National Yang Ming Chiao Tung University.</>
	},
	ja: {
		docTitle: "もっと速く、人にやさしい Moodle",
		openEm3: "EM3 を開く",
		signInSchool: "学校のアカウントでログイン",
		signIn: "ログイン",
		starOnGitHub: "GitHub でスターを付ける",
		starCount: (n: number) => `（現在 ${n} スター）`,
		heroTitle: ["E3 はもう限界。", "人が使えるものを作ろう。"],
		heroBody:
			"EM3 は、陽明交通大学の授業システム E3 のためのクライアントです。学生にも教員にも使いやすく作りました。開けばすぐに、今週の提出物も、いま受けている授業のスライドの場所もわかります。課題はドラッグするだけで提出完了。インストール不要で、いつもの E3 アカウントでログインできます。",
		dashboardAlt: "EM3 のホーム：授業中の科目、今週のカレンダー、締め切りが近い課題",
		focusTitle: ["開いても要点ゼロ、", "何も見つからない。"],
		focusBody: [
			"E3 のトップページでは、画面をまるごとスクロールしてやっと「今後のイベント」にたどり着きますが、そこには科目名すらありません。EM3 は最初の画面が今週の予定。どの授業か、提出したか、締め切りまであとどれくらいかがすぐわかります。",
			"時間割を設定すれば、いま受けている授業がいちばん上に。終了までの残り時間、教材、課題、お知らせがひと目で見られます。"
		],
		timeTitle: ["日時はことばで。", "暗算はいりません。"],
		timeBody:
			"左が E3 の実際の表示です。深夜 0 時締め切りの課題は翌日の「12:00 AM」と表示されるので、まだ 1 日あると勘違いしがちです。EM3 では常に前日の 24:00 と表示し、日付も「昨日」「先週の土曜日」のような言い方にします。",
		// E3 has no Japanese interface, so the left column shows its English one.
		timeBefore: ["Thursday, 22 October, 12:00 AM", "Wednesday, 21 October, 11:59 PM", "Today, 12:00 PM", "14 October", "10 October 2026"],
		timeAfter: ["来週の水曜日 10/21 24:00", "来週の水曜日 10/21 23:59", "今日 12:00", "昨日 水曜日", "10/10 先週の土曜日"],
		timeBeforeLabel: "E3 の表示：",
		timeAfterLabel: "EM3 の表示：",
		filesTitle: ["ファイルは、", "ただのファイル"],
		filesBody: [
			"E3 の「教材」の正体はフォルダで、しかもほとんどはスライドが 1 つ入っているだけ。EM3 はそれを平らに並べ、新しいものを上に、1 週間以内に追加されたファイルには印を付けます。",
			"PDF も画像も動画もその場で開けるので、毎回ダウンロードする必要はありません。"
		],
		materialsAlt: "EM3 の授業ページ：教材が日付順に並び、PDF をその場でプレビュー",
		submitTitle: ["ファイルを上げて、", "提出する。", "そんなに難しい？"],
		submitBody: [
			"誰も使わない Wiki 画像ライブラリも、ライセンスのドロップダウンも、「変更を保存」もありません。受け付けるファイル形式はドロップエリアに書いてあり、違う形式を選ぶとその場で知らせます。",
			"提出する前に、最終的に E3 に残るファイルを一覧表示します。期限を過ぎている場合も先にお知らせします。"
		],
		submitAlt: "EM3 の課題ページ：ファイルをドロップして提出するところ",
		coursesTitle: ["学期が終わると", "授業が消えるって", "なんなの。"],
		coursesBody: [
			"授業は学期ごとにまとまり、今学期がいちばん上。マイクロ単位やオンライン授業は別にまとめます。授業ごとに色とアイコンを設定でき、長い名前には略称を付けられ、見たくない授業は非表示にできます。",
			"これらの設定はブラウザの中だけに保存されます。ファイルに書き出して別のパソコンに持っていくこともできます。"
		],
		coursesAlt: "EM3 の授業一覧：学期ごとにまとまり、授業ごとに色とアイコンが付いている",
		timetableTitle: ["いまの授業がわかるから、", "必要なものにすぐ届く"],
		timetableBody: "シラバスの時間コード（例：T34R7-EC022）を貼り付けるか、マス目を直接クリックするだけ。あとはサイドバーとホームがいまの授業を自動で強調し、終了までのカウントダウンまで表示します。",
		timetableAlt: "EM3 の時間割エディター",
		teacherTitle: ["教員側の E3 も、", "やっぱり限界。"],
		teacherBody:
			"評定表は横幅 1920 の画面でも 1 行に収まりません。「すべてダウンロード」のフォルダ名は、学籍番号と照合できない「参加者番号」。登録が無効になった学生 4 人の提出物は、そもそも評定表に載っていませんでした。",
		gradingTitle: ["J、K、⌘↵、", "次の人。"],
		gradingBody: [
			"左に学生一覧、右に提出物。点数を付けてコメントを書き、⌘↵ で保存して次の人へ。コメントはボタンで書式を付けても Markdown で書いてもよく、よく使う文はフレーズとして保存すればワンクリックで挿入できます。",
			"「すべてダウンロード」は「学籍番号_氏名」のフォルダに分け、成績表も付けます。添削したファイルをドラッグして戻せば学生ごとに自動で振り分け。成績は CSV から取り込め、書き込む前に新旧の比較を確認できます。Big5 で保存された Excel ファイルも読み込めます。"
		],
		gradingAlt: "EM3 の採点画面：左に学生一覧、右に提出内容と評定",
		quizTitle: ["問題作成に 136 項目って、", "飛行機の操縦？"],
		quizBody: [
			"EM3 で問題を入力するか Excel から貼り付けて、Moodle XML をダウンロードし E3 の問題バンクに取り込むだけ。100 回以上クリックしていた小テスト作りが数分で終わります。",
			"お知らせは Markdown で書け、コードも数式も崩れません。投稿前に学生側の見え方を確認できます。E3 には教材を追加する API がないため、教材はここで書いてワンクリックでコピーし、E3 に貼り付けます。"
		],
		quizAlt: "EM3 の小テスト作成：問題カードと Moodle XML の書き出し",
		announceAlt: "EM3 のお知らせ投稿：Milkdown エディター",
		keyboardTitle: "すべてキーボードで操作できる",
		keyboardBody: (mod: string) => `どのボタンにも Tab で移動でき、よく使う操作には 1 キーのショートカットがあります。忘れたら ${mod} / で一覧を表示できます。`,
		keyLabels: ["どの授業にもジャンプ", "ページを切り替え", "上下に移動", "授業のタブを切り替え", "アップロードするファイルを選ぶ", "ショートカット一覧"],
		shortcutsAlt: "EM3 のキーボードショートカット一覧",
		mobileTitle: "通学中でも見やすい",
		mobileBody: "スマホでは下部のナビゲーションバーとコンパクトな週カレンダー。日付をタップすればその日の提出物が一覧できます。PDF はスマホ標準のビューアーで開きます。",
		mobileDashboardAlt: "EM3 のスマホ版ホーム",
		mobileCourseAlt: "EM3 のスマホ版授業ページ",
		themesTitle: (n: number) => `${n} 種類のテーマを、クリックひとつで`,
		themesBody: "daisyUI の全テーマに、EM3 独自のライトとダークを加えました。今すぐ試せます。このページも一緒に切り替わります。",
		themesGroup: "テーマ",
		followSystem: "システムに合わせる",
		privacyTitle: ["あなたのアカウントの置き場所は", "あなたが決める"],
		dataChoice: [
			"2 つのバージョンから選べます。",
			"ローカル版はブラウザが学校の Moodle と直接やり取りし、EM3 サーバーには一切接続しません。サーバー版は通知・同期・TA の協力機能のため、ログイン用トークンを暗号化して EM3 サーバーに保存します。設定からいつでも削除できます。"
		],
		noPassword: ["パスワードは保存しません。", "パスワードは学校の Moodle にだけ送られ、ログイントークンの取得に使われます。トークンはこのサイトの Cookie に保存され、ログアウトすると消去されます。"],
		noAutoRead: [
			"勝手に既読にしません。",
			"お知らせの既読状態はブラウザの中だけに記録します（メッセージは例外で、E3 と同じく開くと既読になります）。EM3 が提出物に触れるのは提出ボタンを押したときだけ。教員の評定も保存を押すまで書き込まれません。"
		],
		openSource: "ソースコードはすべて公開。",
		openSourceBody: (link: ReactNode) => <>{link} で公開しています。気になることがあれば自分で確かめることも、自分でホストすることもできます。</>,
		outroTitle: "今日の提出物は？",
		outroBody: "ログインして確かめてみてください。気に入ったら GitHub でスターを付けて、もっと多くの学生に届けてください。",
		footer: (author: ReactNode) => <>EM3 は {author} が制作しています。国立陽明交通大学とは関係ありません。</>
	},
	emoji: {
		docTitle: "⚡🧑‍🎓🎓",
		openEm3: "🚀",
		signInSchool: "🏫🔑",
		signIn: "🔑",
		starOnGitHub: "⭐🐙",
		starCount: (n: number) => ` ⭐${n}`,
		heroTitle: ["🗑️🔥", "🛠️✨🙂"],
		heroBody: "🏫🎓📱 · 🧑‍🎓🧑‍🏫 · 👀🗓️📌 · 📽️📍 · 📄➡️📤✅ · 🚫💿 · 🔑",
		dashboardAlt: "🏠: 📍🎓 · 🗓️ · ⏰📝",
		focusTitle: ["👀🌫️", "🔍🤷"],
		focusBody: ["🖱️⬇️⬇️⬇️ → 🗓️❓🏷️🚫 😩", "🗓️⏰ → 📍🎓 ⏳ · 📄 · 📝 · 📢 👌"],
		timeTitle: ["🕐💬", "🧠🧮🚫"],
		timeBody: "🌚12:00 = 😱 ⏩📅 · 🛌💤 → 😭 · ⏪📅 24:00 ✅",
		timeBefore: ["🗓️ 10/22 🌳 🌚12:00", "🗓️ 10/21 💧 🌚11:59", "📍 🌞12:00", "🗓️ 10/14", "🗓️ 10/10/2026"],
		timeAfter: ["➡️🗓️💧 10/21 24:00", "➡️🗓️💧 10/21 23:59", "📍 12:00", "⬅️ 💧", "10/10 ⬅️🗓️🪐"],
		timeBeforeLabel: "🗑️ ",
		timeAfterLabel: "✨ ",
		filesTitle: ["📄", "= 📄"],
		filesBody: ["📁📁📁 → 📄📄📄 · 🆕⬆️ · 🆕7️⃣📆 🏷️", "📕🖼️🎬 👀 · 🚫⬇️"],
		materialsAlt: "📚: 📄🗓️ · 📕👀",
		submitTitle: ["📤📄", "✅", "🤔❓"],
		submitBody: ["🚫🖼️📚 · 🚫📜🔽 · 🚫💾 · 📥📄 ✅/❌", "📤 → 👀📄📄 · ⏰🚨"],
		submitAlt: "📝: 📥📄 → 📤",
		coursesTitle: ["🗓️🔚", "📚💨", "🤬"],
		coursesBody: ["🗓️🗂️ · 🆕⬆️ · 🎨🔣 · ✂️🏷️ · 🙈", "💾🌐 · 📤📁 → 💻"],
		coursesAlt: "📚🗂️🗓️ · 🎨🔣",
		timetableTitle: ["📍🎓", "⚡📚"],
		timetableBody: "📋 T34R7-EC022 / 👆🔲 → 📍🎓 · ⏳🔔",
		timetableAlt: "🗓️✏️",
		teacherTitle: ["🧑‍🏫🏫", "🗑️🔥"],
		teacherBody: "📊↔️💥 · 📁#️⃣❓ · 4️⃣📝👻",
		gradingTitle: ["J K ⌘↵", "⏭️🧑‍🎓"],
		gradingBody: ["🧑‍🎓📋 | 📝 · 💯 · 💬 · ⌘↵ 💾⏭️ · ✍️ · 📌💬", "⬇️📁🆔 + 📊 · 📥📄 → 🧑‍🎓🎯 · 📄📊 → 👀🆚 · 🇹🇼📊✅"],
		gradingAlt: "💯: 🧑‍🎓📋 | 📝💯",
		quizTitle: ["1️⃣3️⃣6️⃣🔲❓", "✈️🧑‍✈️"],
		quizBody: ["⌨️ / 📋📊 → 📦 → 🏫🗃️ · 🖱️💯➡️⏱️", "📢✍️ · 💻➗ ✅ · 👀 → 📤 · 📚📋 → 🏫"],
		quizAlt: "❓✏️🃏 · 📦⬇️",
		announceAlt: "📢✍️",
		keyboardTitle: "⌨️💪",
		keyboardBody: (mod: string) => `⇥ 🔘🔘🔘 · 1️⃣⌨️⚡ · 🤔 → ${mod} / 📋`,
		keyLabels: ["🚀📚", "🔀📄", "⬆️⬇️", "🔀🗂️", "📤📄", "📋⌨️"],
		shortcutsAlt: "⌨️📋",
		mobileTitle: "🚇📱👀",
		mobileBody: "📱⬇️🧭 · 🗓️ · 👆📅 → 📝 · 📕📱",
		mobileDashboardAlt: "📱🏠",
		mobileCourseAlt: "📱📚",
		themesTitle: (n: number) => `${n}🎨 👆`,
		themesBody: "🌼🎨 + ☀️🌙 · 👆 → 🖼️🔄",
		themesGroup: "🎨",
		followSystem: "🖥️",
		privacyTitle: ["👤", "📱 / 🖥️ ❓"],
		dataChoice: ["📱 / 🖥️", " 📱 → 🎓 · 🖥️ 🔑🔒 → 🔔🔄🤝 · ⚙️🗑️"],
		noPassword: ["🚫💾🔒", " 🔒 → 🎟️ · 🍪 · 🚪👋 → 🗑️"],
		noAutoRead: ["🚫👁️✅", " 📢👁️ → 🌐 · ✉️👁️ = ✅ · 📝🙅 → 📤 · 💯🙅 → 💾"],
		openSource: "📖🔓",
		openSourceBody: (link: ReactNode) => <> {link} · 🔍 · 🏗️</>,
		outroTitle: "📍📝❓",
		outroBody: "🔑👀 · 👍 → ⭐🐙 → 🧑‍🎓🧑‍🎓🧑‍🎓",
		footer: (author: ReactNode) => <>🛠️ {author} · 🙅🏫</>
	}
});
