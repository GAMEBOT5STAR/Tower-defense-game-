// 攻打台娃 - 最小化可运行版本
// 版本: 1.1.1 (修复版)

// 游戏配置
const GAME_CONFIG = {
    cellSize: 40,
    mapWidth: 20,
    mapHeight: 15,
    STATES: {
        IDLE: 'idle',
        PLAYING: 'playing',
        PAUSED: 'paused',
        BETWEEN_WAVES: 'between_waves',
        GAMEOVER: 'gameover',
        VICTORY: 'victory'
    },
    TOWERS: {
        basic:  { cost: 20,  range: 150, damage: 20,  fireRate: 600,  color: '#3498db', label: '炮' },
        rocket: { cost: 50,  range: 200, damage: 40,  fireRate: 900,  color: '#e67e22', label: '箭' },
        missile:{ cost: 100, range: 280, damage: 80,  fireRate: 1200, color: '#9b59b6', label: '弹' }
    },
    ENEMIES: {
        infantry: { health: 30, speed: 1,   color: '#e74c3c', label: '蛙',      reward: { gold: 10, score: 10 } },
        tank:     { health: 70, speed: 0.7, color: '#e67e22', label: '坦克',    reward: { gold: 15, score: 25 } },
        boss:     { health: 180,speed: 0.5, color: '#8e44ad', label: 'BOSS',    reward: { gold: 30, score: 50 } }
    },
    waveSize: 10,
    enemySpawnInterval: 2500,
    maxLevel: 5,
    betweenWavesDelay: 3000,
    startingGold: 100,
    startingHealth: 100,
    levelCompleteReward: 50
};

