import {
    ArrowRight,
    Clock3,
    MapPin,
    Navigation,
    Share2,
    Smartphone,
    TrainFront,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import styles from './page.module.css';

const APP_URL = 'https://ontrack.hsichen.dev/';
const DOCS_URL = 'https://ontrack.hsichen.dev/docs';
const APP_IMAGE = 'https://ontrack.hsichen.dev/demo.png';

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
        body: '允許定位後，OnTrack 會優先選出附近的台鐵車站，省下手動找站的時間。',
    },
    {
        icon: Clock3,
        title: '下一班列車優先',
        body: '依出發或抵達時間整理班次，並把延誤資訊納入下一班列車判斷。',
    },
    {
        icon: Navigation,
        title: '常用目的地更快找到',
        body: '搜尋目的地時優先顯示常用車站，通勤與轉乘不必重複輸入。',
    },
    {
        icon: Share2,
        title: '抵達時間快速分享',
        body: '選好班次後，一鍵產生目的地與抵達時間訊息，方便告訴同行的人。',
    },
] as const;

const downloads = [
    {
        icon: TrainFront,
        title: 'Web app',
        body: '不需要安裝，打開瀏覽器就能查台鐵時刻表、選站、看延誤與分享班次。',
        cta: '立即開啟 Web App',
        href: '/',
    },
    {
        icon: Smartphone,
        title: 'iPhone app',
        body: '原生 iPhone 版本使用同一套台鐵資料、定位起站與分享流程。',
        cta: '查看 iOS 支援資訊',
        href: '/docs/support',
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
                        <Link className={styles.navTextLink} href='#apps'>
                            App
                        </Link>
                        <Link className={styles.navLink} href='/'>
                            開啟 App
                        </Link>
                    </div>
                </nav>

                <section className={styles.hero}>
                    <div className={styles.heroCopy}>
                        <p className={styles.eyebrow}>
                            Taiwan Railway schedule app
                        </p>
                        <h1 className={styles.title}>
                            快速查台鐵時刻表與下一班列車。
                        </h1>
                        <p className={styles.lede}>
                            OnTrack 以最近車站、即時延誤與常用目的地為核心， 讓
                            Web 與 iPhone 上的查車流程更短。
                        </p>
                        <div className={styles.heroActions}>
                            <Link className={styles.primaryCta} href='/'>
                                立即開啟 Web App
                                <ArrowRight size={18} aria-hidden='true' />
                            </Link>
                            <Link className={styles.secondaryCta} href='#apps'>
                                查看 iOS App
                            </Link>
                        </div>
                    </div>

                    <div
                        className={styles.heroMedia}
                        aria-label='OnTrack app screenshot'
                    >
                        <img
                            className={styles.phoneImage}
                            src='/demo.png'
                            alt='OnTrack 台鐵時刻表 App 畫面，顯示車站、時間與列車班次'
                            width='1170'
                            height='2532'
                        />
                    </div>
                </section>

                <section
                    className={styles.featureSection}
                    id='features'
                    aria-labelledby='features-title'
                >
                    <div className={styles.sectionIntro}>
                        <p className={styles.sectionKicker}>Features</p>
                        <h2 id='features-title'>查車需要的資訊放在同一頁。</h2>
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

                <section
                    className={styles.appsSection}
                    id='apps'
                    aria-labelledby='apps-title'
                >
                    <div className={styles.sectionIntro}>
                        <p className={styles.sectionKicker}>Download</p>
                        <h2 id='apps-title'>Web 先用，iPhone 版同步準備。</h2>
                    </div>
                    <div className={styles.platformGrid}>
                        {downloads.map((item) => {
                            const Icon = item.icon;

                            return (
                                <Link
                                    className={`${styles.platformCard} card-panel`}
                                    href={item.href}
                                    key={item.title}
                                >
                                    <span className={styles.platformIcon}>
                                        <Icon aria-hidden='true' />
                                    </span>
                                    <span className={styles.platformText}>
                                        <strong>{item.title}</strong>
                                        <span>{item.body}</span>
                                    </span>
                                    <span className={styles.platformCta}>
                                        {item.cta}
                                        <ArrowRight
                                            size={16}
                                            aria-hidden='true'
                                        />
                                    </span>
                                </Link>
                            );
                        })}
                    </div>
                </section>

                <section
                    className={styles.downloadBand}
                    aria-labelledby='start-title'
                >
                    <div>
                        <p className={styles.sectionKicker}>Start now</p>
                        <h2 id='start-title'>
                            現在就用 OnTrack 查下一班台鐵。
                        </h2>
                    </div>
                    <Link className={styles.primaryCta} href='/'>
                        開啟 Web App
                        <ArrowRight size={18} aria-hidden='true' />
                    </Link>
                </section>

                <footer className={styles.footer}>
                    <span>© 2026 OnTrack</span>
                    <nav aria-label='Support links'>
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
