document.addEventListener('DOMContentLoaded', () => {
    // === STATE ===
    const state = {
        participants: [], // { id, name, pts, w, d, l }
        leagueMatches: [], // { id, round, homeId, awayId, homeScore, awayScore }
        knockoutRounds: [] // Array of arrays (rounds) of matches
    };

    let editingId = null;

    // === DOM ELEMENTS ===
    // Navigation
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    // Participants
    const participantNameInput = document.getElementById('participantName');
    const addBtn = document.getElementById('addBtn');
    const participantsTableBody = document.querySelector('#participantsTable tbody');
    const participantCountBadge = document.getElementById('participantCount');

    // League
    const leagueRoundsInput = document.getElementById('leagueRoundsInput');
    const generateLeagueBtn = document.getElementById('generateLeagueBtn');
    const leagueRoundsContainer = document.getElementById('leagueRoundsContainer');

    // Knockout
    const generateKnockoutBtn = document.getElementById('generateKnockoutBtn');
    const bracketContainer = document.getElementById('bracketContainer');

    // Common
    const saveBtn = document.getElementById('saveBtn');
    const loadInput = document.getElementById('loadInput');
    const editModal = document.getElementById('editModal');
    const editNameInput = document.getElementById('editName');
    const saveEditBtn = document.getElementById('saveEditBtn');
    const cancelEditBtn = document.getElementById('cancelEditBtn');

    // === UTILS ===
    const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

    // === NAVIGATION LOGIC ===
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            // Add active class
            btn.classList.add('active');
            const tabId = btn.getAttribute('data-tab');
            document.getElementById(`section-${tabId}`).classList.add('active');

            // Refresh views if needed
            if (tabId === 'participants') renderParticipantsTable();
        });
    });

    // === PARTICIPANT LOGIC ===
    const addParticipant = () => {
        const name = participantNameInput.value.trim();
        if (!name) return;

        state.participants.push({
            id: generateId(),
            name: name,
            pts: 0, w: 0, d: 0, l: 0
        });

        participantNameInput.value = '';
        renderParticipantsTable();
    };

    const deleteParticipant = (id) => {
        if (!confirm('Remove team? This will reset the tournament.')) return;
        state.participants = state.participants.filter(p => p.id !== id);
        resetLeague();
        renderParticipantsTable();
        saveToLocal();
    };

    const openEditModal = (id) => {
        const p = state.participants.find(p => p.id === id);
        if (!p) return;
        editingId = id;
        editNameInput.value = p.name;
        editModal.classList.add('active');
    };

    const closeEditModal = () => {
        editModal.classList.remove('active');
        editingId = null;
    };

    const saveEdit = () => {
        if (!editingId) return;
        const newName = editNameInput.value.trim();
        if (newName) {
            const p = state.participants.find(p => p.id === editingId);
            if (p) p.name = newName;
            renderParticipantsTable();
            renderLeague(); // Refresh names if league is active
            renderBracket(); // Refresh names if bracket is active
        }
        closeEditModal();
    };

    const renderParticipantsTable = () => {
        // Sort by Points, then Wins
        const sorted = [...state.participants].sort((a, b) => b.pts - a.pts || b.w - a.w);

        participantsTableBody.innerHTML = '';
        participantCountBadge.textContent = `${state.participants.length} Teams`;

        if (state.participants.length === 0) {
            participantsTableBody.innerHTML = `<tr class="empty-state"><td colspan="7" style="text-align:center; padding:2rem;">No participants yet.</td></tr>`;
            return;
        }

        sorted.forEach((p, index) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="rank-cell rank-${index + 1}">#${index + 1}</td>
                <td>${p.name}</td>
                <td class="text-right"><strong>${p.pts}</strong></td>
                <td class="text-right">${p.w}</td>
                <td class="text-right">${p.d}</td>
                <td class="text-right">${p.l}</td>
                <td class="text-right">
                    <button class="edit-btn btn btn-sm btn-secondary" onclick="window.editPart('${p.id}')">✏️</button>
                    <button class="delete-btn btn btn-sm btn-secondary" onclick="window.deletePart('${p.id}')">🗑️</button>
                </td>
            `;
            participantsTableBody.appendChild(tr);
        });
    };

    // Expose helpers for inline onclick
    window.editPart = openEditModal;
    window.deletePart = deleteParticipant;


    // === LEAGUE LOGIC ===
    const resetLeague = () => {
        state.leagueMatches = [];
        state.knockoutRounds = [];
        state.participants.forEach(p => { p.pts = 0; p.w = 0; p.d = 0; p.l = 0; });
        renderLeague();
        renderBracket();
    };

    const generateLeague = () => {
        if (state.participants.length < 2) {
            alert('Need at least 2 teams.');
            return;
        }

        resetLeague();

        let teams = [...state.participants];
        // If odd number of teams, add a dummy team for "Bye"
        const hasDummy = teams.length % 2 !== 0;
        if (hasDummy) {
            teams.push({ id: 'dummy', name: 'Bye' });
        }

        const totalRounds = teams.length - 1;
        const roundsInput = parseInt(leagueRoundsInput.value) || 1;
        const roundsToPlay = Math.min(roundsInput, totalRounds * 2); // Limit realistic rounds

        // Round Robin "Circle Method"
        // Fixed position: teams[0]
        // Rotate: teams[1]...teams[N-1]

        for (let r = 0; r < roundsToPlay; r++) {
            const roundNum = r + 1;
            const roundMatches = [];

            // For rounds > totalRounds, we repeat (Double Round Robin style), usually checking home/away swap
            // But for simplicity of "N phases", we just generate the pairings. 
            // Ideally, we'd swap home/away in the second half of the season.

            const isSecondHalf = r >= totalRounds;

            for (let i = 0; i < teams.length / 2; i++) {
                const home = teams[i];
                const away = teams[teams.length - 1 - i];

                // Skip dummy matches (Byes)
                if (home.id === 'dummy' || away.id === 'dummy') continue;

                roundMatches.push({
                    id: generateId(),
                    round: roundNum,
                    homeId: isSecondHalf ? away.id : home.id,
                    awayId: isSecondHalf ? home.id : away.id,
                    homeScore: null,
                    awayScore: null
                });
            }

            state.leagueMatches.push(...roundMatches);

            // Rotate teams (keep index 0 fixed)
            const first = teams[0];
            const rest = teams.slice(1);
            const last = rest.pop();
            rest.unshift(last);
            teams = [first, ...rest];
        }

        renderLeague();
        saveToLocal();
    };

    const updateScore = (matchId, type, value) => {
        const match = state.leagueMatches.find(m => m.id === matchId);
        if (!match) return;

        if (type === 'home') match.homeScore = value === '' ? null : parseInt(value);
        if (type === 'away') match.awayScore = value === '' ? null : parseInt(value);

        recalculateStandings();
        saveToLocal();
    };

    const recalculateStandings = () => {
        // Reset stats
        state.participants.forEach(p => { p.pts = 0; p.w = 0; p.d = 0; p.l = 0; });

        // Apply scores
        state.leagueMatches.forEach(m => {
            if (m.homeScore !== null && m.awayScore !== null) {
                const home = state.participants.find(p => p.id === m.homeId);
                const away = state.participants.find(p => p.id === m.awayId);

                if (m.homeScore > m.awayScore) {
                    if (home) { home.pts += 3; home.w++; }
                    if (away) { away.l++; }
                } else if (m.homeScore < m.awayScore) {
                    if (away) { away.pts += 3; away.w++; }
                    if (home) { home.l++; }
                } else {
                    if (home) { home.pts += 1; home.d++; }
                    if (away) { away.pts += 1; away.d++; }
                }
            }
        });

        // Update UI
        renderParticipantsTable(); // Updates the table in the first tab
    };

    const renderLeague = () => {
        leagueRoundsContainer.innerHTML = '';
        if (state.leagueMatches.length === 0) {
            leagueRoundsContainer.innerHTML = '<p style="text-align:center;color:var(--text-secondary)">No active league. Click "Start League" to generate fixtures.</p>';
            return;
        }

        // Group by Round
        const rounds = {};
        state.leagueMatches.forEach(m => {
            if (!rounds[m.round]) rounds[m.round] = [];
            rounds[m.round].push(m);
        });

        Object.keys(rounds).forEach(rNum => {
            const roundDiv = document.createElement('div');
            roundDiv.className = 'round-container';

            const matchesHtml = rounds[rNum].map(m => {
                const home = state.participants.find(p => p.id === m.homeId) || { name: '?' };
                const away = state.participants.find(p => p.id === m.awayId) || { name: '?' };
                return `
                    <div class="match-card">
                        <div class="match-teams">
                            <span>${home.name}</span>
                            <span class="vs-divider">VS</span>
                            <span>${away.name}</span>
                        </div>
                        <div class="match-inputs">
                            <input type="number" class="score-input" value="${m.homeScore !== null ? m.homeScore : ''}" 
                                onchange="window.onScoreChange('${m.id}', 'home', this.value)">
                            <span>-</span>
                            <input type="number" class="score-input" value="${m.awayScore !== null ? m.awayScore : ''}" 
                                onchange="window.onScoreChange('${m.id}', 'away', this.value)">
                        </div>
                    </div>
                `;
            }).join('');

            roundDiv.innerHTML = `
                <div class="round-header"><span class="round-title">Round ${rNum}</span></div>
                <div class="matches-grid">
                    ${matchesHtml}
                </div>
            `;
            leagueRoundsContainer.appendChild(roundDiv);
        });
    };

    window.onScoreChange = updateScore;


    // === KNOCKOUT LOGIC ===
    const generateKnockout = () => {
        // 1. Get Sorted Teams
        const sorted = [...state.participants].sort((a, b) => b.pts - a.pts || b.w - a.w);

        // 2. Determine Bracket Size (2, 4, 8, 16)
        let size = 0;
        if (sorted.length >= 16) size = 16;
        else if (sorted.length >= 8) size = 8;
        else if (sorted.length >= 4) size = 4;
        else if (sorted.length >= 2) size = 2;
        else {
            alert('Need at least 2 teams for a final.');
            return;
        }

        // 3. Select Top N Teams
        const qualifiers = sorted.slice(0, size);

        // 4. Create First Round Matches (Best vs Worst)
        // 1 vs 16, 2 vs 15, etc.
        const round1 = [];
        for (let i = 0; i < size / 2; i++) {
            round1.push({
                matchId: generateId(),
                homeId: qualifiers[i].id,
                awayId: qualifiers[size - 1 - i].id,
                winnerId: null,
                nextMatchId: null // To be linked
            });
        }

        state.knockoutRounds = [round1];

        // 5. Build subsequent rounds holes
        let currentSize = size / 2;
        while (currentSize > 1) {
            currentSize = currentSize / 2;
            const nextRound = [];
            for (let i = 0; i < currentSize; i++) {
                nextRound.push({
                    matchId: generateId(),
                    homeId: null, // TBD
                    awayId: null, // TBD
                    winnerId: null
                });
            }
            state.knockoutRounds.push(nextRound);
        }

        renderBracket();
    };

    const advanceWinner = (roundIndex, matchIndex, winnerId) => {
        const round = state.knockoutRounds[roundIndex];
        const match = round[matchIndex];

        // Set winner
        match.winnerId = winnerId;

        // Propagate to next round
        const nextRoundIndex = roundIndex + 1;
        if (nextRoundIndex < state.knockoutRounds.length) {
            const nextRound = state.knockoutRounds[nextRoundIndex];
            const nextMatchIndex = Math.floor(matchIndex / 2);
            const nextMatch = nextRound[nextMatchIndex];

            // Is this match the top or bottom feeder for the next match?
            // If matchIndex is even (0, 2, 4), it goes to 'home' slot of (0, 1, 2)
            if (matchIndex % 2 === 0) {
                nextMatch.homeId = winnerId;
            } else {
                nextMatch.awayId = winnerId;
            }

            // Reset next match winner if we changed the input
            nextMatch.winnerId = null;
        }

        renderBracket();
        saveToLocal();
    };

    const renderBracket = () => {
        bracketContainer.innerHTML = '';
        if (state.knockoutRounds.length === 0) {
            bracketContainer.innerHTML = '<p style="text-align:center;color:var(--text-secondary)">No active bracket.</p>';
            return;
        }

        const roundNames = ['Round of 16', 'Quarter-Finals', 'Semi-Finals', 'Final'];
        // Adjust names based on total rounds
        // If 4 rounds: R16, QF, SF, F
        // If 3 rounds: QF, SF, F
        // If 2 rounds: SF, F
        // If 1 round: F
        const totalRounds = state.knockoutRounds.length;
        const startNameIndex = 4 - totalRounds;

        state.knockoutRounds.forEach((round, rIndex) => {
            const col = document.createElement('div');
            col.className = 'bracket-round';

            // Round Title
            const title = document.createElement('h3');
            title.textContent = roundNames[startNameIndex + rIndex] || `Round ${rIndex + 1}`;
            title.style.textAlign = 'center';
            title.style.fontSize = '0.9rem';
            col.appendChild(title);

            round.forEach((m, mIndex) => {
                const home = state.participants.find(p => p.id === m.homeId) || { name: 'TBD' };
                const away = state.participants.find(p => p.id === m.awayId) || { name: 'TBD' };

                const matchDiv = document.createElement('div');
                matchDiv.className = 'bracket-match';

                // Helper to create team line
                const createTeamLine = (p, isHome) => `
                    <div class="bracket-team ${m.winnerId === p.id ? 'winner' : ''} ${p.name === 'TBD' ? 'tbd' : ''}"
                         onclick="window.advance('${rIndex}', '${mIndex}', '${p.id}')">
                        <span>${p.name}</span>
                        ${m.winnerId === p.id ? '<span>🏆</span>' : ''}
                    </div>
                `;

                if (m.homeId) matchDiv.innerHTML += createTeamLine(home, true);
                else matchDiv.innerHTML += `<div class="bracket-team tbd">Waiting...</div>`;

                if (m.awayId) matchDiv.innerHTML += createTeamLine(away, false);
                else matchDiv.innerHTML += `<div class="bracket-team tbd">Waiting...</div>`;

                col.appendChild(matchDiv);
            });

            bracketContainer.appendChild(col);
        });
    };

    window.advance = (r, m, id) => {
        if (id !== 'undefined' && id !== 'null') {
            advanceWinner(parseInt(r), parseInt(m), id);
        }
    };


    // === PERSISTENCE LOGIC ===
    const saveToLocal = () => {
        localStorage.setItem('tournamentData', JSON.stringify(state));
    };

    const loadFromLocal = () => {
        const saved = localStorage.getItem('tournamentData');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                state.participants = data.participants || [];
                state.leagueMatches = data.leagueMatches || [];
                state.knockoutRounds = data.knockoutRockoutRounds || [];

                renderParticipantsTable();
                renderLeague();
                renderBracket();
            } catch (e) {
                console.error('Failed to load local data', e);
            }
        }
    };

    const saveData = () => {
        const dataStr = JSON.stringify(state, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'tournament_data.json';
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
    };

    const loadData = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                // Backward compatibility check or simple assign
                if (data.participants) {
                    state.participants = data.participants;
                    state.leagueMatches = data.leagueMatches || [];
                    state.knockoutRounds = data.knockoutRounds || [];
                } else if (Array.isArray(data)) {
                    // Old format (just list of participants)
                    state.participants = data;
                }

                renderParticipantsTable();
                renderLeague();
                renderBracket();
                saveToLocal(); // Save immediately after loading file
                alert('Tournament loaded!');
            } catch (err) {
                console.error(err);
                alert('Error loading file');
            }
            e.target.value = '';
        }
        reader.readAsText(file);
    };

    // Proxies to inject saveToLocal
    const withSave = (fn) => (...args) => {
        fn(...args);
        saveToLocal();
    };

    // === LISTENERS ===
    addBtn.addEventListener('click', withSave(addParticipant));
    participantNameInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') withSave(addParticipant)() });

    generateLeagueBtn.addEventListener('click', withSave(generateLeague));
    generateKnockoutBtn.addEventListener('click', withSave(generateKnockout));

    saveBtn.addEventListener('click', saveData);
    loadInput.addEventListener('change', loadData);

    saveEditBtn.addEventListener('click', withSave(saveEdit));
    cancelEditBtn.addEventListener('click', closeEditModal);

    // Initial load
    loadFromLocal();
});
