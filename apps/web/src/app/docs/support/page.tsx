import type { Metadata } from 'next';

import { LegalPage, legalPageStyles as styles } from '../../LegalPage';

const SUPPORT_EMAIL = 'its.hsichen@gmail.com';

export const metadata: Metadata = {
    title: 'OnTrack Support',
    description:
        'Get help with OnTrack, contact support, and read answers to common questions about station detection, train times, sharing, and bug reports.',
    alternates: {
        canonical: 'https://ontrack.hsichen.dev/docs/support',
    },
};

export default function SupportPage() {
    return (
        <LegalPage
            title='OnTrack Support'
            subtitle="Need help with OnTrack? We're here to help."
            footerLinks={[{ href: '/docs/privacy', label: 'Privacy Policy' }]}
            footerNote='Support resources for OnTrack.'
        >
            <section className={styles.section} aria-labelledby='contact'>
                <h2 id='contact'>Contact</h2>
                <div className={styles.callout}>
                    <p>
                        If you have questions, feedback, or encounter a bug,
                        please contact:
                    </p>
                    <p>
                        <a
                            className={styles.inlineLink}
                            href={`mailto:${SUPPORT_EMAIL}`}
                        >
                            {SUPPORT_EMAIL}
                        </a>
                    </p>
                </div>
                <p>We typically respond within 1-3 business days.</p>
            </section>

            <section className={styles.section} aria-labelledby='faq'>
                <h2 id='faq'>Frequently Asked Questions</h2>
                <div className={styles.faqList}>
                    <article className={styles.faqItem}>
                        <h3>The app can't detect my station.</h3>
                        <ul>
                            <li>Ensure Location Services are enabled.</li>
                            <li>
                                Verify OnTrack has permission to access your
                                location.
                            </li>
                            <li>Wait a few seconds for station detection.</li>
                        </ul>
                    </article>

                    <article className={styles.faqItem}>
                        <h3>Train times seem incorrect.</h3>
                        <ul>
                            <li>Pull to refresh.</li>
                            <li>
                                Delay information depends on the official
                                railway data source and may update periodically.
                            </li>
                        </ul>
                    </article>

                    <article className={styles.faqItem}>
                        <h3>How do I share my current train?</h3>
                        <p>
                            Open the train details page and tap the{' '}
                            <strong>Share</strong> button.
                        </p>
                    </article>

                    <article className={styles.faqItem}>
                        <h3>I found a bug or have a feature request.</h3>
                        <p>Please include:</p>
                        <ul>
                            <li>Device model</li>
                            <li>iOS version</li>
                            <li>OnTrack version</li>
                            <li>Screenshots, if applicable</li>
                            <li>Steps to reproduce</li>
                        </ul>
                    </article>
                </div>
            </section>
        </LegalPage>
    );
}
