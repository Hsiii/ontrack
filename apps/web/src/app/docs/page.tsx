import { ArrowRight, Info, Shield } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import styles from './page.module.css';

export const metadata: Metadata = {
    title: 'OnTrack Help | Support and Privacy',
    description: 'OnTrack 支援入口，提供常見問題、聯絡方式與隱私權政策。',
    alternates: {
        canonical: 'https://ontrack.hsichen.dev/docs',
    },
};

const docsLinks = [
    {
        icon: Info,
        title: '支援',
        body: '定位、列車時間、分享或其他問題，查看常見解法並聯絡我們。',
        href: '/docs/support',
        cta: '查看支援',
    },
    {
        icon: Shield,
        title: '隱私權',
        body: '了解 OnTrack 如何使用位置權限、診斷資料與鐵路資料服務。',
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
                    <Link className={styles.navLink} href='/'>
                        開啟 App
                    </Link>
                </nav>

                <section className={styles.hero}>
                    <div className={styles.heroCopy}>
                        <h1 className={styles.title}>OnTrack 支援</h1>
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
                                    <Icon size={28} />
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
