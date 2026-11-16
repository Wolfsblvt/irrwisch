export default [
  {
    path: '/',
    title: null,
    description: 'A small clearing in the woods that exists only because people came by. Every visitor leaves a light; some build, chalk or move something. Nothing is ever torn down.',
    surfaceName: 'Irrwisch',
    indexing: 'index',
    role: 'public',
    social: {
      image: '/social/home.png',
      eyebrow: 'A place made by whoever came by',
      alt: 'Irrwisch: a night clearing with a small settlement of lit windows',
    },
  },
  {
    path: '/impressum/',
    title: 'Impressum',
    description: 'Provider and contact information.',
    role: 'legal',
  },
  {
    path: '/privacy/',
    title: 'Privacy and data',
    description: 'How this site processes personal data.',
    role: 'legal',
  },
  {
    path: '/terms/',
    title: 'Terms',
    description: 'Terms for visiting and adding to the clearing.',
    role: 'legal',
  },
  {
    path: '/404/',
    title: 'Page not found',
    description: 'This address does not point into the clearing.',
    role: 'error',
  },
];
