/* === CONFIGURATION === */
const POWERUP_TYPES = {
    MAGNET: 'magnet',
    SHIELD: 'shield',
    SCORE_X2: 'score_x2',
    SHORTEN: 'shorten'
};

const POWERUP_CONFIG = {
    [POWERUP_TYPES.MAGNET]: { color: '#fbbf24', duration: 8000, label: 'MAGNET', name: 'Magnet' },
    [POWERUP_TYPES.SHIELD]: { color: '#60a5fa', duration: 8000, label: 'SHIELD', name: 'Shield' },
    [POWERUP_TYPES.SCORE_X2]: { color: '#d946ef', duration: 8000, label: 'X2', name: 'Double Score' },
    [POWERUP_TYPES.SHORTEN]: { color: '#ef4444', duration: 0, label: 'CUT', name: 'Shorten' }
};

const COLORS = {
    snakeHead: '#22c55e',
    snakeBody: '#4ade80',
    food: '#f472b6',
    wall: '#94a3b8',
    particle: ['#4ade80', '#22c55e', '#f472b6', '#fff'],
    text: '#f8fafc'
};

const GRID_SIZE = 20;
const CANVAS_SIZE = 400;
const TILE_COUNT = CANVAS_SIZE / GRID_SIZE;

const LEVELS = [
    { id: 1, targetScore: 50, walls: [] },
    { id: 2, targetScore: 100, walls: 'border' },
    {
        id: 3, targetScore: 150, walls: [
            { x: 6, y: 5 }, { x: 7, y: 5 }, { x: 8, y: 5 }, { x: 9, y: 5 }, { x: 10, y: 5 }, { x: 11, y: 5 }, { x: 12, y: 5 }, { x: 13, y: 5 },
            { x: 6, y: 14 }, { x: 7, y: 14 }, { x: 8, y: 14 }, { x: 9, y: 14 }, { x: 10, y: 14 }, { x: 11, y: 14 }, { x: 12, y: 14 }, { x: 13, y: 14 }
        ]
    },
    {
        id: 4, targetScore: 200, walls: [
            { x: 10, y: 4 }, { x: 10, y: 5 }, { x: 10, y: 6 }, { x: 10, y: 13 }, { x: 10, y: 14 }, { x: 10, y: 15 },
            { x: 4, y: 10 }, { x: 5, y: 10 }, { x: 6, y: 10 }, { x: 13, y: 10 }, { x: 14, y: 10 }, { x: 15, y: 10 }
        ]
    },
    { id: 5, targetScore: 9999, walls: 'random' }
];

/* === UTILITY CLASSES === */
class Vector2 {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
    equals(other) {
        return this.x === other.x && this.y === other.y;
    }
    add(other) {
        return new Vector2(this.x + other.x, this.y + other.y);
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x * GRID_SIZE + GRID_SIZE / 2;
        this.y = y * GRID_SIZE + GRID_SIZE / 2;
        this.color = color;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 3 + 2;
        this.velocity = {
            x: Math.cos(angle) * speed,
            y: Math.sin(angle) * speed
        };
        this.life = 1.0;
        this.decay = Math.random() * 0.02 + 0.015;
        this.size = Math.random() * 4 + 2;
        this.gravity = 0.1;
    }

    update() {
        this.x += this.velocity.x;
        this.y += this.velocity.y;
        this.velocity.y += this.gravity;
        this.velocity.x *= 0.95;
        this.velocity.y *= 0.95;
        this.life -= this.decay;
        this.size *= 0.96;
    }

    draw(ctx) {
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10 * this.life;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, Math.max(0, this.size), 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1.0;
    }
}

class ParticleSystem {
    constructor() {
        this.particles = [];
        // Performance optimization: detect mobile and reduce particle count
        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        this.maxParticles = this.isMobile ? 50 : 100; // Limit particles on mobile
    }
    emit(x, y, color, count = 20) {
        // Reduce particle count on mobile for better performance
        const adjustedCount = this.isMobile ? Math.min(count, 15) : count;
        // Enforce max particles limit
        const availableSlots = this.maxParticles - this.particles.length;
        const actualCount = Math.min(adjustedCount, availableSlots);
        
        for (let i = 0; i < actualCount; i++) {
            this.particles.push(new Particle(x, y, color));
        }
    }
    update() {
        this.particles.forEach(p => p.update());
        this.particles = this.particles.filter(p => p.life > 0);
        // Enforce max particles limit
        if (this.particles.length > this.maxParticles) {
            this.particles = this.particles.slice(-this.maxParticles);
        }
    }
    draw(ctx) {
        this.particles.forEach(p => p.draw(ctx));
    }
}

class SoundManager {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterVolume = 0.3;
        this.enabled = true;
    }

    setEnabled(enabled) {
        this.enabled = enabled;
    }

    playTone(freq, type, duration, slideFreq = null) {
        if (!this.enabled) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        if (slideFreq) {
            osc.frequency.exponentialRampToValueAtTime(slideFreq, this.ctx.currentTime + duration);
        }
        gain.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    playEat() { this.playTone(600, 'sine', 0.1, 800); }
    playPowerUp() {
        this.playTone(400, 'square', 0.1, 600);
        setTimeout(() => this.playTone(600, 'square', 0.2, 1200), 100);
    }
    playDie() { this.playTone(200, 'sawtooth', 0.3, 50); }
    playVictory() {
        [440, 554, 659, 880].forEach((freq, i) => {
            setTimeout(() => this.playTone(freq, 'square', 0.2), i * 150);
        });
    }
}

/* === MUSIC MANAGER === */
class MusicManager {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.enabled = true;
        this.isPlaying = false;
        this.volume = 0.15;
        this.tempo = 140; // BPM
        this.currentTimeout = null;

