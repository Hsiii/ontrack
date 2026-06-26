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
        icon: LifeBuoy,
        title: '需要協助',
        body: '定位不到車站、列車時間看起來不對，或想回報問題時從這裡開始。',
        href: '/docs/support',
        cta: '查看支援',
    },
    {
        icon: Shield,
        title: '隱私權',
        body: '了解位置權限、診斷資料與第三方服務如何用於提供查詢功能。',
        href: '/docs/privacy',
        cta: '閱讀說明',
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
                </nav>

                <section className={styles.hero}>
                    <div className={styles.heroCopy}>
                        <p className={styles.eyebrow}>Docs</p>
                        <h1 className={styles.title}>第一次使用 OnTrack</h1>
                        <p className={styles.lede}>
                            先選出發站、目的地與時間。允許定位後，OnTrack
                            可以優先顯示附近車站，讓你更快查到下一班台鐵列車。
                        </p>
                        <div className={styles.actions}>
                            <Link className={styles.primaryAction} href='/'>
                                開始查車
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
            </div>
        </main>
    );
}
