// 攻打台娃 - 塔防游戏核心逻辑（含8位音效与背景音乐）

// ============================================================
//  8-BIT 音频引擎
// ============================================================
class AudioEngine {
    constructor() {
        this.ctx = null;
        this.bgGain = null;
        this.sfxGain = null;
        this.bgNodes = [];   // 记录背景音乐节点，便于停止
        this.bgPlaying = false;
        this.bgScheduled = false;
        this._init();
    }

    _init() {
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            // 主增益
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = 1.0;
            this.masterGain.connect(this.ctx.destination);
            // 背景音乐增益（稍低，不压音效）
            this.bgGain = this.ctx.createGain();
            this.bgGain.gain.value = 0.28;
            this.bgGain.connect(this.masterGain);
            // 音效增益
            this.sfxGain = this.ctx.createGain();
            this.sfxGain.gain.value = 0.7;
            this.sfxGain.connect(this.masterGain);
        } catch (e) {
            console.warn('Web Audio API 不可用', e);
        }
    }

    // 恢复被浏览器自动挂起的 AudioContext
    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    // ---- 通用波形发生器 ----
    _osc(type, freq, startTime, duration, gainVal, dest, pitchEnd) {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const g   = this.ctx.createGain();
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

    // 噪声爆破（用于击中/爆炸）
    _noise(startTime, duration, gainVal, dest, filterFreq) {
        if (!this.ctx) return;
        const bufLen = this.ctx.sampleRate * duration;
        const buf    = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
        const data   = buf.getChannelData(0);
        for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
        const src    = this.ctx.createBufferSource();
        src.buffer   = buf;
        const filter = this.ctx.createBiquadFilter();
        filter.type  = 'bandpass';
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

    // ============================================================
    //  音效：岸炮发射 — 短促的方波"嘣"，带下滑
    // ============================================================
    playBasicShot() {
        if (!this.ctx) return;
        this.resume();
        const t = this.ctx.currentTime;
        this._osc('square', 320, t,       0.06, 0.5, this.sfxGain, 160);
        this._osc('square', 160, t + 0.04, 0.08, 0.3, this.sfxGain, 80);
        this._noise(t, 0.05, 0.15, this.sfxGain, 600);
    }

    // ============================================================
    //  音效：火箭发射 — 锯齿波上升，带嘶嘶尾音
    // ============================================================
    playRocketShot() {
        if (!this.ctx) return;
        this.resume();
        const t = this.ctx.currentTime;
        this._osc('sawtooth', 80,  t,       0.12, 0.45, this.sfxGain, 280);
        this._osc('sawtooth', 200, t + 0.05, 0.10, 0.25, this.sfxGain, 80);
        this._noise(t, 0.14, 0.2, this.sfxGain, 1200);
    }

    // ============================================================
    //  音效：导弹发射 — 厚重低频下压，带爆发噪声
    // ============================================================
    playMissileShot() {
        if (!this.ctx) return;
        this.resume();
        const t = this.ctx.currentTime;
        this._osc('sawtooth', 60,  t,       0.18, 0.55, this.sfxGain, 30);
        this._osc('square',   120, t,       0.14, 0.3,  this.sfxGain, 40);
        this._osc('sawtooth', 240, t + 0.02, 0.10, 0.2, this.sfxGain, 60);
        this._noise(t, 0.2, 0.35, this.sfxGain, 400);
    }

    // ============================================================
    //  音效：步兵受击 — 高频短促"噗"
    // ============================================================
    playInfantryHit() {
        if (!this.ctx) return;
        this.resume();
        const t = this.ctx.currentTime;
        this._osc('square', 600, t, 0.04, 0.35, this.sfxGain, 200);
        this._noise(t, 0.04, 0.12, this.sfxGain, 900);
    }

    // ============================================================
    //  音效：坦克受击 — 中频撞击感
    // ============================================================
    playTankHit() {
        if (!this.ctx) return;
        this.resume();
        const t = this.ctx.currentTime;
        this._osc('square',   200, t,        0.07, 0.45, this.sfxGain, 80);
        this._osc('sawtooth', 100, t + 0.02, 0.08, 0.25, this.sfxGain, 50);
        this._noise(t, 0.08, 0.22, this.sfxGain, 500);
    }

    // ============================================================
    //  音效：BOSS受击 — 厚重爆炸感，三层叠加
    // ============================================================
    playBossHit() {
        if (!this.ctx) return;
        this.resume();
        const t = this.ctx.currentTime;
        this._osc('sawtooth', 80,  t,        0.14, 0.5,  this.sfxGain, 25);
        this._osc('square',   160, t,        0.12, 0.35, this.sfxGain, 40);
        this._osc('square',   320, t + 0.03, 0.08, 0.2,  this.sfxGain, 60);
        this._noise(t, 0.18, 0.45, this.sfxGain, 300);
    }

    // ============================================================
    //  音效：敌人死亡 — 下滑音+爆破
    // ============================================================
    playEnemyDead() {
        if (!this.ctx) return;
        this.resume();
        const t = this.ctx.currentTime;
        this._osc('square', 400, t,       0.05, 0.4, this.sfxGain, 50);
        this._noise(t + 0.02, 0.12, 0.3, this.sfxGain, 350);
    }

    // ============================================================
    //  音效：玩家受伤（敌人到达终点）— 低沉警报
    // ============================================================
    playPlayerHurt() {
        if (!this.ctx) return;
        this.resume();
        const t = this.ctx.currentTime;
        this._osc('square', 120, t,       0.12, 0.6, this.sfxGain, 80);
        this._osc('square', 80,  t + 0.1, 0.12, 0.5, this.sfxGain, 60);
        this._noise(t, 0.1, 0.15, this.sfxGain, 200);
    }

    // ============================================================
    //  音效：胜利 — 上升音阶
    // ============================================================
    playVictory() {
        if (!this.ctx) return;
        this.resume();
        const t = this.ctx.currentTime;
        const notes = [523, 659, 784, 1047];
        notes.forEach((freq, i) => {
            this._osc('square', freq, t + i * 0.18, 0.22, 0.45, this.sfxGain);
        });
    }

    // ============================================================
    //  音效：游戏结束 — 下降音阶
    // ============================================================
    playGameOver() {
        if (!this.ctx) return;
        this.resume();
        const t = this.ctx.currentTime;
        const notes = [392, 330, 262, 196];
        notes.forEach((freq, i) => {
            this._osc('square', freq, t + i * 0.22, 0.28, 0.45, this.sfxGain);
        });
    }

    // ============================================================
    //  音效：武器选取（从面板抓起）— 轻快上扬的"叮"
    //  type: 'basic' / 'rocket' / 'missile'
    // ============================================================
    playPickup(type) {
        if (!this.ctx) return;
        this.resume();
        const t = this.ctx.currentTime;
        if (type === 'basic') {
            // 岸炮：清脆短促上扬方波
            this._osc('square', 440, t,        0.05, 0.4, this.sfxGain, 660);
            this._osc('square', 880, t + 0.04, 0.04, 0.2, this.sfxGain, 1100);
        } else if (type === 'rocket') {
            // 火箭：锯齿波双音上扬
            this._osc('sawtooth', 330, t,        0.06, 0.38, this.sfxGain, 550);
            this._osc('sawtooth', 660, t + 0.05, 0.05, 0.22, this.sfxGain, 880);
            this._noise(t + 0.06, 0.03, 0.08, this.sfxGain, 1400);
        } else {
            // 导弹：厚重低频提示音+短噪声
            this._osc('square',   220, t,        0.08, 0.45, this.sfxGain, 330);
            this._osc('triangle', 440, t + 0.06, 0.06, 0.28, this.sfxGain, 550);
            this._noise(t, 0.04, 0.12, this.sfxGain, 300);
        }
    }

    // ============================================================
    //  音效：武器部署落地 — 重锤钉入感
    //  type: 'basic' / 'rocket' / 'missile'
    // ============================================================
    playDeploy(type) {
        if (!this.ctx) return;
        this.resume();
        const t = this.ctx.currentTime;
        if (type === 'basic') {
            // 岸炮：方波下压+短噪声，坚实"咣"
            this._osc('square', 300, t,        0.06, 0.5, this.sfxGain, 120);
            this._osc('square', 160, t + 0.04, 0.08, 0.35, this.sfxGain, 60);
            this._noise(t, 0.07, 0.25, this.sfxGain, 500);
        } else if (type === 'rocket') {
            // 火箭：锯齿下压+中频噪声
            this._osc('sawtooth', 200, t,        0.08, 0.5, this.sfxGain, 70);
            this._osc('sawtooth', 400, t + 0.02, 0.06, 0.28, this.sfxGain, 100);
            this._noise(t, 0.1, 0.3, this.sfxGain, 700);
        } else {
            // 导弹：厚重三层轰然落地
            this._osc('sawtooth', 100, t,        0.12, 0.55, this.sfxGain, 30);
            this._osc('square',   200, t,        0.10, 0.38, this.sfxGain, 50);
            this._osc('square',   400, t + 0.03, 0.07, 0.22, this.sfxGain, 80);
            this._noise(t, 0.15, 0.45, this.sfxGain, 300);
        }
    }

    // ============================================================
    //  背景音乐：欢快8位曲子
    //  曲调：C大调，4/4拍，120BPM，双声部（旋律+节奏底音）
    // ============================================================
    startBGM() {
        if (!this.ctx || this.bgPlaying) return;
        this.resume();
        this.bgPlaying = true;
        this._scheduleBGM();
    }

    stopBGM() {
        this.bgPlaying = false;
        // 渐出后清零
        if (this.bgGain) {
            const t = this.ctx.currentTime;
            this.bgGain.gain.linearRampToValueAtTime(0, t + 0.5);
            setTimeout(() => {
                if (this.bgGain) this.bgGain.gain.value = 0.28;
            }, 600);
        }
    }

    _scheduleBGM() {
        if (!this.ctx || !this.bgPlaying) return;

        const BPM    = 128;
        const beat   = 60 / BPM;          // 一拍时长(s)
        const now    = this.ctx.currentTime + 0.05;

        // ---- 旋律：C大调欢快短句，两小节循环 ----
        // 音符格式：[频率Hz, 拍数]
        const melody = [
            [523, 0.5],[659, 0.5],[784, 0.5],[880, 0.5],   // C5 E5 G5 A5
            [784, 0.5],[659, 0.5],[523, 0.5],[659, 0.5],   // G5 E5 C5 E5
            [784, 1.0],[523, 0.5],[659, 0.5],              // G5 C5 E5
            [784, 0.5],[880, 0.5],[1047,0.5],[880, 0.5],   // G5 A5 C6 A5
            [784, 0.5],[659, 1.0],[523, 0.5],              // G5 E5 C5
            [659, 0.5],[784, 0.5],[659, 0.5],[523, 0.5],   // E5 G5 E5 C5
            [392, 1.0],[0,   1.0],                         // G4 休止
        ];

        // ---- 低音节奏：四分音符跳动 ----
        const bass = [
            [131,0.5],[165,0.5], [131,0.5],[196,0.5],
            [131,0.5],[165,0.5], [131,0.5],[196,0.5],
            [131,0.5],[165,0.5], [131,0.5],[196,0.5],
            [131,0.5],[165,0.5], [131,0.5],[196,0.5],
            [110,0.5],[131,0.5], [110,0.5],[165,0.5],
            [110,0.5],[131,0.5], [110,0.5],[165,0.5],
            [131,0.5],[165,0.5], [131,0.5],[196,0.5],
        ];

        // ---- 鼓点：每拍一个短噪声咔哒 ----
        let totalBeats = 0;
        melody.forEach(n => totalBeats += n[1]);

        // 播放旋律
        let t = now;
        melody.forEach(([freq, dur]) => {
            if (freq > 0) {
                this._osc('square', freq, t, dur * beat * 0.85, 0.6, this.bgGain);
            }
            t += dur * beat;
        });

        // 播放低音
        t = now;
        bass.forEach(([freq, dur]) => {
            this._osc('triangle', freq, t, dur * beat * 0.7, 0.5, this.bgGain);
            t += dur * beat;
        });

        // 鼓点（每半拍一个噪声咔哒）
        const totalDur = totalBeats * beat;
        for (let i = 0; i < totalBeats * 2; i++) {
            const nt = now + i * beat * 0.5;
            if (nt < now + totalDur) {
                const isStrong = (i % 4 === 0); // 强拍用低频滚奏
                this._noise(nt, 0.04, isStrong ? 0.18 : 0.08, this.bgGain, isStrong ? 180 : 600);
            }
        }

        // 循环：在这段旋律结束前0.1s重新调度
        const loopDelay = (totalDur - 0.1) * 1000;
        this._bgTimer = setTimeout(() => this._scheduleBGM(), loopDelay);
    }
}


// ============================================================
//  主游戏类
// ============================================================
class TowerDefenseGame {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx    = this.canvas.getContext('2d');
        this.audio  = new AudioEngine();

        this.gameState = 'idle';
        this.score  = 0;
        this.gold   = 100;
        this.health = 100;
        this.level  = 1;
        this.wave   = 0;
        this.enemies     = [];
        this.towers      = [];
        this.projectiles = [];
        this.drag        = null;   // 当前拖拽状态 { type, cost, x, y, active }
        this.gameTime    = 0;
        this.waveSpawning = false;
        this._insufficientGoldFlash = 0; // 金币不足提示计时

        this.config = {
            cellSize: 40,
            mapWidth: 20,
            mapHeight: 15,
            enemySpawnInterval: 2500,
            waveSize: 10,
            basePosition: { x: 19, y: 7 }
        };

        this.gameMap = this.generateMap();
        this.initializeEventListeners();
        this.gameLoop();
    }

    // ---- 地图生成 ----
    generateMap() {
        const map = Array(this.config.mapHeight).fill().map(() =>
            Array(this.config.mapWidth).fill(0));
        const path = [
            { x: 0,  y: 7 },
            { x: 5,  y: 7 },
            { x: 10, y: 7 },
            { x: 15, y: 7 },
            { x: 19, y: 7 }
        ];
        // 填充连续路径
        for (let i = 0; i < path.length - 1; i++) {
            const a = path[i], b = path[i + 1];
            for (let x = Math.min(a.x, b.x); x <= Math.max(a.x, b.x); x++)
                map[a.y][x] = 1;
        }
        map[7][0]  = 2; // 起点：高雄
        map[7][19] = 3; // 终点：台北
        return map;
    }

    // ---- 事件监听 ----
    initializeEventListeners() {
        document.getElementById('start-btn').addEventListener('click',   () => this.startGame());
        document.getElementById('pause-btn').addEventListener('click',   () => this.togglePause());
        document.getElementById('restart-btn').addEventListener('click', () => this.restartGame());

        // ---- 拖拽系统 ----
        // 从武器面板 mousedown 开始拖拽
        document.querySelectorAll('.tower-item').forEach(item => {
            item.addEventListener('mousedown', e => {
                const type = e.currentTarget.dataset.type;
                const cost = parseInt(e.currentTarget.dataset.cost);
                this._startDrag(type, cost, e);
            });
            // 阻止默认拖拽行为（浏览器图标拖拽）
            item.addEventListener('dragstart', e => e.preventDefault());
        });

        // 鼠标在整个 document 上移动，保证离开面板后仍然跟随
        document.addEventListener('mousemove', e => this._onDragMove(e));
        document.addEventListener('mouseup',   e => this._onDragUp(e));

        document.getElementById('close-overlay').addEventListener('click', () => this.hideOverlay());
    }

    // ---- 拖拽：开始 ----
    _startDrag(type, cost, e) {
        this.audio.resume();
        if (this.gameState !== 'playing' && this.gameState !== 'between_waves') return;
        if (this.gold < cost) {
            // 金币不足时轻微抖动提示，不弹窗
            this._insufficientGoldFlash = 40;
            return;
        }
        this.drag = { type, cost, x: e.clientX, y: e.clientY, active: true };
        this.audio.playPickup(type);   // 选取音效
        document.body.style.cursor = 'grabbing';
        e.preventDefault();
    }

    // ---- 拖拽：移动 ----
    _onDragMove(e) {
        if (!this.drag || !this.drag.active) return;
        this.drag.x = e.clientX;
        this.drag.y = e.clientY;
    }

    // ---- 拖拽：松手放置 ----
    _onDragUp(e) {
        if (!this.drag || !this.drag.active) return;
        document.body.style.cursor = '';
        const rect = this.canvas.getBoundingClientRect();
        const cx   = e.clientX - rect.left;
        const cy   = e.clientY - rect.top;
        // 只有松手位置在 canvas 内才尝试放置
        if (cx >= 0 && cy >= 0 && cx <= this.canvas.width && cy <= this.canvas.height) {
            this._tryPlaceTower(cx, cy, this.drag.type, this.drag.cost);
        }
        this.drag = null;
    }

    // ---- 尝试放置防御塔 ----
    _tryPlaceTower(x, y, type, cost) {
        const gx = Math.floor(x / this.config.cellSize);
        const gy = Math.floor(y / this.config.cellSize);
        if (gx >= 0 && gx < this.config.mapWidth &&
            gy >= 0 && gy < this.config.mapHeight &&
            this.gameMap[gy][gx] === 0) {
            // 检查是否已有炮台
            const occupied = this.towers.some(t =>
                Math.floor(t.x / this.config.cellSize) === gx &&
                Math.floor(t.y / this.config.cellSize) === gy
            );
            if (occupied) return;
            this.gold -= cost;
            this.towers.push({
                type,
                x:        gx * this.config.cellSize + this.config.cellSize / 2,
                y:        gy * this.config.cellSize + this.config.cellSize / 2,
                range:    this.getTowerRange(type),
                damage:   this.getTowerDamage(type),
                fireRate: this.getTowerFireRate(type),
                lastFire: 0,
                deployAnim: 20  // 部署动画帧数（缩放弹出）
            });
            this.audio.playDeploy(type); // 部署落地音效
            this.updateUI();
        }
    }

    // ---- 游戏控制 ----
    startGame() {
        this.audio.resume();
        this.gameState = 'playing';
        this.audio.startBGM();
        this.showOverlay('游戏开始', '保卫台湾同胞，从南到北解放城市！');
        this.startWave();
    }

    togglePause() {
        if (this.gameState === 'playing' || this.gameState === 'between_waves') {
            this.gameState = 'paused';
            this.audio.stopBGM();
            this.showOverlay('游戏暂停', '点击确定继续游戏');
        } else if (this.gameState === 'paused') {
            this.gameState = 'playing';
            this.audio.startBGM();
            this.hideOverlay();
        }
    }

    restartGame() {
        this.audio.stopBGM();
        this.gameState    = 'idle';
        this.score        = 0;
        this.gold         = 100;
        this.health       = 100;
        this.level        = 1;
        this.wave         = 0;
        this.enemies      = [];
        this.towers       = [];
        this.projectiles  = [];
        this.gameTime     = 0;
        this.waveSpawning = false;
        this.drag         = null;
        document.body.style.cursor = '';
        this.hideOverlay();
        this.updateUI();
    }

    getTowerRange(type)    { return { basic: 150, rocket: 200, missile: 280 }[type] || 150; }
    getTowerDamage(type)   { return { basic: 20,  rocket: 40,  missile: 80  }[type] || 20;  }
    getTowerFireRate(type) { return { basic: 600, rocket: 900, missile: 1200}[type] || 600; }

    // ---- 波次 ----
    startWave() {
        this.wave++;
        this.waveSpawning = true;
        let count = 0;
        const spawn = () => {
            if (count < this.config.waveSize && this.gameState === 'playing') {
                this.spawnEnemy();
                count++;
                setTimeout(spawn, this.config.enemySpawnInterval);
            } else {
                this.waveSpawning = false;
            }
        };
        spawn();
    }

    spawnEnemy() {
        const types = ['infantry', 'tank', 'boss'];
        const type  = types[Math.min(this.wave - 1, 2)];
        this.enemies.push({
            type,
            x:         20,
            y:         7 * this.config.cellSize + this.config.cellSize / 2,
            health:    this.getEnemyHealth(type),
            maxHealth: this.getEnemyHealth(type),
            speed:     this.getEnemySpeed(type),
            pathIndex: 0,
            path:      this.getEnemyPath(),
            hitFlash:  0   // 受击闪白计时
        });
    }

    getEnemyHealth(type) { return { infantry: 30, tank: 70, boss: 180 }[type] || 30; }
    getEnemySpeed(type)  { return { infantry: 1,  tank: 0.7, boss: 0.5 }[type] || 1;  }

    getEnemyPath() {
        return [
            { x: 0,  y: 7 },
            { x: 5,  y: 7 },
            { x: 10, y: 7 },
            { x: 15, y: 7 },
            { x: 19, y: 7 }
        ];
    }

    // ---- 更新逻辑 ----
    updateEnemies(dt) {
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            if (e.hitFlash > 0) e.hitFlash -= dt;

            if (e.pathIndex < e.path.length - 1) {
                const tgt  = e.path[e.pathIndex + 1];
                const tx   = tgt.x * this.config.cellSize + this.config.cellSize / 2;
                const ty   = tgt.y * this.config.cellSize + this.config.cellSize / 2;
                const dx   = tx - e.x, dy = ty - e.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < e.speed) { e.pathIndex++; }
                else { e.x += (dx / dist) * e.speed; e.y += (dy / dist) * e.speed; }
            } else {
                // 到达终点
                this.health -= 10;
                this.audio.playPlayerHurt();
                this.enemies.splice(i, 1);
                if (this.health <= 0) { this.health = 0; this.gameOver(); }
            }
        }
    }

    updateTowers(dt) {
        this.towers.forEach(tower => {
            tower.lastFire += dt;
            if (tower.lastFire >= tower.fireRate) {
                const target = this.findTarget(tower);
                if (target) {
                    this.fireProjectile(tower, target);
                    // ---- 发射音效，精确在发射瞬间触发 ----
                    if (tower.type === 'basic')   this.audio.playBasicShot();
                    if (tower.type === 'rocket')  this.audio.playRocketShot();
                    if (tower.type === 'missile') this.audio.playMissileShot();
                    tower.lastFire = 0;
                }
            }
        });
    }

    findTarget(tower) {
        let best = null, bestDist = Infinity;
        for (const e of this.enemies) {
            const dx = e.x - tower.x, dy = e.y - tower.y;
            const d  = Math.sqrt(dx * dx + dy * dy);
            if (d <= tower.range && d < bestDist) { best = e; bestDist = d; }
        }
        return best;
    }

    fireProjectile(tower, target) {
        this.projectiles.push({
            x: tower.x, y: tower.y,
            target,
            damage:    tower.damage,
            speed:     tower.type === 'missile' ? 4 : tower.type === 'rocket' ? 5 : 7,
            towerType: tower.type
        });
    }

    updateProjectiles() {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p  = this.projectiles[i];
            const dx = p.target.x - p.x, dy = p.target.y - p.y;
            const d  = Math.sqrt(dx * dx + dy * dy);

            if (d < p.speed) {
                // ---- 命中：触发受击音效，精确在弹丸到达时触发 ----
                p.target.health -= p.damage;
                p.target.hitFlash = 80; // 受击闪白 80ms

                if (p.target.health > 0) {
                    // 受击但未死亡
                    if (p.target.type === 'boss')     this.audio.playBossHit();
                    else if (p.target.type === 'tank') this.audio.playTankHit();
                    else                               this.audio.playInfantryHit();
                } else {
                    // 死亡
                    this.audio.playEnemyDead();
                    const idx = this.enemies.indexOf(p.target);
                    if (idx > -1) {
                        this.enemies.splice(idx, 1);
                        this.gold  += p.target.type === 'boss' ? 30 : p.target.type === 'tank' ? 15 : 10;
                        this.score += p.target.type === 'boss' ? 50 : p.target.type === 'tank' ? 25 : 10;
                    }
                }
                this.projectiles.splice(i, 1);
            } else {
                p.x += (dx / d) * p.speed;
                p.y += (dy / d) * p.speed;
            }
        }
    }

    checkWaveCompletion() {
        if (!this.waveSpawning && this.enemies.length === 0 && this.gameState === 'playing') {
            this.level++;
            this.gold += 50;
            this.updateUI();
            if (this.level <= 5) {
                this.gameState = 'between_waves';
                setTimeout(() => {
                    if (this.gameState === 'between_waves') {
                        this.gameState = 'playing';
                        this.startWave();
                    }
                }, 3000);
            } else {
                this.victory();
            }
        }
    }

    gameOver() {
        this.gameState = 'gameover';
        this.audio.stopBGM();
        this.audio.playGameOver();
        this.showOverlay('游戏结束', `最终得分: ${this.score}\n台湾同胞需要你的保护！`);
    }

    victory() {
        this.gameState = 'victory';
        this.audio.stopBGM();
        this.audio.playVictory();
        this.showOverlay('胜利！', `恭喜！成功解放台湾！\n最终得分: ${this.score}`);
    }

    showOverlay(title, msg) {
        document.getElementById('overlay-title').textContent   = title;
        document.getElementById('overlay-message').textContent = msg;
        document.getElementById('game-overlay').classList.remove('hidden');
    }
    hideOverlay() { document.getElementById('game-overlay').classList.add('hidden'); }

    updateUI() {
        document.getElementById('gold').textContent   = this.gold;
        document.getElementById('health').textContent = Math.max(0, this.health);
        document.getElementById('level').textContent  = this.level;
    }

    // ---- 渲染 ----
    render() {
        this.ctx.fillStyle = '#2c3e50';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.renderMap();
        this.renderEnemies();
        this.renderTowers();
        this.renderProjectiles();
        this.renderDragPreview();   // 拖拽跟随预览
        this.renderUI();
    }

    renderMap() {
        const { cellSize, mapWidth, mapHeight } = this.config;
        for (let y = 0; y < mapHeight; y++) {
            for (let x = 0; x < mapWidth; x++) {
                const cx = x * cellSize, cy = y * cellSize;
                const v  = this.gameMap[y][x];
                if (v === 0) {
                    this.ctx.fillStyle = '#34495e';
                    this.ctx.fillRect(cx, cy, cellSize, cellSize);
                    this.ctx.strokeStyle = '#2c3e50';
                    this.ctx.strokeRect(cx, cy, cellSize, cellSize);
                } else if (v === 1) {
                    // 路径加纹理
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
        // 标注中间城市
        const cities = [
            { x: 5, label: '台中' }, { x: 10, label: '新竹' }, { x: 15, label: '桃园' }
        ];
        cities.forEach(c => {
            this.ctx.fillStyle = 'rgba(255,255,255,0.6)';
            this.ctx.font = '10px Arial';
            this.ctx.fillText(c.label, c.x * cellSize + 4, 7 * cellSize + 14);
        });
    }

    renderEnemies() {
        this.enemies.forEach(e => {
            const r = e.type === 'boss' ? 18 : e.type === 'tank' ? 14 : 11;
            // 受击闪白效果
            this.ctx.fillStyle = e.hitFlash > 0 ? 'white' : this.getEnemyColor(e.type);
            this.ctx.beginPath();
            this.ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
            this.ctx.fill();
            // 描边
            this.ctx.strokeStyle = 'rgba(0,0,0,0.5)';
            this.ctx.lineWidth = 1.5;
            this.ctx.stroke();
            this.ctx.lineWidth = 1;
            // 血条背景
            this.ctx.fillStyle = '#e74c3c';
            this.ctx.fillRect(e.x - r, e.y - r - 8, r * 2, 5);
            // 血条
            const pct = Math.max(0, e.health / e.maxHealth);
            this.ctx.fillStyle = pct > 0.5 ? '#2ecc71' : pct > 0.25 ? '#f39c12' : '#e74c3c';
            this.ctx.fillRect(e.x - r, e.y - r - 8, r * 2 * pct, 5);
            // 文字
            this.ctx.fillStyle = 'white';
            this.ctx.font = `bold ${e.type === 'boss' ? 10 : 9}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.fillText(this.getEnemyText(e.type), e.x, e.y + 4);
            this.ctx.textAlign = 'left';
        });
    }

    getEnemyColor(type) { return { infantry: '#e74c3c', tank: '#e67e22', boss: '#8e44ad' }[type] || '#e74c3c'; }
    getEnemyText(type)  { return { infantry: '蛙', tank: '坦克', boss: 'BOSS' }[type] || '蛙'; }

    renderTowers() {
        this.towers.forEach(tower => {
            // 部署动画：deployAnim 帧数递减，影响缩放
            if (tower.deployAnim > 0) tower.deployAnim--;
            const scale = tower.deployAnim > 0
                ? 1 + tower.deployAnim * 0.04   // 0~20帧弹出放大后缩回
                : 1;

            // 拖拽中或 between_waves 时显示已放置塔的射程
            if (this.drag && this.drag.active) {
                this.ctx.strokeStyle = 'rgba(255,255,255,0.12)';
                this.ctx.lineWidth = 1;
                this.ctx.beginPath();
                this.ctx.arc(tower.x, tower.y, tower.range, 0, Math.PI * 2);
                this.ctx.stroke();
                this.ctx.lineWidth = 1;
            }

            this.ctx.save();
            this.ctx.translate(tower.x, tower.y);
            this.ctx.scale(scale, scale);

            // 底座
            this.ctx.fillStyle = '#2c3e50';
            this.ctx.beginPath();
            this.ctx.arc(0, 0, 14, 0, Math.PI * 2);
            this.ctx.fill();
            // 主体
            this.ctx.fillStyle = this.getTowerColor(tower.type);
            this.ctx.beginPath();
            this.ctx.arc(0, 0, 11, 0, Math.PI * 2);
            this.ctx.fill();
            // 外圈高亮（部署瞬间发光）
            if (tower.deployAnim > 10) {
                this.ctx.strokeStyle = 'rgba(255,255,255,' + (tower.deployAnim / 20 * 0.8) + ')';
                this.ctx.lineWidth = 3;
                this.ctx.beginPath();
                this.ctx.arc(0, 0, 14, 0, Math.PI * 2);
                this.ctx.stroke();
                this.ctx.lineWidth = 1;
            }
            // 炮管
            this.ctx.strokeStyle = '#ecf0f1';
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            this.ctx.moveTo(0, 0);
            this.ctx.lineTo(tower.type === 'missile' ? 0 : 14, -10);
            this.ctx.stroke();
            this.ctx.lineWidth = 1;
            // 标签
            this.ctx.fillStyle = 'white';
            this.ctx.font = '9px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(this.getTowerText(tower.type), 0, 4);
            this.ctx.textAlign = 'left';

            this.ctx.restore();
        });
    }

    getTowerColor(type) { return { basic: '#3498db', rocket: '#e67e22', missile: '#9b59b6' }[type] || '#3498db'; }
    getTowerText(type)  { return { basic: '炮', rocket: '箭', missile: '弹' }[type] || '塔'; }

    renderProjectiles() {
        this.projectiles.forEach(p => {
            const colors = { basic: '#f1c40f', rocket: '#e74c3c', missile: '#9b59b6' };
            const sizes  = { basic: 3, rocket: 4, missile: 5 };
            this.ctx.fillStyle = colors[p.towerType] || '#f1c40f';
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, sizes[p.towerType] || 3, 0, Math.PI * 2);
            this.ctx.fill();
        });
    }

    renderUI() {
        // 波次提示
        this.ctx.fillStyle = 'rgba(0,0,0,0.45)';
        this.ctx.fillRect(4, 4, 130, 48);
        this.ctx.fillStyle = '#f1c40f';
        this.ctx.font = 'bold 14px Arial';
        this.ctx.fillText(`得分: ${this.score}`, 10, 20);
        this.ctx.fillStyle = 'white';
        this.ctx.font = '13px Arial';
        this.ctx.fillText(`第 ${this.wave} 波`, 10, 38);

        // 间隔提示
        if (this.gameState === 'between_waves') {
            this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
            this.ctx.fillRect(this.canvas.width / 2 - 100, 10, 200, 30);
            this.ctx.fillStyle = '#2ecc71';
            this.ctx.font = 'bold 14px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('下一波即将到来...', this.canvas.width / 2, 30);
            this.ctx.textAlign = 'left';
        }

        // 金币不足闪烁提示
        if (this._insufficientGoldFlash > 0) {
            this._insufficientGoldFlash--;
            this.ctx.save();
            this.ctx.globalAlpha = this._insufficientGoldFlash / 40;
            this.ctx.fillStyle = '#e74c3c';
            this.ctx.fillRect(this.canvas.width / 2 - 80, this.canvas.height / 2 - 20, 160, 36);
            this.ctx.fillStyle = 'white';
            this.ctx.font = 'bold 14px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('金币不足！', this.canvas.width / 2, this.canvas.height / 2 + 4);
            this.ctx.textAlign = 'left';
            this.ctx.restore();
        }
    }

    // ---- 拖拽预览：鼠标跟随 ----
    renderDragPreview() {
        if (!this.drag || !this.drag.active) return;
        const rect = this.canvas.getBoundingClientRect();
        const mx   = this.drag.x - rect.left;
        const my   = this.drag.y - rect.top;

        // 鼠标在 canvas 外时不绘制
        if (mx < 0 || my < 0 || mx > this.canvas.width || my > this.canvas.height) return;

        const cs = this.config.cellSize;
        const gx = Math.floor(mx / cs);
        const gy = Math.floor(my / cs);

        // 目标格子高亮（区分可放置/不可放置）
        const canPlace = gx >= 0 && gx < this.config.mapWidth &&
                         gy >= 0 && gy < this.config.mapHeight &&
                         this.gameMap[gy][gx] === 0 &&
                         !this.towers.some(t =>
                             Math.floor(t.x / cs) === gx && Math.floor(t.y / cs) === gy);

        this.ctx.save();
        // 格子底色
        this.ctx.fillStyle = canPlace ? 'rgba(46,204,113,0.25)' : 'rgba(231,76,60,0.25)';
        this.ctx.fillRect(gx * cs, gy * cs, cs, cs);
        this.ctx.strokeStyle = canPlace ? 'rgba(46,204,113,0.8)' : 'rgba(231,76,60,0.8)';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(gx * cs, gy * cs, cs, cs);
        this.ctx.lineWidth = 1;

        const cx = gx * cs + cs / 2;
        const cy = gy * cs + cs / 2;
        const range = this.getTowerRange(this.drag.type);

        // 射程预览圆
        this.ctx.strokeStyle = canPlace ? 'rgba(46,204,113,0.45)' : 'rgba(231,76,60,0.35)';
        this.ctx.lineWidth = 1.5;
        this.ctx.setLineDash([6, 4]);
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, range, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        this.ctx.lineWidth = 1;

        // 武器图标（半透明，跟随鼠标精确位置）
        this.ctx.globalAlpha = 0.82;
        this.ctx.translate(mx, my);

        // 底座
        this.ctx.fillStyle = '#2c3e50';
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 14, 0, Math.PI * 2);
        this.ctx.fill();
        // 主体
        this.ctx.fillStyle = this.getTowerColor(this.drag.type);
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 11, 0, Math.PI * 2);
        this.ctx.fill();
        // 炮管
        this.ctx.strokeStyle = '#ecf0f1';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.moveTo(0, 0);
        this.ctx.lineTo(this.drag.type === 'missile' ? 0 : 14, -10);
        this.ctx.stroke();
        this.ctx.lineWidth = 1;
        // 文字
        this.ctx.fillStyle = 'white';
        this.ctx.font = '9px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(this.getTowerText(this.drag.type), 0, 4);
        this.ctx.textAlign = 'left';

        this.ctx.restore();
    }

    // ---- 主循环 ----
    gameLoop() {
        const now = performance.now();
        const dt  = now - (this.lastTime || now);
        this.lastTime = now;

        if (this.gameState === 'playing') {
            this.gameTime += dt;
            this.updateEnemies(dt);
            this.updateTowers(dt);
            this.updateProjectiles();
            this.checkWaveCompletion();
        }

        this.render();
        this.updateUI();
        requestAnimationFrame(() => this.gameLoop());
    }
}

// 启动
document.addEventListener('DOMContentLoaded', () => { new TowerDefenseGame(); });