        // Pentatonic scale for pleasant melody
        this.menuNotes = [262, 294, 330, 392, 440, 523, 587, 659];
        this.gameNotes = [330, 392, 440, 523, 587, 659, 784, 880];
        this.noteIndex = 0;
    }

    setEnabled(enabled) {
        this.enabled = enabled;
        if (!enabled) {
            this.stop();
        }
    }

    playNote(freq, duration) {
        if (!this.enabled || !this.isPlaying) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

        // Smooth envelope
        gain.gain.setValueAtTime(0, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(this.volume, this.ctx.currentTime + 0.05);
        gain.gain.linearRampToValueAtTime(this.volume * 0.7, this.ctx.currentTime + duration * 0.5);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    playMenuMusic() {
        if (!this.enabled) return;
        this.isPlaying = true;
        this.tempo = 100;
        this.scheduleMenuNote();
    }

    scheduleMenuNote() {
        if (!this.isPlaying || !this.enabled) return;

        const beatDuration = 60 / this.tempo;
        const note = this.menuNotes[this.noteIndex % this.menuNotes.length];

        this.playNote(note, beatDuration * 0.8);

        this.noteIndex++;
        this.currentTimeout = setTimeout(() => this.scheduleMenuNote(), beatDuration * 1000);
    }

    playGameMusic() {
        if (!this.enabled) return;
        this.stop();
        this.isPlaying = true;
        this.tempo = 140;
        this.scheduleGameNote();
    }

    scheduleGameNote() {
        if (!this.isPlaying || !this.enabled) return;

        const beatDuration = 60 / this.tempo;
        const notePattern = [0, 2, 4, 2, 0, 4, 2, 5]; // Simple pattern
        const note = this.gameNotes[notePattern[this.noteIndex % notePattern.length]];

        this.playNote(note, beatDuration * 0.5);

        this.noteIndex++;
        this.currentTimeout = setTimeout(() => this.scheduleGameNote(), beatDuration * 500);
    }

    stop() {
        this.isPlaying = false;
        if (this.currentTimeout) {
            clearTimeout(this.currentTimeout);
            this.currentTimeout = null;
        }
        this.noteIndex = 0;
    }
}

class ScreenShake {
    constructor() {
        this.duration = 0;
        this.intensity = 0;
    }
    trigger(duration, intensity) {
        this.duration = duration;
        this.intensity = intensity;
    }
    update() {
        if (this.duration > 0) {
            this.duration--;
            const dx = (Math.random() - 0.5) * 2 * this.intensity;
            const dy = (Math.random() - 0.5) * 2 * this.intensity;
            return { x: dx, y: dy };
        }
        return { x: 0, y: 0 };
    }
}

class PowerUp {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.life = 400;
        this.animOffset = 0;
    }
    update() {
        this.life--;
        this.animOffset += 0.15;
    }
    draw(ctx) {
        const conf = POWERUP_CONFIG[this.type];
        const cx = this.x * GRID_SIZE + GRID_SIZE / 2;
        const cy = this.y * GRID_SIZE + GRID_SIZE / 2;

        ctx.shadowBlur = 15 + Math.sin(this.animOffset) * 5;
        ctx.shadowColor = conf.color;
        ctx.fillStyle = conf.color;
        ctx.strokeStyle = conf.color;
        ctx.lineWidth = 2;

        const dy = Math.sin(this.animOffset) * 3;
        const scale = 0.8 + Math.sin(this.animOffset * 2) * 0.1;

        ctx.save();
        ctx.translate(cx, cy + dy);
        ctx.scale(scale, scale);

        ctx.beginPath();
        if (this.type === POWERUP_TYPES.MAGNET) {
            ctx.arc(0, -2, 6, Math.PI, 0);
            ctx.lineTo(6, 6);
            ctx.lineTo(3, 6);
            ctx.lineTo(3, -2);
            ctx.arc(0, -2, 3, 0, Math.PI, true);
            ctx.lineTo(-3, 6);
            ctx.lineTo(-6, 6);
            ctx.closePath();
            ctx.fill();
        } else if (this.type === POWERUP_TYPES.SHIELD) {
            ctx.moveTo(0, 8);
            ctx.quadraticCurveTo(8, 6, 8, -4);
            ctx.lineTo(-8, -4);
            ctx.quadraticCurveTo(-8, 6, 0, 8);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(0, -1, 3, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === POWERUP_TYPES.SCORE_X2) {
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('x2', 0, 1);
            ctx.beginPath();
            ctx.arc(0, 0, 9, 0, Math.PI * 2);
            ctx.stroke();
        } else if (this.type === POWERUP_TYPES.SHORTEN) {
            // Scissors icon - more intuitive for "cut/shorten"
            ctx.strokeStyle = conf.color;
            ctx.lineWidth = 2;
            // Left blade
            ctx.beginPath();
            ctx.ellipse(-3, -4, 3, 6, -0.3, 0, Math.PI * 2);
            ctx.stroke();
            // Right blade
            ctx.beginPath();
            ctx.ellipse(3, -4, 3, 6, 0.3, 0, Math.PI * 2);
            ctx.stroke();
            // Handle
            ctx.beginPath();
            ctx.moveTo(-2, 2);
            ctx.lineTo(0, 6);
            ctx.lineTo(2, 2);
            ctx.stroke();
        }
        ctx.restore();
        ctx.shadowBlur = 0;
    }
}

/* === SNAKE CLASS === */
class Snake {
    constructor(startPos = { x: 10, y: 10 }) {
        this.body = [
            new Vector2(startPos.x, startPos.y),
            new Vector2(startPos.x - 1, startPos.y),
            new Vector2(startPos.x - 2, startPos.y)
        ];
        this.direction = new Vector2(1, 0);
        this.nextDirection = new Vector2(1, 0);
        this.growPending = 0;
        this.colorOffset = 0;
    }

    setDirection(x, y) {
        if (this.direction.x + x === 0 && this.direction.y + y === 0) return;
        this.nextDirection = new Vector2(x, y);
    }

    update(walls, isCampaign) {
        this.direction = this.nextDirection;
        const head = this.body[0].add(this.direction);
        let crashed = false;

        if (isCampaign && walls.length > 0) {
            if (head.x < 0 || head.x >= TILE_COUNT || head.y < 0 || head.y >= TILE_COUNT) {
                crashed = true;
            }
        } else {
            if (head.x < 0) head.x = TILE_COUNT - 1;
            if (head.x >= TILE_COUNT) head.x = 0;
            if (head.y < 0) head.y = TILE_COUNT - 1;
            if (head.y >= TILE_COUNT) head.y = 0;
        }

        if (!crashed) {
            this.body.unshift(head);
            if (this.growPending > 0) {
                this.growPending--;
            } else {
                this.body.pop();
            }
        }

        this.colorOffset += 0.05;
        return { head, crashed };
    }

    checkCollision(walls = []) {
        const head = this.body[0];
        for (let i = 1; i < this.body.length; i++) {
            if (head.equals(this.body[i])) return true;
        }
        for (let wall of walls) {
            if (head.x === wall.x && head.y === wall.y) return true;
        }
        return false;
    }

    shorten(amount = 5) {
        const minLength = 3; // Keep at least head + 2 body parts
        const maxCut = this.body.length - minLength;
        if (maxCut > 0) {
            const actualCut = Math.min(amount, maxCut);
            this.body.splice(this.body.length - actualCut, actualCut);
        }
    }

    grow() {
        this.growPending++;
    }

    undoMove() {
        if (this.body.length > 0) {
            this.body.shift();
        }
    }

    bounce(walls) {
        const moves = [
            { x: 0, y: -1 }, { x: 0, y: 1 },
            { x: -1, y: 0 }, { x: 1, y: 0 }
        ];

        const head = this.body[0];
        let safeDir = null;
        moves.sort(() => Math.random() - 0.5);

        for (let m of moves) {
            const testHead = { x: head.x + m.x, y: head.y + m.y };

            let bodyHit = false;
            for (let part of this.body) {
                if (part.x === testHead.x && part.y === testHead.y) {
                    bodyHit = true; break;
                }
            }
            if (bodyHit) continue;

            let wallHit = false;
            for (let w of walls) {
                if (w.x === testHead.x && w.y === testHead.y) {
                    wallHit = true; break;
                }
            }
            if (wallHit) continue;

            if (testHead.x < 0 || testHead.x >= TILE_COUNT || testHead.y < 0 || testHead.y >= TILE_COUNT) {
                continue;
            }

            safeDir = m;
            break;
        }

        if (safeDir) {
            this.nextDirection = new Vector2(safeDir.x, safeDir.y);
            this.direction = new Vector2(safeDir.x, safeDir.y);
        }
    }

    draw(ctx, hasShield) {
        // Draw body from tail to head for proper layering
        for (let index = this.body.length - 1; index >= 0; index--) {
            const part = this.body[index];
            const x = part.x * GRID_SIZE + 1;
            const y = part.y * GRID_SIZE + 1;
            const size = GRID_SIZE - 2;
            const radius = 4;

            if (index === 0) {
                // Head
                ctx.fillStyle = hasShield ? '#60a5fa' : '#22c55e';
                ctx.shadowBlur = 20;
                ctx.shadowColor = ctx.fillStyle;
            } else {
                // Body gradient
                const hue = 140 + index * 2;
                const lightness = 50 - (index * 0.5);
                ctx.fillStyle = `hsl(${hue}, 70%, ${Math.max(35, lightness)}%)`;
                ctx.shadowBlur = 5;
                ctx.shadowColor = '#4ade80';
            }

            // Draw rounded rectangle
            ctx.beginPath();
            ctx.roundRect(x, y, size, size, radius);
            ctx.fill();

            // Draw head eyes
            if (index === 0) {
                ctx.fillStyle = '#fff';
                ctx.shadowBlur = 0;
                const eyeSize = 3;
                const eyeOffset = 5;

                // Eye positions based on direction
                let eyeX1, eyeY1, eyeX2, eyeY2;
                if (this.direction.x === 1) { // Right
                    eyeX1 = eyeX2 = x + size - eyeOffset;
                    eyeY1 = y + eyeOffset;
                    eyeY2 = y + size - eyeOffset;
                } else if (this.direction.x === -1) { // Left
                    eyeX1 = eyeX2 = x + eyeOffset;
                    eyeY1 = y + eyeOffset;
                    eyeY2 = y + size - eyeOffset;
                } else if (this.direction.y === -1) { // Up
                    eyeY1 = eyeY2 = y + eyeOffset;
                    eyeX1 = x + eyeOffset;
                    eyeX2 = x + size - eyeOffset;
                } else { // Down
                    eyeY1 = eyeY2 = y + size - eyeOffset;
                    eyeX1 = x + eyeOffset;
                    eyeX2 = x + size - eyeOffset;
                }

                ctx.beginPath();
                ctx.arc(eyeX1, eyeY1, eyeSize, 0, Math.PI * 2);
                ctx.arc(eyeX2, eyeY2, eyeSize, 0, Math.PI * 2);
                ctx.fill();
            }

            // Shield effect
            if (hasShield) {
                ctx.strokeStyle = `rgba(96, 165, 250, ${0.5 + Math.sin(Date.now() / 100) * 0.3})`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.roundRect(x - 2, y - 2, size + 4, size + 4, radius + 2);
                ctx.stroke();
            }
        }
        ctx.shadowBlur = 0;
    }
}

/* === SCORE POPUP SYSTEM === */
class ScorePopup {
    constructor() {
        this.popups = [];
    }

    show(x, y, points, isCombo = false) {
        const canvas = document.getElementById('gameCanvas');
        const rect = canvas.getBoundingClientRect();
        const scaleX = rect.width / 400;
        const scaleY = rect.height / 400;

        const popup = document.createElement('div');
        popup.className = 'score-popup';
        popup.textContent = `+${points}`;

        if (isCombo) {
            popup.style.color = '#d946ef';
            popup.style.textShadow = '0 0 15px rgba(217, 70, 239, 0.9)';
        } else if (points >= 20) {
            popup.style.color = '#fbbf24';
        }

        popup.style.left = `${rect.left + x * GRID_SIZE * scaleX}px`;
        popup.style.top = `${rect.top + y * GRID_SIZE * scaleY}px`;

        document.body.appendChild(popup);

        setTimeout(() => {
            popup.remove();
        }, 1000);
    }
}

/* === COMBO MANAGER === */
class ComboManager {
    constructor() {
        this.combo = 0;
        this.lastEatTime = 0;
        this.comboTimeout = 2000; // 2 seconds to maintain combo
        this.comboDisplay = document.getElementById('combo-display');
        this.comboCountEl = document.getElementById('combo-count');
        this.comboMultiplierEl = document.getElementById('combo-multiplier');
    }

    onEat() {
        const now = Date.now();
        if (now - this.lastEatTime < this.comboTimeout) {
            this.combo++;
        } else {
            this.combo = 1;
        }
        this.lastEatTime = now;
        this.updateDisplay();
        
        // Track combo achievements (5, 10, 15, etc.)
        if (this.combo >= 5 && this.combo % 5 === 0) {
            if (window.game && window.game.poki) {
                window.game.poki.trackComboAchievement(this.combo);
            }
        }
        
        return this.getMultiplier();
    }

    getMultiplier() {
        if (this.combo >= 5) return 3;
        if (this.combo >= 3) return 2;
        if (this.combo >= 2) return 1.5;
        return 1;
    }

    updateDisplay() {
        if (this.combo >= 2) {
            this.comboDisplay.classList.add('visible');
            this.comboCountEl.textContent = this.combo;
            this.comboMultiplierEl.textContent = this.getMultiplier();
        } else {
            this.comboDisplay.classList.remove('visible');
        }
    }

    reset() {
        this.combo = 0;
        this.comboDisplay.classList.remove('visible');
    }

    update() {
        if (Date.now() - this.lastEatTime > this.comboTimeout && this.combo > 0) {
            this.reset();
        }
    }
}

/* === TOUCH CONTROLLER === */
class TouchController {
    constructor(game) {
        this.game = game;
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.minSwipeDistance = 30;
        this.setupTouchControls();
    }

    setupTouchControls() {
        const canvas = document.getElementById('gameCanvas');

        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            this.touchStartX = touch.clientX;
            this.touchStartY = touch.clientY;
        }, { passive: false });

        canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            const touch = e.changedTouches[0];
            const deltaX = touch.clientX - this.touchStartX;
            const deltaY = touch.clientY - this.touchStartY;

            if (Math.abs(deltaX) > this.minSwipeDistance || Math.abs(deltaY) > this.minSwipeDistance) {
                if (Math.abs(deltaX) > Math.abs(deltaY)) {
                    // Horizontal swipe
                    if (deltaX > 0) {
                        this.game.snake.setDirection(1, 0); // Right
                    } else {
                        this.game.snake.setDirection(-1, 0); // Left
                    }
                } else {
                    // Vertical swipe
                    if (deltaY > 0) {
                        this.game.snake.setDirection(0, 1); // Down
                    } else {
                        this.game.snake.setDirection(0, -1); // Up
                    }
                }
            }
        }, { passive: false });
    }
}

