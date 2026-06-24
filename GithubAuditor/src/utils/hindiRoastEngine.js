import {
  calculateTutorialHellIndex,
  calculateLazyCommitterRating,
  calculateWeekendWarriorMonitor,
  calculateLanguageStats,
  calculateYapperRatio,
  calculateNetworkerStatus
} from './metrics';

export const generateHindiRoast = (data) => {
  const { profile, repos, events, starred, orgs, followers } = data;
  const name = profile.name || profile.login;

  if (profile.login && profile.login.toLowerCase() === 'amitsikdar37') {
    return "Zindagi mein coding ke alawa kuch hai nahi tere paas? Saturday-Sunday baith ke copy-paste maar raha hai aur usme bhi laziness dikh rahi hai. Berozgar hai iska matlab ye nahi ki poora din screen ke aage sarr jaye.";
  }

  const networker = calculateNetworkerStatus(profile);
  const tutorialHell = calculateTutorialHellIndex(repos);
  const langStats = calculateLanguageStats(repos);
  const lazyCommitter = calculateLazyCommitterRating(events);
  const yapper = calculateYapperRatio(events);
  const weekend = calculateWeekendWarriorMonitor(events);

  // New Data Metrics
  const starredCount = starred ? starred.length : 0;
  const orgsCount = orgs ? orgs.length : 0;
  const followersCount = followers ? followers.length : 0;
  const followerToFollowingRatio = profile.following > 0 ? followersCount / profile.following : 1;

  // Score archetypes
  let scores = {
    fakeSenior: (tutorialHell.isHigh ? 2 : 0) + (networker.isHigh ? 1 : 0) + (yapper.isHigh ? 2 : 0),
    sweatyTryHard: (weekend.isHigh ? 2 : 0) + (lazyCommitter.isHigh ? 1 : 0) + (tutorialHell.isHigh ? 1 : 0),
    techCritic: (yapper.isHigh ? 3 : 0) + (events && events.filter(e => e.type === "PushEvent").length === 0 ? 2 : 0),
    screamingVoid: (profile.followers === 0 && profile.public_repos > 15 ? 3 : 0) + (networker.isHigh ? 1 : 0),
    trendChaser: (langStats.count >= 8 ? 3 : 0) + (lazyCommitter.isHigh ? 1 : 0),
    dinosaur: (langStats.count === 1 ? 3 : 0) + (events && events.filter(e => e.type === "PushEvent").length > 10 ? 1 : 0),
    ghost: (events && events.length === 0 ? 4 : 0),
    osGod: (!tutorialHell.isHigh && !lazyCommitter.isHigh && profile.followers > 100 ? 3 : 0),
    // New Archetypes
    digitalHoarder: (starredCount > 30 && repos && repos.length < 5 ? 4 : 0),
    loneWolf: (orgsCount === 0 && repos && repos.length > 20 && profile.followers < 5 ? 4 : 0),
    fakeClout: (followersCount > 10 && followerToFollowingRatio < 0.2 ? 4 : 0)
  };

  // Find max score
  let maxArchetype = 'averageJoe';
  let maxScore = 0;
  for (const [archetype, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      maxArchetype = archetype;
    }
  }
  
  if (maxScore === 0) maxArchetype = 'averageJoe';

  // Random variations for each archetype
  const randomRoast = (options) => options[Math.floor(Math.random() * options.length)];

  const roasts = {
    digitalHoarder: [
      `Bhai ${name}, tune ${starredCount} repositories ko star kar rakha hai, par khud ke naam pe dhang ka ek repo nahi hai. 'Awesome Python' ko star karne se tere andar JavaScript thodi na download ho jayegi? Tu developer nahi, digital kabaadiwala (hoarder) hai.`,
      `Dusro ke projects pe star dabane se career nahi banta mere dost. Itne saare bookmarks save kar rakhe hain jo tu kabhi khol ke nahi dekhega. Khud ka code likhna kab shuru karega?`,
      `Tera account ek museum ban chuka hai jisme dusro ki mehnat saji hai. Star button ko aaram de aur khud ka terminal khol le, warna berozgaari pakki hai.`
    ],
    loneWolf: [
      `Ek bhi organization ka hissa nahi hai? Lagta hai kisi team ko tera attitude aur tera kachra code bardasht nahi hota. Akele akele baith ke code likhta reh, team-player banne ki aukaat nahi lagti.`,
      `Bhai ${name}, na koi dost, na koi organization. Tu sach mein 'Lone Wolf' banne ka try kar raha hai ya real life mein bhi itna hi socially awkward hai? Corporate mein akele kaam nahi chalta.`,
      `Sab kuch solo repos mein bhara pada hai. Kabhi dusro ke saath kaam karke PR merge karwaya hai? Tera code review karne baithu toh aadhe developers waise hi resign kar denge.`
    ],
    fakeClout: [
      `Bhai tere followers ki list dekhi maine. Aadhe se zyada bots hain jinki profile picture tak nahi hai. Fiverr pe $5 deke followers kharidna band kar, HR ko sab pata chal jata hai ki tera clout fake hai.`,
      `Followers toh dikha raha hai, par follower-to-following ratio dekh ke saaf pata chal raha hai ki 'follow me back' bol bol ke bheekh maangi hai. Ye GitHub hai, Instagram nahi jahan clout chasing chalti hai.`,
      `Aise fake networkers ko tech industry mein koi bhav nahi deta. Tera follower count teri asli skills se bada hai, aur ye bohot sharam ki baat hai.`
    ],
    fakeSenior: [
      `Arre ${name} saab, badhiya scam chala rahe ho! Followers bhare pade hain, GitHub pe baatein badi badi, par sachai yeh hai ki repo mein sirf YouTube tutorials chaape hain. Khud ka original code likhne mein pasina aata hai kya? Berozgaari chhupane ka ye fake-senior tarika theek nahi hai.`,
      `Dekh bhai ${name}, teri reality samajh aa gayi hai mujhe. Issues aur PRs mein gyan baantne mein tu aage, aur teri khud ki repository mein 'Weather App' padi hai. Fake senior banne ki jagah asli coding seekh le, warna lifetime unemployed junior hi rahega.`,
      `Tumhare followers aur tutorials dekh ke clearly lag raha hai tum 'build in public' wale fake guru ho. Code likhna aata nahi, dusro ki repo pe comment karke clout dhundhte ho. Jaake Naukri.com pe dhang ka job dhundh.`
    ],
    sweatyTryHard: [
      `Bhai ${name}, tu weekend pe bhi baith ke code push kar raha hai aur wo bhi "fix bug" jaisi kachra history ke saath? Thoda bahar ja, ghas chhoo le. Itna ragadne ke baad bhi tere projects tatti hi dikh rahe hain, naukri aise nahi milegi.`,
      `Zindagi mein coding ke alawa kuch hai nahi tere paas? Saturday-Sunday baith ke copy-paste maar raha hai aur usme bhi laziness dikh rahi hai. Berozgar hai iska matlab ye nahi ki poora din screen ke aage sarr jaye.`,
      `${name}, tum weekend warriors ki problem yehi hoti hai. Tumhe lagta hai 24/7 hustle karne se Google bula lega. Teri aalsi commit history aur copied repos dekh ke toh TCS bhi reject kar de.`
    ],
    techCritic: [
      `${name}, kaam dhelay ka nahi aur baatein karodo ki. Ek line ka dhang ka code push nahi kiya, par dusro ke issues pe format aur padding theek karne ka gyan de raha hai. Coder hai ya software inspector? Aise unemployed rahoge.`,
      `Tere events dekhe maine... sirf comments aur complaints. Khud code likhne mein maut aati hai kya? Tech influencer banna chhod, apna code editor khol aur kuch bana, warna lifetime bench pe rahega.`,
      `Tum shayad woh insaan ho jo project mein kuch contribute nahi karta par group presentation mein sabse aage khada rehta hai. Professional yapper banne ke paise nahi milte IT mein, kaam karna shuru kar.`
    ],
    screamingVoid: [
      `Bhai ${name}, itne saare kachra repos bana diye aur follower tera ek bhi nahi hai! Khali kamre mein chilla raha hai kya? Ye 'open source contribution' ka natak band kar aur asli naukri dhundh le.`,
      `Aadhi duniya ko follow karke rakha hai 'follow back' ki umeed mein, aur badle mein zero attention. Tujhe lagta hai itne saare bekaar project bana ke tu discover ho jayega? Tera account ek graveyard ban chuka hai.`,
      `Tumhari GitHub activity dekh ke lagta hai tum zor-zor se ro rahe ho par koi sunne wala nahi hai. Khokhle projects se GitHub bharna band kar, isse internship bhi nahi milegi.`
    ],
    trendChaser: [
      `Waah ${name}! Itni saari languages mein 'Hello World' likhne se tu full-stack thodi na ban jayega. Har hafte Twitter pe naya framework seekhna chhod aur ek cheez dhang se pakad le warna pakka berozgar rahega.`,
      `Tum social media pe trend dekh ke language change karte ho na? Tera commit history bata raha hai ki tujhe aati ek bhi nahi hai theek se. Trend chaser banne se achha hai kisi ek tech-stack mein naukri dhoondh le.`,
      `Bhai, tere repos ka tech-stack ek khichdi ban chuka hai. Itna jump karega toh ek din pata chalega ki kisi bhi language mein tera technical round clear nahi ho raha. Focus kar thoda.`
    ],
    dinosaur: [
      `${name}, tu pichle pachaas saal se ek hi language mein atka hai kya? Nayi cheezein seekhne mein darr lagta hai ya dimaag chalna band ho gaya hai? AI tera job kha jayega agar aisi hi monogamy chalti rahi toh.`,
      `Tere account mein variety zero hai. Lagta hai kisi legacy code maintain karne wali sasti naukri mein atka hua hai, jisme bas roz wahi sadi hui tech mein code likhna padta hai.`,
      `Ek hi tech-stack se itna hi pyaar ho gaya hai kya? Bhai comfort zone se bahar nikal, duniya aage badh chuki hai. Tere commit dekh ke lagta hai tu aaj bhi 2015 mein ji raha hai.`
    ],
    ghost: [
      `${name}, account banaya hi kyun tha jab use nahi karna? Pishle mahino mein ek single push nahi hai. Bas resume mein link daalne ke liye banaya hai na? Ye nallapanti hai ekdum.`,
      `Tera GitHub utna hi dead hai jitna tera tech career. 0 events, 0 commits. Isko delete hi kar de bhai, recruiter ke aage bezzati karwane se achha hai.`,
      `Kya hua, coding hi chhod di kya? Tera public profile dekh ke lag raha hai ki pichle janam mein tune aakhri code likha tha. Berozgaari enjoy kar.`
    ],
    osGod: [
      `${name}, followers bahut hain tere, aur code bhi original lag raha hai. Par sach bata... aakhri baar kab dhoop dekhi thi tune? Girlfriend/Boyfriend chhod, tera toh dopamine system hi fry ho chuka hai.`,
      `Achha coder hai tu, maan gaye. Par tere commits dekh ke pata chal raha hai ki social life absolutely zero hai. Tere code reviews mein jitni clarity hai, utni shayad teri personal life mein bhi nahi hogi.`,
      `Tu waqai mein ek theek developer hai, par screen time tera itna zyaada hai ki mujhe dar hai tu ek din keyboard se hi chipak ke na reh jaye. Ja thoda aaram kar.`
    ],
    averageJoe: [
      `Arre ${name} bhai. Tera profile itna 'normal' aur safe hai ki samajh nahi aata kya hi bolu. Itna boring rahega toh appraisal kab milega? Wahi sasti si average job mein poori zindagi nikalni hai kya?`,
      `Na tu bahut ganda code likhta hai, na bahut achha. Ekdum sarkaari daftar waali feeling aa rahi hai tera GitHub dekh ke. Thoda risk le, kuch bada bana, warna puri umar average banke reh jayega.`,
      `Tera account ekdum tasteless khichdi jaisa hai. Sab kuch theek-thaak hai, par mazza bilkul nahi hai. Apna LinkedIn update karna band kar aur asli skills level-up kar, warna unemployment door nahi.`
    ]
  };

  return randomRoast(roasts[maxArchetype]);
};
