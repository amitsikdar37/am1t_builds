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
    }

    function renderBerozgar(data) {
        berozgarBody.innerHTML = '';
        if (data.length === 0) {
            berozgarBody.innerHTML = '<p class="term-line info">Not enough data to calculate response latency.</p>';
            return;
        }

        // Max response time for bar scaling
        const maxMinutes = Math.max(...data.map(d => d.avgMinutes), 1);

        data.forEach((user, i) => {
            const delay = i * 0.1;
            // Invert bar: faster = longer bar (more berozgar)
            const barPercent = Math.max(5, 100 - (user.avgMinutes / maxMinutes) * 100);

            berozgarBody.innerHTML += `
                <div class="user-result" style="animation-delay: ${delay}s">
                    <div class="rank ${i > 0 ? 'secondary' : ''}">${i + 1}</div>
                    <div class="user-info">
                        <div class="user-name">→ ${user.name}</div>
                        <div class="user-stat">${formatTime(user.avgMinutes)} average response time (${user.totalResponses} replies tracked)</div>
                        <div class="stat-bar-container">
                            <div class="stat-bar">
                                <div class="stat-bar-fill" data-width="${barPercent}"></div>
                            </div>
                            <div class="stat-bar-value">${formatTime(user.avgMinutes)}</div>
                        </div>
                        ${i === 0 ? `<div class="user-roast">[STATUS: ${user.roast}]</div>` : ''}
                    </div>
                </div>
            `;
        });

        // Animate bars after render
        requestAnimationFrame(() => {
            setTimeout(() => animateBars(berozgarBody), 100);
        });
    }

    function renderDryTexter(data) {
        dryBody.innerHTML = '';
        if (data.length === 0) {
            dryBody.innerHTML = '<p class="term-line info">Not enough data to calculate dry text index.</p>';
            return;
        }

        data.forEach((user, i) => {
            const delay = i * 0.1;

            dryBody.innerHTML += `
                <div class="user-result" style="animation-delay: ${delay}s">
                    <div class="rank ${i > 0 ? 'secondary' : ''}">${i + 1}</div>
                    <div class="user-info">
                        <div class="user-name">→ ${user.name}</div>
                        <div class="user-stat">${user.dryPercent}% Dry Text Rate (${user.dryCount}/${user.totalMessages} messages)</div>
                        <div class="stat-bar-container">
                            <div class="stat-bar">
                                <div class="stat-bar-fill" data-width="${user.dryPercent}"></div>
                            </div>
                            <div class="stat-bar-value">${user.dryPercent}%</div>
                        </div>
                        ${i === 0 ? `<div class="user-roast">[STATUS: ${user.roast}]</div>` : ''}
                    </div>
                </div>
            `;
        });

        requestAnimationFrame(() => {
            setTimeout(() => animateBars(dryBody), 200);
        });
    }

    function renderGhost(data) {
        ghostBody.innerHTML = '';
        if (data.length === 0) {
            ghostBody.innerHTML = '<p class="term-line info">Not enough data to calculate ghosting patterns.</p>';
            return;
        }

        const maxGhost = Math.max(...data.map(d => d.ghostCount), 1);

        data.forEach((user, i) => {
            const delay = i * 0.1;
            const barPercent = Math.max(5, (user.ghostCount / maxGhost) * 100);

            ghostBody.innerHTML += `
                <div class="user-result" style="animation-delay: ${delay}s">
                    <div class="rank ${i > 0 ? 'secondary' : ''}">${i + 1}</div>
                    <div class="user-info">
                        <div class="user-name">→ ${user.name}</div>
                        <div class="user-stat">${user.ghostCount} Ghosted Conversations</div>
                        <div class="stat-bar-container">
                            <div class="stat-bar">
                                <div class="stat-bar-fill" data-width="${barPercent}"></div>
                            </div>
                            <div class="stat-bar-value">${user.ghostCount}</div>
                        </div>
                        ${i === 0 ? `<div class="user-roast">[STATUS: ${user.roast}]</div>` : ''}
                    </div>
                </div>
            `;
        });

        requestAnimationFrame(() => {
            setTimeout(() => animateBars(ghostBody), 300);
        });
    }

    function renderMidnight(data) {
        midnightBody.innerHTML = '';
        if (data.length === 0) {
            midnightBody.innerHTML = '<p class="term-line info">Not enough data to calculate nighttime activity.</p>';
            return;
        }

        data.forEach((user, i) => {
            const delay = i * 0.1;
            // Cap bar at 100%
            const barPercent = Math.min(100, Math.max(5, user.nightPercent * 2));

            midnightBody.innerHTML += `
                <div class="user-result" style="animation-delay: ${delay}s">
                    <div class="rank ${i > 0 ? 'secondary' : ''}">${i + 1}</div>
                    <div class="user-info">
                        <div class="user-name">→ ${user.name}</div>
                        <div class="user-stat">${user.nightPercent}% of texts sent between 1AM–4AM (${user.nightCount}/${user.totalMessages})</div>
                        <div class="stat-bar-container">
                            <div class="stat-bar">
                                <div class="stat-bar-fill" data-width="${barPercent}"></div>
                            </div>
                            <div class="stat-bar-value">${user.nightPercent}%</div>
                        </div>
                        ${i === 0 ? `<div class="user-roast">[STATUS: ${user.roast}]</div>` : ''}
                    </div>
                </div>
            `;
        });

        requestAnimationFrame(() => {
            setTimeout(() => animateBars(midnightBody), 400);
        });
    }

    function animateBars(container) {
        const fills = container.querySelectorAll('.stat-bar-fill');
        fills.forEach(fill => {
            const width = fill.getAttribute('data-width');
            fill.style.width = width + '%';
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
