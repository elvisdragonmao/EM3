// Relative import so the Node test runner (tsx, no path aliases) can load it.
import { defineMessages } from "../../i18n";

export const t = defineMessages({
	"zh-TW": {
		notLoggedIn: "尚未登入",
		httpStatus: (status: number) => `Moodle 回應 HTTP ${status}`,
		unreachable: "無法連線到這個 Moodle；學校可能未啟用行動版 API 或跨網域存取",
		notMoodle: "這個網址看起來不是 Moodle，或學校未啟用行動版 API",
		uploadFailed: (status: number) => `上傳失敗 HTTP ${status}`,
		uploadNetwork: "上傳時網路中斷",
		urlRequired: "請輸入 Moodle 網址",
		urlInvalid: "Moodle 網址格式不正確",
		urlHttps: "為保護帳號密碼，Moodle 網址必須使用 HTTPS",
		ssoExpired: "單一登入已逾時，請重新開始",
		ssoBadLink: "連結格式不正確",
		ssoWrongLaunch: "這個連結不是這次登入產生的，請重新按單一登入"
	},
	en: {
		notLoggedIn: "You're not signed in",
		httpStatus: (status: number) => `Moodle responded with HTTP ${status}`,
		unreachable: "Couldn't connect to this Moodle site. The school may not have enabled the mobile API or cross-origin access.",
		notMoodle: "This URL doesn't look like a Moodle site, or the school hasn't enabled the mobile API.",
		uploadFailed: (status: number) => `Upload failed (HTTP ${status})`,
		uploadNetwork: "The connection dropped during the upload",
		urlRequired: "Enter a Moodle URL",
		urlInvalid: "That isn't a valid Moodle URL",
		urlHttps: "To protect your password, the Moodle URL must use HTTPS",
		ssoExpired: "Single sign-on timed out. Start again.",
		ssoBadLink: "That link isn't in the right format",
		ssoWrongLaunch: "This link wasn't made by this sign-in. Press single sign-on again."
	},
	ja: {
		notLoggedIn: "ログインしていません",
		httpStatus: (status: number) => `Moodle が HTTP ${status} を返しました`,
		unreachable: "この Moodle に接続できませんでした。学校がモバイル API またはクロスオリジンアクセスを有効にしていない可能性があります。",
		notMoodle: "この URL は Moodle ではないか、学校がモバイル API を有効にしていないようです。",
		uploadFailed: (status: number) => `アップロードに失敗しました（HTTP ${status}）`,
		uploadNetwork: "アップロード中に接続が切れました",
		urlRequired: "Moodle の URL を入力してください",
		urlInvalid: "Moodle の URL の形式が正しくありません",
		urlHttps: "パスワードを守るため、Moodle の URL は HTTPS である必要があります",
		ssoExpired: "シングルサインオンの有効期限が切れました。もう一度やり直してください",
		ssoBadLink: "リンクの形式が正しくありません",
		ssoWrongLaunch: "このリンクは今回のログインで作られたものではありません。もう一度シングルサインオンを押してください"
	},
	emoji: {
		notLoggedIn: "🔑❓",
		httpStatus: (status: number) => `🎓⚠️ ${status}`,
		unreachable: "🎓🔌❌ · 📱🚫",
		notMoodle: "🔗🤔 🎓❓",
		uploadFailed: (status: number) => `📤💥 ${status}`,
		uploadNetwork: "📤📶❌",
		urlRequired: "🎓🔗❓",
		urlInvalid: "🎓🔗❌",
		urlHttps: "🔓🚫 · 🔒🔗✅",
		ssoExpired: "🔑⏰❌ · 🔁",
		ssoBadLink: "🔗❌",
		ssoWrongLaunch: "🔗🙅 · 🔁🔑"
	}
});
