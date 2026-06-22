export const calculateTutorialHellIndex = (repos) => {
  if (!repos || repos.length === 0) return { percentage: 0, status: "NO REPOS FOUND. PROBABLY DELETED THEM ALL IN SHAME.", evidence: "0 public repositories found.", isHigh: false };
  
  const tutorialKeywords = ['todo', 'clone', 'weather', 'calculator', 'tic-tac-toe', 'counter', 'ecommerce', 'resume', 'course', 'learning', 'practice'];
  let matchCount = 0;
  let evidenceList = [];
  
  repos.forEach(repo => {
    // Ignore repos with more than 5 stars (probably a real project)
    if (repo.stargazers_count > 5) return;
    
    const name = repo.name.toLowerCase();
    const desc = (repo.description || '').toLowerCase();
    const isFork = repo.fork;
    
    const hasKeyword = tutorialKeywords.some(keyword => name.includes(keyword) || desc.includes(keyword));
    
    if (hasKeyword || isFork) {
      matchCount++;
      if (evidenceList.length < 5) {
        let reason = isFork ? `${repo.name} (forked)` : repo.name;
        evidenceList.push(reason);
      }
    }
  });

  const percentage = Math.round((matchCount / repos.length) * 100);
  let status = "MODERATE ORIGINALITY DETECTED. NOT TERRIBLE.";
  let evidence = evidenceList.length > 0 ? `Matched tutorials/forks: ${evidenceList.join(', ')}${matchCount > 5 ? '...' : ''}` : "No tutorial keywords or excessive forks found.";
  let isHigh = percentage > 40; // Lowered threshold since we include forks and desc now
  
  if (isHigh) {
    status = "[DIAGNOSIS: ZERO ORIGINAL THOUGHT. RELYING ON TUTORIALS AND FORKS TO PAD THE RESUME.]";
  } else if (percentage === 0) {
    status = "NO TUTORIALS DETECTED. EITHER A GENIUS OR HIDING THEIR PAST IN PRIVATE REPOS.";
  }

  return { percentage, status, evidence, isHigh };
};

export const calculateLazyCommitterRating = (events) => {
  if (!events || events.length === 0) return { count: 0, status: "NO EVENTS FOUND. ACCOUNT APPEARS DEAD.", evidence: "No recent push events.", isHigh: false };

  const pushEvents = events.filter(e => e.type === "PushEvent");
  let lazyCount = 0;
  const lazyKeywords = ["fix", "update", "wip", "final", "test", "oops"];
  let evidenceList = [];

  pushEvents.forEach(event => {
    const commits = event.payload?.commits || [];
    commits.forEach(commit => {
      const msg = commit.message.toLowerCase().trim();
      
      // Strict check: if message is exactly the lazy keyword, or very short (<15) and contains it
      const isExactlyLazy = lazyKeywords.includes(msg);
      const isShortLazy = msg.length < 15 && lazyKeywords.some(kw => msg.includes(kw));
      
      if (isExactlyLazy || isShortLazy) {
        lazyCount++;
        if (evidenceList.length < 3) evidenceList.push(`"${commit.message}"`);
      }
    });
  });

  let status = "ACCEPTABLE COMMIT DISCIPLINE.";
  let evidence = evidenceList.length > 0 ? `Spotted lazy commits like: ${evidenceList.join(', ')}` : "All recent commits look highly descriptive.";
  let isHigh = lazyCount > 3; // Reduced threshold since check is stricter

  if (isHigh) {
    status = "[DIAGNOSIS: CHAOTIC PROGRAMMER. LEAVES ZERO CONTEXT FOR FUTURE MAINTAINERS.]";
  } else if (lazyCount === 0 && pushEvents.length > 0) {
     status = "IMPECCABLE COMMIT MESSAGES DETECTED. DEFINITELY USES AI TO WRITE THEM.";
  }

  return { count: lazyCount, status, evidence, isHigh };
};

export const calculateWeekendWarriorMonitor = (events) => {
  if (!events || events.length === 0) return { count: 0, status: "NO EVENTS FOUND. TOUCHING GRASS CONFIRMED.", evidence: "No event data.", isHigh: false };

  const pushEvents = events.filter(e => e.type === "PushEvent");
  let weekendCount = 0;
  let evidenceList = [];

  pushEvents.forEach(event => {
    const date = new Date(event.created_at);
    // getUTCDay() returns 0 for Sunday, 6 for Saturday
    const day = date.getUTCDay();
    if (day === 0 || day === 6) {
      weekendCount++;
      if (evidenceList.length < 1) {
        evidenceList.push(`Pushed code on a ${day === 0 ? 'Sunday' : 'Saturday'}`);
      }
    }
  });

  let status = "HEALTHY WORK-LIFE BALANCE. DOES NOT TOUCH CODE ON WEEKENDS.";
  let evidence = evidenceList.length > 0 ? `${evidenceList[0]} (UTC)` : "No commits detected on weekends.";
  let isHigh = weekendCount > 0;

  if (isHigh) {
    status = "[DIAGNOSIS: WEEKEND WARRIOR. BURNOUT IMMINENT. HAS FORGOTTEN WHAT OUTDOORS LOOKS LIKE.]";
  }

  return { count: weekendCount, status, evidence, isHigh };
};

