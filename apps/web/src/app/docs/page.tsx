import { Clock3, MapPin, Navigation, Share2 } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import styles from './page.module.css';

const APP_URL = 'https://ontrack.hsichen.dev/';
const DOCS_URL = 'https://ontrack.hsichen.dev/docs';
const APP_IMAGE = 'https://ontrack.hsichen.dev/ontrack-web-showcase.png';

export const metadata: Metadata = {
    title: 'OnTrack 台鐵時刻表 App | Web 與 iPhone 查車工具',
    description:
        'OnTrack 是台鐵時刻表 App，支援最近車站偵測、即時延誤、下一班列車與班次分享，可在 Web 與 iPhone 使用。',
    alternates: {
        canonical: DOCS_URL,
    },
    openGraph: {
        title: 'OnTrack 台鐵時刻表 App',
        description:
            '自動偵測最近車站、依延誤調整下一班列車，快速查台鐵時刻表與分享抵達時間。',
        url: DOCS_URL,
        siteName: 'OnTrack',
        images: [APP_IMAGE],
        locale: 'zh_TW',
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'OnTrack 台鐵時刻表 App',
        description:
            '快速查台鐵時刻表、即時延誤與下一班列車，可在 Web 與 iPhone 使用。',
        images: [APP_IMAGE],
    },
};

const features = [
    {
        icon: MapPin,
        title: '自動偵測最近車站',
        body: '開啟定位後，OnTrack 便能依您的當前位置自動判斷起點站。',
    },
    {
        icon: Navigation,
        title: '智慧預測目的地',
        body: '使用幾次後，OnTrack會開始以您的搭乘習慣預測目的地並幫您填入。',
    },
    {
        icon: Clock3,
        title: '輕鬆找出下一班列車',
        body: '整合即時延誤資料、幫您找出下一班能搭上的列車。',
    },
    {
        icon: Share2,
        title: '抵達時間快速分享',
        body: '一鍵分享目的地與抵達時間訊息，快速讓親友知道你的動態。',
    },
] as const;

export default function DocsPage() {
    const structuredData = {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        'name': 'OnTrack',
        'applicationCategory': 'TravelApplication',
        'operatingSystem': 'Web, iOS',
        'url': APP_URL,
        'image': APP_IMAGE,
        'description':
            'OnTrack is a Taiwan Railway schedule app for fast route lookup, nearest-station detection, delay-aware next trains, and arrival sharing.',
        'offers': {
            '@type': 'Offer',
            'price': '0',
            'priceCurrency': 'TWD',
        },
    };

    return (
        <main className={styles.page}>
            <div className={styles.shell}>
                <nav className={styles.nav} aria-label='OnTrack navigation'>
                    <Link className={styles.brand} href='/'>
                        <img
                            className={styles.brandIcon}
                            src='/apple-touch-icon.png'
                            alt=''
                            width='32'
                            height='32'
                            aria-hidden='true'
                        />
                        <span className={styles.brandText}>OnTrack</span>
                    </Link>
                    <div className={styles.navLinks}>
                        <Link className={styles.navTextLink} href='#features'>
                            功能
                        </Link>
                        <Link className={styles.navTextLink} href='/'>
                            網頁版
                        </Link>
                        <Link
                            className={styles.navTextLink}
                            href='/docs/support'
                        >
                            iOS
                        </Link>
                    </div>
                </nav>

                <section className={styles.hero}>
                    <div className={styles.heroCopy}>
                        <h1 className={styles.title}>
                            專為台鐵旅客打造的時刻表 App。
                        </h1>
                        <p className={styles.lede}>
                            自動規劃路線、顯示即時班次與延誤資訊，讓您打開 App
                            的瞬間就能知道這趟怎麼搭。
                        </p>
                        <div className={styles.heroActions}>
                            <Link className={styles.primaryCta} href='/'>
                                網頁版
                            </Link>
                            {/* TODO: Replace with App Store URL when the listing is live. */}
                            <Link
                                className={styles.secondaryCta}
                                href='/docs/support'
                            >
                                iOS App
                            </Link>
                        </div>
                    </div>

                    <div
                        className={styles.heroMedia}
                        aria-label='OnTrack app screenshot'
                    >
                        <img
                            className={styles.phoneImage}
                            src='/ontrack-web-showcase.png'
                            alt='OnTrack 網頁版台鐵時刻表 App 畫面，顯示車站、班次與預計搭乘資訊'
                            width='390'
                            height='844'
                        />
                    </div>
                </section>

                <section
                    className={styles.featureSection}
                    id='features'
                    aria-labelledby='features-title'
                >
                    <div className={styles.sectionIntro}>
                        <h2 id='features-title'>重要資訊一目了然。</h2>
                    </div>
                    <div className={styles.featureGrid}>
                        {features.map((feature) => {
                            const Icon = feature.icon;

                            return (
                                <article
                                    className={styles.featureCard}
                                    key={feature.title}
                                >
                                    <span className={styles.featureIcon}>
                                        <Icon aria-hidden='true' />
                                    </span>
                                    <h3>{feature.title}</h3>
                                    <p>{feature.body}</p>
                                </article>
                            );
                        })}
                    </div>
                </section>

                <footer className={styles.footer}>
                    <span>© 2026 OnTrack</span>
                    <nav aria-label='Support links'>
                        <Link href='https://github.com/Hsiii/OnTrack'>
                            GitHub
                        </Link>
                        <Link href='/docs/support'>支援</Link>
                        <Link href='/docs/privacy'>隱私權</Link>
                    </nav>
                </footer>
            </div>

            <script
                type='application/ld+json'
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(structuredData),
                }}
            />
        </main>
    );
}
