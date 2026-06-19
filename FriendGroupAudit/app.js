/**
 * Friend Group Audit — Main Application Controller
 * Handles file upload, terminal animation, analysis orchestration, and results rendering.
 */

(function () {
    'use strict';

    // ========== DOM References ==========
    const uploadScreen = document.getElementById('upload-screen');
    const loadingScreen = document.getElementById('loading-screen');
    const resultsScreen = document.getElementById('results-screen');

    const uploadZone = document.getElementById('upload-zone');
    const fileInput = document.getElementById('file-input');
    const fileInfo = document.getElementById('file-info');
    const fileName = document.getElementById('file-name');
    const fileSize = document.getElementById('file-size');
    const btnAudit = document.getElementById('btn-audit');
    const btnRestart = document.getElementById('btn-restart');

    const terminalBody = document.getElementById('terminal-body');
    const chatMeta = document.getElementById('chat-meta');

    // Metric bodies
    const berozgarBody = document.getElementById('berozgar-body');
    const dryBody = document.getElementById('dry-body');
    const ghostBody = document.getElementById('ghost-body');
    const midnightBody = document.getElementById('midnight-body');

    let rawFileContent = null;

    // ========== Particle Background ==========
    function createParticles() {
        const container = document.getElementById('particles');
        const count = 30;
        for (let i = 0; i < count; i++) {
            const p = document.createElement('div');
            p.className = 'particle';
            p.style.left = Math.random() * 100 + '%';
            p.style.animationDuration = (6 + Math.random() * 10) + 's';
            p.style.animationDelay = Math.random() * 8 + 's';
            p.style.width = (1 + Math.random() * 2) + 'px';
            p.style.height = p.style.width;
            container.appendChild(p);
        }
    }
    createParticles();

    // ========== File Upload Handling ==========
    uploadZone.addEventListener('click', () => fileInput.click());

    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('drag-over');
    });

    uploadZone.addEventListener('dragleave', () => {
        uploadZone.classList.remove('drag-over');
    });

    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    });

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleFile(file);
    });

    function handleFile(file) {
        if (!file.name.endsWith('.txt')) {
            alert('Please upload a .txt WhatsApp chat export file.');
            return;
        }

        fileName.textContent = file.name;
        fileSize.textContent = formatBytes(file.size);
        fileInfo.style.display = 'flex';
        uploadZone.classList.add('has-file');
        btnAudit.disabled = false;

        const reader = new FileReader();
        reader.onload = (event) => {
            rawFileContent = event.target.result;
        };
        reader.readAsText(file, 'UTF-8');
    }

    function formatBytes(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    // ========== Screen Transitions ==========
    function showScreen(screen) {
        [uploadScreen, loadingScreen, resultsScreen].forEach(s => s.classList.remove('active'));
        screen.classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // ========== Terminal Animation ==========
    function addTermLine(text, className = '', delay = 0) {
        return new Promise(resolve => {
            setTimeout(() => {
                const line = document.createElement('div');
                line.className = `term-line ${className}`;
                line.innerHTML = text;
                terminalBody.appendChild(line);
                terminalBody.scrollTop = terminalBody.scrollHeight;
                resolve();
            }, delay);
        });
    }

    async function runTerminalAnimation(messages, metadata, results) {
        terminalBody.innerHTML = '';

        const steps = [
            { text: 'Initializing Friend Group Audit Engine...', cls: 'prompt', delay: 0 },
            { text: `Loading chat file... [${metadata.totalMessages.toLocaleString()} raw lines detected]`, cls: 'info', delay: 400 },
            { text: `Identified ${metadata.participants} participants: ${metadata.senderList.join(', ')}`, cls: 'highlight', delay: 600 },
            { text: `Chat duration: ${metadata.durationDays} days`, cls: 'info', delay: 300 },
            { text: '', cls: '', delay: 200 },
            { text: '───────────────────────────────────────', cls: 'info', delay: 100 },
            { text: '[MODULE 1] Scanning response latency patterns...', cls: 'prompt', delay: 500 },
            { text: `   Calculating time-deltas across ${messages.length.toLocaleString()} messages...`, cls: 'info', delay: 400 },
            { text: `   ✓ BEROZGAR candidates identified: ${results.berozgar.length}`, cls: 'success', delay: 500 },
            { text: '', cls: '', delay: 100 },
            { text: '[MODULE 2] Analyzing lexical diversity...', cls: 'prompt', delay: 400 },
            { text: '   Running dry-text regex pattern matching...', cls: 'info', delay: 400 },
            { text: `   ✓ Dry texter profiles built: ${results.dryTexter.length}`, cls: 'success', delay: 500 },
            { text: '', cls: '', delay: 100 },
            { text: '[MODULE 3] Detecting interaction dropouts...', cls: 'prompt', delay: 400 },
            { text: '   Tracking conversation thread terminations (6hr threshold)...', cls: 'info', delay: 500 },
            { text: '   Cross-referencing @mentions with follow-up replies...', cls: 'info', delay: 400 },
            { text: `   ✓ Ghost profiles compiled: ${results.leftOnRead.length}`, cls: 'success', delay: 500 },
            { text: '', cls: '', delay: 100 },
            { text: '[MODULE 4] Mapping temporal distribution...', cls: 'prompt', delay: 400 },
            { text: '   Extracting timestamps between 01:00–04:00 AM...', cls: 'info', delay: 400 },
            { text: `   ✓ Night owls detected: ${results.midnightSimp.filter(r => r.nightPercent > 0).length}`, cls: 'success', delay: 500 },
            { text: '', cls: '', delay: 200 },
            { text: '───────────────────────────────────────', cls: 'info', delay: 100 },
            { text: '', cls: '', delay: 200 },
        ];

        // Build the top-result lines
        if (results.berozgar.length > 0) {
            const top = results.berozgar[0];
            steps.push({ text: `⚡ BEROZGAR AWARD → ${top.name} (${formatTime(top.avgMinutes)} avg response)`, cls: 'result', delay: 300 });
        }
        if (results.dryTexter.length > 0) {
            const top = results.dryTexter[0];
            steps.push({ text: `🏜️ DRY TEXTER → ${top.name} (${top.dryPercent}% dry rate)`, cls: 'result', delay: 300 });
        }
        if (results.leftOnRead.length > 0) {
            const top = results.leftOnRead[0];
            steps.push({ text: `👻 LEFT ON READ → ${top.name} (${top.ghostCount} ghosted conversations)`, cls: 'result', delay: 300 });
        }
        if (results.midnightSimp.length > 0) {
            const top = results.midnightSimp[0];
            steps.push({ text: `🌙 MIDNIGHT SIMP → ${top.name} (${top.nightPercent}% after midnight)`, cls: 'result', delay: 300 });
        }

        steps.push({ text: '', cls: '', delay: 300 });
        steps.push({ text: 'AUDIT COMPLETE. GENERATING DAMAGE REPORT... ■', cls: 'warning', delay: 500 });

        for (const step of steps) {
            await addTermLine(step.text, step.cls, step.delay);
        }

        // Wait before transitioning
        await new Promise(r => setTimeout(r, 1200));
    }

    // ========== Format Helpers ==========
    function formatTime(minutes) {
        if (minutes < 1) {
            return Math.round(minutes * 60) + 's';
        }
        if (minutes < 60) {
            return minutes.toFixed(1) + ' min';
        }
        return (minutes / 60).toFixed(1) + ' hr';
    }

    function formatDate(date) {
        if (!date) return 'N/A';
        return date.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    }

    // ========== Render Results ==========
    function renderResults(metadata, results) {
        // Chat metadata
        chatMeta.innerHTML = `
            <span>📊 ${metadata.totalMessages.toLocaleString()} messages</span>
            <span>👥 ${metadata.participants} participants</span>
            <span>📅 ${formatDate(metadata.firstMessage)} → ${formatDate(metadata.lastMessage)}</span>
            <span>⏱️ ${metadata.durationDays} days</span>
        `;

        // Render each metric
        renderBerozgar(results.berozgar);
        renderDryTexter(results.dryTexter);
        renderGhost(results.leftOnRead);
        renderMidnight(results.midnightSimp);

        // Animate all bars after a short delay
        requestAnimationFrame(() => {
            setTimeout(() => animateAllBars(), 200);
        });
    }

    /**
     * Renders a metric card with a prominent winner section and compact runner rows.
     * @param {HTMLElement} container - The metric body element
     * @param {Array} data - Sorted array of user results
     * @param {Function} getWinnerHtml - Returns HTML for the winner section
     * @param {Function} getRunnerHtml - Returns HTML for each runner row
     */
    function renderMetricCard(container, data, getWinnerHtml, getRunnerHtml) {
        container.innerHTML = '';
        if (data.length === 0) {
            container.innerHTML = '<div class="metric-empty">Not enough data to calculate this metric.</div>';
            return;
        }

        // Winner section
        const winner = data[0];
        container.innerHTML += `<div class="winner-section">${getWinnerHtml(winner)}</div>`;

        // Runner-up section
        if (data.length > 1) {
            let runnersHtml = '<div class="runners-section">';
            runnersHtml += '<div class="runners-section-label">Full Rankings</div>';
            data.slice(1).forEach((user, i) => {
                runnersHtml += getRunnerHtml(user, i + 2);
            });
            runnersHtml += '</div>';
            container.innerHTML += runnersHtml;
        }
    }

    function renderBerozgar(data) {
        renderMetricCard(berozgarBody, data,
            // Winner HTML
            (winner) => {
                const median = winner.medianMinutes ?? winner.avgMinutes;
                const barPercent = Math.min(95, Math.max(10, 100 - median * 10));
                return `
                    <div class="winner-row">
                        <div class="winner-badge">🏆</div>
                        <div class="winner-info">
                            <div class="winner-label">Fastest Replier</div>
                            <div class="winner-name">→ ${winner.name}</div>
                            <div class="winner-stat-value">${formatTime(median)} median · ${formatTime(winner.avgMinutes)} avg · ${winner.totalResponses} replies</div>
                        </div>
                        <div class="winner-big-stat">
                            <div class="big-number">${formatTime(median)}</div>
                            <div class="big-number-label">median reply</div>
                        </div>
                    </div>
                    <div class="winner-bar-container">
                        <div class="winner-bar">
                            <div class="winner-bar-fill" data-width="${barPercent}"></div>
                        </div>
                    </div>
                    <div class="winner-roast">[STATUS: ${winner.roast}]</div>
                `;
            },
            // Runner HTML
            (user, rank) => {
                const median = user.medianMinutes ?? user.avgMinutes;
                const maxTime = data[data.length - 1].avgMinutes || 1;
                const barPercent = Math.max(8, 100 - (user.avgMinutes / maxTime) * 100);
                return `
                    <div class="runner-row" style="animation-delay: ${(rank - 1) * 0.08}s">
                        <div class="runner-rank">${rank}</div>
                        <div class="runner-info">
                            <div class="runner-name">→ ${user.name}</div>
                            <div class="runner-stat">${formatTime(median)} median · ${user.totalResponses} replies</div>
                            <div class="runner-roast">${user.roast}</div>
                        </div>
                        <div class="runner-bar-container">
                            <div class="runner-bar">
                                <div class="runner-bar-fill" data-width="${barPercent}"></div>
                            </div>
                            <div class="runner-value">${formatTime(user.avgMinutes)}</div>
                        </div>
                    </div>
                `;
            }
        );
    }

    function renderDryTexter(data) {
        renderMetricCard(dryBody, data,
            (winner) => `
                <div class="winner-row">
                    <div class="winner-badge">🏜️</div>
                    <div class="winner-info">
                        <div class="winner-label">Driest Texter</div>
                        <div class="winner-name">→ ${winner.name}</div>
                        <div class="winner-stat-value">${winner.dryCount} dry texts out of ${winner.totalMessages} total messages</div>
                    </div>
                    <div class="winner-big-stat">
                        <div class="big-number">${winner.dryPercent}%</div>
                        <div class="big-number-label">dry rate</div>
                    </div>
                </div>
                <div class="winner-bar-container">
                    <div class="winner-bar">
                        <div class="winner-bar-fill" data-width="${winner.dryPercent}"></div>
                    </div>
                </div>
                <div class="winner-roast">[STATUS: ${winner.roast}]</div>
            `,
            (user, rank) => `
                <div class="runner-row" style="animation-delay: ${(rank - 1) * 0.08}s">
                    <div class="runner-rank">${rank}</div>
                    <div class="runner-info">
                        <div class="runner-name">→ ${user.name}</div>
                        <div class="runner-stat">${user.dryCount}/${user.totalMessages} messages dry</div>
                        <div class="runner-roast">${user.roast}</div>
                    </div>
                    <div class="runner-bar-container">
                        <div class="runner-bar">
                            <div class="runner-bar-fill" data-width="${user.dryPercent}"></div>
                        </div>
                        <div class="runner-value">${user.dryPercent}%</div>
                    </div>
                </div>
            `
        );
    }

    function renderGhost(data) {
        const maxGhost = data.length > 0 ? Math.max(...data.map(d => d.ghostCount), 1) : 1;

        renderMetricCard(ghostBody, data,
            (winner) => `
                <div class="winner-row">
                    <div class="winner-badge">${winner.isLurker ? '🫥' : '👻'}</div>
                    <div class="winner-info">
                        <div class="winner-label">${winner.isLurker ? 'Certified Lurker' : 'Top Ghoster'}</div>
                        <div class="winner-name">→ ${winner.name}</div>
                        <div class="winner-stat-value">${winner.ghostCount} conversations ghosted${winner.totalMessages ? ' · ' + winner.totalMessages + ' total msgs sent' : ''}</div>
                    </div>
                    <div class="winner-big-stat">
                        <div class="big-number">${winner.ghostCount}</div>
                        <div class="big-number-label">ghosted</div>
                    </div>
                </div>
                <div class="winner-bar-container">
                    <div class="winner-bar">
                        <div class="winner-bar-fill" data-width="95"></div>
                    </div>
                </div>
                <div class="winner-roast">[STATUS: ${winner.roast}]</div>
            `,
            (user, rank) => {
                const barPercent = Math.max(8, (user.ghostCount / maxGhost) * 100);
                return `
                    <div class="runner-row" style="animation-delay: ${(rank - 1) * 0.08}s">
                        <div class="runner-rank">${rank}</div>
                        <div class="runner-info">
                            <div class="runner-name">→ ${user.name}${user.isLurker ? ' 🫥' : ''}</div>
                            <div class="runner-stat">${user.ghostCount} ghosted${user.totalMessages ? ' · ' + user.totalMessages + ' msgs sent' : ''}</div>
                            <div class="runner-roast">${user.roast}</div>
                        </div>
                        <div class="runner-bar-container">
                            <div class="runner-bar">
                                <div class="runner-bar-fill" data-width="${barPercent}"></div>
                            </div>
                            <div class="runner-value">${user.ghostCount}</div>
                        </div>
                    </div>
                `;
            }
        );
    }

    function renderMidnight(data) {
        renderMetricCard(midnightBody, data,
            (winner) => `
                <div class="winner-row">
                    <div class="winner-badge">🌙</div>
                    <div class="winner-info">
                        <div class="winner-label">Night Owl</div>
                        <div class="winner-name">→ ${winner.name}</div>
                        <div class="winner-stat-value">${winner.nightCount} texts between 1AM–4AM out of ${winner.totalMessages} total</div>
                    </div>
                    <div class="winner-big-stat">
                        <div class="big-number">${winner.nightPercent}%</div>
                        <div class="big-number-label">after midnight</div>
                    </div>
                </div>
                <div class="winner-bar-container">
                    <div class="winner-bar">
                        <div class="winner-bar-fill" data-width="${Math.min(95, Math.max(10, winner.nightPercent * 2))}"></div>
                    </div>
                </div>
                <div class="winner-roast">[STATUS: ${winner.roast}]</div>
            `,
            (user, rank) => `
                <div class="runner-row" style="animation-delay: ${(rank - 1) * 0.08}s">
                    <div class="runner-rank">${rank}</div>
                    <div class="runner-info">
                        <div class="runner-name">→ ${user.name}</div>
                        <div class="runner-stat">${user.nightCount}/${user.totalMessages} texts after midnight</div>
                        <div class="runner-roast">${user.roast}</div>
                    </div>
                    <div class="runner-bar-container">
                        <div class="runner-bar">
                            <div class="runner-bar-fill" data-width="${Math.min(95, Math.max(8, user.nightPercent * 2))}"></div>
                        </div>
                        <div class="runner-value">${user.nightPercent}%</div>
                    </div>
                </div>
            `
        );
    }

    function animateAllBars() {
        document.querySelectorAll('.winner-bar-fill, .runner-bar-fill').forEach(fill => {
            const width = fill.getAttribute('data-width');
            if (width) fill.style.width = width + '%';
        });
    }

    // ========== Main Audit Flow ==========
    btnAudit.addEventListener('click', async () => {
        if (!rawFileContent) return;

        // Transition to loading screen
        showScreen(loadingScreen);

        // Small delay for screen transition
        await new Promise(r => setTimeout(r, 300));

        // Parse
        const messages = ChatParser.parse(rawFileContent);
        const metadata = ChatParser.getMetadata(messages);

        if (!metadata || metadata.totalMessages < 10) {
            terminalBody.innerHTML = '<div class="term-line error">ERROR: Not enough messages to analyze. Need at least 10 messages.</div>';
            await new Promise(r => setTimeout(r, 2000));
            showScreen(uploadScreen);
            return;
        }

        // Analyze
        const results = ChatAnalyzer.analyze(messages);

        // Run terminal animation
        await runTerminalAnimation(messages, metadata, results);

        // Show results
        showScreen(resultsScreen);
        renderResults(metadata, results);
    });

    // ========== Restart ==========
    btnRestart.addEventListener('click', () => {
        rawFileContent = null;
        fileInput.value = '';
        fileInfo.style.display = 'none';
        uploadZone.classList.remove('has-file');
        btnAudit.disabled = true;
        terminalBody.innerHTML = '';
        showScreen(uploadScreen);
    });

})();
