import { Helmet } from 'react-helmet-async'

const SITE_URL = 'https://aura50.io'
const OG_IMAGE = `${SITE_URL}/og-image.png`

const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'AURA50',
  url: SITE_URL,
  description: 'The world\'s first mobile-native blockchain. Real SHA-256 Proof-of-Work. Mine A50 on any smartphone.',
}

const orgSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'AURA50',
  url: SITE_URL,
  logo: `${SITE_URL}/coin-face.png`,
  sameAs: [
    'https://twitter.com/aura50_io',
    'https://discord.gg/aura50',
    'https://t.me/aura50',
    'https://github.com/aura50/aura50',
  ],
  contactPoint: {
    '@type': 'ContactPoint',
    email: 'hello@aura50.io',
    contactType: 'customer support',
  },
}

const appSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'AURA50',
  operatingSystem: 'ANDROID, IOS',
  applicationCategory: 'FinanceApplication',
  description: 'Mine A50 cryptocurrency on any Android or iOS smartphone. Real SHA-256 Proof-of-Work. Works on 2G networks. Only 32MB storage required.',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  url: SITE_URL,
  softwareVersion: '1.0.0-beta',
  releaseNotes: 'Beta release. Mainnet launching Q2 2026.',
}

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What is AURA50?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'AURA50 is the world\'s first mobile-native blockchain. It uses real SHA-256 Proof-of-Work mining — the same algorithm as Bitcoin — but engineered to run on any Android or iOS smartphone. It requires only 32MB of storage and works on 2G mobile networks.',
      },
    },
    {
      '@type': 'Question',
      name: 'Can I mine AURA50 on my phone?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. AURA50 was specifically designed for smartphone mining. Unlike Bitcoin which requires expensive ASIC hardware, any Android 7.0+ or iOS 14+ device can mine A50 tokens and earn 2–5 A50 per day with zero special hardware.',
      },
    },
    {
      '@type': 'Question',
      name: 'How much storage does AURA50 require?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'AURA50 requires only 32MB of storage to run a full node — compared to over 500GB for Bitcoin and 1TB+ for Ethereum. This is achieved through a 31.25 million times temporal-spatial compression algorithm.',
      },
    },
    {
      '@type': 'Question',
      name: 'What is the A50 token max supply?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'A50 has a hard cap of 50 million tokens. 85% of all tokens are earned by miners over a 10-year period through Proof-of-Work mining, similar to Bitcoin\'s halving schedule. There was no ICO, no pre-mine, and no insider allocation.',
      },
    },
    {
      '@type': 'Question',
      name: 'When is the AURA50 mainnet launching?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'The AURA50 mainnet is scheduled to launch in Q2 2026. You can join the waitlist at aura50.io to receive a 5% mining bonus on launch day.',
      },
    },
    {
      '@type': 'Question',
      name: 'Does AURA50 work without an internet connection?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. AURA50 supports offline transaction queuing. You can create and sign transactions without internet access, and they will automatically sync to the network when your connection resumes. The app is also optimised for 2G and 3G networks.',
      },
    },
    {
      '@type': 'Question',
      name: 'Is AURA50 open source?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. The AURA50 blockchain core is fully open source and available on GitHub at github.com/aura50/aura50. Anyone can read, audit, and contribute to the codebase.',
      },
    },
  ],
}

export default function SEO({ title, description, path = '/', noindex = false }) {
  const canonical = `${SITE_URL}${path}`
  const metaTitle = title
    ? `${title} | AURA50`
    : 'AURA50 — World\'s First Mobile-Native Blockchain (2026)'
  const metaDesc = description ||
    'Mine A50 cryptocurrency on any smartphone. Real SHA-256 PoW. Only 32MB storage. Works on 2G. No ASIC required. 50M token hard cap. Mainnet Q2 2026.'

  return (
    <Helmet>
      <title>{metaTitle}</title>
      <meta name="description" content={metaDesc} />
      <link rel="canonical" href={canonical} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}

      {/* Open Graph */}
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="AURA50" />
      <meta property="og:title" content={metaTitle} />
      <meta property="og:description" content={metaDesc} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={OG_IMAGE} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content="AURA50 — Mine crypto on any smartphone" />

      {/* Twitter / X */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@aura50_io" />
      <meta name="twitter:title" content={metaTitle} />
      <meta name="twitter:description" content={metaDesc} />
      <meta name="twitter:image" content={OG_IMAGE} />

      {/* JSON-LD schemas — only on homepage */}
      {path === '/' && (
        <>
          <script type="application/ld+json">{JSON.stringify(websiteSchema)}</script>
          <script type="application/ld+json">{JSON.stringify(orgSchema)}</script>
          <script type="application/ld+json">{JSON.stringify(appSchema)}</script>
          <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
        </>
      )}
    </Helmet>
  )
}
