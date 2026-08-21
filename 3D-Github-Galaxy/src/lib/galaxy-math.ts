import { RepositoryNode, StarData, GalaxyMetrics, UserGalaxyData, GalaxySceneData } from './types';
import { getLanguageColor, getSpectralClass } from './language-colors';

/**
 * Generates true elliptical orbital elements for realistic planetary motion.
 * Guarantees no two planets share the exact same orbital track to prevent collisions.
 */
export function generateOrbitalElements(
  index: number,
  totalPlanets: number
): { 
  a: number; 
  b: number; 
  speed: number; 
  inclination: number; 
  periapsis: number; 
  anomaly: number; 
  x: number; 
  y: number; 
  z: number; 
  distanceFromCore: number; 
} {
  // Spacing: Each planet gets a progressively larger semi-major axis (a) to guarantee no intersections.
  // Start at 22.0 to clear the central sun/accretion disk. Add ~8 units per planet.
  const a = 22.0 + (index * 8.5) + (Math.random() * 2.0);
  
  // Eccentricity (e): How oval the orbit is. 0 = circle, 0.9 = long comet.
  // We use modest eccentricities (0.05 to 0.3) for realistic planets.
  const e = 0.05 + Math.random() * 0.25;
  const b = a * Math.sqrt(1 - e * e); // Semi-minor axis

  // Orbital speed: Kepler's third law approximation (closer planets move vastly faster)
  // Random multiplier adds slight chaotic variance between neighbors.
  const speed = (0.2 / Math.sqrt(a)) * (0.8 + Math.random() * 0.4);

  // Inclination: Tilt of the orbital plane (-12 to +12 degrees)
  const inclination = (Math.random() - 0.5) * 0.4;
  
  // Periapsis: Rotation of the ellipse within its plane (0 to 360)
  const periapsis = Math.random() * Math.PI * 2;
  
  // Anomaly: Current starting position along the track (0 to 360)
  const anomaly = Math.random() * Math.PI * 2;

  // Calculate INITIAL 3D coordinates (for constellation line mapping and initial load)
  // We rotate the 2D ellipse by periapsis, then tilt by inclination.
  const flatX = a * Math.cos(anomaly);
  const flatZ = b * Math.sin(anomaly);

  // Rotate by periapsis (around Y)
  const px = flatX * Math.cos(periapsis) - flatZ * Math.sin(periapsis);
  const pz = flatX * Math.sin(periapsis) + flatZ * Math.cos(periapsis);

  // Tilt by inclination (around X)
  const x = px;
  const y = pz * Math.sin(inclination);
  const z = pz * Math.cos(inclination);

  const distanceFromCore = Math.sqrt(x * x + y * y + z * z);

  return {
    a: Number(a.toFixed(2)),
    b: Number(b.toFixed(2)),
    speed: Number(speed.toFixed(4)),
    inclination: Number(inclination.toFixed(3)),
    periapsis: Number(periapsis.toFixed(3)),
    anomaly: Number(anomaly.toFixed(3)),
    x: Number(x.toFixed(2)),
    y: Number(y.toFixed(2)),
    z: Number(z.toFixed(2)),
    distanceFromCore: Number(distanceFromCore.toFixed(2)),
  };
}

/**
 * Calculates planet radius using a composite score of Stars, Disk Size, and Profile Percentile
 */
export function calculatePlanetRadius(repo: any, maxUserStars: number): number {
  const BASE_RADIUS = 1.2; // Restored solid Terrestrial floor
  const MAX_ADDITIONAL_RADIUS = 3.0;

  const stars = repo.stargazerCount || 0;
  const disk = repo.diskUsage || 100;

  // 2. Relative star weight within user's own universe (0.0 to 1.0)
  const relativeStarWeight = Math.log10(stars + 1) / Math.log10(maxUserStars + 1);

  // 3. Codebase depth weight (heavy codebases feel substantial even with 0 stars)
  const diskWeight = Math.min(Math.log10(disk + 1) / 5, 1.0) * 0.4;

  // 4. Global prestige bonus
  const globalBonus = Math.min(Math.log10(stars + 1) * 0.2, 1.5);

  const finalRadius = BASE_RADIUS + (relativeStarWeight * 1.2) + diskWeight + globalBonus;
  
  return Number(Math.min(finalRadius, BASE_RADIUS + MAX_ADDITIONAL_RADIUS).toFixed(3));
}

/**
 * Calculates activity velocity rating from update date & disk usage
 */
