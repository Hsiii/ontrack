import type { Metadata } from 'next';

import { LegalPage, legalPageStyles as styles } from '../../LegalPage';

const SUPPORT_EMAIL = 'its.hsichen@gmail.com';
const SUPPORT_URL = 'https://ontrack.hsichen.dev/docs/support';
const APP_IMAGE = 'https://ontrack.hsichen.dev/demo.png';
const APP_DESCRIPTION =
    'OnTrack support and troubleshooting for station detection, train times, sharing, and bug reports. OnTrack 支援與疑難排解。';

export const metadata: Metadata = {
    title: 'OnTrack Support',
    description: APP_DESCRIPTION,
    alternates: {
        canonical: SUPPORT_URL,
    },
    openGraph: {
        title: 'OnTrack Support',
        description: APP_DESCRIPTION,
        url: SUPPORT_URL,
        siteName: 'OnTrack',
        images: [APP_IMAGE],
        locale: 'zh_TW',
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'OnTrack Support',
        description: APP_DESCRIPTION,
        images: [APP_IMAGE],
    },
};

export default function SupportPage() {
    return (
        <LegalPage
            title='OnTrack Support / OnTrack 支援'
            subtitle='Need help with OnTrack? Send us a note. 需要協助使用 OnTrack？歡迎聯絡我們。'
            footerLinks={[
                { href: '/docs/privacy', label: 'Privacy Policy / 隱私權政策' },
            ]}
            footerNote='Support resources for OnTrack / OnTrack 支援資訊。'
        >
            <section className={styles.section} aria-labelledby='contact'>
                <h2 id='contact'>Contact / 聯絡方式</h2>
                <div className={styles.callout}>
                    <p>
                        For questions, feedback, or bug reports, email support
                        and include any details that can help us reproduce the
                        issue.
                    </p>
                    <p>
                        若有問題、建議，或遇到錯誤，請寄信給支援信箱，並附上可協助重現問題的資訊。
                    </p>
                    <a
                        className={styles.supportAction}
                        href={`mailto:${SUPPORT_EMAIL}`}
                    >
                        Email support / 寄信給支援
                    </a>
                </div>
                <p>
                    {SUPPORT_EMAIL} · We typically respond within 1-3 business
                    days. 我們通常會在 1-3 個工作天內回覆。
                </p>
            </section>

            <section className={styles.section} aria-labelledby='faq'>
                <h2 id='faq'>Frequently Asked Questions / 常見問題</h2>
                <div className={styles.faqList}>
                    <article className={styles.faqItem}>
                        <h3>
                            The app can't detect my station. / App
                            無法偵測車站。
                        </h3>
                        <ul>
                            <li>
                                Ensure Location Services are enabled.
                                確認定位服務已開啟。
                            </li>
                            <li>
                                Verify OnTrack has permission to access your
                                location. 確認 OnTrack 有定位權限。
                            </li>
                            <li>
                                Wait a few seconds for station detection.
                                請等待數秒讓 App 判斷附近車站。
                            </li>
                        </ul>
                    </article>

                    <article className={styles.faqItem}>
                        <h3>
                            Train times seem incorrect. / 列車時間看起來不正確。
                        </h3>
                        <ul>
                            <li>Tap the refresh button. 點選重新整理按鈕。</li>
                            <li>
                                Delay information depends on the official
                                railway data source and may update periodically.
                                誤點資訊來自官方鐵路資料來源，可能會分批更新。
                            </li>
                        </ul>
                    </article>

                    <article className={styles.faqItem}>
                        <h3>
                            How do I share my current train? /
                            如何分享目前列車？
                        </h3>
                        <p>
                            Open the train details page and tap the{' '}
                            <strong>Share</strong> button.
                            開啟列車詳細資訊後，點選
                            <strong>分享</strong>按鈕。
                        </p>
                    </article>

                    <article className={styles.faqItem}>
                        <h3>
                            I found a bug or have a feature request. /
                            我發現錯誤或想提出功能建議。
                        </h3>
                        <p>
                            Please include these details if available /
                            請盡量附上：
                        </p>
                        <ul>
                            <li>Device model / 裝置型號</li>
                            <li>iOS version / iOS 版本</li>
                            <li>OnTrack version / OnTrack 版本</li>
                            <li>Screenshots, if applicable / 相關截圖</li>
                            <li>Steps to reproduce / 重現步驟</li>
                        </ul>
                    </article>
                </div>
            </section>
        </LegalPage>
    );
}
