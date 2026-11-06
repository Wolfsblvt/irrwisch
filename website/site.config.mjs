export default {
  title: 'Lichtung',
  description: 'A small clearing in the woods that exists only because people came by. Every visitor leaves a light; some build, chalk or move something. Nothing is ever torn down.',
  // Bootstrap Home on the Workers subdomain. Replace with the canonical
  // Wolf-owned hostname once it is selected (see docs/DECISIONS.md).
  url: 'https://lichtung.wolfsblvt.workers.dev',
  docs: {
    mode: 'none',
    surfaceName: 'Lichtung',
  },
  identity: {
    productName: 'Lichtung',
    hostSiteName: 'Lichtung',
    surfaceName: 'Lichtung',
    descriptor: { text: null, persist: false },
    defaultLanguage: 'en',
    defaultLocale: 'en_US',
    themeColor: '#0b0f1a',
    backgroundColor: '#0b0f1a',
    icons: {
      svg: '/favicon.svg',
      raster: '/favicon.png',
      touch: '/apple-touch-icon.png',
    },
    social: {
      fallbackImage: '/social/generated/home.png',
      markText: 'Lichtung',
      colors: {
        background: '#0b0f1a',
        panel: '#161c2c',
        foreground: '#f3eee4',
        muted: '#a9b2c2',
        accent: '#ff8a3d',
      },
    },
    install: {
      kind: 'site',
    },
  },
  terms: false,
  publisher: 'Wolfsblvt Works',
  openSource: false,
  links: { source: null, releases: null, status: null, security: null, licences: null },
  footerGroups: [
    { title: 'Get', links: [{ label: 'Walk into the clearing', href: '/' }] },
    { title: 'Learn', links: [{ label: 'Wolfsblvt Works', href: 'https://wolfsblvt.works/' }] },
  ],
  legal: {
    lastUpdated: '2026-11-06',
    contact: null,
    impressum: {
      directContact: null,
    },
    consumerDispute: null,
    privacy: {
      hosting: 'The page and its live connection run on Cloudflare Workers, operated by Cloudflare, Inc., 101 Townsend St, San Francisco, CA 94107, USA. To deliver the page, open the WebSocket and protect the service, Cloudflare receives your IP address, the requested URL, browser headers and timing, and keeps its own edge logs under its own retention. We run no analytics and keep no request logs of our own.',
      purposeAndBasis: 'Delivering the page you asked for and keeping it available and abuse-resistant, on the basis of Art. 6(1)(f) GDPR: our legitimate interest in operating a stable public page. While you connect, a Cloudflare rate-limit counter uses your network address to cap how many arrivals come from one address per minute; that count lives in Cloudflare memory for the minute and is never written into the clearing.',
      recipientsAndTransfers: 'Cloudflare, Inc. acts as our hosting processor. Requests are answered from the Cloudflare location nearest to you, which may be outside the EU. For those transfers Cloudflare relies on its participation in the EU-US Data Privacy Framework and on standard contractual clauses, both documented in its Data Processing Addendum, which it publishes.',
      retention: 'We store no personal data. What you leave in the clearing (a lit window, worn ground, a room, a thing on the ground, chalk cells, a nudged creature) is anonymous, public and permanent by design and carries no identifier that links it to you. Cloudflare edge logs follow Cloudflare retention.',
      provision: 'Nothing has to be provided. Without the ordinary request metadata the page cannot be delivered; without an open connection you can look at the clearing but not add to it.',
      storage: 'None. The page sets no cookies and uses no localStorage, sessionStorage, IndexedDB or comparable storage. The only thing on your device is the ordinary browser cache of the page files, which is strictly necessary to show the page you requested (§ 25(2) TDDDG).',
      contact: 'If you write to the addresses on this page or through the shared contact form, we process what you send (your address, a name if you give one, your message) to answer you, on the basis of Art. 6(1)(f) GDPR, our interest in handling enquiries. Correspondence is kept as long as the matter needs and for statutory record duties. None of it is required to use the clearing.',
    },
    terms: null,
  },
};
