export interface RepositoryNode {
  name: string;
  description: string | null;
  stargazerCount: number;
  forkCount: number;
  primaryLanguage: {
    name: string;
    color: string | null;
  } | null;
  diskUsage: number; // in KB
  createdAt: string;
  updatedAt: string;
  url: string;
  isFork: boolean;
  languages?: {
    nodes: Array<{
      name: string;
      color: string | null;
    }>;
  };
  repositoryTopics?: {
    nodes: Array<{
      topic: {
        name: string;
      };
    }>;
  };
}

export interface UserGalaxyData {
  user: {
    login: string;
    name: string | null;
    avatarUrl: string;
    bio: string | null;
    location: string | null;
    company: string | null;
    twitterUsername: string | null;
    websiteUrl: string | null;
    createdAt: string;
    followers: {
      totalCount: number;
    };
    following: {
      totalCount: number;
    };
    contributionsCollection: {
      contributionCalendar: {
        totalContributions: number;
        weeks?: Array<{
          contributionDays: Array<{
            contributionCount: number;
            date: string;
          }>;
        }>;
      };
    };
    repositories: {
      totalCount: number;
      nodes: RepositoryNode[];
    };
  };
}

export interface StarData {
  id: string;
  name: string;
  description: string;
  stars: number;
  forks: number;
  language: string;
  languageColor: string;
  diskUsageKB: number;
  createdAt: string;
  updatedAt: string;
  url: string;
  isFork: boolean;
  topics: string[];
  // Calculated Astronomical Coordinates & Properties
  x: number;
  y: number;
  z: number;
  radius: number;
  spectralClass: string;
  luminosity: number;
  a: number;
  b: number;
  orbitSpeed: number;
  inclination: number;
  periapsis: number;
  anomaly: number;
  orbitalArm: number;
  distanceFromCore: number;
  particleBeltCount: number;
  particleBeltSpeed: number;
  activityRating: 'Hyperspeed' | 'Active' | 'Stable' | 'Dormant';
  hasHaloAndRings: boolean;
  isRival?: boolean;
}

export interface GalaxyMetrics {
  totalStars: number;
  totalForks: number;
  totalContributions: number;
  totalRepositories: number;
  dominantLanguage: string;
  dominantLanguageColor: string;
  galaxyClassification: string;
  galaxyType: string;
  coreRadius: number;
  coreLuminosity: number;
  spiralArmsCount: number;
  languagesBreakdown: Array<{
    name: string;
    color: string;
    count: number;
    percentage: number;
  }>;
}

export interface GalaxySceneData {
  user: {
    login: string;
    name: string;
    avatarUrl: string;
    bio: string;
    location: string;
    followers: number;
    following: number;
    createdAt: string;
  };
  metrics: GalaxyMetrics;
  stars: StarData[];
}