/* === GAME CLASS === */
class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.scoreElement = document.getElementById('score');
        this.highScoreElement = document.getElementById('high-score');

        this.snake = new Snake();
        this.particles = new ParticleSystem();
        this.shaker = new ScreenShake();
        this.sound = new SoundManager();
        this.music = new MusicManager();
        this.scorePopup = new ScorePopup();
        this.comboManager = new ComboManager();
        this.poki = new window.PokiSDKWrapper();
        this.food = new Vector2(0, 0);
        this.walls = [];
        this.powerUps = [];
        this.activeEffects = {};

        this.score = 0;
        this.highScore = localStorage.getItem('snakeHighScore') || 0;
        this.highScoreElement.textContent = this.highScore;

        this.levelIndex = 0;
        this.isCampaign = false;
        this.isPaused = false;
        this.canContinue = true; // For rewarded ads

        this.gameInterval = null;
        this.isRunning = false;

        this.setupCanvas();
        this.setupInput();
        this.setupUI();

        this.touchController = new TouchController(this);
    }

    setupCanvas() {
        // Responsive canvas
        const updateCanvasSize = () => {
            const size = Math.min(window.innerWidth * 0.9, window.innerHeight * 0.7, 400);
            this.canvas.style.width = size + 'px';
            this.canvas.style.height = size + 'px';
            this.canvas.width = CANVAS_SIZE;
            this.canvas.height = CANVAS_SIZE;
        };
        updateCanvasSize();
        window.addEventListener('resize', updateCanvasSize);
    }

    setupInput() {
        document.addEventListener('keydown', (e) => {
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ',
                'w', 'a', 's', 'd', 'W', 'A', 'S', 'D'].includes(e.key)) {
                e.preventDefault();
            }

            if (!this.isRunning && e.key === 'Enter') {
                if (document.getElementById('game-overlay').classList.contains('visible')) {
                    document.getElementById('start-btn').click();
                }
                return;
            }

            const key = e.key.toLowerCase();

            if (key === 'escape' || key === 'p') {
                if (this.isRunning && !this.isPaused) {
                    window.menuManager.showPauseMenu();
                } else if (this.isPaused) {
                    window.menuManager.resumeGame();
                }
                return;
            }

            if (key === 'r') {
                if (document.getElementById('game-overlay').classList.contains('visible')) {
                    document.getElementById('start-btn').click();
                } else if (!this.isRunning) {
                    this.startLevel();
                }
                return;
            }

            if (!this.isRunning || this.isPaused) return;

            switch (key) {
                case 'arrowup': case 'w': this.snake.setDirection(0, -1); break;
                case 'arrowdown': case 's': this.snake.setDirection(0, 1); break;
                case 'arrowleft': case 'a': this.snake.setDirection(-1, 0); break;
                case 'arrowright': case 'd': this.snake.setDirection(1, 0); break;
            }
        });
    }

    setupUI() {
        const startBtn = document.getElementById('start-btn');
        const menuBtn = document.getElementById('menu-btn');

        startBtn.onclick = () => { this.startCampaign(); };
        menuBtn.onclick = () => { window.menuManager.showScreen('main-menu'); };
    }

    pause() {
        this.isPaused = true;
        this.poki.gameplayStop();
    }

    resume() {
        this.isPaused = false;
        this.poki.gameplayStart();
    }

    loadLevel(index) {
        if (index >= LEVELS.length) {
            this.victory();
            return;
        }

        this.levelIndex = index;
        const levelData = LEVELS[index];
        this.targetScore = levelData.targetScore;

        this.walls = [];
        const w = levelData.walls;

        if (w === 'border') {
            for (let i = 0; i < TILE_COUNT; i++) {
                this.walls.push({ x: i, y: 0 });
                this.walls.push({ x: i, y: TILE_COUNT - 1 });
                this.walls.push({ x: 0, y: i });
                this.walls.push({ x: TILE_COUNT - 1, y: i });
            }
        } else if (Array.isArray(w)) {
            this.walls = w;
        } else if (w === 'random') {
            for (let i = 0; i < 15; i++) {
                this.walls.push({
                    x: Math.floor(Math.random() * (TILE_COUNT - 4) + 2),
                    y: Math.floor(Math.random() * (TILE_COUNT - 4) + 2)
                });
            }
        }

        document.getElementById('overlay-title').textContent = `Level ${this.levelIndex + 1}`;
    }

    spawnFood() {
        for (let i = 0; i < 50; i++) {
            const x = Math.floor(Math.random() * TILE_COUNT);
            const y = Math.floor(Math.random() * TILE_COUNT);
            const pos = new Vector2(x, y);
            if (!this.isOccupied(pos)) {
                this.food = pos;
                return;
            }
        }
        for (let x = 0; x < TILE_COUNT; x++) {
            for (let y = 0; y < TILE_COUNT; y++) {
                const pos = new Vector2(x, y);
                if (!this.isOccupied(pos)) {
                    this.food = pos;
                    return;
                }
            }
        }
    }

    spawnPowerUp() {
        if (this.powerUps.length >= 1) return;
        if (Math.random() > 0.03) return;

        const types = Object.values(POWERUP_TYPES);
        const type = types[Math.floor(Math.random() * types.length)];

        let attempts = 0;
        while (attempts < 50) {
            const x = Math.floor(Math.random() * TILE_COUNT);
            const y = Math.floor(Math.random() * TILE_COUNT);
            const pos = new Vector2(x, y);

            if (!this.isOccupied(pos) && !this.food.equals(pos)) {
                this.powerUps.push(new PowerUp(x, y, type));
                break;
            }
            attempts++;
        }
    }

    isOccupied(pos) {
        for (let part of this.snake.body) {
            if (pos.equals(part)) return true;
        }
        for (let wall of this.walls) {
            if (pos.x === wall.x && pos.y === wall.y) return true;
        }
        return false;
    }

    startCampaign() {
        // Clear time attack timer if running
        if (this.timeAttackInterval) {
            clearInterval(this.timeAttackInterval);
            this.timeAttackInterval = null;
            document.getElementById('time-attack-timer').classList.remove('visible');
            document.getElementById('time-attack-timer').classList.remove('warning');
        }

        this.isCampaign = true;
        this.isTimeAttack = false;
        this.levelIndex = 0;
        
        // Track mode selection and game start
        this.poki.trackModeSelection('campaign');
        this.poki.trackGameStart('campaign');
        
        this.startLevel();
    }

    startTimeAttack() {
        // Clear any existing timer
        if (this.timeAttackInterval) {
            clearInterval(this.timeAttackInterval);
            this.timeAttackInterval = null;
        }
        document.getElementById('time-attack-timer').classList.remove('visible');
        document.getElementById('time-attack-timer').classList.remove('warning');

        this.isCampaign = false;
        this.isTimeAttack = true;
        this.timeAttackDuration = 60; // 60 seconds
        this.timeAttackRemaining = 60;
        this.levelIndex = 0; // Reset level for Time Attack
        
        // Track mode selection and game start
        this.poki.trackModeSelection('timeattack');
        this.poki.trackGameStart('timeattack');
        
        this.startLevel();

        // Start countdown timer
        this.timeAttackInterval = setInterval(() => {
            if (this.isPaused) return; // Don't count down when paused

            this.timeAttackRemaining--;
            const timerEl = document.getElementById('time-attack-timer');
            timerEl.textContent = this.timeAttackRemaining;
            timerEl.classList.add('visible');

            if (this.timeAttackRemaining <= 10) {
                timerEl.classList.add('warning');
            }

            if (this.timeAttackRemaining <= 0) {
                clearInterval(this.timeAttackInterval);
                this.timeAttackInterval = null;
                this.timeAttackComplete();
            }
        }, 1000);
    }

    timeAttackComplete() {
        this.isRunning = false;
        clearInterval(this.gameInterval);
        this.sound.playVictory();

        // Track time attack completion
        this.poki.trackTimeAttackScore(this.score, 0);
        this.poki.trackGameOver(this.score, 'timeattack');

        document.getElementById('time-attack-timer').classList.remove('visible');
        document.getElementById('overlay-title').textContent = 'Time Up!';
        document.getElementById('overlay-message').textContent = `Final Score: ${this.score}`;

        const startBtn = document.getElementById('start-btn');
        startBtn.textContent = 'Play Again';
        startBtn.onclick = () => window.menuManager.showGameScreen('timeattack');

        document.getElementById('menu-btn').style.display = 'inline-block';
        document.getElementById('game-overlay').classList.add('visible');
    }

    startLevel() {
        if (this.isRunning) return;

        this.loadLevel(this.levelIndex);
        this.snake = new Snake();
        this.particles = new ParticleSystem();
        this.powerUps = [];
        this.activeEffects = {};
        this.score = 0;
        this.isPaused = false;
        this.canContinue = true;
        this.comboManager.reset();
        this.updateScoreUI();
        this.spawnFood();
        this.isRunning = true;
        document.getElementById('game-overlay').classList.remove('visible');

        // Track level start
        this.poki.trackLevelStart(this.levelIndex, this.isCampaign ? 'campaign' : 'timeattack');

        // Poki SDK - gameplay started
        this.poki.gameplayStart();

        // Start game music
        this.music.playGameMusic();

        this.startGameLoop();
    }

    startGameLoop() {
        if (this.gameInterval) clearInterval(this.gameInterval);
        let speed = 100;
        this.gameInterval = setInterval(() => this.loop(), speed);
    }

    async gameOver() {
        this.isRunning = false;
        clearInterval(this.gameInterval);

        // Track game over event
        this.poki.trackGameOver(this.score, this.isCampaign ? 'campaign' : 'timeattack');

        // Poki SDK - gameplay stopped
        this.poki.gameplayStop();

        // Stop game music
        this.music.stop();

        // Clear time attack timer if running
        if (this.timeAttackInterval) {
            clearInterval(this.timeAttackInterval);
            this.timeAttackInterval = null;
            document.getElementById('time-attack-timer').classList.remove('visible');
            document.getElementById('time-attack-timer').classList.remove('warning');
        }

        this.shaker.trigger(10, 5);
        this.sound.playDie();
        this.draw();

        // Show commercial break
        await this.poki.showCommercialBreak();

        setTimeout(() => {
            if (this.isTimeAttack) {
                document.getElementById('overlay-title').textContent = 'Game Over!';
                document.getElementById('overlay-message').textContent = `Score: ${this.score}`;
                const startBtn = document.getElementById('start-btn');
                startBtn.textContent = 'Play Again';
                startBtn.onclick = () => window.menuManager.showGameScreen('timeattack');
            } else {
                document.getElementById('overlay-title').textContent = 'Game Over!';
                document.getElementById('overlay-message').textContent = `Score: ${this.score} / Target: ${this.targetScore}`;
                const startBtn = document.getElementById('start-btn');
                startBtn.textContent = 'Try Again (R)';
                startBtn.onclick = () => this.startLevel();
            }

            // Show continue with ad button if available
            const continueBtn = document.getElementById('continue-ad-btn');
            if (this.canContinue && this.score > 0) {
                continueBtn.style.display = 'inline-block';
                continueBtn.onclick = () => this.continueWithAd();
            } else {
                continueBtn.style.display = 'none';
            }

            document.getElementById('menu-btn').style.display = 'inline-block';
            document.getElementById('game-overlay').classList.add('visible');
        }, 500);
    }

    async continueWithAd() {
        const watched = await this.poki.showRewardedBreak();
        if (watched) {
            // User watched ad - continue game with revive
            this.canContinue = false; // Only allow once per game
            document.getElementById('game-overlay').classList.remove('visible');
            document.getElementById('continue-ad-btn').style.display = 'none';

            // Respawn snake at a safe position
            this.snake = new Snake({ x: 10, y: 10 });
            this.snake.bounce(this.walls); // Find safe direction

            // Keep score but reset combos
            this.comboManager.reset();

            // Give a temporary shield as protection
            this.activeEffects[POWERUP_TYPES.SHIELD] = Date.now() + 3000; // 3 second shield
            this.particles.emit(10, 10, '#60a5fa', 30);
            this.sound.playPowerUp();

            this.isRunning = true;
            this.poki.gameplayStart();
            this.music.playGameMusic();

            // Resume time attack timer if in time attack mode (only if not already running)
            if (this.isTimeAttack && this.timeAttackRemaining > 0 && !this.timeAttackInterval) {
                this.resumeTimeAttackTimer();
            }

            this.startGameLoop();
        }
    }

    resumeTimeAttackTimer() {
        // Clear any existing timer first
        if (this.timeAttackInterval) {
            clearInterval(this.timeAttackInterval);
        }

        const timerEl = document.getElementById('time-attack-timer');
        timerEl.textContent = this.timeAttackRemaining;
        timerEl.classList.add('visible');
        if (this.timeAttackRemaining <= 10) {
            timerEl.classList.add('warning');
        }

        this.timeAttackInterval = setInterval(() => {
            if (this.isPaused) return;

            this.timeAttackRemaining--;
            timerEl.textContent = this.timeAttackRemaining;

            if (this.timeAttackRemaining <= 10) {
                timerEl.classList.add('warning');
            }

            if (this.timeAttackRemaining <= 0) {
                clearInterval(this.timeAttackInterval);
                this.timeAttackInterval = null;
                this.timeAttackComplete();
            }
        }, 1000);
    }

    async levelComplete() {
        this.isRunning = false;
        clearInterval(this.gameInterval);
        this.poki.gameplayStop();
        this.sound.playVictory();

        // Track level completion
        this.poki.trackEvent('level_complete', {
            level: this.levelIndex + 1,
            score: this.score,
            targetScore: this.targetScore
        });

        // Show commercial break only every 2 levels to reduce ad fatigue
        if (this.levelIndex % 2 === 1) {
            await this.poki.showCommercialBreak();
        }

        document.getElementById('overlay-title').textContent = 'Level Complete!';
        document.getElementById('overlay-message').textContent = 'Preparing next level...';
        document.getElementById('continue-ad-btn').style.display = 'none';
        const startBtn = document.getElementById('start-btn');
        startBtn.textContent = 'Continue';
        startBtn.onclick = () => {
            this.levelIndex++;
            this.startLevel();
        };
        document.getElementById('menu-btn').style.display = 'inline-block';
        document.getElementById('game-overlay').classList.add('visible');
    }

    victory() {
        this.isRunning = false;
        clearInterval(this.gameInterval);
        this.sound.playVictory();

        // Track campaign completion
        this.poki.trackEvent('campaign_complete', {
            totalScore: this.score,
            highScore: this.highScore
        });

        document.getElementById('overlay-title').textContent = 'VICTORY!';
        document.getElementById('overlay-message').textContent = 'You completed the game!';
        const startBtn = document.getElementById('start-btn');
        startBtn.textContent = 'Play Again';
        startBtn.onclick = () => this.startCampaign();
        document.getElementById('menu-btn').style.display = 'inline-block';
        document.getElementById('game-overlay').classList.add('visible');
    }

    updateScoreUI() {
        if (this.isCampaign && this.targetScore < 9000) {
            this.scoreElement.textContent = `${this.score}/${this.targetScore}`;
        } else {
            this.scoreElement.textContent = this.score;
        }
        if (this.score > this.highScore) {
            const previousHighScore = this.highScore;
            this.highScore = this.score;
            this.highScoreElement.textContent = this.highScore;
            localStorage.setItem('snakeHighScore', this.highScore);
            // Track high score achievement
            this.poki.trackHighScore(this.score, previousHighScore);
        }
        
        // Track score milestones (every 50 points)
        const milestone = Math.floor(this.score / 50) * 50;
        if (milestone > 0 && milestone !== this.lastMilestone) {
            this.lastMilestone = milestone;
            this.poki.trackScoreMilestone(this.score, milestone);
        }
    }

    applyPowerUp(type) {
        // Track powerup collection for analytics
        this.poki.trackEvent('powerup_collected', {
            type: type,
            score: this.score
        });

        if (type === POWERUP_TYPES.SHORTEN) {
            this.snake.shorten(5);
            return;
        }
        this.activeEffects[type] = Date.now() + POWERUP_CONFIG[type].duration;
    }

    loop() {
        if (!this.isPaused) {
            this.update();
        }
        this.draw();
    }

    update() {
        const { head, crashed } = this.snake.update(this.walls, this.isCampaign);
        this.particles.update();

        // Initialize lastMilestone if not set
        if (typeof this.lastMilestone === 'undefined') {
            this.lastMilestone = 0;
        }

        // Magnet Logic
        if (this.activeEffects[POWERUP_TYPES.MAGNET] > Date.now()) {
            const dist = Math.abs(this.food.x - head.x) + Math.abs(this.food.y - head.y);
            if (dist > 0 && dist < 8) {
                const stepX = this.food.x < head.x ? 1 : (this.food.x > head.x ? -1 : 0);
                const stepY = this.food.y < head.y ? 1 : (this.food.y > head.y ? -1 : 0);

                let nextX = this.food.x;
                let nextY = this.food.y;

                if (dist <= 2) { nextX += stepX; nextY += stepY; }
                else if (this.gameInterval % 2 === 0) { nextX += stepX; nextY += stepY; }

                let wallHit = false;
                for (let w of this.walls) {
                    if (Math.round(nextX) === w.x && Math.round(nextY) === w.y) {
                        wallHit = true; break;
                    }
                }
                if (!wallHit) {
                    this.food.x = nextX;
                    this.food.y = nextY;
                }
            }
        }

        this.food.x = Math.round(this.food.x);
        this.food.y = Math.round(this.food.y);

        let collision = crashed || this.snake.checkCollision(this.walls);

        if (collision) {
            if (this.activeEffects[POWERUP_TYPES.SHIELD] > Date.now()) {
                delete this.activeEffects[POWERUP_TYPES.SHIELD];
                this.particles.emit(head.x, head.y, '#60a5fa', 30);
                this.shaker.trigger(5, 5);
                this.sound.playPowerUp();

                if (!crashed) this.snake.undoMove();
                this.snake.bounce(this.walls);
                return;
            } else {
                this.gameOver();
                return;
            }
        }

        const distToFood = Math.abs(this.food.x - head.x) + Math.abs(this.food.y - head.y);

        // Update combo timer
        this.comboManager.update();

        if (distToFood < 1) {
            this.snake.grow();

            // Calculate points with combo multiplier
            const comboMultiplier = this.comboManager.onEat();
            let basePoints = 10;
            if (this.activeEffects[POWERUP_TYPES.SCORE_X2] > Date.now()) basePoints *= 2;
            let points = Math.floor(basePoints * comboMultiplier);

            this.score += points;
            this.updateScoreUI();

            // Show score popup
            this.scorePopup.show(this.food.x, this.food.y, points, comboMultiplier > 1);

            this.particles.emit(this.food.x, this.food.y, COLORS.food, 25);
            try { this.sound.playEat(); } catch (e) { }
            this.spawnFood();
            if (this.isCampaign && this.score >= this.targetScore) {
                this.levelComplete();
            }
        }

        this.powerUps.forEach(p => p.update());
        this.powerUps = this.powerUps.filter(p => p.life > 0);
        this.spawnPowerUp();

        for (let i = 0; i < this.powerUps.length; i++) {
            const p = this.powerUps[i];
            if (head.x === p.x && head.y === p.y) {
                this.applyPowerUp(p.type);
                this.particles.emit(p.x, p.y, POWERUP_CONFIG[p.type].color, 20);
                try { this.sound.playPowerUp(); } catch (e) { }
                if (p.type === POWERUP_TYPES.SHORTEN) this.shaker.trigger(5, 2);
                this.powerUps.splice(i, 1);
                i--;
            }
        }
    }

    draw() {
        const shake = this.shaker.update();
        this.ctx.save();
        this.ctx.translate(shake.x, shake.y);

        this.ctx.fillStyle = '#1e293b';
        this.ctx.fillRect(-10, -10, this.canvas.width + 20, this.canvas.height + 20);

        // Walls
        this.ctx.fillStyle = '#334155';
        this.ctx.shadowBlur = 0;
        this.walls.forEach(w => {
            this.ctx.fillRect(w.x * GRID_SIZE, w.y * GRID_SIZE, GRID_SIZE, GRID_SIZE);
            this.ctx.strokeStyle = '#475569';
            this.ctx.strokeRect(w.x * GRID_SIZE, w.y * GRID_SIZE, GRID_SIZE, GRID_SIZE);
        });

        // Food with pulsing animation
        const foodPulse = 1 + Math.sin(Date.now() / 150) * 0.15;
        const foodX = this.food.x * GRID_SIZE + GRID_SIZE / 2;
        const foodY = this.food.y * GRID_SIZE + GRID_SIZE / 2;
        const foodRadius = (GRID_SIZE / 2 - 2) * foodPulse;

        // Outer glow
        this.ctx.shadowBlur = 20 + Math.sin(Date.now() / 100) * 10;
        this.ctx.shadowColor = COLORS.food;

        // Main food circle
        this.ctx.fillStyle = COLORS.food;
        this.ctx.beginPath();
        this.ctx.arc(foodX, foodY, foodRadius, 0, Math.PI * 2);
        this.ctx.fill();

        // Inner highlight
        this.ctx.shadowBlur = 0;
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        this.ctx.beginPath();
        this.ctx.arc(foodX - 2, foodY - 2, foodRadius * 0.4, 0, Math.PI * 2);
        this.ctx.fill();

        // Powerups
        this.powerUps.forEach(p => p.draw(this.ctx));

        // Snake
        const hasShield = this.activeEffects[POWERUP_TYPES.SHIELD] > Date.now();
        this.snake.draw(this.ctx, hasShield);

        // Particles
        this.particles.draw(this.ctx);

        this.ctx.restore();

        this.drawEffectsUI();
    }

    drawEffectsUI() {
        let y = 60;
        for (const [type, expire] of Object.entries(this.activeEffects)) {
            if (expire > Date.now()) {
                const conf = POWERUP_CONFIG[type];
                const timeLeft = Math.ceil((expire - Date.now()) / 1000);
                this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
                this.ctx.fillRect(10, y, 100, 4);
                const pct = (expire - Date.now()) / conf.duration;
                this.ctx.fillStyle = conf.color;
                this.ctx.fillRect(10, y, 100 * pct, 4);
                this.ctx.shadowColor = 'black';
                this.ctx.shadowBlur = 2;
                this.ctx.font = 'bold 12px Outfit, sans-serif';
                this.ctx.textAlign = 'left';
                this.ctx.fillText(`${conf.label} ${timeLeft}s`, 10, y - 2);
                this.ctx.shadowBlur = 0;
                y += 25;
            }
        }
    }
}

