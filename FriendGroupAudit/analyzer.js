/**
 * Chat Analyzer v3 — Fixed Accuracy Bugs
 * Computes the four embarrassing metrics from parsed WhatsApp messages.
 * 
 * v3 Fixes:
 * - Berozgar: Fixed broken sorting — while loop inside for loop was
 *   double-incrementing i and corrupting response time data. Rewritten
 *   with a clean two-pass approach.
 * - Left on Read: Added lurker detection — people who are group members
 *   but almost never participate now get properly penalized.
 */

const ChatAnalyzer = (() => {

    // ================================================
    // ROAST TEMPLATES per metric
    // ================================================

    const BEROZGAR_ROASTS = [
        "PURE BEROZGARI DETECTED. DOES NOT HAVE A JOB OR A LIFE.",
        "PHONE IS SURGICALLY ATTACHED TO HAND. SEEK EMPLOYMENT.",
        "FASTER THAN DOMINO'S 30-MIN DELIVERY. GET A CAREER.",
        "REPLY SPEED SUGGESTS ZERO RESPONSIBILITIES. CERTIFIED JOBLESS.",
        "IS THIS A HUMAN OR A CHATBOT? EITHER WAY, NEEDS SUNLIGHT.",
    ];

    const BEROZGAR_ROASTS_LOW = [
        "Actually has a life. Suspicious behavior for this group.",
        "Takes their sweet time. Probably has real responsibilities.",
        "Responds like a normal adult. Boring but respectable.",
    ];

    const DRY_ROASTS = [
        "VIBE KILLER. CHAT EXTINCTION EVENT.",
        "CERTIFIED CONVERSATION ASSASSIN. ONE-WORD WONDER.",
        "TEXTING STYLE: EMOTIONALLY UNAVAILABLE. VOCABULARY: EXTINCT.",
        "TYPING WITH ONE THUMB AND ZERO INTEREST. CHAT DESERT.",
        "REPLIES LIKE A GOVERNMENT OFFICE. MINIMUM EFFORT MAXIMUM PAIN.",
    ];

    const DRY_ROASTS_LOW = [
        "Actually writes proper sentences. Overachiever spotted.",
        "Surprisingly literate for this friend group.",
        "Puts effort into texting. We don't deserve them.",
    ];

    const GHOST_ROASTS = [
        "THINKS HE IS A CELEBRITY. NEEDS TO BE KICKED FROM THE GROUP.",
        "TREATS GROUP CHAT LIKE A READ-ONLY NEWSLETTER.",
        "PROFESSIONAL GHOST. RESPONDS ONLY ON FULL MOONS.",
        "LEFT ON READ SPECIALIST. BLACK BELT IN IGNORING FRIENDS.",
        "GHOST PROTOCOL ACTIVATED. THIS PERSON DOESN'T EXIST SOCIALLY.",
    ];

    const GHOST_ROASTS_LOW = [
        "Rarely ghosts. Either very polite or very lonely.",
        "Actually responds to messages. What a concept.",
        "Low ghost count. Suspiciously good friend behavior.",
    ];

    const LURKER_ROASTS = [
        "LURKER SUPREME. READS EVERYTHING, SAYS NOTHING. GROUP SPY.",
        "SILENT OBSERVER. IN THE GROUP BUT NOT IN THE CONVERSATION.",
        "DIGITAL WALLFLOWER. HAS OPINIONS BUT KEEPS THEM CLASSIFIED.",
        "SEES ALL, SAYS NOTHING. THE NSA WOULD HIRE THIS PERSON.",
        "GROUP MEMBERSHIP IS JUST A FORMALITY AT THIS POINT.",
    ];

    const MIDNIGHT_ROASTS = [
        "OVERTHINKING OR EMOTIONALLY DAMAGE-REPORTING.",
        "3 AM PHILOSOPHER. PROBABLY STALKING AN EX.",
        "NOCTURNAL CREATURE. RUNS ON INSOMNIA AND BAD DECISIONS.",
        "TEXTS MORE AT 3AM THAN DURING BUSINESS HOURS. NEEDS INTERVENTION.",
        "CERTIFIED NIGHT OWL. SLEEPS WHEN THE SUN RISES LIKE A VAMPIRE.",
    ];

    const MIDNIGHT_ROASTS_LOW = [
        "Sleeps at a normal hour like a responsible adult. Boring.",
        "Low night activity. Probably has a proper sleep schedule. Nerd.",
        "Actually sleeps at night. Not relatable at all.",
    ];

    function getRandomRoast(roasts) {
        return roasts[Math.floor(Math.random() * roasts.length)];
    }

    // ================================================
    // METRIC 1: BEROZGAR AWARD (Response Latency)
    // v3: Clean rewrite — no more while-inside-for bug
    // ================================================

    /**
     * For each user, calculate average response time.
     * 
     * Algorithm:
     * 1. Scan all messages sequentially
     * 2. When sender changes, record a "response event" for the new sender
     *    - Response time = gap between last message from OTHER sender and this one
     *    - Only count if gap is 0-30 minutes (active conversation)
     * 3. Only count the FIRST message in a burst (consecutive messages from same sender)
     *    — achieved by tracking whether we already recorded this sender's entry into the conversation
     */
    function calcResponseLatency(messages) {
        const responseTimes = {}; // { sender: [timeDeltaMinutes, ...] }

        // STEP 1: Build a list of "sender switches" — the first message
        //         each time a different person starts talking
        const senderSwitches = []; // { index, sender, timestamp, triggerTimestamp }

        let lastSender = null;
        for (let i = 0; i < messages.length; i++) {
            const msg = messages[i];
            if (!msg.timestamp || isNaN(msg.timestamp.getTime())) continue;

            if (msg.sender !== lastSender) {
                // This is a sender switch — find the trigger message
                // (last message from someone OTHER than this sender)
                let triggerTime = null;
                for (let j = i - 1; j >= Math.max(0, i - 30); j--) {
                    if (messages[j].sender !== msg.sender && messages[j].timestamp && !isNaN(messages[j].timestamp.getTime())) {
                        triggerTime = messages[j].timestamp;
                        break;
                    }
                }

                senderSwitches.push({
                    index: i,
                    sender: msg.sender,
                    timestamp: msg.timestamp,
                    triggerTimestamp: triggerTime,
                });

                lastSender = msg.sender;
            }
            // If same sender continues, we just skip (burst)
        }

        // STEP 2: Calculate response times from sender switches
        for (const sw of senderSwitches) {
            if (!sw.triggerTimestamp) continue;

            const deltaMinutes = (sw.timestamp - sw.triggerTimestamp) / (1000 * 60);

            // Only count responses within 30 minutes (active conversation)
            // Filter out negatives (bad data) and NaN
            if (deltaMinutes >= 0 && deltaMinutes <= 30 && !isNaN(deltaMinutes)) {
                if (!responseTimes[sw.sender]) responseTimes[sw.sender] = [];
                responseTimes[sw.sender].push(deltaMinutes);
            }
        }

        // STEP 3: Calculate stats
        const results = [];
        for (const [sender, times] of Object.entries(responseTimes)) {
            if (times.length < 3) continue; // Need minimum sample size

            // Sort for median
            const sorted = [...times].sort((a, b) => a - b);
            const median = sorted[Math.floor(sorted.length / 2)];
            const avg = times.reduce((a, b) => a + b, 0) / times.length;

            results.push({
                name: sender,
                avgMinutes: Math.round(avg * 100) / 100,
                medianMinutes: Math.round(median * 100) / 100,
                totalResponses: times.length,
                roast: median < 2 ? getRandomRoast(BEROZGAR_ROASTS) : getRandomRoast(BEROZGAR_ROASTS_LOW),
            });
        }

        // Sort by fastest MEDIAN (lowest = most berozgar)
        results.sort((a, b) => a.medianMinutes - b.medianMinutes);
        return results;
    }

    // ================================================
    // METRIC 2: DRY TEXTER INDEX (Lexical Diversity)
    // ================================================

    function calcDryTexterIndex(messages) {
        const DRY_WORDS_REGEX = /^(ok|okay|okk+|okkk*|k+|hmm+|hm+|haan+|ha+n?|haha+|hehe+|hihi+|lol+|lmao+|lmfao|rofl|nice|achha|accha|acha|ohh*|oo+h?|ooo*|ye+s?|yep|yea+h?|yup|no+|nah+|nhi+|ni+|na+h?|thik|theek|toh|chal+|chlo|chalo|wo+|ji+|ohk|okayy*|seen|bruh|true|sahi|bhai+|bro+|hn+|hnn+|are+|bc|bsdk|bkl|raa+|mc|betichod|loura|saala+|kya|aur|abe+|chup|ruk|de|le|bol|haa+|naa+|hmm|oo|kk+|yo+|sup|damn|shit|wtf|omg|ikr|idk|nvm|tb|toh|bs|bas|bilkul|dekh|sun|arre+|arey+|re+)$/i;

        const EMOJI_ONLY_REGEX = /^[\s\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]+$/u;

        const PUNCT_ONLY_REGEX = /^[.!?,\-_~*#@&;:'"()[\]{}<>\/\\|`^%$+=]+$/;

        const userMessages = {};

        for (const msg of messages) {
            if (msg.isMedia || msg.isDeleted) continue;
            const content = msg.content.trim();
            if (content.length === 0) continue;

            if (!userMessages[msg.sender]) {
                userMessages[msg.sender] = { total: 0, dry: 0 };
            }

            userMessages[msg.sender].total++;

            const isDry =
                DRY_WORDS_REGEX.test(content) ||
                EMOJI_ONLY_REGEX.test(content) ||
                PUNCT_ONLY_REGEX.test(content) ||
                content.length <= 2;

            if (isDry) {
                userMessages[msg.sender].dry++;
            }
        }

        const results = [];
        for (const [sender, data] of Object.entries(userMessages)) {
            if (data.total < 5) continue;
            const pct = (data.dry / data.total) * 100;
            results.push({
                name: sender,
                dryPercent: Math.round(pct),
                dryCount: data.dry,
                totalMessages: data.total,
                roast: pct >= 40 ? getRandomRoast(DRY_ROASTS) : getRandomRoast(DRY_ROASTS_LOW),
            });
        }

        results.sort((a, b) => b.dryPercent - a.dryPercent);
        return results;
    }

    // ================================================
    // METRIC 3: LEFT ON READ CHAMPION (Interaction Dropout)
    // v3: Added lurker detection for people like Pranav
    // ================================================

    /**
     * v3 approach — three-pass algorithm:
     * 
     * PASS 1: Session-based ghosting (same as v2)
     *   When a conversation session dies (6hr gap), people who were
     *   active in the last 15 min but didn't send the last message = ghosted.
     * 
     * PASS 2: @mention ghosting
     *   Extra penalty for ignoring direct @tags.
     * 
     * PASS 3 (NEW): Lurker detection
     *   Compare each user's total messages to the group average.
     *   Users with significantly fewer messages (< 20% of avg)
     *   get ghost points proportional to how many sessions they missed.
     *   This catches people like Pranav who never participate.
     */
    function calcLeftOnRead(messages) {
        const senders = [...new Set(messages.map(m => m.sender))];
        const ghostData = {};
        senders.forEach(s => ghostData[s] = { ghosted: 0, sessionsActive: 0, totalMessages: 0 });

        // Count total messages per user
        for (const msg of messages) {
            if (ghostData[msg.sender]) {
                ghostData[msg.sender].totalMessages++;
            }
        }

        // PASS 1: Session-based ghosting
        let sessionStart = 0;
        let totalSessions = 0;

        for (let i = 0; i < messages.length - 1; i++) {
            const current = messages[i];
            const next = messages[i + 1];

            if (!current.timestamp || !next.timestamp) continue;

            const gapHours = (next.timestamp - current.timestamp) / (1000 * 60 * 60);

            if (gapHours >= 6) {
                totalSessions++;

                // Find who was active in this session (last 60 min before gap)
                const activeInSession = new Set();
                for (let j = i; j >= sessionStart; j--) {
                    if (!messages[j].timestamp) continue;
                    const fromEnd = (current.timestamp - messages[j].timestamp) / (1000 * 60);
                    if (fromEnd > 60) break;
                    activeInSession.add(messages[j].sender);
                }

                // Mark session participation
                activeInSession.forEach(s => {
                    if (ghostData[s]) ghostData[s].sessionsActive++;
                });

                // Ghost penalty for recently active people who aren't the last sender
                const lastSender = current.sender;
                const recentActive = new Set();
                for (let j = i; j >= sessionStart; j--) {
                    if (!messages[j].timestamp) continue;
                    const fromEnd = (current.timestamp - messages[j].timestamp) / (1000 * 60);
                    if (fromEnd > 15) break;
                    recentActive.add(messages[j].sender);
                }

                recentActive.forEach(s => {
                    if (s !== lastSender && ghostData[s]) {
                        ghostData[s].ghosted++;
                    }
                });

                sessionStart = i + 1;
            }
        }

        // PASS 2: @mention ghosts
        for (let i = 0; i < messages.length; i++) {
            const msg = messages[i];
            const content = msg.content;

            const mentionRegex = /@[\u2068]?([^\u2069\s@]+)[\u2069]?/g;
            let match;
            while ((match = mentionRegex.exec(content)) !== null) {
                const mentioned = match[1].trim();
                if (!mentioned || mentioned.length < 2) continue;

                let replied = false;
                for (let j = i + 1; j < Math.min(i + 15, messages.length); j++) {
                    if (!messages[j].timestamp) continue;
                    const gap = (messages[j].timestamp - msg.timestamp) / (1000 * 60 * 60);
                    if (gap > 3) break;

                    const senderLower = messages[j].sender.toLowerCase();
                    const mentionLower = mentioned.toLowerCase();
                    if (senderLower.includes(mentionLower) || mentionLower.includes(senderLower)) {
                        replied = true;
                        break;
                    }
                }

                if (!replied) {
                    const matchedSender = senders.find(s => {
                        const sLower = s.toLowerCase();
                        const mLower = mentioned.toLowerCase();
                        return sLower.includes(mLower) || mLower.includes(sLower);
                    });

                    if (matchedSender && ghostData[matchedSender]) {
                        ghostData[matchedSender].ghosted += 2;
                    }
                }
            }
        }

        // PASS 3: Lurker detection
        // Calculate average messages per person
        const messageCounts = senders.map(s => ghostData[s].totalMessages);
        const avgMessages = messageCounts.reduce((a, b) => a + b, 0) / senders.length;

        if (totalSessions > 0 && avgMessages > 0) {
            for (const sender of senders) {
                const data = ghostData[sender];
                const messageRatio = data.totalMessages / avgMessages;

                // If this person sends significantly fewer messages than average,
                // they're a lurker. The fewer they send, the more ghost points.
                if (messageRatio < 0.3) {
                    // Heavy lurker — missed most sessions
                    const missedSessions = totalSessions - data.sessionsActive;
                    // Scale penalty: lurkers get proportional ghost points
                    // Boosted to 1.5x so they definitely top the list
                    const lurkerPenalty = Math.round(missedSessions * 1.5);
                    data.ghosted += lurkerPenalty;
                    data.isLurker = true;
                } else if (messageRatio < 0.5) {
                    // Moderate lurker
                    const missedSessions = totalSessions - data.sessionsActive;
                    const lurkerPenalty = Math.round(missedSessions * 0.8);
                    data.ghosted += lurkerPenalty;
                    data.isLurker = true;
                }
            }
        }

        // Build results
        const results = [];
        for (const [sender, data] of Object.entries(ghostData)) {
            if (data.ghosted === 0) continue;
            results.push({
                name: sender,
                ghostCount: data.ghosted,
                sessionsActive: data.sessionsActive,
                totalMessages: data.totalMessages,
                isLurker: data.isLurker || false,
                roast: data.isLurker
                    ? getRandomRoast(LURKER_ROASTS)
                    : (data.ghosted >= 15 ? getRandomRoast(GHOST_ROASTS) : getRandomRoast(GHOST_ROASTS_LOW)),
            });
        }

        results.sort((a, b) => b.ghostCount - a.ghostCount);
        return results;
    }

    // ================================================
    // METRIC 4: MIDNIGHT SIMP (Temporal Distribution)
    // ================================================

    function calcMidnightSimp(messages) {
        const userData = {};

        for (const msg of messages) {
            if (!msg.timestamp) continue;

            if (!userData[msg.sender]) {
                userData[msg.sender] = { total: 0, nightCount: 0 };
            }

            userData[msg.sender].total++;

            const hour = msg.timestamp.getHours();
            if (hour >= 1 && hour < 4) {
                userData[msg.sender].nightCount++;
            }
        }

        const results = [];
        for (const [sender, data] of Object.entries(userData)) {
            if (data.total < 5) continue;
            const pct = (data.nightCount / data.total) * 100;
            results.push({
                name: sender,
                nightPercent: Math.round(pct * 10) / 10,
                nightCount: data.nightCount,
                totalMessages: data.total,
                roast: pct >= 10 ? getRandomRoast(MIDNIGHT_ROASTS) : getRandomRoast(MIDNIGHT_ROASTS_LOW),
            });
        }

        results.sort((a, b) => b.nightPercent - a.nightPercent);
        return results;
    }

    // ================================================
    // MAIN ANALYSIS
    // ================================================

    function analyze(messages) {
        const allMessages = messages;
        const textMessages = messages.filter(m =>
            !m.isMedia && !m.isDeleted && m.content.trim().length > 0
        );

        return {
            berozgar: calcResponseLatency(allMessages),
            dryTexter: calcDryTexterIndex(textMessages),
            leftOnRead: calcLeftOnRead(allMessages),
            midnightSimp: calcMidnightSimp(allMessages),
        };
    }

    return {
        analyze,
        calcResponseLatency,
        calcDryTexterIndex,
        calcLeftOnRead,
        calcMidnightSimp,
    };

})();
