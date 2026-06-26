import type { ReactNode } from 'react';
import Link from 'next/link';

import styles from './legal-page.module.css';

type LegalPageProps = {
    title: string;
    subtitle: string;
    children: ReactNode;
    footerLinks: Array<{
        href: string;
        label: string;
    }>;
    footerNote: string;
};

export function LegalPage({
    title,
    subtitle,
    children,
    footerLinks,
    footerNote,
}: LegalPageProps) {
    return (
        <main className={styles.page}>
            <div className={styles.shell}>
                <nav className={styles.nav} aria-label='Page navigation'>
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
                        <Link className={styles.navLink} href='/docs/support'>
                            Support
                        </Link>
                        <Link className={styles.navLink} href='/docs/privacy'>
                            Privacy
                        </Link>
                    </div>
                </nav>

                <header className={styles.hero}>
                    <h1 className={styles.title}>{title}</h1>
                    <p className={styles.subtitle}>{subtitle}</p>
                </header>

                <div className={styles.content}>{children}</div>

                <footer className={styles.footer}>
                    <div>
                        <p className={styles.copyright}>© 2026 OnTrack</p>
                        <p className={styles.copyright}>{footerNote}</p>
                    </div>
                    <nav
                        className={styles.footerLinks}
                        aria-label='Support links'
                    >
                        {footerLinks.map((link) => (
                            <Link
                                className={styles.footerLink}
                                href={link.href}
                                key={link.href}
                            >
                                {link.label}
                            </Link>
                        ))}
                        <a className={styles.footerLink} href='#terms'>
                            Terms of Service (coming soon)
                        </a>
                    </nav>
                </footer>
            </div>
        </main>
    );
}

export { styles as legalPageStyles };
