import type { ReactNode } from 'react';
import Link from 'next/link';

import styles from './legal-page.module.css';

type LegalPageProps = {
    title: string;
    eyebrow: string;
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
    eyebrow,
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
                        <span className={styles.brandMark} aria-hidden='true'>
                            OT
                        </span>
                        OnTrack
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
                    <p className={styles.eyebrow}>{eyebrow}</p>
                    <h1 className={styles.title}>{title}</h1>
                    <p className={styles.subtitle}>{subtitle}</p>
                </header>

                <div className={styles.content}>{children}</div>

                <footer className={styles.footer}>
                    <div className={styles.footerLinks}>
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
                    </div>
                    <p className={styles.copyright}>{footerNote}</p>
                    <p className={styles.copyright}>© 2026 OnTrack</p>
                </footer>
            </div>
        </main>
    );
}

export { styles as legalPageStyles };
