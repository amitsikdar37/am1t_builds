/**
 * WhatsApp Chat Parser
 * Parses exported WhatsApp .txt chat files into structured message objects.
 * 
 * Supports formats:
 *   - "M/DD/YY, H:MM AM/PM - User: Message"
 *   - "DD/MM/YY, H:MM AM/PM - User: Message"
 *   - "M/DD/YY, H:MM am/pm - User: Message"
 *   - Multiline messages (continuation lines without timestamp)
 */

const ChatParser = (() => {

    // Regex to match WhatsApp message lines
    // Captures: date, time, ampm, sender, message
    const MESSAGE_REGEX = /^(\d{1,2}\/\d{1,2}\/\d{2,4}),\s(\d{1,2}:\d{2})\s?(AM|PM|am|pm)?\s?-\s(.+?):\s(.*)$/;

    // System messages to skip (not from actual users)
    const SYSTEM_PATTERNS = [
        'Messages and calls are end-to-end encrypted',
        'created group',
        'added you',
        'changed this group',
        'You\'re now an admin',
        'changed the group',
        'left',
        'removed',
        'joined using',
        'changed the subject',
        'changed their phone number',
        'changed this group\'s settings',
        'changed this group\'s icon',
        'changed the group name',
    ];

    // Messages to skip during analysis
    const SKIP_CONTENT = [
        '<Media omitted>',
        'This message was deleted',
        'You deleted this message',
        'null',
        '',
    ];

    /**
     * Parse a date+time string from WhatsApp format into a JS Date.
     */
    function parseDateTime(dateStr, timeStr, ampm) {
        const dateParts = dateStr.split('/');
        let month, day, year;

        // Detect format: if first part > 12, it's DD/MM/YY, else M/DD/YY
        if (parseInt(dateParts[0]) > 12) {
            day = parseInt(dateParts[0]);
            month = parseInt(dateParts[1]) - 1;
        } else {
            month = parseInt(dateParts[0]) - 1;
            day = parseInt(dateParts[1]);
        }

        year = parseInt(dateParts[2]);
        if (year < 100) year += 2000;

        const timeParts = timeStr.split(':');
        let hours = parseInt(timeParts[0]);
        const minutes = parseInt(timeParts[1]);

        if (ampm) {
            const ap = ampm.toUpperCase();
            if (ap === 'PM' && hours !== 12) hours += 12;
            if (ap === 'AM' && hours === 12) hours = 0;
        }

        return new Date(year, month, day, hours, minutes);
    }

    /**
     * Check if a line is a system/notification message.
     */
    function isSystemMessage(text) {
        return SYSTEM_PATTERNS.some(pattern =>
            text.toLowerCase().includes(pattern.toLowerCase())
        );
    }

    /**
     * Check if message content should be skipped in analysis.
     */
    function isSkippableContent(content) {
        const trimmed = content.trim();
        return SKIP_CONTENT.includes(trimmed) || trimmed.length === 0;
    }

    /**
     * Parse the entire chat text into an array of message objects.
     * 
     * Each message object:
     * {
     *   sender: string,
     *   timestamp: Date,
     *   content: string,
     *   isMedia: boolean,
     *   isDeleted: boolean
     * }
     */
    function parse(rawText) {
        const lines = rawText.split('\n');
        const messages = [];
        let currentMessage = null;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Try to match as a new message
            const match = line.match(MESSAGE_REGEX);

            if (match) {
                // Save previous message
                if (currentMessage) {
                    messages.push(currentMessage);
                }

                const [, dateStr, timeStr, ampm, sender, content] = match;
                const timestamp = parseDateTime(dateStr, timeStr, ampm);

                // Check if it's a system notification disguised as a message
                const fullLine = `${sender}: ${content}`;
                if (isSystemMessage(line) || isSystemMessage(fullLine)) {
                    currentMessage = null;
                    continue;
                }

                currentMessage = {
                    sender: sender.trim(),
                    timestamp,
                    content: content.trim(),
                    isMedia: content.trim() === '<Media omitted>',
                    isDeleted: content.trim() === 'This message was deleted' ||
                               content.trim() === 'You deleted this message',
                };
            } else if (currentMessage) {
                // Continuation line — append to current message
                currentMessage.content += '\n' + line;
            }
            // else: orphan line or system notification, skip
        }

        // Don't forget the last message
        if (currentMessage) {
            messages.push(currentMessage);
        }

        return messages;
    }

    /**
     * Get unique senders from parsed messages.
     */
    function getSenders(messages) {
        const senderSet = new Set();
        messages.forEach(msg => {
            if (!isSkippableContent(msg.content) && !msg.isMedia && !msg.isDeleted) {
                senderSet.add(msg.sender);
            }
        });
        return Array.from(senderSet);
    }

    /**
     * Filter messages to only include analyzable content.
     */
    function getAnalyzableMessages(messages) {
        return messages.filter(msg =>
            !msg.isMedia && !msg.isDeleted && !isSkippableContent(msg.content)
        );
    }

    /**
     * Get all messages (including media/deleted) for timeline analysis.
     */
    function getAllUserMessages(messages) {
        return messages.filter(msg => !isSkippableContent(msg.content) || msg.isMedia);
    }

    /**
     * Get chat metadata: date range, total messages, participants.
     */
    function getMetadata(messages) {
        if (messages.length === 0) return null;

        const validMessages = messages.filter(m => m.timestamp && !isNaN(m.timestamp));
        const senders = getSenders(messages);

        return {
            totalMessages: messages.length,
            participants: senders.length,
            senderList: senders,
            firstMessage: validMessages[0]?.timestamp,
            lastMessage: validMessages[validMessages.length - 1]?.timestamp,
            durationDays: validMessages.length > 1
                ? Math.ceil((validMessages[validMessages.length - 1].timestamp - validMessages[0].timestamp) / (1000 * 60 * 60 * 24))
                : 1,
        };
    }

    return {
        parse,
        getSenders,
        getAnalyzableMessages,
        getAllUserMessages,
        getMetadata,
        isSkippableContent,
    };

})();