// 简化的音频引擎
class AudioEngine {
    constructor() {
        this.ctx = null;
        this.bgGain = null;
        this.sfxGain = null;
        this.bgPlaying = false;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = 1.0;
            this.masterGain.connect(this.ctx.destination);
            this.bgGain = this.ctx.createGain();
            this.bgGain.gain.value = 0.28;
            this.bgGain.connect(this.masterGain);
            this.sfxGain = this.ctx.createGain();
            this.sfxGain.gain.value = 0.7;
            this.sfxGain.connect(this.masterGain);
        } catch (e) {
            console.warn('Web Audio API 不可用', e);
        }
    }
    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }
    _osc(type, freq, startTime, duration, gainVal, dest, pitchEnd) {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, startTime);
        if (pitchEnd !== undefined) {
            osc.frequency.linearRampToValueAtTime(pitchEnd, startTime + duration);
        }
        g.gain.setValueAtTime(gainVal, startTime);
        g.gain.linearRampToValueAtTime(0.001, startTime + duration);
        osc.connect(g);
        g.connect(dest);
        osc.start(startTime);
        osc.stop(startTime + duration + 0.01);
        return osc;
    }
    _noise(startTime, duration, gainVal, dest, filterFreq) {
        if (!this.ctx) return;
        const bufLen = this.ctx.sampleRate * duration;
        const buf = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = filterFreq || 800;
        filter.Q.value = 0.8;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(gainVal, startTime);
        g.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        src.connect(filter);
        filter.connect(g);
        g.connect(dest);
        src.start(startTime);
        src.stop(startTime + duration + 0.01);
    }
    playBasicShot() {
        if (!this.ctx) return;
        this.resume();
        const t = this.ctx.currentTime;
        this._osc('square', 320, t, 0.06, 0.5, this.sfxGain, 160);
        this._osc('square', 160, t + 0.04, 0.08, 0.3, this.sfxGain, 80);
        this._noise(t, 0.05, 0.15, this.sfxGain, 600);
    }
    playRocketShot() {
        if (!this.ctx) return;
        this.resume();
        const t = this.ctx.currentTime;
        this._osc('sawtooth', 80, t, 0.12, 0.45, this.sfxGain, 280);
        this._osc('sawtooth', 200, t + 0.05, 0.10, 0.25, this.sfxGain, 80);
        this._noise(t, 0.14, 0.2, this.sfxGain, 1200);
    }
    playMissileShot() {
        if (!this.ctx) return;
        this.resume();
        const t = this.ctx.currentTime;
        this._osc('sawtooth', 60, t, 0.18, 0.55, this.sfxGain, 30);
        this._osc('square', 120, t, 0.14, 0.3, this.sfxGain, 40);
        this._osc('sawtooth', 240, t + 0.02, 0.10, 0.2, this.sfxGain, 60);
        this._noise(t, 0.2, 0.35, this.sfxGain, 400);
    }
    playEnemyDead() {
        if (!this.ctx) return;
        this.resume();
        const t = this.ctx.currentTime;
        this._osc('square', 400, t, 0.05, 0.4, this.sfxGain, 50);
        this._noise(t + 0.02, 0.12, 0.3, this.sfxGain, 350);
    }
    startBGM() {
        if (!this.ctx || this.bgPlaying) return;
        this.resume();
        this.bgPlaying = true;
        this._scheduleBGM();
    }
    stopBGM() {
        this.bgPlaying = false;
        if (this.bgGain) {
            const t = this.ctx.currentTime;
            this.bgGain.gain.linearRampToValueAtTime(0, t + 0.5);
        }
    }
    _scheduleBGM() {
        if (!this.ctx || !this.bgPlaying) return;
        const BPM = 128;
        const beat = 60 / BPM;
        const now = this.ctx.currentTime + 0.05;
        const melody = [
            [523, 0.5],[659, 0.5],[784, 0.5],[880, 0.5],
            [784, 0.5],[659, 0.5],[523, 0.5],[659, 0.5],
            [784, 1.0],[523, 0.5],[659, 0.5],
            [784, 0.5],[880, 0.5],[1047,0.5],[880, 0.5],
            [784, 0.5],[659, 1.0],[523, 0.5],
            [659, 0.5],[784, 0.5],[659, 0.5],[523, 0.5],
            [392, 1.0],[0, 1.0],
        ];
        const bass = [
            [131,0.5],[165,0.5], [131,0.5],[196,0.5],
            [131,0.5],[165,0.5], [131,0.5],[196,0.5],
            [131,0.5],[165,0.5], [131,0.5],[196,0.5],
            [131,0.5],[165,0.5], [131,0.5],[196,0.5],
            [110,0.5],[131,0.5], [110,0.5],[165,0.5],
            [110,0.5],[131,0.5], [110,0.5],[165,0.5],
            [131,0.5],[165,0.5], [131,0.5],[196,0.5],
        ];
        let totalBeats = 0;
        melody.forEach(n => totalBeats += n[1]);
        let t = now;
        melody.forEach(([freq, dur]) => {
            if (freq > 0) {
                this._osc('square', freq, t, dur * beat * 0.85, 0.6, this.bgGain);
            }
            t += dur * beat;
        });
        t = now;
        bass.forEach(([freq, dur]) => {
            this._osc('triangle', freq, t, dur * beat * 0.7, 0.5, this.bgGain);
            t += dur * beat;
        });
        const totalDur = totalBeats * beat;
        for (let i = 0; i < totalBeats * 2; i++) {
            const nt = now + i * beat * 0.5;
            if (nt < now + totalDur) {
                const isStrong = (i % 4 === 0);
                this._noise(nt, 0.04, isStrong ? 0.18 : 0.08, this.bgGain, isStrong ? 180 : 600);
            }
        }
        const loopDelay = (totalDur - 0.1) * 1000;
        this._bgTimer = setTimeout(() => this._scheduleBGM(), loopDelay);
    }
}

