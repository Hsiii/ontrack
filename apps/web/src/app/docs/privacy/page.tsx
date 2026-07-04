import type { Metadata } from 'next';

import { LegalPage, legalPageStyles as styles } from '../../LegalPage';

const SUPPORT_EMAIL = 'its.hsichen@gmail.com';
const PRIVACY_URL = 'https://ontrack.hsichen.dev/docs/privacy';
const APP_IMAGE = 'https://ontrack.hsichen.dev/ontrack-logo.png';
const APP_DESCRIPTION =
    'OnTrack Privacy Policy. OnTrack does not require an account, does not sell user data, and keeps location-based station detection on your device. OnTrack 隱私權政策。';

export const metadata: Metadata = {
    title: 'Privacy Policy | OnTrack',
    description: APP_DESCRIPTION,
    alternates: {
        canonical: PRIVACY_URL,
    },
    openGraph: {
        title: 'Privacy Policy | OnTrack',
        description: APP_DESCRIPTION,
        url: PRIVACY_URL,
        siteName: 'OnTrack',
        images: [APP_IMAGE],
        locale: 'zh_TW',
        type: 'website',
    },
    twitter: {
        card: 'summary',
        title: 'Privacy Policy | OnTrack',
        description: APP_DESCRIPTION,
        images: [APP_IMAGE],
    },
};

