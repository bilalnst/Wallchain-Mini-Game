// Game State
const gameState = {
    running: false,
    score: 0,
    quacksDodged: 0,
    speed: 1,
    streak: 0,
    bestStreak: 0
};

// Canvas Setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Image assets
const images = {
    player: null,
    playerLoaded: false,
    quack: null,
    quackLoaded: false
};

// Load all images
function loadImages() {
    // Load player image (karakter.png)
    images.player = new Image();
    images.player.onload = function() {
        images.playerLoaded = true;
        console.log('Player image loaded successfully:', images.player.src);
    };
    images.player.onerror = function() {
        console.log('Player image not found, using drawn character');
        images.playerLoaded = false;
    };
    images.player.src = 'assets/karakter.png';
    
    // Load quack image (Civciv.png)
    images.quack = new Image();
    images.quack.onload = function() {
        images.quackLoaded = true;
        console.log('Quack image loaded successfully:', images.quack.src);
    };
    images.quack.onerror = function() {
        console.log('Quack image not found, using drawn quack');
        images.quackLoaded = false;
    };
    images.quack.src = 'assets/Civciv.png';
}

// Resize the canvas to match the viewport
function resizeCanvas() {
    const maxWidth = Math.min(800, window.innerWidth * 0.9);
    const maxHeight = Math.min(600, window.innerHeight * 0.7);
    canvas.width = maxWidth;
    canvas.height = maxHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Game Objects
const player = {
    x: 100,
    y: canvas.height / 2,
    width: 50,
    height: 60,
    velocityY: 0,
    onGround: false,
    canDoubleJump: true,
    jumpPower: -15,
    gravity: 0.8,
    groundY: canvas.height - 100
};

const quacks = [];
const bonuses = [];
const particles = [];

// Bonus Types
const BonusType = {
    MINSHARE_ORB: 'mindshare',
    SPEED_BOOST: 'speed',
    MYSTERY_DUCK: 'mystery'
};

// Timing
let lastQuackTime = 0;
let quackSpawnInterval = 2000;
let lastBonusTime = 0;
let bonusSpawnInterval = 8000;
let lastFrameTime = 0;

// Input Handling
let lastClickTime = 0;
const DOUBLE_CLICK_THRESHOLD = 300;

// Leaderboard
function getLeaderboard() {
    const stored = localStorage.getItem('quackJumpLeaderboard');
    return stored ? JSON.parse(stored) : [];
}

function saveToLeaderboard(score, quacksDodged) {
    const leaderboard = getLeaderboard();
    const name = prompt('Enter your name (for leaderboard):') || 'Anonymous';
    leaderboard.push({
        name,
        score,
        quacksDodged,
        date: new Date().toISOString()
    });
    leaderboard.sort((a, b) => b.score - a.score);
    if (leaderboard.length > 10) leaderboard.pop();
    localStorage.setItem('quackJumpLeaderboard', JSON.stringify(leaderboard));
}

function displayLeaderboard() {
    const leaderboard = getLeaderboard();
    const list = document.getElementById('leaderboardList');
    if (leaderboard.length === 0) {
        list.innerHTML = '<p style="text-align: center; color: rgba(255,255,255,0.5);">No records yet. Be the first!</p>';
        return;
    }
    list.innerHTML = leaderboard.map((entry, index) => `
        <div class="leaderboard-item">
            <span class="leaderboard-rank">#${index + 1}</span>
            <span class="leaderboard-name">${entry.name}</span>
            <span class="leaderboard-score">${entry.score} pts</span>
        </div>
    `).join('');
}

// Quack Class
class Quack {
    constructor() {
        this.width = 40;
        this.height = 40;
        this.x = canvas.width;
        const groundLevel = player.groundY - this.height;
        const altitudeSteps = [0, 80, 150];
        const chosenOffset = altitudeSteps[Math.floor(Math.random() * altitudeSteps.length)];
        this.baseY = Math.max(40, groundLevel - chosenOffset);
        this.y = this.baseY;
        this.speed = 3 + gameState.speed * 0.5;
        this.passed = false;
    }

    update() {
        this.x -= this.speed;
        // Small vertical bounce to keep the duck lively
        this.y = this.baseY + Math.sin(Date.now() * 0.01 + this.x) * 2;
    }

    draw() {
        // If quack image is loaded, use it; otherwise draw quack
        if (images.quackLoaded && images.quack) {
            // Draw image with glow effect
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#FFD700';
            ctx.drawImage(
                images.quack,
                this.x,
                this.y,
                this.width,
                this.height
            );
            ctx.shadowBlur = 0;
            return;
        }
        
        // Fallback: Draw quack if image not loaded
        // Quack body (yellow)
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.ellipse(this.x + this.width/2, this.y + this.height/2, this.width/2, this.height/2, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Quack glow
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#FFD700';
        ctx.fill();
        ctx.shadowBlur = 0;
        
        // Quack eyes
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(this.x + this.width/2 - 8, this.y + this.height/2 - 5, 4, 0, Math.PI * 2);
        ctx.arc(this.x + this.width/2 + 8, this.y + this.height/2 - 5, 4, 0, Math.PI * 2);
        ctx.fill();
        
        // Quack beak
        ctx.fillStyle = '#FF6B35';
        ctx.beginPath();
        ctx.moveTo(this.x + this.width/2, this.y + this.height/2 + 5);
        ctx.lineTo(this.x + this.width/2 - 5, this.y + this.height/2 + 15);
        ctx.lineTo(this.x + this.width/2 + 5, this.y + this.height/2 + 15);
        ctx.closePath();
        ctx.fill();
    }

    isOffScreen() {
        return this.x + this.width < 0;
    }

    checkCollision() {
        return player.x < this.x + this.width &&
               player.x + player.width > this.x &&
               player.y < this.y + this.height &&
               player.y + player.height > this.y;
    }
}

// Bonus Class
class Bonus {
    constructor(type) {
        this.type = type;
        this.width = 30;
        this.height = 30;
        this.x = canvas.width;
        this.y = Math.random() * (canvas.height - 200) + 50;
        this.speed = 2 + gameState.speed * 0.3;
        this.collected = false;
        this.rotation = 0;
    }

    update() {
        this.x -= this.speed;
        this.rotation += 0.1;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x + this.width/2, this.y + this.height/2);
        ctx.rotate(this.rotation);
        
        switch(this.type) {
            case BonusType.MINSHARE_ORB:
                // Mindshare orb (glowing blue)
                const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.width/2);
                gradient.addColorStop(0, '#00FFFF');
                gradient.addColorStop(1, '#0088FF');
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(0, 0, this.width/2, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 20;
                ctx.shadowColor = '#00FFFF';
                ctx.fill();
                ctx.shadowBlur = 0;
                break;
                
            case BonusType.SPEED_BOOST:
                // Speed boost (red/yellow)
                ctx.fillStyle = '#FF4444';
                ctx.beginPath();
                ctx.arc(0, 0, this.width/2, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#FFFF00';
                ctx.font = 'bold 20px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('⚡', 0, 0);
                break;
                
            case BonusType.MYSTERY_DUCK:
                // Mystery duck (purple/neon)
                ctx.fillStyle = '#9D4EDD';
                ctx.beginPath();
                ctx.ellipse(0, 0, this.width/2, this.height/2, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#FFD700';
                ctx.font = 'bold 18px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('?', 0, 0);
                break;
        }
        
        ctx.restore();
    }

    isOffScreen() {
        return this.x + this.width < 0;
    }

    checkCollision() {
        return player.x < this.x + this.width &&
               player.x + player.width > this.x &&
               player.y < this.y + this.height &&
               player.y + player.height > this.y;
    }

    collect() {
        if (this.collected) return;
        this.collected = true;
        
        switch(this.type) {
            case BonusType.MINSHARE_ORB:
                gameState.score += 100;
                createParticles(this.x + this.width/2, this.y + this.height/2, '#00FFFF');
                break;
                
            case BonusType.SPEED_BOOST:
                gameState.speed = Math.min(gameState.speed + 0.5, 5);
                createParticles(this.x + this.width/2, this.y + this.height/2, '#FF4444');
                break;
                
            case BonusType.MYSTERY_DUCK:
                const reward = Math.random();
                if (reward < 0.5) {
                    gameState.score += 200;
                } else if (reward < 0.8) {
                    gameState.speed = Math.min(gameState.speed + 0.3, 5);
                } else {
                    gameState.score += 500; // Jackpot!
                }
                createParticles(this.x + this.width/2, this.y + this.height/2, '#9D4EDD');
                break;
        }
    }
}

// Particle System
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 4;
        this.vy = (Math.random() - 0.5) * 4;
        this.life = 1.0;
        this.decay = 0.02;
        this.color = color;
        this.size = Math.random() * 4 + 2;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= this.decay;
    }

    draw() {
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }

    isDead() {
        return this.life <= 0;
    }
}

function createParticles(x, y, color) {
    for (let i = 0; i < 10; i++) {
        particles.push(new Particle(x, y, color));
    }
}

// Draw Background Pattern
function drawBackground() {
    // Dark background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Wallchain pattern (M/W shapes)
    ctx.strokeStyle = 'rgba(255, 255, 0, 0.1)';
    ctx.lineWidth = 1;
    const patternSize = 40;
    for (let x = 0; x < canvas.width; x += patternSize) {
        for (let y = 0; y < canvas.height; y += patternSize) {
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + patternSize/2, y + patternSize/2);
            ctx.lineTo(x + patternSize, y);
            ctx.lineTo(x + patternSize, y + patternSize);
            ctx.lineTo(x + patternSize/2, y + patternSize/2);
            ctx.lineTo(x, y + patternSize);
            ctx.closePath();
            ctx.stroke();
        }
    }
    
    // Ground
    ctx.fillStyle = 'rgba(255, 255, 0, 0.2)';
    ctx.fillRect(0, player.groundY + player.height, canvas.width, canvas.height);
}

