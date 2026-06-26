import type { Metadata } from 'next';

import { LegalPage, legalPageStyles as styles } from '../../LegalPage';

const SUPPORT_EMAIL = 'its.hsichen@gmail.com';

export const metadata: Metadata = {
    title: 'Privacy Policy | OnTrack',
    description:
        'Read the OnTrack privacy policy, including how location access, diagnostics, third-party services, and user rights are handled.',
    alternates: {
        canonical: 'https://ontrack.hsichen.dev/docs/privacy',
    },
};

export default function PrivacyPage() {
    return (
        <LegalPage
            eyebrow='Effective Date: June 2026'
            title='Privacy Policy'
            subtitle='OnTrack is designed to provide train schedule and travel information while respecting user privacy.'
            footerLinks={[{ href: '/docs/support', label: 'Support' }]}
            footerNote='Last updated: June 2026'
        >
            <section className={styles.section} aria-labelledby='overview'>
                <h2 id='overview'>Overview</h2>
                <p>
                    OnTrack helps users view train schedules, nearby stations,
                    route suggestions, and travel information. We aim to collect
                    only the information needed to provide these features.
                </p>
            </section>

            <section className={styles.section} aria-labelledby='collect'>
                <h2 id='collect'>Information We Collect</h2>

                <article className={styles.faqItem}>
                    <h3>Location</h3>
                    <p>
                        If you grant permission, OnTrack may access your
                        location to:
                    </p>
                    <ul>
                        <li>Detect nearby stations</li>
                        <li>Suggest relevant routes</li>
                        <li>Improve travel convenience</li>
                    </ul>
                    <p>
                        Location is used only to provide these features and is
                        not sold.
                    </p>
                </article>

                <article className={styles.faqItem}>
                    <h3>Usage Data</h3>
                    <p>
                        OnTrack may receive anonymous diagnostics, crash
                        reports, and basic analytics from platform or hosting
                        services to help identify reliability issues and improve
                        the app.
                    </p>
                </article>

                <article className={styles.faqItem}>
                    <h3>Personal Information</h3>
                    <p>
                        OnTrack does not require an account and does not collect
                        personally identifiable information such as your name,
                        phone number, or mailing address.
                    </p>
                </article>
            </section>

            <section className={styles.section} aria-labelledby='third-party'>
                <h2 id='third-party'>Third-Party Services</h2>
                <p>OnTrack may rely on the following services:</p>
                <ul>
                    <li>
                        Apple services for iOS system features, permissions,
                        crash reports, and App Store distribution.
                    </li>
                    <li>
                        Official railway data sources for schedules and delay
                        information.
                    </li>
                    <li>
                        Cloudflare services for hosting, performance,
                        infrastructure, and basic web analytics.
                    </li>
                </ul>
            </section>

            <section className={styles.section} aria-labelledby='sharing'>
                <h2 id='sharing'>Data Sharing</h2>
                <p>User data is never sold.</p>
                <p>
                    Information is shared only when necessary to provide app
                    functionality, maintain the service, troubleshoot issues, or
                    comply with legal obligations.
                </p>
            </section>

            <section className={styles.section} aria-labelledby='retention'>
                <h2 id='retention'>Data Retention</h2>
                <p>
                    OnTrack does not store personal account information.
                    Diagnostics, crash reports, and basic analytics, if
                    available, are retained by the relevant platform or service
                    provider according to their policies.
                </p>
            </section>

            <section className={styles.section} aria-labelledby='rights'>
                <h2 id='rights'>Your Rights</h2>
                <ul>
                    <li>
                        You may disable Location permission in iOS Settings.
                    </li>
                    <li>
                        You may contact us with privacy-related questions at{' '}
                        <a
                            className={styles.inlineLink}
                            href={`mailto:${SUPPORT_EMAIL}`}
                        >
                            {SUPPORT_EMAIL}
                        </a>
                        .
                    </li>
                </ul>
            </section>

            <section className={styles.section} aria-labelledby='contact'>
                <h2 id='contact'>Contact</h2>
                <p>
                    Email:{' '}
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
