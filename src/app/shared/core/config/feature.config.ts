
export const featureConfig: any = {
  home: {
    public: ['track', 'comingSoon', 'instructor'],
    userSpecific: [],
  },
  masterclass: {
    public: ['popular', 'track', 'comingSoon', 'instructor'],
    userSpecific: ['inprogress', 'completed', 'bookmark'],
  },
  podcast: {
    public: ['track'],
    userSpecific: ['inprogress', 'completed', 'bookmark'],
  },
  microLearning: {
    public: ['track'],
    userSpecific: ['inprogress', 'completed', 'bookmark'],
  },
  premiere: {
    public: ['upcoming'],
    userSpecific: ['completed'],
  },
} as const;
