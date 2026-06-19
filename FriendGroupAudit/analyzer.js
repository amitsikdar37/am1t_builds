/**
 * Chat Analyzer
 * Computes the four embarrassing metrics from parsed WhatsApp messages.
 * 
 * Metrics:
 * 1. Berozgar Award (Response Latency)
 * 2. Dry Texter Index (Lexical Diversity)
 * 3. Left on Read Champion (Interaction Dropout)
 * 4. Midnight Simp (Temporal Distribution)
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
    // ================================================

    /**
     * For each user, calculate average response time in minutes.
     * A "response" is defined as: someone else sends a message,
     * and this user sends the next message within 30 minutes.
     */
    function calcResponseLatency(messages) {
        const responseTimes = {}; // { sender: [timeDeltaMs, ...] }

        for (let i = 1; i < messages.length; i++) {
            const prev = messages[i - 1];
            const curr = messages[i];

            // Skip if same sender
            if (curr.sender === prev.sender) continue;

            // Both must have valid timestamps
            if (!prev.timestamp || !curr.timestamp) continue;

            const deltaMs = curr.timestamp - prev.timestamp;
            const deltaMinutes = deltaMs / (1000 * 60);

            // Only count responses within 30 minutes as "quick replies"
            if (deltaMinutes >= 0 && deltaMinutes <= 30) {
                if (!responseTimes[curr.sender]) responseTimes[curr.sender] = [];
                responseTimes[curr.sender].push(deltaMinutes);
            }
        }

        // Calculate averages
        const results = [];
        for (const [sender, times] of Object.entries(responseTimes)) {
            if (times.length < 3) continue; // Need minimum data
            const avg = times.reduce((a, b) => a + b, 0) / times.length;
            results.push({
                name: sender,
                avgMinutes: avg,
                totalResponses: times.length,
                roast: avg < 2 ? getRandomRoast(BEROZGAR_ROASTS) : getRandomRoast(BEROZGAR_ROASTS_LOW),
            });
        }

        // Sort by fastest (lowest avg = most berozgar)
        results.sort((a, b) => a.avgMinutes - b.avgMinutes);
        return results;
    }

    // ================================================
    // METRIC 2: DRY TEXTER INDEX (Lexical Diversity)
    // ================================================

    /**
     * Calculate the percentage of messages that are "dry" —
     * single-word or matching common filler patterns.
     */
    function calcDryTexterIndex(messages) {
        const DRY_REGEX = /^(ok|okay|okk+|okkk*|k+|hmm+|hm+|haan+|ha+|haha+|hehe+|lol|lmao|nice|achha|accha|ohh*|oo+|ooo*|ye|yep|yea|yeah|yes|no|nhi|ni|na|thik|theek|chal|chlo|wo|oo|ji|ohk|okayy*|seen|bruh|true|sahi|👍|🤣|😂|😭|👀|💀|🫡|😏|\.+|\?+|!+)$/i;

        const userMessages = {};

        for (const msg of messages) {
            if (msg.isMedia || msg.isDeleted) continue;
            const content = msg.content.trim();
            if (content.length === 0) continue;

            if (!userMessages[msg.sender]) {
                userMessages[msg.sender] = { total: 0, dry: 0 };
            }

            userMessages[msg.sender].total++;

            // Check if entire message is a single dry word/emoji
            if (DRY_REGEX.test(content)) {
                userMessages[msg.sender].dry++;
            }
        }

        const results = [];
        for (const [sender, data] of Object.entries(userMessages)) {
            if (data.total < 5) continue; // Need minimum data
            const pct = (data.dry / data.total) * 100;
            results.push({
                name: sender,
                dryPercent: Math.round(pct),
                dryCount: data.dry,
                totalMessages: data.total,
                roast: pct >= 40 ? getRandomRoast(DRY_ROASTS) : getRandomRoast(DRY_ROASTS_LOW),
            });
        }

        // Sort by highest dry percentage
        results.sort((a, b) => b.dryPercent - a.dryPercent);
        return results;
    }

    // ================================================
    // METRIC 3: LEFT ON READ CHAMPION (Interaction Dropout)
    // ================================================

    /**
     * Count the number of times a user "ghosts" a conversation:
     * - Someone sends a message
     * - This user was the last one addressed (or a general group message)
     * - No reply from this user for 6+ hours
     * - We track per-user how many conversations died on their watch
     */
    function calcLeftOnRead(messages) {
        const ghostCounts = {}; // { sender: count }
        const senders = [...new Set(messages.map(m => m.sender))];

        // Initialize
        senders.forEach(s => ghostCounts[s] = 0);

        // For each message, check if the conversation dies after it
        for (let i = 0; i < messages.length - 1; i++) {
            const current = messages[i];
            const next = messages[i + 1];

            if (!current.timestamp || !next.timestamp) continue;

            const gapHours = (next.timestamp - current.timestamp) / (1000 * 60 * 60);

            // If there's a 6+ hour gap after this message
            if (gapHours >= 6) {
                // Everyone who DIDN'T reply after this message gets a ghost point
                // But primarily the people who were "expected" to reply
                // Simple heuristic: everyone except the sender of the current message
                senders.forEach(s => {
                    if (s !== current.sender) {
                        ghostCounts[s]++;
                    }
                });
            }
        }

        // Also check if someone was directly mentioned/tagged but didn't reply
        for (let i = 0; i < messages.length; i++) {
            const msg = messages[i];
            const content = msg.content;

            // Check for @mentions
            const mentionRegex = /@\u2068?([^⁩\s]+)\u2069?/g;
            let match;
            while ((match = mentionRegex.exec(content)) !== null) {
                const mentioned = match[1];
                // Find if mentioned person replied within the next 10 messages or 2 hours
                let replied = false;
                for (let j = i + 1; j < Math.min(i + 15, messages.length); j++) {
                    if (!messages[j].timestamp) continue;
                    const gap = (messages[j].timestamp - msg.timestamp) / (1000 * 60 * 60);
                    if (gap > 2) break;
                    if (messages[j].sender.toLowerCase().includes(mentioned.toLowerCase())) {
                        replied = true;
                        break;
                    }
                }
                if (!replied) {
                    // Find the actual sender name that matches the mention
                    const matchedSender = senders.find(s =>
                        s.toLowerCase().includes(mentioned.toLowerCase())
                    );
                    if (matchedSender && ghostCounts[matchedSender] !== undefined) {
                        ghostCounts[matchedSender] += 2; // Extra penalty for ignoring a tag
                    }
                }
            }
        }

        const results = [];
        for (const [sender, count] of Object.entries(ghostCounts)) {
            if (count === 0) continue;
            results.push({
                name: sender,
                ghostCount: count,
                roast: count >= 15 ? getRandomRoast(GHOST_ROASTS) : getRandomRoast(GHOST_ROASTS_LOW),
            });
        }

        // Sort by most ghosts
        results.sort((a, b) => b.ghostCount - a.ghostCount);
        return results;
    }

    // ================================================
    // METRIC 4: MIDNIGHT SIMP (Temporal Distribution)
    // ================================================

    /**
     * Calculate the percentage of a user's messages sent between
     * 1:00 AM and 4:00 AM.
     */
    function calcMidnightSimp(messages) {
        const userData = {};

        for (const msg of messages) {
            if (!msg.timestamp) continue;

            if (!userData[msg.sender]) {
                userData[msg.sender] = { total: 0, nightCount: 0 };
            }

            userData[msg.sender].total++;

            const hour = msg.timestamp.getHours();
            // Between 1:00 AM (inclusive) and 4:00 AM (exclusive)
            if (hour >= 1 && hour < 4) {
                userData[msg.sender].nightCount++;
            }
        }

        const results = [];
        for (const [sender, data] of Object.entries(userData)) {
            if (data.total < 5) continue; // Need minimum data
            const pct = (data.nightCount / data.total) * 100;
            results.push({
                name: sender,
                nightPercent: Math.round(pct),
                nightCount: data.nightCount,
                totalMessages: data.total,
                roast: pct >= 10 ? getRandomRoast(MIDNIGHT_ROASTS) : getRandomRoast(MIDNIGHT_ROASTS_LOW),
            });
        }

        // Sort by highest midnight percentage
        results.sort((a, b) => b.nightPercent - a.nightPercent);
        return results;
    }

    // ================================================
    // MAIN ANALYSIS
    // ================================================

    /**
     * Run all four metrics and return a structured results object.
     */
    function analyze(messages) {
        const allMessages = messages; // includes media, deleted for timeline
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