export default function PrivacyPage() {
    return (
        <LegalPage
            title='Privacy Policy / 隱私權政策'
            meta='Last updated: June 2026 / 更新日期：2026 年 6 月'
            subtitle='OnTrack does not require an account, does not sell user data, and keeps location-based station detection on your device. OnTrack 不需要帳號、不會出售使用者資料，定位車站偵測會保留在您的裝置上。'
            footerLinks={[{ href: '/docs/support', label: 'Support / 支援' }]}
            footerNote='Privacy information for OnTrack / OnTrack 隱私權資訊。'
        >
            <section className={styles.section} aria-labelledby='overview'>
                <h2 id='overview'>Overview / 概覽</h2>
                <p>
                    OnTrack is a train schedule app for checking departures,
                    destinations, and live delay information. The app is
                    designed around minimal data use: your device keeps
                    preferences and frequent destinations locally, while the
                    OnTrack server stores only aggregate route demand from
                    schedule lookups so popular routes can be cached and refresh
                    jobs can avoid unnecessary work.
                </p>
                <p>
                    OnTrack 是用來查詢列車出發時間、目的地與即時誤點資訊的時刻表
                    App。OnTrack
                    採用最少資料原則：偏好設定與常用目的地會保存在您的裝置上，
                    OnTrack
                    伺服器只保存時刻查詢產生的彙總路線需求，用於快取熱門路線並減少不必要的背景更新。
                </p>
                <div className={styles.callout}>
                    <strong>At a glance</strong>
                    <dl className={styles.summaryList}>
                        <div className={styles.summaryItem}>
                            <dt>Location / 定位</dt>
                            <dd>
                                Used on your device for nearby station
                                detection. Raw latitude and longitude are not
                                sent to the OnTrack server.
                                僅在裝置上用於偵測附近車站；
                                原始經緯度不會傳送到 OnTrack 伺服器。
                            </dd>
                        </div>
                        <div className={styles.summaryItem}>
                            <dt>Lookups / 查詢</dt>
                            <dd>
                                Schedule lookups send station IDs and a date.
                                查詢時刻表時會傳送車站代碼與日期。
                            </dd>
                        </div>
                        <div className={styles.summaryItem}>
                            <dt>Local data / 本機資料</dt>
                            <dd>
                                Preferences and frequent destinations stay on
                                your device unless used in a schedule lookup.
                                偏好設定與常用目的地會保留在您的裝置上，除非您用它們進行時刻查詢。
                            </dd>
                        </div>
                        <div className={styles.summaryItem}>
                            <dt>Aggregates / 彙總資料</dt>
                            <dd>
                                OnTrack stores aggregate route-demand counts,
                                not accounts or raw location history. OnTrack
                                只保存彙總路線需求，不保存帳號或原始定位紀錄。
                            </dd>
                        </div>
                    </dl>
                </div>
            </section>

            <section className={styles.section} aria-labelledby='collect'>
                <h2 id='collect'>Information We Collect / 我們收集的資訊</h2>

                <article className={styles.faqItem}>
                    <h3>Location / 定位</h3>
                    <p>
                        If you grant permission, OnTrack uses your current
                        location on your device or in your browser to choose the
                        nearest departure station.
                    </p>
                    <p>
                        若您授權定位，OnTrack
                        會在您的裝置或瀏覽器中使用目前位置來選擇最近的出發車站。
                    </p>
                    <ul>
                        <li>Detect nearby stations / 偵測附近車站</li>
                        <li>
                            Fill the origin station more quickly /
                            更快速填入出發站
                        </li>
                        <li>
                            Fall back to your cached origin if needed /
                            必要時使用已快取的出發站
                        </li>
                    </ul>
                    <p>
                        OnTrack does not send your raw latitude or longitude to
                        the OnTrack server for this feature.
                        此功能不會將您的原始經緯度傳送到 OnTrack 伺服器。
                    </p>
                </article>

                <article className={styles.faqItem}>
                    <h3>
                        Schedule Requests and Route Demand / 時刻查詢與路線需求
                    </h3>
                    <p>
                        When you request a schedule, OnTrack sends the origin
                        station ID, destination station ID, selected date, and
                        optional refresh request to the OnTrack server so it can
                        return train times and live delay status.
                    </p>
                    <p>
                        當您查詢時刻表時，OnTrack
                        會將出發站代碼、目的地站代碼、選擇日期，以及選擇性的重新整理請求傳送到
                        OnTrack 伺服器，以便回傳列車時間與即時誤點狀態。
                    </p>
                    <p>
                        To keep the service fast and avoid wasteful background
                        refreshes, OnTrack stores aggregate route-demand
                        records: origin station ID, destination station ID,
                        request count, last-seen time, and Taipei-hour demand
                        buckets. These records are used for route timetable
                        cache prewarming, live-board refresh decisions, and cron
                        optimization.
                    </p>
                    <p>
                        為了維持服務速度並避免浪費背景更新，OnTrack
                        會保存彙總路線需求紀錄：
                        出發站代碼、目的地站代碼、請求次數、最後出現時間，以及台北時區小時需求區間。
                        這些紀錄用於路線時刻表快取預熱、即時看板更新判斷與排程最佳化。
                    </p>
                </article>

                <article className={styles.faqItem}>
                    <h3>
                        Local Preferences and Destination History /
                        本機偏好設定與目的地紀錄
                    </h3>
                    <p>
                        OnTrack stores preferences on your device, such as your
                        selected origin and destination, cached origin,
                        language, appearance, share format, and frequent
                        destination history. This is used to restore your setup
                        and power destination auto-fill.
                    </p>
                    <p>
                        OnTrack
                        會在您的裝置上保存偏好設定，例如已選擇的出發站與目的地、快取出發站、語言、外觀、分享格式與常用目的地紀錄。
                        這些資料用於還原您的設定並提供目的地自動填入。
                    </p>
                    <p>
                        This local preference history is not uploaded as a
                        separate profile. A destination becomes part of a server
                        request only when you use it in a schedule lookup.
                    </p>
                    <p>
                        本機偏好紀錄不會作為獨立個人檔案上傳。只有當您使用某個目的地進行時刻查詢時，它才會成為伺服器請求的一部分。
                    </p>
                </article>

                <article className={styles.faqItem}>
                    <h3>Analytics and Diagnostics / 分析與診斷</h3>
                    <p>
                        The production website may use Cloudflare Web Analytics
                        and hosting telemetry to understand basic site
                        reliability and performance. Apple, Cloudflare, and
                        other platform providers may process diagnostics, crash
                        reports, or request metadata according to their own
                        policies.
                    </p>
                    <p>
                        正式網站可能使用 Cloudflare Web Analytics
                        與主機遙測來了解基本網站可靠性與效能。 Apple、Cloudflare
                        與其他平台服務提供者可能會依其政策處理診斷資料、當機報告或請求中繼資料。
                    </p>
                </article>

                <article className={styles.faqItem}>
                    <h3>Personal Information / 個人資訊</h3>
                    <p>
                        OnTrack does not require an account and does not collect
                        personally identifiable information such as your name,
                        phone number, or mailing address.
                    </p>
                    <p>
                        OnTrack
                        不需要帳號，也不會收集您的姓名、電話號碼、通訊地址等可識別個人的資訊。
                    </p>
                </article>
            </section>

            <section className={styles.section} aria-labelledby='third-party'>
                <h2 id='third-party'>Third-Party Services / 第三方服務</h2>
                <p>
                    OnTrack may rely on the following services / OnTrack
                    可能依賴以下服務：
                </p>
                <ul>
                    <li>
                        Apple services for iOS system features, permissions,
                        crash reports, and App Store distribution. Apple
                        服務用於 iOS 系統功能、權限、當機報告與 App Store 發布。
                    </li>
                    <li>
                        Official railway data sources, including Taiwan
                        transport data services, for schedules and delay
                        information.
                        官方鐵路資料來源，包括台灣交通資料服務，用於時刻與誤點資訊。
                    </li>
                    <li>
                        Cloudflare services for hosting, performance,
                        infrastructure, and basic web analytics. Cloudflare
                        服務用於主機、效能、基礎設施與基本網站分析。
                    </li>
                </ul>
            </section>

            <section className={styles.section} aria-labelledby='sharing'>
                <h2 id='sharing'>Data Sharing / 資料分享</h2>
                <p>User data is never sold. 我們不會出售使用者資料。</p>
                <p>
                    OnTrack shares information only when needed to provide app
                    functionality, operate hosting and analytics, maintain or
                    troubleshoot the service, or comply with legal obligations.
                    The OnTrack application database does not store accounts,
                    names, phone numbers, mailing addresses, or raw location
                    coordinates.
                </p>
                <p>
                    OnTrack 只會在提供 App
                    功能、營運主機與分析、維護或排除服務問題，或符合法律義務所需時分享資訊。
                    OnTrack
                    應用程式資料庫不保存帳號、姓名、電話號碼、通訊地址或原始定位座標。
                </p>
            </section>

            <section className={styles.section} aria-labelledby='retention'>
                <h2 id='retention'>Data Retention / 資料保留</h2>
                <p>
                    Local preferences stay on your device until you clear site
                    data, reset app data, or uninstall the app. OnTrack server
                    route-demand aggregates are kept while they are useful for
                    cache prewarming and refresh optimization. Diagnostics,
                    crash reports, request metadata, and analytics handled by
                    platform or hosting providers are retained according to
                    those providers&apos; policies.
                </p>
                <p>
                    本機偏好設定會保留在您的裝置上，直到您清除網站資料、重設 App
                    資料或解除安裝 App。 OnTrack
                    伺服器的路線需求彙總資料會在對快取預熱與更新最佳化仍有用時保留。
                    由平台或主機提供者處理的診斷資料、當機報告、請求中繼資料與分析資料，會依各提供者政策保留。
                </p>
            </section>

            <section className={styles.section} aria-labelledby='rights'>
                <h2 id='rights'>Your Rights / 您的權利</h2>
                <ul>
                    <li>
                        You may disable Location permission in iOS Settings.
                        您可以在 iOS 設定中關閉定位權限。
                    </li>
                    <li>
                        You may contact us with privacy-related questions at{' '}
                        <a
                            className={styles.inlineLink}
                            href={`mailto:${SUPPORT_EMAIL}`}
                        >
                            {SUPPORT_EMAIL}
                        </a>
                        . 若有隱私相關問題，您可以透過此信箱聯絡我們。
                    </li>
                </ul>
            </section>

            <section className={styles.section} aria-labelledby='contact'>
                <h2 id='contact'>Contact / 聯絡方式</h2>
                <p>
                    <a
                        className={styles.inlineLink}
                        href={`mailto:${SUPPORT_EMAIL}`}
                    >
                        {SUPPORT_EMAIL}
                    </a>
                </p>
            </section>
        </LegalPage>
    );
}
