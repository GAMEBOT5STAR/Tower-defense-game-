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
        this.level  = 1;
        this.wave   = 0;
        this.enemies     = [];
        this.towers      = [];
        this.projectiles = [];
        this.drag        = null;   // 当前拖拽状态 { type, cost, x, y, active }
        this.gameTime    = 0;
        
        // 波次生成系统（帧驱动）
        this.waveSpawning = false;
        this.spawnQueue = [];      // 生成队列 [{time, type}]
        this.spawnTimer = 0;
        this._waveRewarded = false;
        
        this._insufficientGoldFlash = 0; // 金币不足提示计时
        this._waveBannerUntil = 0;       // 波次Banner显示结束时间

        this.config = {
            cellSize: 40,
            mapWidth: 20,
            mapHeight: 15,
            basePosition: { x: 19, y: 7 }
        };

        // 武器升级配置
        this.towerUpgrades = {
            basic:   { level: 1, maxLevel: 3, damage: 20,  range: 150, fireRate: 600, cost: 20 },
            rocket:  { level: 1, maxLevel: 3, damage: 40,  range: 200, fireRate: 900, cost: 50 },
            missile: { level: 1, maxLevel: 3, damage: 80,  range: 280, fireRate: 1200, cost: 100 }
        };

        this.initializeEventListeners();
        // 标记游戏是否已准备好
        this._isReady = false;
        
        // 初始化关卡选择下拉框
        if (document.getElementById('level-select')) {
            document.getElementById('level-select').value = this.level;
        }
        
        // 等待关卡加载完成后再启动游戏循环
        (async () => {
            const success = await this.loadLevel(1);
            if (success) {
                this._isReady = true;
                this.gameLoop();
            } else {
                console.error('游戏初始化失败，无法启动游戏循环');
                this.showOverlay('错误', '无法加载关卡数据，请检查 levels.json 文件');
            }
        })();
    }

    // ---- 加载关卡 ----
    async loadLevel(levelId) {
        console.log('[loadLevel] 开始加载关卡:', levelId);
        console.log('[loadLevel] 当前页面URL:', window.location.href);
        
        try {
            // 尝试多种路径方式
            const baseUrl = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
            const jsonUrl = baseUrl + 'levels.json';
            console.log('[loadLevel] 尝试加载:', jsonUrl);
            
            const resp = await fetch(jsonUrl);
            console.log('[loadLevel] fetch 完成，状态:', resp.status, 'ok:', resp.ok);
            
            if (!resp.ok) {
                throw new Error(`HTTP error! status: ${resp.status}, url: ${jsonUrl}`);
            }
            
            const data = await resp.json();
            console.log('[loadLevel] JSON 解析完成，关卡数:', data.levels?.length);
            
            if (!data.levels || !Array.isArray(data.levels)) {
                throw new Error('levels.json 格式错误：levels 字段不存在或不是数组');
            }
            
            this.levels = data.levels;
            this.currentLevel = this.levels.find(l => l.id === levelId);
            
            if (!this.currentLevel) {
                throw new Error(`关卡 ${levelId} 不存在，可用关卡: ${this.levels.map(l => l.id).join(', ')}`);
            }
            
            // 验证关卡数据完整性
            if (!this.currentLevel.map || !this.currentLevel.map.path) {
                throw new Error(`关卡 ${levelId} 数据不完整：缺少 map.path`);
            }
            
            // 应用关卡配置
            this.level = levelId;
            this.gold = this.currentLevel.startingGold;
            this.health = this.currentLevel.startingHealth;
            this.gameMap = this.generateMapFromPath(this.currentLevel.map.path);
            
            console.log('[loadLevel] 关卡加载成功:', this.currentLevel.name);
            console.log('[loadLevel] gameMap 尺寸:', this.gameMap?.length, 'x', this.gameMap?.[0]?.length);
            return true;
        } catch (e) {
            console.error('[loadLevel] 加载关卡失败:', e);
            console.error('[loadLevel] 错误详情:', e.message);
            
            // 使用内置的默认关卡数据作为备用
            console.log('[loadLevel] 使用内置默认关卡数据');
            return this._loadDefaultLevel(levelId);
        }
    }
    
    // 内置默认关卡数据（备用方案）
    _loadDefaultLevel(levelId) {
        console.log('[_loadDefaultLevel] 加载内置关卡:', levelId);
        
        const defaultLevels = [
            {
                id: 1,
                name: "高雄战役",
                description: "解放台湾南部，保卫高雄同胞",
                startingGold: 120,
                startingHealth: 100,
                enemyWaves: 3,
                enemiesPerWave: 6,
                enemyTypes: ["infantry"],
                spawnInterval: 2500,
                reward: 40,
                map: {
                    start: {x: 0, y: 7},
                    end: {x: 19, y: 7},
                    startLabel: "高雄",
                    endLabel: "台北",
                    path: [
                        {x: 0, y: 7},
                        {x: 5, y: 7},
                        {x: 10, y: 7},
                        {x: 15, y: 7},
                        {x: 19, y: 7}
                    ]
                }
            },
            {
                id: 2,
                name: "台中防线",
                description: "突破台中防线，向北推进",
                startingGold: 150,
                startingHealth: 100,
                enemyWaves: 4,
                enemiesPerWave: 7,
                enemyTypes: ["infantry", "tank"],
                spawnInterval: 2200,
                reward: 50,
                map: {
                    start: {x: 0, y: 3},
                    end: {x: 19, y: 11},
                    startLabel: "台中",
                    endLabel: "台北",
                    path: [
                        {x: 0, y: 3},
                        {x: 6, y: 3},
                        {x: 6, y: 11},
                        {x: 13, y: 11},
                        {x: 13, y: 3},
                        {x: 19, y: 3},
                        {x: 19, y: 11}
                    ]
                }
            },
            {
                id: 3,
                name: "新竹保卫战",
                description: "攻克新竹科技重镇",
                startingGold: 180,
                startingHealth: 100,
                enemyWaves: 4,
                enemiesPerWave: 8,
                enemyTypes: ["infantry", "tank"],
                spawnInterval: 2000,
                reward: 55,
                map: {
                    start: {x: 0, y: 7},
                    end: {x: 19, y: 7},
                    startLabel: "新竹",
                    endLabel: "台北",
                    path: [
                        {x: 0, y: 7},
                        {x: 4, y: 7},
                        {x: 4, y: 2},
                        {x: 10, y: 2},
                        {x: 10, y: 12},
                        {x: 16, y: 12},
                        {x: 16, y: 7},
                        {x: 19, y: 7}
                    ]
                }
            },
            {
                id: 4,
                name: "桃园攻坚战",
                description: "拿下桃园，直逼台北",
                startingGold: 200,
                startingHealth: 100,
                enemyWaves: 5,
                enemiesPerWave: 8,
                enemyTypes: ["infantry", "tank", "boss"],
                spawnInterval: 2000,
                reward: 60,
                map: {
                    start: {x: 0, y: 1},
                    end: {x: 19, y: 13},
                    startLabel: "桃园",
                    endLabel: "台北",
                    path: [
                        {x: 0, y: 1},
                        {x: 8, y: 1},
                        {x: 8, y: 7},
                        {x: 2, y: 7},
                        {x: 2, y: 13},
                        {x: 12, y: 13},
                        {x: 12, y: 7},
                        {x: 19, y: 7},
                        {x: 19, y: 13}
                    ]
                }
            },
            {
                id: 5,
                name: "台北决战",
                description: "最终决战，解放台湾首府！",
                startingGold: 250,
                startingHealth: 100,
                enemyWaves: 5,
                enemiesPerWave: 10,
                enemyTypes: ["tank", "boss"],
                spawnInterval: 1800,
                reward: 80,
                map: {
                    start: {x: 0, y: 7},
                    end: {x: 19, y: 7},
                    startLabel: "台北",
                    endLabel: "总统府",
                    path: [
                        {x: 0, y: 7},
                        {x: 3, y: 7},
                        {x: 3, y: 1},
                        {x: 9, y: 1},
                        {x: 9, y: 13},
                        {x: 15, y: 13},
                        {x: 15, y: 1},
                        {x: 19, y: 1},
                        {x: 19, y: 7}
                    ]
                }
            }
        ];
        
        this.levels = defaultLevels;
        this.currentLevel = defaultLevels.find(l => l.id === levelId);
        
        if (!this.currentLevel) {
            console.error('[_loadDefaultLevel] 默认关卡也不存在:', levelId);
            // 找不到时回退到第1关
            this.currentLevel = defaultLevels[0];
            levelId = 1;
        }
        
        this.level = levelId;
        this.gold = this.currentLevel.startingGold;
        this.health = this.currentLevel.startingHealth;
        this.gameMap = this.generateMapFromPath(this.currentLevel.map.path);
        
        console.log('[_loadDefaultLevel] 内置关卡加载成功:', this.currentLevel.name);
        return true;
    }

    // ---- 生成90度曲折地图 ----
    generateMapFromPath(pathPoints) {
        console.log('[generateMapFromPath] 开始生成地图，路径点:', pathPoints);
        
        // 使用正确的方式创建二维数组
        const map = [];
        for (let y = 0; y < this.config.mapHeight; y++) {
            map[y] = [];
            for (let x = 0; x < this.config.mapWidth; x++) {
                map[y][x] = 0;
            }
        }
        
        console.log('[generateMapFromPath] 初始地图创建完成:', map.length, '行', map[0]?.length || 0, '列');
        
        // 填充连续路径（90度曲折）
        for (let i = 0; i < pathPoints.length - 1; i++) {
            const a = pathPoints[i], b = pathPoints[i + 1];
            
            if (a.x === b.x) { // 垂直移动
                const yMin = Math.min(a.y, b.y);
                const yMax = Math.max(a.y, b.y);
                for (let y = yMin; y <= yMax; y++) {
                    if (map[y] && map[y][a.x] !== undefined) {
                        map[y][a.x] = 1;
                    }
                }
            } else if (a.y === b.y) { // 水平移动
                const xMin = Math.min(a.x, b.x);
                const xMax = Math.max(a.x, b.x);
                for (let x = xMin; x <= xMax; x++) {
                    if (map[a.y] && map[a.y][x] !== undefined) {
                        map[a.y][x] = 1;
                    }
                }
            }
        }
        
        // 标记起点和终点
        const start = pathPoints[0];
        const end = pathPoints[pathPoints.length - 1];
        if (start && map[start.y] && map[start.y][start.x] !== undefined) {
            map[start.y][start.x] = 2;
        }
        if (end && map[end.y] && map[end.y][end.x] !== undefined) {
            map[end.y][end.x] = 3;
        }
        
        console.log('[generateMapFromPath] 地图生成完成');
        return map;
    }

    // ---- 事件监听 ----
    initializeEventListeners() {
        document.getElementById('start-btn').addEventListener('click',   async () => await this.startGame());
        document.getElementById('pause-btn').addEventListener('click',   () => this.togglePause());
        document.getElementById('restart-btn').addEventListener('click', async () => await this.restartGame());
        
        // 关卡选择
        document.getElementById('load-level-btn').addEventListener('click', async () => {
            const levelId = parseInt(document.getElementById('level-select').value);
            await this.loadSpecificLevel(levelId);
        });

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
            const existing = this.towers.find(t =>
                Math.floor(t.x / this.config.cellSize) === gx &&
                Math.floor(t.y / this.config.cellSize) === gy
            );
            
            if (existing) {
                // 尝试升级现有塔
                this._tryUpgradeTower(existing);
                return;
            }
            
            // 放置新塔
            if (this.gold < cost) {
                this._insufficientGoldFlash = 40;
                return;
            }
            
            this.gold -= cost;
            const baseStats = this.towerUpgrades[type];
            this.towers.push({
                type,
                level: 1,
                x: gx * this.config.cellSize + this.config.cellSize / 2,
                y: gy * this.config.cellSize + this.config.cellSize / 2,
                range: baseStats.range,
                damage: baseStats.damage,
                fireRate: baseStats.fireRate,
                lastFire: 0,
                deployAnim: 20
            });
            this.audio.playDeploy(type);
            this.updateUI();
        }
    }

    // ---- 尝试升级防御塔 ----
    _tryUpgradeTower(tower) {
        const upgrade = this.towerUpgrades[tower.type];
        if (tower.level >= upgrade.maxLevel) {
            this.showOverlay('升级提示', `${this.getTowerDisplayName(tower.type)} 已达到最高等级！`);
            return;
        }
        
        const upgradeCost = Math.floor(upgrade.cost * tower.level * 1.5);
        if (this.gold < upgradeCost) {
            this._insufficientGoldFlash = 40;
            return;
        }
        
        this.gold -= upgradeCost;
        tower.level++;
        tower.damage = Math.floor(upgrade.damage * (1 + tower.level * 0.4));
        tower.range = Math.floor(upgrade.range * (1 + tower.level * 0.15));
        tower.fireRate = Math.floor(upgrade.fireRate * (1 - tower.level * 0.1));
        
        // 升级特效
        tower.deployAnim = 15;
        this.audio.playDeploy(tower.type);
        
        this.showOverlay('升级成功', `${this.getTowerDisplayName(tower.type)} 升级到 Lv.${tower.level}\n花费: ${upgradeCost} 金币`);
        this.updateUI();
    }

    getTowerDisplayName(type) {
        return { basic: '岸炮', rocket: '火箭', missile: '导弹' }[type] || '塔';
    }

    // 获取升级费用
    getUpgradeCost(tower) {
        const base = this.towerUpgrades[tower.type];
        return Math.floor(base.cost * tower.level * 1.5);
    }

    // ---- 游戏控制 ----
    async startGame() {
        console.log('[startGame] 开始，当前状态:', this.gameState, 'wave:', this.wave);
        if (this.gameState !== 'idle' && this.gameState !== 'between_waves') {
            console.log('[startGame] 状态不正确，返回');
            return;
        }
        
        // 确保关卡已加载
        if (!this.currentLevel) {
            console.log('[startGame] 关卡未加载，开始加载');
            await this.loadLevel(this.level || 1);
        }
        
        console.log('[startGame] 关卡已加载:', this.currentLevel?.name);
        
        this.audio.resume();
        this.audio.startBGM();
        this.hideOverlay();
        
        // 开始新波次
        console.log('[startGame] 调用 startWave()');
        this.startWave();
        
        this.gameState = 'playing';
        console.log('[startGame] 完成，状态设置为 playing');
    }

    togglePause() {
        if (this.gameState === 'playing') {
            this.gameState = 'paused';
            this.audio.stopBGM();
            this.showOverlay('游戏暂停', '点击确定继续游戏');
        } else if (this.gameState === 'paused') {
            this.gameState = 'playing';
            this.audio.startBGM();
            this.hideOverlay();
        }
    }

    async restartGame() {
        this.audio.stopBGM();
        this.gameState    = 'idle';
        this.score        = 0;
        this.level        = 1;
        this.wave         = 0;
        this.enemies      = [];
        this.towers       = [];
        this.projectiles  = [];
        this.gameTime     = 0;
        this.waveSpawning = false;
        this.spawnQueue   = [];
        this.spawnTimer   = 0;
        this._waveRewarded = false;
        this.drag         = null;
        document.body.style.cursor = '';
        
        await this.loadLevel(1);
        this.hideOverlay();
        this.showOverlay('游戏开始', '保卫台湾同胞，从南到北解放城市！\n点击"开始游戏"按钮开始战斗');
    }
    
    // ---- 加载指定关卡 ----
    async loadSpecificLevel(levelId) {
        console.log('[loadSpecificLevel] 加载指定关卡:', levelId);
        
        // 重置游戏状态
        this.audio.stopBGM();
        this.gameState    = 'idle';
        this.wave         = 0;
        this.enemies      = [];
        this.towers       = [];
        this.projectiles  = [];
        this.gameTime     = 0;
        this.waveSpawning = false;
        this.spawnQueue   = [];
        this.spawnTimer   = 0;
        this._waveRewarded = false;
        this.drag         = null;
        document.body.style.cursor = '';
        
        // 加载指定关卡
        const success = await this.loadLevel(levelId);
        if (success) {
            this.level = levelId;
            this.hideOverlay();
            this.showOverlay('关卡已加载', `${this.currentLevel.name}\n点击"开始游戏"开始战斗`);
            this.updateUI();
        } else {
            this.showOverlay('错误', '无法加载指定关卡');
        }
    }

    getTowerRange(type, level = 1) { 
        const base = { basic: 150, rocket: 200, missile: 280 }[type] || 150;
        return Math.floor(base * (1 + (level - 1) * 0.15));
    }
    getTowerDamage(type, level = 1) { 
        const base = { basic: 20,  rocket: 40,  missile: 80  }[type] || 20;
        return Math.floor(base * (1 + (level - 1) * 0.4));
    }
    getTowerFireRate(type, level = 1) { 
        const base = { basic: 600, rocket: 900, missile: 1200}[type] || 600;
        return Math.floor(base * (1 - (level - 1) * 0.1));
    }

    // ---- 波次 ----
    startWave() {
        console.log('[startWave] 开始，currentLevel:', !!this.currentLevel, 'wave:', this.wave);
        if (!this.currentLevel) {
            console.error('[startWave] currentLevel 未定义，无法开始波次');
            return;
        }
        if (this.wave >= this.currentLevel.enemyWaves) {
            console.log('[startWave] 波次已完成，不开始新波次');
            return;
        }
        
        this.wave++;
        this.waveSpawning = true;
        this._waveRewarded = false;
        this.spawnTimer = 0;
        
        // 构建生成队列
        this.spawnQueue = [];
        const waveConfig = this.currentLevel;
        const interval = waveConfig.spawnInterval;
        
        console.log(`[startWave] 配置: ${waveConfig.enemiesPerWave} 个敌人，间隔 ${interval}ms`);
        
        for (let i = 0; i < waveConfig.enemiesPerWave; i++) {
            // 根据波次选择敌人类型
            const availableTypes = waveConfig.enemyTypes;
            const typeIndex = Math.min(this.wave - 1, availableTypes.length - 1);
            const type = availableTypes[typeIndex];
            
            this.spawnQueue.push({
                time: i * interval,
                type: type
            });
        }
        
        console.log(`[startWave] 生成队列已构建，共 ${this.spawnQueue.length} 个敌人`);
        
        // 显示波次Banner
        this._showWaveBanner();
        console.log(`[Wave ${this.wave}/${this.currentLevel.enemyWaves}] 开始生成`);
    }

    _showWaveBanner() {
        this._waveBannerUntil = performance.now() + 2500;
    }

    _spawnEnemy(type) {
        const start = this.currentLevel.map.start;
        this.enemies.push({
            type,
            x: start.x * this.config.cellSize + this.config.cellSize / 2,
            y: start.y * this.config.cellSize + this.config.cellSize / 2,
            health: this.getEnemyHealth(type),
            maxHealth: this.getEnemyHealth(type),
            speed: this.getEnemySpeed(type),
            pathIndex: 0,
            path: this.currentLevel.map.path,
            hitFlash: 0
        });
    }

    getEnemyHealth(type) { return { infantry: 30, tank: 70, boss: 180 }[type] || 30; }
    getEnemySpeed(type)  { return { infantry: 1,  tank: 0.7, boss: 0.5 }[type] || 1;  }

    // ---- 更新逻辑 ----
    updateEnemies(dt) {
        // 帧驱动的敌人生成
        if (this.waveSpawning && this.spawnQueue.length > 0) {
            this.spawnTimer += dt;
            while (this.spawnQueue.length > 0 && this.spawnTimer >= this.spawnQueue[0].time) {
                const entry = this.spawnQueue.shift();
                this._spawnEnemy(entry.type);
            }
            if (this.spawnQueue.length === 0) {
                this.waveSpawning = false;
                console.log(`[Wave ${this.wave}] 所有敌人已生成`);
            }
        }
        
        // 更新敌人位置
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
        if (!this.waveSpawning && this.enemies.length === 0 && this.gameState === 'playing' && !this._waveRewarded) {
            this._waveRewarded = true;
            
            // 波次奖励
            this.gold += this.currentLevel.reward;
            this.score += this.wave * 10;
            console.log(`[Wave ${this.wave}] 完成！奖励 ${this.currentLevel.reward} 金币`);
            
            if (this.wave >= this.currentLevel.enemyWaves) {
                // 最后一波完成 → 关卡完成
                this._onLevelComplete();
            } else {
                // 中间波次：静默自动进入下一波（不弹 overlay），2秒延迟
                this.gameState = 'between_waves';
                console.log(`[Wave ${this.wave}] 中间波次完成，2秒后自动开始下一波`);
                
                setTimeout(() => {
                    if (this.gameState === 'between_waves') {
                        this.startWave();
                        this.gameState = 'playing';
                    }
                }, 2000);
            }
            this.updateUI();
        }
    }

    async _onLevelComplete() {
        const totalLevels = this.levels ? this.levels.length : 1;
        
        if (this.level >= totalLevels) {
            // 所有关卡完成 → 胜利
            this.victory();
        } else {
            // 进入下一关
            const nextLevelId = this.level + 1;
            const nextLevelData = this.levels ? this.levels.find(l => l.id === nextLevelId) : null;
            const nextName = nextLevelData ? nextLevelData.name : `第 ${nextLevelId} 关`;
            
            this.gameState = 'between_waves'; // 防止 checkWaveCompletion 重复触发
            this.showOverlay('关卡完成！', `${this.currentLevel.name} 完成！\n3秒后自动进入下一关：${nextName}`);
            
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // 重置本关状态（保留得分和金币作为奖励）
            this.wave = 0;
            this.enemies = [];
            this.towers = [];
            this.projectiles = [];
            this.waveSpawning = false;
            this.spawnQueue = [];
            this.spawnTimer = 0;
            this._waveRewarded = false;
            
            // 加载下一关
            const success = await this.loadLevel(nextLevelId);
            
            if (!success) {
                this.showOverlay('错误', `无法加载关卡 ${nextLevelId}`);
                return;
            }
            
            // 更新关卡选择下拉框
            if (document.getElementById('level-select')) {
                document.getElementById('level-select').value = this.level;
            }
            
            // 1秒后自动开始下一关的第一波
            setTimeout(() => {
                this.hideOverlay();
                this.startWave();
                this.gameState = 'playing';
            }, 1000);
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
        document.getElementById('level').textContent  = this.currentLevel ? this.currentLevel.name : `关卡 ${this.level}`;
        
        // 更新关卡选择下拉框（确保与当前关卡同步）
        if (document.getElementById('level-select')) {
            document.getElementById('level-select').value = this.level;
        }
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
        
        if (!this.gameMap || !Array.isArray(this.gameMap) || this.gameMap.length === 0) {
            // 渲染一个错误提示
            this.ctx.fillStyle = 'rgba(231, 76, 60, 0.8)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.fillStyle = 'white';
            this.ctx.font = 'bold 20px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('地图加载失败', this.canvas.width / 2, this.canvas.height / 2 - 20);
            this.ctx.font = '16px Arial';
            this.ctx.fillText('请检查 levels.json 文件', this.canvas.width / 2, this.canvas.height / 2 + 20);
            this.ctx.textAlign = 'left';
            return;
        }
        
        for (let y = 0; y < mapHeight; y++) {
            for (let x = 0; x < mapWidth; x++) {
                const cx = x * cellSize, cy = y * cellSize;
                
                // 检查 gameMap[y][x] 是否存在
                if (!this.gameMap[y] || this.gameMap[y][x] === undefined) {
                    continue;
                }
                
                const v = this.gameMap[y][x];
                
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
                    const startLabel = (this.currentLevel && this.currentLevel.map.startLabel) || '起点';
                    this.ctx.fillText(startLabel, cx + 4, cy + 14);
                    this.ctx.fillText('起点', cx + 4, cy + 28);
                } else if (v === 3) {
                    this.ctx.fillStyle = '#27ae60';
                    this.ctx.fillRect(cx, cy, cellSize, cellSize);
                    this.ctx.fillStyle = 'white';
                    this.ctx.font = 'bold 11px Arial';
                    const endLabel = (this.currentLevel && this.currentLevel.map.endLabel) || '终点';
                    this.ctx.fillText(endLabel, cx + 4, cy + 14);
                    this.ctx.fillText('终点', cx + 4, cy + 28);
                }
            }
        }
        
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
            if (tower.deployAnim > 0) tower.deployAnim--;
            const scale = tower.deployAnim > 0 ? 1 + tower.deployAnim * 0.04 : 1;

            // 始终显示射程（拖拽时更明显）
            const showRange = this.drag && this.drag.active;
            if (showRange) {
                this.ctx.strokeStyle = 'rgba(255,255,255,0.18)';
                this.ctx.lineWidth = 1;
                this.ctx.beginPath();
                this.ctx.arc(tower.x, tower.y, tower.range, 0, Math.PI * 2);
                this.ctx.stroke();
                this.ctx.lineWidth = 1;
            }

            this.ctx.save();
            this.ctx.translate(tower.x, tower.y);
            this.ctx.scale(scale, scale);

            // 底座（根据等级变色）
            const levelColor = tower.level === 1 ? '#2c3e50' : 
                              tower.level === 2 ? '#7f8c8d' : '#f39c12';
            this.ctx.fillStyle = levelColor;
            this.ctx.beginPath();
            this.ctx.arc(0, 0, 14, 0, Math.PI * 2);
            this.ctx.fill();
            
            // 主体
            this.ctx.fillStyle = this.getTowerColor(tower.type);
            this.ctx.beginPath();
            this.ctx.arc(0, 0, 11, 0, Math.PI * 2);
            this.ctx.fill();
            
            // 升级发光效果
            if (tower.deployAnim > 8) {
                this.ctx.strokeStyle = 'rgba(255,255,255,' + (tower.deployAnim / 15 * 0.9) + ')';
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
            
            // 等级标签
            this.ctx.fillStyle = 'white';
            this.ctx.font = 'bold 10px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(`Lv.${tower.level}`, 0, 4);
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
        // 左上角游戏信息
        this.ctx.fillStyle = 'rgba(0,0,0,0.45)';
        this.ctx.fillRect(4, 4, 130, 48);
        this.ctx.fillStyle = '#f1c40f';
        this.ctx.font = 'bold 14px Arial';
        this.ctx.fillText(`得分: ${this.score}`, 10, 20);
        this.ctx.fillStyle = 'white';
        this.ctx.font = '13px Arial';
        this.ctx.fillText(`第 ${this.wave}/${this.currentLevel ? this.currentLevel.enemyWaves : 0} 波`, 10, 38);

        // 波次Banner（大字体中央显示）
        const now = performance.now();
        if (now < this._waveBannerUntil) {
            const alpha = Math.min(1, (this._waveBannerUntil - now) / 500);
            this.ctx.save();
            this.ctx.globalAlpha = alpha;
            this.ctx.fillStyle = 'rgba(0,0,0,0.7)';
            this.ctx.fillRect(this.canvas.width / 2 - 150, this.canvas.height / 2 - 50, 300, 60);
            this.ctx.fillStyle = '#f1c40f';
            this.ctx.font = 'bold 28px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(`第 ${this.wave} 波来袭！`, this.canvas.width / 2, this.canvas.height / 2 - 15);
            if (this.currentLevel) {
                this.ctx.fillStyle = 'white';
                this.ctx.font = '16px Arial';
                this.ctx.fillText(this.currentLevel.description, this.canvas.width / 2, this.canvas.height / 2 + 15);
            }
            this.ctx.textAlign = 'left';
            this.ctx.restore();
        }

        // 关卡信息（右上角）
        if (this.currentLevel) {
            this.ctx.fillStyle = 'rgba(0,0,0,0.4)';
            this.ctx.fillRect(this.canvas.width - 220, 4, 216, 56);
            this.ctx.fillStyle = '#3498db';
            this.ctx.font = 'bold 15px Arial';
            this.ctx.textAlign = 'right';
            this.ctx.fillText(this.currentLevel.name, this.canvas.width - 10, 22);
            this.ctx.fillStyle = 'white';
            this.ctx.font = '12px Arial';
            this.ctx.fillText(`进度: ${this.wave}/${this.currentLevel.enemyWaves} 波`, this.canvas.width - 10, 40);
            this.ctx.fillText(`奖励: ${this.currentLevel.reward} 金币/波`, this.canvas.width - 10, 55);
            this.ctx.textAlign = 'left';
        }

        // 间隔提示（底部中央）
        if (this.gameState === 'between_waves') {
            this.ctx.fillStyle = 'rgba(0,0,0,0.6)';
            this.ctx.fillRect(this.canvas.width / 2 - 120, this.canvas.height - 40, 240, 32);
            this.ctx.fillStyle = '#2ecc71';
            this.ctx.font = 'bold 15px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('准备就绪 - 点击"开始游戏"进入下一波', this.canvas.width / 2, this.canvas.height - 20);
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
        // 如果游戏未准备好，不执行任何逻辑，但继续请求下一帧
        if (!this._isReady) {
            requestAnimationFrame(() => this.gameLoop());
            return;
        }
        
        const now = performance.now();
        const dt  = now - (this.lastTime || now);
        this.lastTime = now;

        if (this.gameState === 'playing' || this.gameState === 'between_waves') {
            this.gameTime += dt;
            this.updateEnemies(dt);
            this.updateTowers(dt);
            this.updateProjectiles();
            if (this.gameState === 'playing') {
                this.checkWaveCompletion();
            }
        }

        this.render();
        this.updateUI();
        requestAnimationFrame(() => this.gameLoop());
    }
}

// 启动
document.addEventListener('DOMContentLoaded', () => { new TowerDefenseGame(); });
