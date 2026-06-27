import type { Metadata } from 'next';

import { LegalPage, legalPageStyles as styles } from '../../LegalPage';

const SUPPORT_EMAIL = 'its.hsichen@gmail.com';
const PRIVACY_URL = 'https://ontrack.hsichen.dev/docs/privacy';
const APP_IMAGE = 'https://ontrack.hsichen.dev/ontrack-logo.png';
const APP_DESCRIPTION =
    '自動偵測您的所在車站，並依搭乘習慣預測路線。打開 App 的瞬間，即可掌握即時班次與延誤資訊。';

export const metadata: Metadata = {
    title: 'Privacy Policy | OnTrack',
    description: APP_DESCRIPTION,
    alternates: {
        canonical: PRIVACY_URL,
    },
    openGraph: {
        title: 'Privacy Policy | OnTrack',
        description: APP_DESCRIPTION,
        url: PRIVACY_URL,
        siteName: 'OnTrack',
        images: [APP_IMAGE],
        locale: 'zh_TW',
        type: 'website',
    },
    twitter: {
        card: 'summary',
        title: 'Privacy Policy | OnTrack',
        description: APP_DESCRIPTION,
        images: [APP_IMAGE],
    },
};

export default function PrivacyPage() {
    return (
        <LegalPage
            title='Privacy Policy'
            subtitle='OnTrack does not require an account, does not sell user data, and keeps location-based station detection on your device.'
            footerLinks={[{ href: '/docs/support', label: 'Support' }]}
            footerNote='Last updated: June 2026'
        >
            <section className={styles.section} aria-labelledby='overview'>
                <h2 id='overview'>Overview</h2>
                <p>
                    OnTrack is a train schedule app for checking departures,
                    destinations, and live delay information. The app is
                    designed around minimal data use: your device keeps
                    preferences and frequent destinations locally, while the
                    OnTrack server stores only aggregate route demand from
                    schedule lookups so popular routes can be cached and refresh
                    jobs can avoid unnecessary work.
                </p>
                <div className={styles.callout}>
                    <strong>At a glance</strong>
                    <p>
                        Location stays on your device. Schedule lookups send
                        station IDs and a date. OnTrack stores aggregate
                        origin-destination demand counts, not accounts or raw
                        location history.
                    </p>
                </div>
            </section>

            <section className={styles.section} aria-labelledby='collect'>
                <h2 id='collect'>Information We Collect</h2>

                <article className={styles.faqItem}>
                    <h3>Location</h3>
                    <p>
                        If you grant permission, OnTrack uses your current
                        location on your device or in your browser to choose the
                        nearest departure station.
                    </p>
                    <ul>
                        <li>Detect nearby stations</li>
                        <li>Fill the origin station more quickly</li>
                        <li>Fall back to your cached origin if needed</li>
                    </ul>
                    <p>
                        OnTrack does not send your raw latitude or longitude to
                        the OnTrack server for this feature.
                    </p>
                </article>

                <article className={styles.faqItem}>
                    <h3>Schedule Requests and Route Demand</h3>
                    <p>
                        When you request a schedule, OnTrack sends the origin
                        station ID, destination station ID, selected date, and
                        optional refresh request to the OnTrack server so it can
                        return train times and live delay status.
                    </p>
                    <p>
                        To keep the service fast and avoid wasteful background
                        refreshes, OnTrack stores aggregate route-demand
                        records: origin station ID, destination station ID,
                        request count, last-seen time, and Taipei-hour demand
                        buckets. These records are used for route timetable
                        cache prewarming, live-board refresh decisions, and cron
                        optimization.
                    </p>
                </article>

                <article className={styles.faqItem}>
                    <h3>Local Preferences and Destination History</h3>
                    <p>
                        OnTrack stores preferences on your device, such as your
                        selected origin and destination, cached origin,
                        language, appearance, share format, and frequent
                        destination history. This is used to restore your setup
                        and power destination auto-fill.
                    </p>
                    <p>
                        This local preference history is not uploaded as a
                        separate profile. A destination becomes part of a server
                        request only when you use it in a schedule lookup.
                    </p>
                </article>

                <article className={styles.faqItem}>
                    <h3>Analytics and Diagnostics</h3>
                    <p>
                        The production website may use Cloudflare Web Analytics
                        and hosting telemetry to understand basic site
                        reliability and performance. Apple, Cloudflare, and
                        other platform providers may process diagnostics, crash
                        reports, or request metadata according to their own
                        policies.
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
                        Official railway data sources, including Taiwan
                        transport data services, for schedules and delay
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
                    OnTrack shares information only when needed to provide app
                    functionality, operate hosting and analytics, maintain or
                    troubleshoot the service, or comply with legal obligations.
                    The OnTrack application database does not store accounts,
                    names, phone numbers, mailing addresses, or raw location
                    coordinates.
                </p>
            </section>

            <section className={styles.section} aria-labelledby='retention'>
                <h2 id='retention'>Data Retention</h2>
                <p>
                    Local preferences stay on your device until you clear site
                    data, reset app data, or uninstall the app. OnTrack server
                    route-demand aggregates are kept while they are useful for
                    cache prewarming and refresh optimization. Diagnostics,
                    crash reports, request metadata, and analytics handled by
                    platform or hosting providers are retained according to
                    those providers&apos; policies.
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