export const calculateLanguageStats = (repos) => {
  if (!repos || repos.length === 0) return { count: 0, status: "NO REPOS FOUND.", evidence: "No language data.", isHigh: false };
  
  const languages = new Set();
  repos.forEach(repo => {
    if (repo.language) {
      languages.add(repo.language);
    }
  });

  const count = languages.size;
  let status = "BALANCED TECH STACK. BORING BUT SAFE.";
  let evidence = count > 0 ? `Languages: ${Array.from(languages).slice(0, 4).join(', ')}${count > 4 ? '...' : ''}` : "No primary languages found in public repos.";
  let isHigh = count <= 1 || count >= 8;

  if (count === 1) {
    status = "[DIAGNOSIS: LANGUAGE MONOGAMIST. TERRIFIED TO LEARN ANYTHING OUTSIDE THEIR COMFORT ZONE.]";
  } else if (count >= 8) {
    status = "[DIAGNOSIS: TREND CHASER. WRITING 'HELLO WORLD' IN 15 LANGUAGES DOES NOT MAKE YOU FULL-STACK.]";
  } else if (count === 0) {
    status = "[DIAGNOSIS: NO CODE DETECTED. DO THEY JUST WRITE MARKDOWN REPOS?]";
    isHigh = true;
  }

  return { count, status, evidence, isHigh };
};

export const calculateYapperRatio = (events) => {
  if (!events || events.length === 0) return { count: 0, status: "NO EVENTS FOUND.", evidence: "No recent activity.", isHigh: false };

  let pushCount = 0;
  let yapCount = 0;

  events.forEach(event => {
    if (event.type === "PushEvent") pushCount++;
    if (event.type === "IssueCommentEvent" || event.type === "IssuesEvent" || event.type === "PullRequestReviewCommentEvent") {
      yapCount++;
    }
  });

  const ratio = pushCount === 0 ? yapCount : yapCount / pushCount;
  let status = "ACTUALLY WRITES CODE INSTEAD OF JUST COMPLAINING ABOUT IT.";
  let evidence = `Found ${yapCount} issue/PR comments vs ${pushCount} pushes.`;
  let isHigh = ratio > 2 && yapCount > 5;

  if (isHigh) {
    status = "[DIAGNOSIS: PROFESSIONAL YAPPER. OPENS ISSUES ABOUT BUTTON PADDING BUT WRITES ZERO CODE.]";
  } else if (pushCount === 0 && yapCount === 0) {
    status = "GHOST ACCOUNT. DOES ABSOLUTELY NOTHING.";
    evidence = "0 pushes, 0 comments in the last 90 days.";
    isHigh = true; // Ghost is a roast
  }

  return { count: yapCount, status, evidence, isHigh };
};

export const calculateNetworkerStatus = (profile) => {
  if (!profile) return { count: 0, status: "NO PROFILE FOUND.", evidence: "Error loading profile.", isHigh: false };

  const { followers, following, public_repos } = profile;
  
  let status = "NORMAL FOLLOWER RATIO. NOT BEGGING FOR ATTENTION.";
  let evidence = `Following: ${following} | Followers: ${followers}`;
  let isHigh = false;

  if (following > followers * 5 && following > 30) {
    status = "[DIAGNOSIS: DESPERATE NETWORKER. FOLLOWS HALF OF GITHUB HOPING FOR A FOLLOW BACK.]";
    isHigh = true;
  } else if (followers === 0 && public_repos > 20) {
    status = "[DIAGNOSIS: SCREAMING INTO THE VOID. SHIPPING CODE THAT LITERALLY NOBODY IS WATCHING.]";
    evidence = `${public_repos} repos, 0 followers.`;
    isHigh = true;
  } else if (followers > 500 && following < 10) {
    status = "[DIAGNOSIS: GOD COMPLEX. TOO IMPORTANT TO FOLLOW ANYONE BACK.]";
    isHigh = true;
  }

  return { count: following, status, evidence, isHigh };
};