export function calculateActivityRating(updatedAt: string): {
  rating: 'Hyperspeed' | 'Active' | 'Stable' | 'Dormant';
  particleBeltCount: number;
  particleBeltSpeed: number;
} {
  const updatedDate = new Date(updatedAt).getTime();
  const now = Date.now();
  const daysDiff = (now - updatedDate) / (1000 * 60 * 60 * 24);

  if (daysDiff <= 30) {
    return { rating: 'Hyperspeed', particleBeltCount: 5, particleBeltSpeed: 1.8 };
  } else if (daysDiff <= 90) {
    return { rating: 'Active', particleBeltCount: 3, particleBeltSpeed: 1.2 };
  } else if (daysDiff <= 365) {
    return { rating: 'Stable', particleBeltCount: 2, particleBeltSpeed: 0.8 };
  } else {
    return { rating: 'Dormant', particleBeltCount: 1, particleBeltSpeed: 0.4 };
  }
}

/**
 * Generates galactic classification title based on metrics
 */
export function generateGalacticClassification(totalContributions: number, totalStars: number, reposCount: number): string {
  if (totalContributions > 2500 || totalStars > 5000) {
    return 'Type SB0-a • Hyper-Productive Grand Design Spiral';
  } else if (totalContributions > 1000 || totalStars > 1000) {
    return 'Type SA-b • High-Luminosity Multi-Arm Stellar Galaxy';
  } else if (totalContributions > 300 || totalStars > 100) {
    return 'Type S-c • Active Intermediate Starburst Galaxy';
  } else if (reposCount > 15) {
    return 'Type dS-m • Multi-Node Dwarf Spiral Galaxy';
  } else {
    return 'Type Irr-I • Emerging Nebula Cluster';
  }
}

/**
 * Converts raw GitHub GraphQL payload into structured 3D Galaxy Scene Data
 */