// 主游戏类
class TowerDefenseGame {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        if (!this.canvas) {
            console.error('游戏画布未找到！');
            return;
        }
        this.ctx = this.canvas.getContext('2d');
        this.audio = new AudioEngine();
        this.resetGameState();
        this.gameMap = this.generateMap();
        this.fps = 0;
        this.frameCount = 0;
        this.lastFpsUpdate = 0;
        this.initializeEventListeners();
        this.gameLoop();
    }
    
    resetGameState() {
        this.gameState = GAME_CONFIG.STATES.IDLE;
        this.score = 0;
        this.gold = GAME_CONFIG.startingGold;
        this.health = GAME_CONFIG.startingHealth;
        this.level = 1;
        this.wave = 0;
        this.enemies = [];
        this.towers = [];
        this.projectiles = [];
        this.drag = null;
        this.gameTime = 0;
        this.waveSpawning = false;
        this._insufficientGoldFlash = 0;
    }
    
    generateMap() {
        const { mapWidth, mapHeight } = GAME_CONFIG;
        const map = Array(mapHeight).fill().map(() => Array(mapWidth).fill(0));
        const path = [
            { x: 0, y: 7 }, { x: 5, y: 7 }, { x: 10, y: 7 },
            { x: 15, y: 7 }, { x: 19, y: 7 }
        ];
        for (let i = 0; i < path.length - 1; i++) {
            const a = path[i], b = path[i + 1];
            const startX = Math.min(a.x, b.x), endX = Math.max(a.x, b.x);
            for (let x = startX; x <= endX; x++) map[a.y][x] = 1;
        }
        map[7][0] = 2; map[7][19] = 3;
        return map;
    }
    
    initializeEventListeners() {
        document.getElementById('start-btn')?.addEventListener('click', () => this.startGame());
        document.getElementById('pause-btn')?.addEventListener('click', () => this.togglePause());
        document.getElementById('restart-btn')?.addEventListener('click', () => this.restartGame());
        
        document.querySelectorAll('.tower-item').forEach(item => {
            item.addEventListener('mousedown', e => {
                const type = e.currentTarget.dataset.type;
                const cost = parseInt(e.currentTarget.dataset.cost);
                this._startDrag(type, cost, e);
            });
            item.addEventListener('dragstart', e => e.preventDefault());
        });
        
        document.addEventListener('mousemove', e => this._onDragMove(e));
        document.addEventListener('mouseup', e => this._onDragUp(e));
        document.getElementById('close-overlay')?.addEventListener('click', () => this.hideOverlay());
    }
    
    _startDrag(type, cost, e) {
        this.audio.resume();
        if (this.gameState !== 'playing' && this.gameState !== 'between_waves') return;
        if (this.gold < cost) {
            this._insufficientGoldFlash = 40;
            return;
        }
        this.drag = { type, cost, x: e.clientX, y: e.clientY, active: true };
        this.audio.playPickup(type);
        document.body.style.cursor = 'grabbing';
        e.preventDefault();
    }
    
    _onDragMove(e) {
        if (!this.drag || !this.drag.active) return;
        this.drag.x = e.clientX; this.drag.y = e.clientY;
    }
    
    _onDragUp(e) {
        if (!this.drag || !this.drag.active) return;
        document.body.style.cursor = '';
        const rect = this.canvas.getBoundingClientRect();
        const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
        if (cx >= 0 && cy >= 0 && cx <= this.canvas.width && cy <= this.canvas.height) {
            this._tryPlaceTower(cx, cy, this.drag.type, this.drag.cost);
        }
        this.drag = null;
    }
    
    _tryPlaceTower(x, y, type, cost) {
        const { cellSize, mapWidth, mapHeight } = GAME_CONFIG;
        const gx = Math.floor(x / cellSize), gy = Math.floor(y / cellSize);
        if (gx < 0 || gx >= mapWidth || gy < 0 || gy >= mapHeight) return;
        if (this.gameMap[gy][gx] !== 0) return;
        const occupied = this.towers.some(t => Math.floor(t.x / cellSize) === gx && Math.floor(t.y / cellSize) === gy);
        if (occupied) return;
        this.gold -= cost;
        const towerConfig = GAME_CONFIG.TOWERS[type];
        this.towers.push({
            type, x: gx * cellSize + cellSize / 2, y: gy * cellSize + cellSize / 2,
            range: towerConfig.range, damage: towerConfig.damage, fireRate: towerConfig.fireRate,
            lastFire: 0, deployAnim: 20, level: 1
        });
        this.audio.playDeploy(type); this.updateUI();
    }
    
    startGame() {
        this.audio.resume();
        this.gameState = 'playing';
        this.audio.startBGM();
        this.showOverlay('游戏开始', '保卫台湾同胞，从南到北解放城市！');
        this.startWave();
    }
    
    togglePause() {
        if (this.gameState === 'playing' || this.gameState === 'between_waves') {
            this.gameState = 'paused'; this.audio.stopBGM();
            this.showOverlay('游戏暂停', '点击确定继续游戏');
        } else if (this.gameState === 'paused') {
            this.gameState = 'playing'; this.audio.startBGM(); this.hideOverlay();
        }
    }
    
    restartGame() {
        this.audio.stopBGM(); this.resetGameState();
        document.body.style.cursor = ''; this.hideOverlay(); this.updateUI();
    }
    
    startWave() {
        this.wave++; this.waveSpawning = true; let spawnedCount = 0;
        const spawnNext = () => {
            if (spawnedCount >= GAME_CONFIG.waveSize || this.gameState !== 'playing') {
                this.waveSpawning = false; return;
            }
            this.spawnEnemy(); spawnedCount++;
            setTimeout(spawnNext, GAME_CONFIG.enemySpawnInterval);
        };
        spawnNext();
    }
    
    spawnEnemy() {
        const enemyTypes = Object.keys(GAME_CONFIG.ENEMIES);
        const type = enemyTypes[Math.min(this.wave - 1, enemyTypes.length - 1)];
        const enemyConfig = GAME_CONFIG.ENEMIES[type];
        this.enemies.push({
            type, x: 20, y: 7 * GAME_CONFIG.cellSize + GAME_CONFIG.cellSize / 2,
            health: enemyConfig.health, maxHealth: enemyConfig.health, speed: enemyConfig.speed,
            pathIndex: 0, path: this.getEnemyPath(), hitFlash: 0, worth: enemyConfig.reward
        });
    }
    
    getEnemyPath() {
        return [
            { x: 0, y: 7 }, { x: 5, y: 7 }, { x: 10, y: 7 },
            { x: 15, y: 7 }, { x: 19, y: 7 }
        ];
    }
    
    updateEnemies(dt) {
        const { cellSize } = GAME_CONFIG;
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            if (enemy.hitFlash > 0) enemy.hitFlash -= dt;
            if (enemy.pathIndex >= enemy.path.length - 1) {
                this.health = Math.max(0, this.health - 10); this.audio.playPlayerHurt();
                this.enemies.splice(i, 1);
                if (this.health <= 0) { this.health = 0; this.gameOver(); }
                this.updateUI(); continue;
            }
            const target = enemy.path[enemy.pathIndex + 1];
            const targetX = target.x * cellSize + cellSize / 2;
            const targetY = target.y * cellSize + cellSize / 2;
            const dx = targetX - enemy.x, dy = targetY - enemy.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < enemy.speed) { enemy.pathIndex++; }
            else { enemy.x += (dx / distance) * enemy.speed; enemy.y += (dy / distance) * enemy.speed; }
        }
    }
    
    updateTowers(dt) {
        this.towers.forEach(tower => {
            tower.lastFire += dt;
            if (tower.lastFire < tower.fireRate) return;
            const target = this.findTarget(tower);
            if (!target) return;
            this.fireProjectile(tower, target);
            const sounds = {
                basic: () => this.audio.playBasicShot(),
                rocket: () => this.audio.playRocketShot(),
                missile: () => this.audio.playMissileShot()
            };
            if (sounds[tower.type]) sounds[tower.type]();
            tower.lastFire = 0;
        });
    }
    
    findTarget(tower) {
        let closest = null, minDist = tower.range;
        for (const enemy of this.enemies) {
            const dx = enemy.x - tower.x, dy = enemy.y - tower.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= tower.range && dist < minDist) {
                minDist = dist; closest = enemy;
            }
        }
        return closest;
    }
    
    fireProjectile(tower, target) {
        const speeds = { basic: 7, rocket: 5, missile: 4 };
        this.projectiles.push({
            x: tower.x, y: tower.y, target, damage: tower.damage,
            speed: speeds[tower.type] || 7, towerType: tower.type
        });
    }
    
    updateProjectiles() {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            if (!p.target || !this.enemies.includes(p.target)) {
                this.projectiles.splice(i, 1); continue;
            }
            const dx = p.target.x - p.x, dy = p.target.y - p.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < p.speed) {
                const enemy = p.target; const enemyConfig = GAME_CONFIG.ENEMIES[enemy.type];
                enemy.health -= p.damage; enemy.hitFlash = 80;
                if (enemy.health <= 0) {
                    this.audio.playEnemyDead();
                    const idx = this.enemies.indexOf(enemy);
                    if (idx > -1) {
                        this.enemies.splice(idx, 1);
                        this.gold += enemyConfig.reward.gold;
                        this.score += enemyConfig.reward.score;
                    }
                } else {
                    const sounds = {
                        boss: () => this.audio.playBossHit(),
                        tank: () => this.audio.playTankHit(),
                        infantry: () => this.audio.playInfantryHit()
                    };
                    if (sounds[enemy.type]) sounds[enemy.type]();
                }
                this.projectiles.splice(i, 1); this.updateUI();
            } else {
                p.x += (dx / dist) * p.speed; p.y += (dy / dist) * p.speed;
            }
        }
    }
    
    checkWaveCompletion() {
        const isComplete = !this.waveSpawning && this.enemies.length === 0 && this.gameState === 'playing';
        if (!isComplete) return;
        this.level++; this.gold += GAME_CONFIG.levelCompleteReward; this.updateUI();
        if (this.level > GAME_CONFIG.maxLevel) { this.victory(); return; }
        this.gameState = 'between_waves';
        this.showOverlay(`第 ${this.level} 关准备`, `${this.getLevelName(this.level)}\n准备迎接新的挑战！`);
        setTimeout(() => {
            if (this.gameState === 'between_waves') {
                this.gameState = 'playing'; this.hideOverlay(); this.startWave();
            }
        }, GAME_CONFIG.betweenWavesDelay);
    }
    
    getLevelName(level) {
        const names = { 2: '台中防线', 3: '新竹保卫战', 4: '桃园攻坚战', 5: '台北决战' };
        return names[level] || `关卡 ${level}`;
    }
    
    gameOver() {
        this.gameState = 'gameover';
        this.audio.stopBGM();
        this.showOverlay('游戏结束', `最终得分: ${this.score}\n台湾同胞需要你的保护！`);
    }
    
    victory() {
        this.gameState = 'victory';
        this.audio.stopBGM();
        this.showOverlay('🎉 胜利！', `恭喜！成功解放台湾！\n最终得分: ${this.score}\n\n祖国统一大业完成！`);
    }
    
    showOverlay(title, msg) {
        document.getElementById('overlay-title').textContent = title;
        document.getElementById('overlay-message').textContent = msg;
        document.getElementById('game-overlay').classList.remove('hidden');
    }
    
    hideOverlay() { document.getElementById('game-overlay').classList.add('hidden'); }
    
    updateUI() {
        document.getElementById('gold').textContent = this.gold;
        document.getElementById('health').textContent = Math.max(0, this.health);
        document.getElementById('level').textContent = this.level;
    }
    
    render() {
        this.ctx.fillStyle = '#2c3e50';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.renderMap();
        this.renderEnemies();
        this.renderTowers();
        this.renderProjectiles();
        this.renderDragPreview();
        this.renderUI();
    }
    
    renderMap() {
        const { cellSize, mapWidth, mapHeight } = GAME_CONFIG;
        for (let y = 0; y < mapHeight; y++) {
            for (let x = 0; x < mapWidth; x++) {
                const cx = x * cellSize, cy = y * cellSize;
                const v = this.gameMap[y][x];
                if (v === 0) {
                    this.ctx.fillStyle = '#34495e';
                    this.ctx.fillRect(cx, cy, cellSize, cellSize);
                    this.ctx.strokeStyle = '#2c3e50';
                    this.ctx.strokeRect(cx, cy, cellSize, cellSize);
                } else if (v === 1) {
                    this.ctx.fillStyle = '#7f8c8d';
                    this.ctx.fillRect(cx, cy, cellSize, cellSize);
                    this.ctx.fillStyle = '#95a5a6';
                    this.ctx.fillRect(cx + 2, cy + cellSize / 2 - 1, cellSize - 4, 2);
                } else if (v === 2) {
                    this.ctx.fillStyle = '#c0392b';
                    this.ctx.fillRect(cx, cy, cellSize, cellSize);
                    this.ctx.fillStyle = 'white';
                    this.ctx.font = 'bold 11px Arial';
                    this.ctx.fillText('高雄', cx + 4, cy + 14);
                    this.ctx.fillText('起点', cx + 4, cy + 28);
                } else if (v === 3) {
                    this.ctx.fillStyle = '#27ae60';
                    this.ctx.fillRect(cx, cy, cellSize, cellSize);
                    this.ctx.fillStyle = 'white';
                    this.ctx.font = 'bold 11px Arial';
                    this.ctx.fillText('台北', cx + 4, cy + 14);
                    this.ctx.fillText('终点', cx + 4, cy + 28);
                }
            }
        }
        const cities = [{ x: 5, label: '台中' }, { x: 10, label: '新竹' }, { x: 15, label: '桃园' }];
        cities.forEach(c => {
            this.ctx.fillStyle = 'rgba(255,255,255,0.6)';
            this.ctx.font = '10px Arial';
            this.ctx.fillText(c.label, c.x * cellSize + 4, 7 * cellSize + 14);
        });
    }
    
    renderEnemies() {
        this.enemies.forEach(e => {
            const r = e.type === 'boss' ? 18 : e.type === 'tank' ? 14 : 11;
            this.ctx.fillStyle = e.hitFlash > 0 ? 'white' : GAME_CONFIG.ENEMIES[e.type].color;
            this.ctx.beginPath(); this.ctx.arc(e.x, e.y, r, 0, Math.PI * 2); this.ctx.fill();
            this.ctx.strokeStyle = 'rgba(0,0,0,0.5)';
            this.ctx.lineWidth = 1.5; this.ctx.stroke(); this.ctx.lineWidth = 1;
            this.ctx.fillStyle = '#e74c3c';
            this.ctx.fillRect(e.x - r, e.y - r - 8, r * 2, 5);
            const pct = Math.max(0, e.health / e.maxHealth);
            this.ctx.fillStyle = pct > 0.5 ? '#2ecc71' : pct > 0.25 ? '#f39c12' : '#e74c3c';
            this.ctx.fillRect(e.x - r, e.y - r - 8, r * 2 * pct, 5);
            this.ctx.fillStyle = 'white';
            this.ctx.font = `bold ${e.type === 'boss' ? 10 : 9}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.fillText(GAME_CONFIG.ENEMIES[e.type].label, e.x, e.y + 4);
            this.ctx.textAlign = 'left';
        });
    }
    
    renderTowers() {
        this.towers.forEach(tower => {
            if (tower.deployAnim > 0) tower.deployAnim--;
            const scale = tower.deployAnim > 0 ? 1 + tower.deployAnim * 0.04 : 1;
            if (this.drag && this.drag.active) {
                this.ctx.strokeStyle = 'rgba(255,255,255,0.12)';
                this.ctx.lineWidth = 1;
                this.ctx.beginPath(); this.ctx.arc(tower.x, tower.y, tower.range, 0, Math.PI * 2); this.ctx.stroke();
            }
            this.ctx.save(); this.ctx.translate(tower.x, tower.y); this.ctx.scale(scale, scale);
            this.ctx.fillStyle = '#2c3e50'; this.ctx.beginPath(); this.ctx.arc(0, 0, 14, 0, Math.PI * 2); this.ctx.fill();
            this.ctx.fillStyle = GAME_CONFIG.TOWERS[tower.type].color; this.ctx.beginPath(); this.ctx.arc(0, 0, 11, 0, Math.PI * 2); this.ctx.fill();
            if (tower.deployAnim > 10) {
                this.ctx.strokeStyle = 'rgba(255,255,255,' + (tower.deployAnim / 20 * 0.8) + ')';
                this.ctx.lineWidth = 3; this.ctx.beginPath(); this.ctx.arc(0, 0, 14, 0, Math.PI * 2); this.ctx.stroke(); this.ctx.lineWidth = 1;
            }
            this.ctx.strokeStyle = '#ecf0f1'; this.ctx.lineWidth = 3;
            this.ctx.beginPath(); this.ctx.moveTo(0, 0); this.ctx.lineTo(tower.type === 'missile' ? 0 : 14, -10); this.ctx.stroke(); this.ctx.lineWidth = 1;
            this.ctx.fillStyle = 'white'; this.ctx.font = '9px Arial'; this.ctx.textAlign = 'center';
            this.ctx.fillText(GAME_CONFIG.TOWERS[tower.type].label, 0, 4); this.ctx.textAlign = 'left';
            this.ctx.restore();
        });
    }
    
    renderProjectiles() {
        this.projectiles.forEach(p => {
            const colors = { basic: '#f1c40f', rocket: '#e74c3c', missile: '#9b59b6' };
            const sizes = { basic: 3, rocket: 4, missile: 5 };
            this.ctx.fillStyle = colors[p.towerType] || '#f1c40f';
            this.ctx.beginPath(); this.ctx.arc(p.x, p.y, sizes[p.towerType] || 3, 0, Math.PI * 2); this.ctx.fill();
        });
    }
    
    renderUI() {
        this.ctx.fillStyle = 'rgba(0,0,0,0.45)';
        this.ctx.fillRect(4, 4, 140, 48);
        this.ctx.fillStyle = '#f1c40f'; this.ctx.font = 'bold 14px Arial'; this.ctx.fillText(`得分: ${this.score}`, 10, 20);
        this.ctx.fillStyle = 'white'; this.ctx.font = '13px Arial'; this.ctx.fillText(`第 ${this.wave} 波`, 10, 38);
        
        if (this.gameState === 'between_waves') {
            this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
            this.ctx.fillRect(this.canvas.width / 2 - 110, 10, 220, 30);
            this.ctx.fillStyle = '#2ecc71'; this.ctx.font = 'bold 14px Arial';
            this.ctx.textAlign = 'center'; this.ctx.fillText('下一波即将到来...', this.canvas.width / 2, 30); this.ctx.textAlign = 'left';
        }
        
        if (this._insufficientGoldFlash > 0) {
            this._insufficientGoldFlash--;
            this.ctx.save(); this.ctx.globalAlpha = this._insufficientGoldFlash / 40;
            this.ctx.fillStyle = '#e74c3c';
            this.ctx.fillRect(this.canvas.width / 2 - 80, this.canvas.height / 2 - 20, 160, 36);
            this.ctx.fillStyle = 'white'; this.ctx.font = 'bold 14px Arial';
            this.ctx.textAlign = 'center'; this.ctx.fillText('金币不足！', this.canvas.width / 2, this.canvas.height / 2 + 4);
            this.ctx.restore(); this.ctx.textAlign = 'left';
        }
    }
    
    renderDragPreview() {
        if (!this.drag || !this.drag.active) return;
        const rect = this.canvas.getBoundingClientRect();
        const mx = this.drag.x - rect.left, my = this.drag.y - rect.top;
        if (mx < 0 || my < 0 || mx > this.canvas.width || my > this.canvas.height) return;
        const cs = GAME_CONFIG.cellSize; const gx = Math.floor(mx / cs); const gy = Math.floor(my / cs);
        const canPlace = gx >= 0 && gx < GAME_CONFIG.mapWidth && gy >= 0 && gy < GAME_CONFIG.mapHeight &&
                        this.gameMap[gy][gx] === 0 && !this.towers.some(t => Math.floor(t.x / cs) === gx && Math.floor(t.y / cs) === gy);
        this.ctx.save(); this.ctx.fillStyle = canPlace ? 'rgba(46,204,113,0.25)' : 'rgba(231,76,60,0.25)';
        this.ctx.fillRect(gx * cs, gy * cs, cs, cs); this.ctx.strokeStyle = canPlace ? 'rgba(46,204,113,0.8)' : 'rgba(231,76,60,0.8)';
        this.ctx.lineWidth = 2; this.ctx.strokeRect(gx * cs, gy * cs, cs, cs); this.ctx.lineWidth = 1;
        const cx = gx * cs + cs / 2, cy = gy * cs + cs / 2, range = GAME_CONFIG.TOWERS[this.drag.type].range;
        this.ctx.strokeStyle = canPlace ? 'rgba(46,204,113,0.45)' : 'rgba(231,76,60,0.35)';
        this.ctx.lineWidth = 1.5; this.ctx.setLineDash([6, 4]); this.ctx.beginPath(); this.ctx.arc(cx, cy, range, 0, Math.PI * 2); this.ctx.stroke();
        this.ctx.setLineDash([]); this.ctx.lineWidth = 1; this.ctx.globalAlpha = 0.82; this.ctx.translate(mx, my);
        this.ctx.fillStyle = '#2c3e50'; this.ctx.beginPath(); this.ctx.arc(0, 0, 14, 0, Math.PI * 2); this.ctx.fill();
        this.ctx.fillStyle = GAME_CONFIG.TOWERS[this.drag.type].color; this.ctx.beginPath(); this.ctx.arc(0, 0, 11, 0, Math.PI * 2); this.ctx.fill();
        this.ctx.strokeStyle = '#ecf0f1'; this.ctx.lineWidth = 3; this.ctx.beginPath(); this.ctx.moveTo(0, 0);
        this.ctx.lineTo(this.drag.type === 'missile' ? 0 : 14, -10); this.ctx.stroke(); this.ctx.lineWidth = 1;
        this.ctx.fillStyle = 'white'; this.ctx.font = '9px Arial'; this.ctx.textAlign = 'center';
        this.ctx.fillText(GAME_CONFIG.TOWERS[this.drag.type].label, 0, 4); this.ctx.restore(); this.ctx.textAlign = 'left';
    }
    
    gameLoop() {
        const now = performance.now();
        const dt = now - (this.lastTime || now);
        this.lastTime = now;
        this.frameCount++; if (now - this.lastFpsUpdate >= 1000) { this.fps = this.frameCount; this.frameCount = 0; this.lastFpsUpdate = now; }
        if (this.gameState === 'playing') {
            this.gameTime += dt; this.updateEnemies(dt); this.updateTowers(dt); this.updateProjectiles(); this.checkWaveCompletion();
        }
        this.render(); this.updateUI(); requestAnimationFrame(() => this.gameLoop());
    }
}

// 启动游戏
document.addEventListener('DOMContentLoaded', () => {
    try {
        window.game = new TowerDefenseGame();
        console.log('游戏启动成功！');
    } catch (error) {
        console.error('游戏启动失败:', error);
    }
});