// Draw Player - Anime girl with duck hoodie
function drawPlayer() {
    // If image is loaded, use it; otherwise draw character
    if (images.playerLoaded && images.player) {
        // Draw image with glow effect
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#FFD700';
        ctx.drawImage(
            images.player,
            player.x,
            player.y,
            player.width,
            player.height
        );
        ctx.shadowBlur = 0;
        return;
    }
    
    // Fallback: Draw character if image not loaded
    const centerX = player.x + player.width / 2;
    const headY = player.y + 15;
    const bodyY = player.y + 35;
    
    // Brown hair (shoulder length, slightly wavy)
    ctx.fillStyle = '#8B4513';
    ctx.beginPath();
    // Left side of hair
    ctx.ellipse(centerX - 12, headY + 5, 8, 12, -0.3, 0, Math.PI * 2);
    // Right side of hair
    ctx.ellipse(centerX + 12, headY + 5, 8, 12, 0.3, 0, Math.PI * 2);
    // Back hair
    ctx.ellipse(centerX, headY + 8, 15, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Hair highlights
    ctx.fillStyle = '#A0522D';
    ctx.beginPath();
    ctx.ellipse(centerX - 12, headY + 3, 6, 10, -0.3, 0, Math.PI * 2);
    ctx.ellipse(centerX + 12, headY + 3, 6, 10, 0.3, 0, Math.PI * 2);
    ctx.fill();
    
    // Duck hoodie head (black hood)
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(centerX, headY, 18, 0, Math.PI * 2);
    ctx.fill();
    
    // Duck beak on hood (yellow, prominent)
    ctx.fillStyle = '#FFD700';
    ctx.shadowBlur = 5;
    ctx.shadowColor = '#FFD700';
    ctx.beginPath();
    ctx.ellipse(centerX, headY - 3, 9, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    
    // Duck eyes on hood (white circles with black pupils)
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(centerX - 9, headY - 5, 5, 0, Math.PI * 2);
    ctx.arc(centerX + 9, headY - 5, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(centerX - 9, headY - 5, 3, 0, Math.PI * 2);
    ctx.arc(centerX + 9, headY - 5, 3, 0, Math.PI * 2);
    ctx.fill();
    
    // Character face (anime style - visible under hood)
    ctx.fillStyle = '#FFDBAC';
    ctx.beginPath();
    ctx.arc(centerX, headY + 5, 12, 0, Math.PI * 2);
    ctx.fill();
    
    // Character eyes (large, amber/brown)
    ctx.fillStyle = '#D4A574';
    ctx.beginPath();
    ctx.ellipse(centerX - 6, headY + 8, 4, 6, 0, 0, Math.PI * 2);
    ctx.ellipse(centerX + 6, headY + 8, 4, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#654321';
    ctx.beginPath();
    ctx.arc(centerX - 6, headY + 8, 2.5, 0, Math.PI * 2);
    ctx.arc(centerX + 6, headY + 8, 2.5, 0, Math.PI * 2);
    ctx.fill();
    
    // Character mouth (gentle smile)
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(centerX, headY + 12, 3, 0, Math.PI);
    ctx.stroke();
    
    // Black hoodie body (zipper jacket)
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(player.x + 5, bodyY, player.width - 10, player.height - 35);
    
    // Zipper line
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX, bodyY);
    ctx.lineTo(centerX, bodyY + player.height - 35);
    ctx.stroke();
    
    // Zipper teeth
    ctx.fillStyle = '#888';
    for (let y = bodyY + 5; y < bodyY + player.height - 35; y += 8) {
        ctx.fillRect(centerX - 1, y, 2, 3);
    }
    
    // Small logo/design on sleeve (white rectangle)
    ctx.fillStyle = '#fff';
    ctx.fillRect(player.x + 8, bodyY + 8, 8, 6);
    
    // Glow effect around character
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#FFD700';
    ctx.fillRect(player.x, player.y, player.width, player.height);
    ctx.shadowBlur = 0;
}

// Game Loop
function update(deltaTime) {
    if (!gameState.running) return;
    
    // Update player
    player.velocityY += player.gravity;
    player.y += player.velocityY;
    
    // Ground collision
    if (player.y + player.height >= player.groundY) {
        player.y = player.groundY - player.height;
        player.velocityY = 0;
        player.onGround = true;
        player.canDoubleJump = true;
    } else {
        player.onGround = false;
    }
    
    // Spawn quacks
    const now = Date.now();
    if (now - lastQuackTime > quackSpawnInterval / gameState.speed) {
        quacks.push(new Quack());
        lastQuackTime = now;
    }
    
    // Spawn bonuses
    if (now - lastBonusTime > bonusSpawnInterval) {
        const bonusTypes = Object.values(BonusType);
        const randomType = bonusTypes[Math.floor(Math.random() * bonusTypes.length)];
        bonuses.push(new Bonus(randomType));
        lastBonusTime = now;
    }
    
    // Update quacks
    for (let i = quacks.length - 1; i >= 0; i--) {
        quacks[i].update();
        
        // Check if passed
        if (!quacks[i].passed && quacks[i].x + quacks[i].width < player.x) {
            quacks[i].passed = true;
            gameState.quacksDodged++;
            gameState.score += 10;
            gameState.streak++;
            if (gameState.streak > gameState.bestStreak) {
                gameState.bestStreak = gameState.streak;
            }
            createParticles(quacks[i].x + quacks[i].width/2, quacks[i].y + quacks[i].height/2, '#FFD700');
        }
        
        // Check collision - if player hits a quack (couldn't jump over it), game over
        if (quacks[i].checkCollision()) {
            // Player hit a quack - game over
            gameOver();
            return;
        }
        
        // Remove off-screen quacks
        if (quacks[i].isOffScreen()) {
            quacks.splice(i, 1);
        }
    }
    
    // Update bonuses
    for (let i = bonuses.length - 1; i >= 0; i--) {
        bonuses[i].update();
        
        if (bonuses[i].checkCollision() && !bonuses[i].collected) {
            bonuses[i].collect();
        }
        
        if (bonuses[i].isOffScreen() || bonuses[i].collected) {
            bonuses.splice(i, 1);
        }
    }
    
    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        if (particles[i].isDead()) {
            particles.splice(i, 1);
        }
    }
    
    // Update UI
    updateUI();
    
    // Gradually increase speed
    gameState.speed = Math.min(gameState.speed + 0.0005, 5);
}

function draw() {
    drawBackground();
    
    // Draw ground line
    ctx.strokeStyle = 'rgba(255, 255, 0, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, player.groundY + player.height);
    ctx.lineTo(canvas.width, player.groundY + player.height);
    ctx.stroke();
    
    // Draw bonuses
    bonuses.forEach(bonus => bonus.draw());
    
    // Draw quacks
    quacks.forEach(quack => quack.draw());
    
    // Draw player
    drawPlayer();
    
    // Draw particles
    particles.forEach(particle => particle.draw());
}

function gameLoop(timestamp) {
    const deltaTime = timestamp - lastFrameTime;
    lastFrameTime = timestamp;
    
    update(deltaTime);
    draw();
    
    requestAnimationFrame(gameLoop);
}

// Input Handling
function handleJump() {
    const now = Date.now();
    const timeSinceLastClick = now - lastClickTime;
    
    if (timeSinceLastClick < DOUBLE_CLICK_THRESHOLD && player.canDoubleJump && !player.onGround) {
        // Double jump
        player.velocityY = player.jumpPower * 1.2;
        player.canDoubleJump = false;
        createParticles(player.x + player.width/2, player.y + player.height/2, '#00FFFF');
    } else {
        // Single jump
        if (player.onGround) {
            player.velocityY = player.jumpPower;
            player.onGround = false;
        } else if (player.canDoubleJump) {
            // Double jump from air
            player.velocityY = player.jumpPower * 1.2;
            player.canDoubleJump = false;
            createParticles(player.x + player.width/2, player.y + player.height/2, '#00FFFF');
        }
    }
    
    lastClickTime = now;
}

canvas.addEventListener('click', handleJump);
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    handleJump();
});

