export default {
  title: 'Irrwisch',
  description: 'A small clearing in the woods that exists only because people came by. Every visitor leaves a light; some build, chalk or move something. Nothing is ever torn down.',
  // Recommended canonical Home (free at Cloudflare Registrar on 2026-11-16, not yet bought).
  // Change this one line if Wolf selects another hostname (docs/DEPLOYMENT.md).
  url: 'https://irrwisch.com',
  docs: {
    mode: 'none',
    surfaceName: 'Irrwisch',
  },
  identity: {
    productName: 'Irrwisch',
    hostSiteName: 'Irrwisch',
    surfaceName: 'Irrwisch',
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
      fallbackImage: '/social/home.png',
      markText: 'Irrwisch',
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
  terms: true,
  publisher: 'Wolfsblvt Works',
  openSource: false,
  links: { source: null, releases: null, status: null, security: null, licences: null },
  footerGroups: [
    { title: 'Get', links: [{ label: 'Walk into the clearing', href: '/' }] },
    { title: 'Learn', links: [{ label: 'Wolfsblvt Works', href: 'https://wolfsblvt.works/' }] },
  ],
  legal: {
    lastUpdated: '2026-11-16',
    contact: null,
    impressum: {
      directContact: null,
    },
    consumerDispute: null,
    privacy: {
      hosting: 'The page and its live connection run on Cloudflare Workers, operated by Cloudflare, Inc., 101 Townsend St, San Francisco, CA 94107, USA. To deliver the page, open the WebSocket and protect the service, Cloudflare receives your IP address, the requested URL, browser headers and timing, and keeps its own edge logs under its own retention. We run no analytics and keep no request logs of our own.',
      purposeAndBasis: 'Delivering the page you asked for and keeping it available and abuse-resistant, on the basis of Art. 6(1)(f) GDPR: our legitimate interest in operating a stable public page. While you connect, a Cloudflare rate-limit counter uses your network address to cap how many arrivals come from one address per minute; that count lives in Cloudflare memory for the minute. The clearing counts every person once and gives each one a small allowance per night. To recognise you when you come back, it sets one cookie with a random token and keeps a salted hash of that token and a salted hash of your network address (for IPv6, of its /64 prefix), together with what is left of your allowance for the night. The token and the address themselves are never stored, the hashes are used for nothing else, and they are not linked to anything you build, place or draw.',
      recipientsAndTransfers: 'Cloudflare, Inc. acts as our hosting processor. Requests are answered from the Cloudflare location nearest to you, which may be outside the EU. For those transfers Cloudflare relies on its participation in the EU-US Data Privacy Framework and on standard contractual clauses, both documented in its Data Processing Addendum, which it publishes.',
      retention: 'The token hash is kept for 400 days after your last visit and the address hash for 30 days after it was last seen; both are erased on the next arrival or within six hours after that at the latest. Deleting the cookie in your browser ends the recognition by token at once. We store no other personal data. What you leave in the clearing (a lit window, worn ground, a room, a thing on the ground, chalk cells, a nudged creature) is anonymous and public, carries no identifier that links it to you, and stays for as long as the place exists unless the operator removes unlawful or hateful content. Because nothing links a contribution to a person, we cannot find or delete "your" contributions on request. Cloudflare edge logs follow Cloudflare retention.',
      provision: 'Nothing has to be provided. Without the ordinary request metadata the page cannot be delivered; without an open connection you can look at the clearing but not add to it.',
      storage: 'One cookie, named wisp: a random token set by this site, readable only by this site\'s server (HttpOnly, Secure, SameSite=Lax), kept for up to 400 days and renewed when you visit. It exists so that the place can do what it is: count each person once and give each one a single allowance per night, however often and from whatever network they return. It is strictly necessary for that service (§ 25(2) no. 2 TDDDG), is not used for analytics, advertising or profiles, and is shared with nobody. The page uses no localStorage, sessionStorage, IndexedDB or comparable storage. Besides the cookie, the only thing on your device is the ordinary browser cache of the page files.',
      contact: 'If you write to the addresses on this page or through the shared contact form, we process what you send (your address, a name if you give one, your message) to answer you, on the basis of Art. 6(1)(f) GDPR, our interest in handling enquiries. Correspondence is kept as long as the matter needs and for statutory record duties. None of it is required to use the clearing.',
    },
    terms: {
      service: 'Irrwisch is a free, non-commercial web page that shows one shared night clearing. Visiting it lights a window; visitors may also build a room, place a thing, chalk slate cells, nudge a creature and wave. There are no accounts, no payments and no guaranteed features.',
      formation: 'Using the page does not require registration or agreement to a paid contract. These Terms describe the conditions under which the page is offered; by contributing to the clearing you accept them for that contribution.',
      eligibility: 'Anyone may visit. If you are under the age at which you may agree to such terms on your own where you live, use the page only with the consent of a parent or guardian.',
      contributions: 'Everything you add is anonymous, visible to every visitor and meant to stay. It cannot be attributed to you, and it cannot be taken back or edited afterwards, by you or on request. You allow the operator to store, display and reproduce what you add as part of the clearing, including in pictures of it, without payment and for as long as the place exists. Add only what you are allowed to add.',
      removal: 'The operator may wipe a slate or remove a thing that is unlawful, hateful or harassing, and may reset or repair the clearing after abuse or technical damage. If you see something that should not be there, please say so.',
      availability: 'The page is provided as it is, without any promise of availability, continuity or preservation of the clearing. Contributions per person per night and arrivals per network address per minute are limited, and the limits may change.',
      suspension: 'The operator may limit or block access that harms the service or breaks these Terms, and may pause or end the page at any time. Ending the page ends the clearing; no copy of it is owed to anyone.',
      changes: 'The page, its rules and these Terms may change. The effective date above shows the current version; mandatory rights remain unaffected.',
      liability: null,
    },
  },
};
