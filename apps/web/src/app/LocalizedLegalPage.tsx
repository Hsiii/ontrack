'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';

import { I18nProvider } from '../i18n/I18nProvider';
import type { TranslationKey } from '../i18n/translations';
import { useI18n } from '../i18n/useI18n';
import styles from './legal-page.module.css';

type LocalizedFooterLink = {
    href: string;
    labelKey: TranslationKey;
};

type LocalizedLegalPageProps = {
    titleKey: TranslationKey;
    subtitleKey: TranslationKey;
    metaKey?: TranslationKey;
    children: ReactNode;
    footerLinks: LocalizedFooterLink[];
    footerNoteKey: TranslationKey;
};

function LocalizedLegalPageContent({
    titleKey,
    subtitleKey,
    metaKey,
    children,
    footerLinks,
    footerNoteKey,
}: LocalizedLegalPageProps) {
    const { language, setLanguage, t } = useI18n();
    const nextLanguage = language === 'en' ? 'zh-TW' : 'en';

    return (
        <main className={styles.page}>
            <div className={styles.shell}>
                <nav className={styles.nav} aria-label={t('docs.nav.label')}>
                    <Link className={styles.brand} href='/'>
                        <img
                            className={styles.brandIcon}
                            src='/ontrack-logo.png'
                            alt=''
                            width='32'
                            height='32'
                            aria-hidden='true'
                        />
                        <span className={styles.brandText}>OnTrack</span>
                    </Link>
                    <div className={styles.navLinks}>
                        <Link className={styles.navLink} href='/docs'>
                            {t('docs.nav.docs')}
                        </Link>
                        <Link className={styles.navLink} href='/docs/support'>
                            {t('docs.nav.support')}
                        </Link>
                        <Link className={styles.navLink} href='/docs/privacy'>
                            {t('docs.nav.privacy')}
                        </Link>
                        <button
                            className={styles.navLink}
                            type='button'
                            aria-label={t('docs.nav.switchLanguage')}
                            onClick={() => setLanguage(nextLanguage)}
                        >
                            {nextLanguage === 'en' ? 'EN' : '中'}
                        </button>
                    </div>
                </nav>

                <header className={styles.hero}>
                    <h1 className={styles.title}>{t(titleKey)}</h1>
                    {metaKey ? (
                        <p className={styles.meta}>{t(metaKey)}</p>
                    ) : null}
                    <p className={styles.subtitle}>{t(subtitleKey)}</p>
                </header>

                <div className={styles.content}>{children}</div>

                <footer className={styles.footer}>
                    <div>
                        <p className={styles.copyright}>© 2026 OnTrack</p>
                        <p className={styles.copyright}>{t(footerNoteKey)}</p>
                    </div>
                    <nav
                        className={styles.footerLinks}
                        aria-label={t('docs.footer.label')}
                    >
                        {footerLinks.map((link) => (
                            <Link
                                className={styles.footerLink}
                                href={link.href}
                                key={link.href}
                            >
                                {t(link.labelKey)}
                            </Link>
                        ))}
                    </nav>
                </footer>
            </div>
        </main>
    );
}

export function LocalizedLegalPage(props: LocalizedLegalPageProps) {
    return (
        <I18nProvider>
            <LocalizedLegalPageContent {...props} />
        </I18nProvider>
    );
}