export function transformGitHubToGalaxy(data: UserGalaxyData): GalaxySceneData {
  const { user } = data;
  const repos = user.repositories?.nodes || [];
  
  // Calculate arms count (2, 3, or 4 arms based on repository count)
  const spiralArmsCount = repos.length > 30 ? 4 : repos.length > 12 ? 3 : 2;
  
  let totalStars = 0;
  let totalForks = 0;
  const langCountMap: Record<string, { count: number; color: string }> = {};

  const maxUserStars = Math.max(...repos.map((r) => r.stargazerCount || 0), 1);
  const totalStarsInGalaxy = repos.reduce((sum, repo) => sum + (repo.stargazerCount || 0), 0);
  
  // Dynamic spread: pull in small galaxies to prevent empty voids, 
  // but ensure there is always enough physical volume for the number of planets.
  const minRequiredSpread = Math.max(32.0, repos.length * 1.5 + 18.0);
  
  let maxSpreadRadius = 82.0;
  if (totalStarsInGalaxy < 100) {
    maxSpreadRadius = Math.max(minRequiredSpread, 32.0 + (totalStarsInGalaxy / 100) * 18.0);
  } else if (totalStarsInGalaxy < 1000) {
    maxSpreadRadius = Math.max(minRequiredSpread, 50.0 + ((totalStarsInGalaxy - 100) / 900) * 32.0);
  } else {
    maxSpreadRadius = Math.max(minRequiredSpread, 82.0);
  }

  // Find top repos to guarantee rings (Now factors in Recent Activity)
  const now = Date.now();
  const sortedByRank = [...repos].sort((a, b) => {
    // Calculate days since last update
    const daysA = Math.max(1, (now - new Date(a.updatedAt).getTime()) / (1000 * 60 * 60 * 24));
    const daysB = Math.max(1, (now - new Date(b.updatedAt).getTime()) / (1000 * 60 * 60 * 24));
    
    // Activity Multiplier: Repos updated recently get a massive score boost.
    // 30 days is the baseline 1.0. Older repos decay down to a 0.1 multiplier.
    const activityBoostA = Math.max(0.1, Math.min(2.0, 30 / daysA));
    const activityBoostB = Math.max(0.1, Math.min(2.0, 30 / daysB));

    // Base score combines stars (heavy weight) and disk usage
    const baseScoreA = (a.stargazerCount || 0) * 5000 + (a.diskUsage || 0);
    const baseScoreB = (b.stargazerCount || 0) * 5000 + (b.diskUsage || 0);

    // Final score multiplies the base size/prestige by how "alive" the repository is
    const scoreA = baseScoreA * activityBoostA;
    const scoreB = baseScoreB * activityBoostB;

    return scoreB - scoreA;
  });
  const top3RepoIds = new Set(sortedByRank.slice(0, 3).map((r) => r.name));
  const top15PercentCount = Math.max(3, Math.ceil(repos.length * 0.15));
  const top15RepoIds = new Set(sortedByRank.slice(0, top15PercentCount).map((r) => r.name));

  // Map Repos to Stars
  const stars: StarData[] = repos.map((repo, idx) => {
    totalStars += repo.stargazerCount || 0;
    totalForks += repo.forkCount || 0;

    const langName = repo.primaryLanguage?.name || 'Unknown';
    const langColor = getLanguageColor(langName, repo.primaryLanguage?.color);

    if (!langCountMap[langName]) {
      langCountMap[langName] = { count: 0, color: langColor };
    }
    langCountMap[langName].count += 1;

    const { a, b, speed, inclination, periapsis, anomaly, x, y, z, distanceFromCore } = generateOrbitalElements(
      idx,
      repos.length
    );

    const radius = calculatePlanetRadius(repo, maxUserStars);
    let { rating, particleBeltCount, particleBeltSpeed } = calculateActivityRating(repo.updatedAt);
    
    // Strict cutoff: only the absolute best 15% of repos get premium rings and halos
    const hasHaloAndRings = top15RepoIds.has(repo.name);

    if (!hasHaloAndRings) {
      particleBeltCount = 0;
    } else if (top3RepoIds.has(repo.name)) {
      // Guarantee magnificent rings for the user's absolute best work
      particleBeltCount = Math.max(particleBeltCount, 4);
      particleBeltSpeed = Math.max(particleBeltSpeed, 1.2);
    }

    const spectralClass = getSpectralClass(langName, repo.stargazerCount || 0);

    const topics = repo.repositoryTopics?.nodes.map((t) => t.topic.name) || [];

    return {
      id: `${user.login}-${repo.name}-${idx}`,
      name: repo.name,
      description: repo.description || 'No stellar mission logs recorded for this repository.',
      stars: repo.stargazerCount || 0,
      forks: repo.forkCount || 0,
      language: langName,
      languageColor: langColor,
      diskUsageKB: repo.diskUsage || 0,
      createdAt: repo.createdAt || repo.updatedAt || new Date().toISOString(),
      updatedAt: repo.updatedAt,
      url: repo.url,
      isFork: repo.isFork || false,
      topics,
      x,
      y,
      z,
      a,
      b,
      orbitSpeed: speed,
      inclination,
      periapsis,
      anomaly,
      radius,
      spectralClass,
      luminosity: Math.min(1.0, 0.4 + (repo.stargazerCount / 500) * 0.6),
      orbitalArm: 0,
      distanceFromCore,
      particleBeltCount,
      particleBeltSpeed,
      activityRating: rating,
      hasHaloAndRings,
    };
  });

  // No physics relaxation needed anymore: Orbits are perfectly spaced mathematically to prevent collisions!

  // Calculate dominant language & breakdown
  const languagesBreakdown = Object.entries(langCountMap)
    .map(([name, info]) => ({
      name,
      color: info.color,
      count: info.count,
      percentage: Number(((info.count / Math.max(repos.length, 1)) * 100).toFixed(1)),
    }))
    .sort((a, b) => b.count - a.count);

  const dominantLanguage = languagesBreakdown[0]?.name || 'TypeScript';
  const dominantLanguageColor = languagesBreakdown[0]?.color || '#38bdf8';

  const totalContributions = user.contributionsCollection?.contributionCalendar?.totalContributions || 0;
  const galaxyClassification = generateGalacticClassification(totalContributions, totalStars, repos.length);

  // Core radius and luminosity scales with total contributions
  const coreRadius = Math.max(2.2, Math.min(4.8, 2.0 + Math.log10(totalContributions + 1) * 0.7));
  const coreLuminosity = Math.min(2.5, 1.2 + (totalContributions / 2000) * 1.3);

  const metrics: GalaxyMetrics = {
    totalStars,
    totalForks,
    totalContributions,
    totalRepositories: user.repositories?.totalCount || repos.length,
    dominantLanguage,
    dominantLanguageColor,
    galaxyClassification,
    galaxyType: `${spiralArmsCount}-Arm Logarithmic Spiral`,
    coreRadius: Number(coreRadius.toFixed(2)),
    coreLuminosity: Number(coreLuminosity.toFixed(2)),
    spiralArmsCount,
    languagesBreakdown,
  };

  return {
    user: {
      login: user.login,
      name: user.name || user.login,
      avatarUrl: user.avatarUrl,
      bio: user.bio || 'Interstellar Code Voyager',
      location: user.location || 'Deep Space Coordinates',
      followers: user.followers?.totalCount || 0,
      following: user.following?.totalCount || 0,
      createdAt: user.createdAt || new Date().toISOString(),
    },
    metrics,
    stars,
  };
}
