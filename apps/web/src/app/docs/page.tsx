import { ArrowRight, LifeBuoy, Shield, TrainFront } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import styles from './page.module.css';

export const metadata: Metadata = {
    title: 'OnTrack Docs | 快速台鐵查詢指南',
    description:
        'OnTrack 是為通勤情境設計的台鐵查詢工具，支援常用目的地、即時到站與分享下一班列車。',
    alternates: {
        canonical: 'https://ontrack.hsichen.dev/docs',
    },
};

const docsLinks = [
    {
        icon: TrainFront,
        title: '開啟 OnTrack',
        body: '直接回到查詢工具，設定車站與時間來查看列車資訊。',
        href: '/',
        cta: '開始查詢',
    },
    {
        icon: LifeBuoy,
        title: 'Support',
        body: '查看常見問題，或回報站點偵測、列車資訊與分享功能相關問題。',
        href: '/docs/support',
        cta: '取得協助',
    },
    {
        icon: Shield,
        title: 'Privacy Policy',
        body: '了解 OnTrack 如何處理位置權限、診斷資料與第三方服務。',
        href: '/docs/privacy',
        cta: '閱讀政策',
    },
] as const;

export default function DocsPage() {
    return (
        <main className={styles.page}>
            <div className={styles.shell}>
                <nav className={styles.nav} aria-label='Docs navigation'>
                    <Link className={styles.brand} href='/'>
                        <span className={styles.brandMark} aria-hidden='true'>
                            <TrainFront size={20} />
                        </span>
                        OnTrack
                    </Link>
                    <Link className={styles.navLink} href='/'>
                        開啟 App
                    </Link>
                </nav>

                <section className={styles.hero}>
                    <div className={styles.heroCopy}>
                        <p className={styles.eyebrow}>Docs</p>
                        <h1 className={styles.title}>OnTrack 說明文件</h1>
                        <p className={styles.lede}>
                            OnTrack
                            是台鐵查詢工具，提供附近車站、常用目的地、列車時間與分享功能。這裡保留必要的使用支援與隱私資訊。
                        </p>
                        <div className={styles.actions}>
                            <Link className={styles.primaryAction} href='/'>
                                開始查詢
                                <ArrowRight size={16} />
                            </Link>
                        </div>
                    </div>
                </section>

                <section className={styles.linkGrid} aria-label='Docs links'>
                    {docsLinks.map((item) => {
                        const Icon = item.icon;

                        return (
                            <Link
                                className={`${styles.linkCard} card-panel`}
                                href={item.href}
                                key={item.title}
                            >
                                <span className={styles.cardIcon}>
                                    <Icon size={22} />
                                </span>
                                <span className={styles.cardText}>
                                    <strong>{item.title}</strong>
                                    <span>{item.body}</span>
                                </span>
                                <span className={styles.cardCta}>
                                    {item.cta}
                                    <ArrowRight size={16} />
                                </span>
                            </Link>
                        );
                    })}
                </section>

                <footer className={styles.footer}>
                    <span>Support: its.hsichen@gmail.com</span>
                </footer>
            </div>
        </main>
    );
}