// Game Control Functions
function startGame() {
    gameState.running = true;
    gameState.score = 0;
    gameState.quacksDodged = 0;
    gameState.speed = 1;
    gameState.streak = 0;
    
    player.y = player.groundY - player.height;
    player.velocityY = 0;
    player.onGround = true;
    player.canDoubleJump = true;
    
    quacks.length = 0;
    bonuses.length = 0;
    particles.length = 0;
    
    lastQuackTime = Date.now();
    lastBonusTime = Date.now();
    lastFrameTime = performance.now();
    
    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('gameOverScreen').classList.add('hidden');
}

function gameOver() {
    gameState.running = false;
    gameState.streak = 0;
    
    document.getElementById('finalScore').textContent = gameState.score;
    document.getElementById('finalQuacks').textContent = gameState.quacksDodged;
    document.getElementById('finalStreak').textContent = gameState.bestStreak;
    
    // Random game over messages
    const messages = [
        "Quack overwhelmed you. Touch grass 🦆🌱",
        "Too many quacks! QUACK ATTACK! 🦆💥",
        "You got quacked! Better luck next time 🦆",
        "Mindshare insufficient! Try again 🦆✨"
    ];
    document.getElementById('gameOverMessage').textContent = messages[Math.floor(Math.random() * messages.length)];
    
    document.getElementById('gameOverScreen').classList.remove('hidden');
    
    // Auto-save to leaderboard if score is good
    const leaderboard = getLeaderboard();
    if (leaderboard.length < 10 || gameState.score > leaderboard[leaderboard.length - 1].score) {
        saveToLeaderboard(gameState.score, gameState.quacksDodged);
    }
}

function updateUI() {
    document.getElementById('score').textContent = gameState.score;
    document.getElementById('quacks-dodged').textContent = gameState.quacksDodged;
    document.getElementById('speed').textContent = gameState.speed.toFixed(1) + 'x';
}

// UI Event Listeners
document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', () => {
    document.getElementById('gameOverScreen').classList.add('hidden');
    startGame();
});
document.getElementById('leaderboardBtn').addEventListener('click', () => {
    displayLeaderboard();
    document.getElementById('gameOverScreen').classList.add('hidden');
    document.getElementById('leaderboardScreen').classList.remove('hidden');
});
document.getElementById('backBtn').addEventListener('click', () => {
    document.getElementById('leaderboardScreen').classList.add('hidden');
    document.getElementById('gameOverScreen').classList.remove('hidden');
});

// Load images when page loads
loadImages();

// Start game loop
requestAnimationFrame(gameLoop);

// Initial draw
draw();

