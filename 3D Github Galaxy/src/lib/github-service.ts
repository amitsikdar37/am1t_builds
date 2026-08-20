import { UserGalaxyData } from './types';

const GITHUB_GRAPHQL_ENDPOINT = 'https://api.github.com/graphql';

const GALAXY_QUERY = `
  query getUserGalaxy($login: String!) {
    user(login: $login) {
      login
      name
      avatarUrl
      bio
      location
      company
      twitterUsername
      websiteUrl
      createdAt
      followers {
        totalCount
      }
      following {
        totalCount
      }
      contributionsCollection {
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              contributionCount
              date
            }
          }
        }
      }
      repositories(first: 60, orderBy: {field: STARGAZERS, direction: DESC}, privacy: PUBLIC, isFork: false) {
        totalCount
        nodes {
          name
          description
          stargazerCount
          forkCount
          primaryLanguage {
            name
            color
          }
          diskUsage
          createdAt
          updatedAt
          url
          isFork
          repositoryTopics(first: 5) {
            nodes {
              topic {
                name
              }
            }
          }
        }
      }
    }
  }
`;

/**
 * Executes GraphQL query with token
 */
export async function fetchGitHubGalaxyData(username: string, customToken?: string): Promise<UserGalaxyData> {
  const token = customToken || process.env.GITHUB_TOKEN;

  if (token) {
    try {
      const res = await fetch(GITHUB_GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          'Content-Type': 'application/json',
          'User-Agent': '3D-GitHub-Galaxy-App',
        },
        body: JSON.stringify({
          query: GALAXY_QUERY,
          variables: { login: username },
        }),
        next: { revalidate: 60 }, // 1 min cache
      });

      if (res.ok) {
        const json = await res.json();
        if (json.data && json.data.user) {
          return json.data as UserGalaxyData;
        }
        if (json.errors && json.errors.length > 0) {
          console.warn('GraphQL returned errors:', json.errors[0]?.message);
        }
      }
    } catch (err) {
      console.warn('GraphQL fetch failed, trying REST fallback:', err);
    }
  }

  // Fallback 1: Public GitHub REST API
  try {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': '3D-GitHub-Galaxy-App',
    };
    if (token) {
      headers.Authorization = `token ${token.trim()}`;
    }

    const [userRes, reposRes] = await Promise.all([
      fetch(`https://api.github.com/users/${username}`, { headers, next: { revalidate: 60 } }),
      fetch(`https://api.github.com/users/${username}/repos?per_page=60&sort=pushed`, { headers, next: { revalidate: 60 } }),
    ]);

    if (userRes.ok && reposRes.ok) {
      const u = await userRes.json();
      const repos = await reposRes.json();

      // Transform REST output to GraphQL schema
      const nodes = (Array.isArray(repos) ? repos : []).map((r: any) => ({
        name: r.name,
        description: r.description,
        stargazerCount: r.stargazers_count || 0,
        forkCount: r.forks_count || 0,
        primaryLanguage: r.language ? { name: r.language, color: null } : null,
        diskUsage: r.size || 100,
        createdAt: r.created_at || r.updated_at || new Date().toISOString(),
        updatedAt: r.updated_at || new Date().toISOString(),
        url: r.html_url,
        isFork: r.fork || false,
        repositoryTopics: { nodes: (r.topics || []).map((t: string) => ({ topic: { name: t } })) },
      }));

      // Approximate contributions if GraphQL calendar is unauthenticated
      const approxContributions = Math.max(
        u.public_repos * 18,
        nodes.reduce((acc: number, n: any) => acc + (n.stargazerCount > 10 ? 45 : 12), 120)
      );

      return {
        user: {
          login: u.login,
          name: u.name || u.login,
          avatarUrl: u.avatar_url,
          bio: u.bio,
          location: u.location,
          company: u.company,
          twitterUsername: u.twitter_username,
          websiteUrl: u.blog,
          createdAt: u.created_at,
          followers: { totalCount: u.followers || 0 },
          following: { totalCount: u.following || 0 },
          contributionsCollection: {
            contributionCalendar: {
              totalContributions: approxContributions,
            },
          },
          repositories: {
            totalCount: u.public_repos || nodes.length,
            nodes,
          },
        },
      };
    }
  } catch (restErr) {
    console.warn('REST fallback failed:', restErr);
  }

  // Fallback 2: Generate rich procedural galaxy data for demo / offline experience
  return generateProceduralGalaxy(username);
}

/**
 * Procedural galaxy generator for offline / fallback stability
 */
export function generateProceduralGalaxy(username: string): UserGalaxyData {
  const isLinus = username.toLowerCase().includes('torvalds');
  const isShadcn = username.toLowerCase().includes('shadcn');
  
  const reposCount = isLinus ? 18 : 24;
  const sampleLanguages = ['TypeScript', 'Rust', 'JavaScript', 'Python', 'Go', 'C++', 'CSS'];

  const nodes = Array.from({ length: reposCount }).map((_, i) => {
    const lang = sampleLanguages[i % sampleLanguages.length];
    const stars = isLinus
      ? Math.floor(Math.pow(Math.random(), 3) * 190000) + 120
      : Math.floor(Math.pow(Math.random(), 2.5) * 45000) + (i === 0 ? 55000 : 15);

    return {
      name: `${username.toLowerCase()}-stellar-core-${i + 1}`,
      description: `Hyper-optimized cosmic repository engine powered by ${lang} and distributed gravitational clusters.`,
      stargazerCount: stars,
      forkCount: Math.floor(stars * 0.15) + 3,
      primaryLanguage: {
        name: lang,
        color: null,
      },
      diskUsage: Math.floor(Math.random() * 45000) + 500,
      createdAt: new Date(Date.now() - i * 86400000 * 80).toISOString(),
      updatedAt: new Date(Date.now() - i * 86400000 * 4).toISOString(),
      url: `https://github.com/${username}`,
      isFork: false,
      repositoryTopics: {
        nodes: [
          { topic: { name: lang.toLowerCase() } },
          { topic: { name: 'galaxy' } },
          { topic: { name: 'astronomy' } },
        ],
      },
    };
  });

  return {
    user: {
      login: username,
      name: username.charAt(0).toUpperCase() + username.slice(1),
      avatarUrl: `https://avatars.githubusercontent.com/u/${Math.floor(Math.random() * 8000000) + 1000}?v=4`,
      bio: 'Architect of Stellar Code Systems & Intergalactic Repositories',
      location: 'Deep Space Orbit • Sector 7',
      company: 'Cosmic Systems Galactic',
      twitterUsername: username,
      websiteUrl: `https://${username}.dev`,
      createdAt: '2018-04-12T00:00:00Z',
      followers: { totalCount: Math.floor(Math.random() * 12000) + 850 },
      following: { totalCount: Math.floor(Math.random() * 300) + 20 },
      contributionsCollection: {
        contributionCalendar: {
          totalContributions: Math.floor(Math.random() * 3500) + 850,
        },
      },
      repositories: {
        totalCount: reposCount,
        nodes,
      },
    },
  };
}
