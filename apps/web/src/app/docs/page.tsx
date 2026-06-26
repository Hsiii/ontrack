import {
    ArrowRight,
    Bell,
    Clock3,
    LocateFixed,
    MapPinned,
    Share2,
    TrainFront,
} from 'lucide-react';
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

const usageSteps = [
    {
        icon: Clock3,
        title: '選時間',
        body: '像 Akuma 使用說明的第一步一樣，先決定輸入脈絡：出發、抵達，或使用現在時間。',
    },
    {
        icon: MapPinned,
        title: '選路線',
        body: '設定起訖站。OnTrack 會保留常用目的地，也能自動偵測附近車站以減少手動輸入。',
    },
    {
        icon: Share2,
        title: '分享結果',
        body: '確認下一班車、延誤與抵達資訊後，可直接產生分享卡，適合傳給同伴或留作備忘。',
    },
] as const;

const benefits = [
    {
        icon: LocateFixed,
        title: '通勤優先',
        body: '首頁就是查詢工具，沒有行銷頁阻擋。打開後直接看時間、車站與下一班列車。',
    },
    {
        icon: Bell,
        title: '即時感強',
        body: '以台鐵資料為基礎，補上即時到站與延誤狀態，避免只看靜態時刻表。',
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
                        <h1 className={styles.title}>台鐵查詢，打開就能用。</h1>
                        <p className={styles.lede}>
                            OnTrack
                            把時間、路線、即時到站與分享卡放在同一個輕量流程裡，適合每天重複查下一班車的使用情境。
                        </p>
                        <div className={styles.actions}>
                            <Link className={styles.primaryAction} href='/'>
                                開始查詢
                                <ArrowRight size={16} />
                            </Link>
                            <a className={styles.secondaryAction} href='#usage'>
                                看使用方式
                            </a>
                        </div>
                    </div>

                    <div className={`${styles.preview} card-panel`}>
                        <div className={styles.previewHeader}>
                            <span className='text-caption'>Next train</span>
                            <span className={styles.statusPill}>Live</span>
                        </div>
                        <div className={styles.routeCard}>
                            <div className={styles.stationRow}>
                                <span className={styles.stationDot} />
                                <span>台北</span>
                                <span>origin</span>
                            </div>
                            <div className={styles.stationRow}>
                                <span className={styles.stationDot} />
                                <span>新竹</span>
                                <span>destination</span>
                            </div>
                        </div>
                        <div className={styles.trainCard}>
                            <span className={styles.trainIcon}>
                                <TrainFront size={22} />
                            </span>
                            <div>
                                <p className={styles.trainTitle}>
                                    1187 區間車 · 8 分鐘後
                                </p>
                                <p className={styles.trainMeta}>
                                    即時資訊、延誤與抵達時間一次確認
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                <section id='usage' className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <p className={styles.eyebrow}>Usage</p>
                        <h2>沿用 Akuma usage section 的三步節奏。</h2>
                        <p>
                            先設定輸入、再校對結果、最後保存或分享。OnTrack
                            把這個節奏換成通勤查車的版本。
                        </p>
                    </div>
                    <div className={styles.usageGrid}>
                        {usageSteps.map((step) => {
                            const Icon = step.icon;

                            return (
                                <article
                                    className={`${styles.usageCard} card-panel`}
                                    key={step.title}
                                >
                                    <span className={styles.cardIcon}>
                                        <Icon size={22} />
                                    </span>
                                    <h3>{step.title}</h3>
                                    <p>{step.body}</p>
                                </article>
                            );
                        })}
                    </div>
                </section>

                <section className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <p className={styles.eyebrow}>Design cue</p>
                        <h2>參考 Repomux landing page 的產品敘事。</h2>
                        <p>
                            用一個清楚的主張、產品預覽與少量利益點說明價值，同時保留
                            OnTrack 目前 Web App 的卡片與 iOS 淺色主色風格。
                        </p>
                    </div>
                    <div className={styles.benefitGrid}>
                        {benefits.map((benefit) => {
                            const Icon = benefit.icon;

                            return (
                                <article
                                    className={`${styles.benefitCard} card-panel`}
                                    key={benefit.title}
                                >
                                    <span className={styles.cardIcon}>
                                        <Icon size={22} />
                                    </span>
                                    <h3>{benefit.title}</h3>
                                    <p>{benefit.body}</p>
                                </article>
                            );
                        })}
                    </div>
                </section>

                <footer className={styles.footer}>
                    <Link className={styles.primaryAction} href='/'>
                        開啟 OnTrack
                        <ArrowRight size={16} />
                    </Link>
                </footer>
            </div>
        </main>
    );
}
