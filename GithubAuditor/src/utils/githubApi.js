export const fetchGithubData = async (username) => {
  const headers = {
    Accept: "application/vnd.github.v3+json",
  };

  try {
    // 1. Fetch profile first to ensure user exists
    const profileResponse = await fetch(`https://api.github.com/users/${username}`, { headers });
    
    if (profileResponse.status === 403 || profileResponse.status === 429) {
      throw new Error("RATE_LIMIT");
    }
    
    if (profileResponse.status === 404) {
      throw new Error("NOT_FOUND");
    }

    if (!profileResponse.ok) {
      throw new Error("API_ERROR");
    }

    const profile = await profileResponse.json();

    // 2. Fetch everything else in parallel to save time
    const [reposRes, eventsRes, starredRes, orgsRes, followersRes] = await Promise.all([
      fetch(`https://api.github.com/users/${username}/repos?per_page=100&sort=updated`, { headers }),
      fetch(`https://api.github.com/users/${username}/events?per_page=100`, { headers }),
      fetch(`https://api.github.com/users/${username}/starred?per_page=100`, { headers }),
      fetch(`https://api.github.com/users/${username}/orgs`, { headers }),
      fetch(`https://api.github.com/users/${username}/followers?per_page=100`, { headers })
    ]);

    // Helper to safely parse JSON if OK, else return empty array
    const safeParse = async (res) => {
      if (res.status === 403 || res.status === 429) throw new Error("RATE_LIMIT");
      return res.ok ? await res.json() : [];
    };

    const repos = await safeParse(reposRes);
    const events = await safeParse(eventsRes);
    const starred = await safeParse(starredRes);
    const orgs = await safeParse(orgsRes);
    const followers = await safeParse(followersRes);

    return { profile, repos, events, starred, orgs, followers };
  } catch (error) {
    throw error;
  }
};
