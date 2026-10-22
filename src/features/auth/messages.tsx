import { defineMessages } from "@/i18n";
import type { ReactNode } from "react";

export const t = defineMessages({
	"zh-TW": {
		docTitle: "登入",
		tagline: "更快、更人類的 Moodle",
		signInWithE3: "使用陽明交通大學 E3 登入",
		school: "學校",
		otherSchool: "其他學校／自訂 Moodle 網址",
		moodleUrl: "Moodle 網址",
		moodleUrlHint: "可貼上 Moodle 首頁或登入頁網址。",
		username: "帳號或學號",
		password: "Moodle 密碼",
		showPassword: "顯示密碼",
		remember: (days: number) => `保持登入 ${days} 天`,
		signIn: "登入",
		signingIn: "登入中…",
		invalidLogin: "學號或密碼不正確",
		signInFailed: "登入失敗，請稍後再試",
		useNycu: "改用陽明交通大學 E3",
		chooseOtherSchool: "不是陽明交大的學生？選擇其他學校",
		staticSite: "密碼只會送到學校的 Moodle，不會傳到 EM3 伺服器。",
		whatIsEm3: "EM3 是什麼？",
		ssoAllow: "瀏覽器詢問是否開啟 web+emthree 連結時，請選擇「允許」；登入完成後將自動返回 EM3。",
		ssoBlocked: (copy: ReactNode, reask: ReactNode) => (
			<>
				誤關詢問會被 Chrome 視為封鎖，請至{copy}移除封鎖後，{reask}。
			</>
		),
		copyUrl: (url: string) => `複製 ${url}`,
		reask: "重新詢問",
		ssoStartFailed: "無法開始單一登入，請確認瀏覽器允許此網站儲存資料。",
		ssoButton: "使用學校單一登入（SSO）",
		ssoNotBack: "單一登入完成後沒有回到 EM3？",
		ssoStepCopy: (page: string, link: ReactNode) => (
			<>
				在 {page} 的完成頁面，長按或按右鍵複製「{link}」的連結。
			</>
		),
		ssoStepPaste: "貼到下方欄位，選擇「完成登入」。",
		ssoLinkLabel: "單一登入連結",
		finishSignIn: "完成登入",
		ssoNoLink: "沒有收到登入連結",
		backToLogin: "回登入頁",
		ssoSigningIn: "正在完成單一登入…"
	},
	en: {
		docTitle: "Sign in",
		tagline: "A faster, more human Moodle",
		signInWithE3: "Sign in with NYCU E3",
		school: "School",
		otherSchool: "Other school / custom Moodle URL",
		moodleUrl: "Moodle URL",
		moodleUrlHint: "You can paste the address of the Moodle home page or sign-in page.",
		username: "Username or student ID",
		password: "Moodle password",
		showPassword: "Show password",
		remember: (days: number) => `Stay signed in for ${days} days`,
		signIn: "Sign in",
		signingIn: "Signing in…",
		invalidLogin: "Incorrect username or password",
		signInFailed: "Couldn't sign in. Please try again later.",
		useNycu: "Use NYCU E3 instead",
		chooseOtherSchool: "Not at NYCU? Choose another school",
		staticSite: "Your password only goes to your school's Moodle, never to the EM3 server.",
		whatIsEm3: "What is EM3?",
		ssoAllow: "When the browser asks whether to open web+emthree links, choose Allow. EM3 opens again once you've signed in.",
		ssoBlocked: (copy: ReactNode, reask: ReactNode) => (
			<>
				Chrome treats closing that prompt as blocking it. Go to {copy}, remove the block, then {reask}.
			</>
		),
		copyUrl: (url: string) => `Copy ${url}`,
		reask: "ask again",
		ssoStartFailed: "Couldn't start single sign-on. Check that your browser lets this site store data.",
		ssoButton: "Sign in with school SSO",
		ssoNotBack: "Didn't come back to EM3 after signing in?",
		ssoStepCopy: (page: string, link: ReactNode) => (
			<>
				On the {page} finish page, long-press or right-click “{link}” and copy the link.
			</>
		),
		ssoStepPaste: "Paste it below and choose Finish signing in.",
		ssoLinkLabel: "Single sign-on link",
		finishSignIn: "Finish signing in",
		ssoNoLink: "No sign-in link was received",
		backToLogin: "Back to sign-in",
		ssoSigningIn: "Finishing single sign-on…"
	},
	ja: {
		docTitle: "ログイン",
		tagline: "もっと速く、人にやさしい Moodle",
		signInWithE3: "陽明交通大学 E3 でログイン",
		school: "学校",
		otherSchool: "その他の学校／Moodle の URL を指定",
		moodleUrl: "Moodle の URL",
		moodleUrlHint: "Moodle のトップページかログインページの URL を貼り付けられます。",
		username: "アカウントまたは学籍番号",
		password: "Moodle のパスワード",
		showPassword: "パスワードを表示",
		remember: (days: number) => `${days} 日間ログインしたままにする`,
		signIn: "ログイン",
		signingIn: "ログイン中…",
		invalidLogin: "アカウントまたはパスワードが正しくありません",
		signInFailed: "ログインできませんでした。しばらくしてからもう一度お試しください。",
		useNycu: "陽明交通大学 E3 に戻す",
		chooseOtherSchool: "陽明交通大学以外の学生はこちらから学校を選択",
		staticSite: "パスワードは学校の Moodle にだけ送られ、EM3 のサーバーには送られません。",
		whatIsEm3: "EM3 とは？",
		ssoAllow: "ブラウザに web+emthree リンクを開くか聞かれたら「許可」を選んでください。ログインが終わると EM3 に戻ります。",
		ssoBlocked: (copy: ReactNode, reask: ReactNode) => (
			<>
				確認を閉じると Chrome はブロックとして扱います。{copy}でブロックを解除してから、{reask}。
			</>
		),
		copyUrl: (url: string) => `${url} をコピー`,
		reask: "もう一度確認する",
		ssoStartFailed: "シングルサインオンを開始できませんでした。このサイトがデータを保存できるようブラウザで許可されているか確認してください。",
		ssoButton: "学校のシングルサインオン（SSO）でログイン",
		ssoNotBack: "ログイン後に EM3 に戻らない場合",
		ssoStepCopy: (page: string, link: ReactNode) => (
			<>
				{page} の完了ページで「{link}」を長押しまたは右クリックし、リンクをコピーします。
			</>
		),
		ssoStepPaste: "下の欄に貼り付けて「ログインを完了」を選びます。",
		ssoLinkLabel: "シングルサインオンのリンク",
		finishSignIn: "ログインを完了",
		ssoNoLink: "ログインリンクを受け取れませんでした",
		backToLogin: "ログインページに戻る",
		ssoSigningIn: "シングルサインオンを完了しています…"
	},
	emoji: {
		docTitle: "🔑",
		tagline: "⚡🧑‍🎓🎓",
		signInWithE3: "🏫🔑",
		school: "🏫",
		otherSchool: "🏫❓ / 🔗✏️",
		moodleUrl: "🎓🔗",
		moodleUrlHint: "📋 🏠🔗 / 🔑🔗",
		username: "👤🆔",
		password: "🎓🔒",
		showPassword: "👁️🔒",
		remember: (days: number) => `🔒⏳ ${days}📆`,
		signIn: "🔑➡️",
		signingIn: "🔑⏳",
		invalidLogin: "👤🔒❌",
		signInFailed: "🔑💥 · ⏳🔁",
		useNycu: "🔙🏫",
		chooseOtherSchool: "🏫❓➡️",
		staticSite: "🔒 → 🎓 · 🚫🖥️",
		whatIsEm3: "❓",
		ssoAllow: "🌐❓ web+emthree → ✅ · 🔙 EM3",
		ssoBlocked: (copy: ReactNode, reask: ReactNode) => (
			<>
				❌ = 🚫 · 👉 {copy} 🔓 · {reask}
			</>
		),
		copyUrl: (url: string) => `📋 ${url}`,
		reask: "🔁❓",
		ssoStartFailed: "🔑💥 · 💾🚫",
		ssoButton: "🏫🔑",
		ssoNotBack: "🔙❓",
		ssoStepCopy: (page: string, link: ReactNode) => (
			<>
				{page} ✅📄 · 👆📋 “{link}”
			</>
		),
		ssoStepPaste: "📋⬇️ · 🔑✅",
		ssoLinkLabel: "🔑🔗",
		finishSignIn: "🔑✅",
		ssoNoLink: "🔗❓",
		backToLogin: "🔙🔑",
		ssoSigningIn: "🔑⏳"
	}
});