/* === MENU MANAGER === */
class MenuManager {
    constructor() {
        this.currentScreen = 'main-menu';
        this.setupMenus();
    }

    setupMenus() {
        // Main Menu buttons
        const campaignBtn = document.getElementById('campaign-btn');
        const timeAttackBtn = document.getElementById('time-attack-btn');

        if (campaignBtn) {
            campaignBtn.onclick = () => this.showGameScreen('campaign');
        }
        if (timeAttackBtn) {
            timeAttackBtn.onclick = () => this.showGameScreen('timeattack');
        }

        document.getElementById('how-to-play-btn').onclick = () => this.showScreen('how-to-play-screen');
        document.getElementById('settings-btn').onclick = () => this.showScreen('settings-screen');

        // Back buttons
        document.getElementById('back-from-tutorial-btn').onclick = () => this.showScreen('main-menu');
        document.getElementById('back-from-settings-btn').onclick = () => this.showScreen('main-menu');

        // Settings - load saved preferences
        const soundToggle = document.getElementById('sound-toggle');
        const musicToggle = document.getElementById('music-toggle');

        // Load saved settings
        const savedSound = localStorage.getItem('snakeSoundEnabled');
        const savedMusic = localStorage.getItem('snakeMusicEnabled');

        if (savedSound !== null) {
            soundToggle.checked = savedSound === 'true';
        }
        if (savedMusic !== null) {
            musicToggle.checked = savedMusic === 'true';
        }

        // Apply settings when game is ready
        setTimeout(() => {
            if (window.game) {
                window.game.sound.setEnabled(soundToggle.checked);
                window.game.music.setEnabled(musicToggle.checked);
            }
        }, 100);

        // Sound toggle handler
        soundToggle.addEventListener('change', (e) => {
            const enabled = e.target.checked;
            localStorage.setItem('snakeSoundEnabled', enabled);
            if (window.game) {
                window.game.sound.setEnabled(enabled);
            }
        });

        // Music toggle handler
        musicToggle.addEventListener('change', (e) => {
            const enabled = e.target.checked;
            localStorage.setItem('snakeMusicEnabled', enabled);
            if (window.game) {
                window.game.music.setEnabled(enabled);
                if (!enabled) {
                    window.game.music.stop();
                }
            }
        });

        // Pause menu
        document.getElementById('pause-btn').onclick = () => this.showPauseMenu();
        document.getElementById('resume-btn').onclick = () => this.resumeGame();
        document.getElementById('restart-btn').onclick = () => this.restartGame();
        document.getElementById('quit-btn').onclick = () => this.quitToMenu();
    }

    showScreen(screenId) {
        document.querySelectorAll('.menu-screen').forEach(s => s.classList.remove('visible'));
        document.getElementById('game-screen').classList.remove('active');
        document.getElementById(screenId).classList.add('visible');
        this.currentScreen = screenId;
        
        // Track screen views for analytics
        if (window.game && window.game.poki) {
            window.game.poki.trackScreenView(screenId);
        }
    }

    showGameScreen(mode = 'campaign') {
        document.querySelectorAll('.menu-screen').forEach(s => s.classList.remove('visible'));
        document.getElementById('game-screen').classList.add('active');
        this.currentScreen = 'game-screen';

        if (window.game) {
            if (mode === 'timeattack') {
                window.game.startTimeAttack();
            } else {
                window.game.startCampaign();
            }
        }
    }

    showPauseMenu() {
        if (window.game && window.game.isRunning) {
            window.game.pause();
            document.getElementById('pause-menu').classList.add('visible');
        }
    }

    resumeGame() {
        document.getElementById('pause-menu').classList.remove('visible');
        if (window.game) {
            window.game.resume();
        }
    }

    restartGame() {
        document.getElementById('pause-menu').classList.remove('visible');
        if (window.game) {
            // Stop current game first
            window.game.isRunning = false;
            clearInterval(window.game.gameInterval);
            window.game.music.stop();

            // Clear time attack timer
            if (window.game.timeAttackInterval) {
                clearInterval(window.game.timeAttackInterval);
                window.game.timeAttackInterval = null;
            }

            // Restart based on mode
            if (window.game.isTimeAttack) {
                window.game.startTimeAttack();
            } else {
                window.game.startLevel();
            }
        }
    }

    quitToMenu() {
        document.getElementById('pause-menu').classList.remove('visible');
        if (window.game) {
            window.game.isRunning = false;
            clearInterval(window.game.gameInterval);
        }
        this.showScreen('main-menu');
    }
}

/* === INITIALIZATION === */
window.addEventListener('DOMContentLoaded', () => {
    window.menuManager = new MenuManager();
    window.game = new Game();
    
    // Track session start
    if (window.game && window.game.poki) {
        window.game.poki.trackSessionStart();
    }
    
    // Track session end when page unloads
    window.addEventListener('beforeunload', () => {
        if (window.game && window.game.poki) {
            window.game.poki.trackSessionEnd();
        }
    });
});
