// js/game.js

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('score');
const livesDisplay = document.getElementById('lives');
const startScreen = document.getElementById('startScreen');
const startButton = document.getElementById('startButton');
const gameOverScreen = document.getElementById('gameOverScreen');
const continueButton = document.getElementById('continueButton');
const restartButton = document.getElementById('restartButton');

const controlsDiv = document.getElementById('controls');
const leftButton = document.getElementById('leftButton');
const rightButton = document.getElementById('rightButton');
const jumpButton = document.getElementById('jumpButton');

const stageClearScreen = document.getElementById('stageClearScreen');
const nextStageButton = document.getElementById('nextStageButton');
const restartFromClearButton = document.getElementById('restartFromClearButton');

canvas.width = 500;
canvas.height = 500;

// ====================================================================
// ゲームの状態変数
// ====================================================================
let gameRunning = false;
let score = 0;
let lives = 3;
let continueCount = 3;
let backgroundX = 0;
const backgroundScrollSpeed = 1;
let gameSpeed = 1.5; // 強制スクロールの速さ (ステージによって変更)

let lastEnemySpawnTime = 0;
const enemySpawnInterval = 1500;

let lastItemSpawnTime = 0;
const itemSpawnInterval = 5000;

let isGamePausedForDamage = false;
let damagePauseTimer = 0;
const DAMAGE_PAUSE_DURATION = 150;

let currentStage = 1;
const MAX_STAGES = 2;
let isStageClearItemSpawned = false;

// ====================================================================
// オーディオ関連
// ====================================================================
const bgm = document.getElementById('bgm');
const bgmStage2 = document.getElementById('bgmStage2'); // ステージ2 BGMを追加
const jumpSound = document.getElementById('jumpSound');
const hitSound = document.getElementById('hitSound');
const enemyHitSound = document.getElementById('enemyHitSound');
const collectItemSound = document.getElementById('collectItemSound');
const blockHitSound = document.getElementById('blockHitSound');
const stageClearSound = document.getElementById('stageClearSound');
const shootSound = document.getElementById('shootSound'); // 射撃音を追加

function playSound(audioElement) {
    if (audioElement) {
        audioElement.currentTime = 0;
        audioElement.play().catch(e => console.warn("Audio play error:", e));
    }
}

function stopBGM() {
    bgm.pause();
    bgm.currentTime = 0;
    bgmStage2.pause(); // ステージ2 BGMも停止
    bgmStage2.currentTime = 0;
}

function playBGMForCurrentStage() {
    stopBGM(); // まず全て停止
    if (currentStage === 1) {
        bgm.play().catch(e => console.warn("BGM play error:", e));
    } else if (currentStage === 2) {
        bgmStage2.play().catch(e => console.warn("Stage 2 BGM play error:", e));
    }
}

// ====================================================================
// アセットの読み込み
// ====================================================================
const assets = {
    playerRun: { img: new Image(), src: 'assets/images/player_run.png' },
    playerJump: { img: new Image(), src: 'assets/images/player_jump.png' },
    enemy: { img: new Image(), src: 'assets/images/enemy.png' },
    flyingEnemy: { img: new Image(), src: 'assets/images/flying_enemy.png' },
    groundEnemy2: { img: new Image(), src: 'assets/images/ground_enemy.png' },
    stage2Enemy: { img: new Image(), src: 'assets/images/stage2_enemy.png' },
    block: { img: new Image(), src: 'assets/images/block.png' },
    breakableBlock: { img: new Image(), src: 'assets/images/breakable_block.png' },
    healthItem: { img: new Image(), src: 'assets/images/health_item.png' },
    invincibilityItem: { img: new Image(), src: 'assets/images/invincibility_item.png' },
    stageClearItem: { img: new Image(), src: 'assets/images/stage_clear_item.png' },
    background: { img: new Image(), src: 'assets/images/background.png' },
    backgroundStage2: { img: new Image(), src: 'assets/images/background_stage2.png' }, // ステージ2背景
    shootItem: { img: new Image(), src: 'assets/images/shoot_item.png' }, // 射撃能力アイテム
    playerProjectile: { img: new Image(), src: 'assets/images/player_projectile.png' }, // プレイヤーの弾
};

let assetsLoadedCount = 0;
const totalAssets = Object.keys(assets).length;

function loadAssets() {
    return new Promise((resolve) => {
        for (const key in assets) {
            assets[key].img.onload = () => {
                assetsLoadedCount++;
                console.log(`Loaded: ${assets[key].src} (${assetsLoadedCount}/${totalAssets})`);
                if (assetsLoadedCount === totalAssets) {
                    resolve();
                }
            };
            assets[key].img.onerror = (e) => {
                console.error(`Failed to load ${assets[key].src}:`, e);
                assetsLoadedCount++;
                if (assetsLoadedCount === totalAssets) {
                    resolve();
                }
            };
            assets[key].img.src = assets[key].src;
        }
    });
}

// ====================================================================
// プレイヤーオブジェクト
// ====================================================================
const player = {
    x: 100,
    y: canvas.height - 50 - 50,
    width: 50,
    height: 50,
    velocityY: 0,
    isJumping: false,
    jumpCount: 0,
    maxJumpCount: 2,
    speedX: 0,
    maxSpeedX: 5,
    gravity: 0.8,
    jumpStrength: -15,

    currentFrame: 0,
    frameCounter: 0,
    animationSpeed: 5,
    maxRunFrames: 6,
    maxJumpFrames: 1,
    frameWidth: 32,
    frameHeight: 32,

    isInvincible: false,
    invincibleTimer: 0,
    invincibleDuration: 3000,
    blinkTimer: 0,
    blinkInterval: 50,

    canShoot: false, // 射撃能力を持っているか
    shootCooldown: 0,
    maxShootCooldown: 300, // 射撃クールダウン (ミリ秒)
    projectileSpeed: 10,
    projectileDamage: 50, // 敵に与えるダメージ

    draw() {
        if (this.isInvincible && Math.floor(this.blinkTimer / this.blinkInterval) % 2 === 0) {
            return;
        }

        let currentImage = assets.playerRun.img;
        let sx = 0;

        if (this.isJumping) {
            currentImage = assets.playerJump.img;
            sx = this.currentFrame * this.frameWidth;
        } else {
            currentImage = assets.playerRun.img;
            if (this.speedX === 0) {
                sx = 0;
            } else {
                sx = this.currentFrame * this.frameWidth;
            }
        }

        if (currentImage.complete && currentImage.naturalHeight !== 0) {
            ctx.drawImage(currentImage,
                          sx, 0,
                          this.frameWidth, this.frameHeight,
                          this.x, this.y,
                          this.width, this.height);
        } else {
            ctx.fillStyle = 'red';
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
    },

    update(deltaTime) {
        if (isGamePausedForDamage) {
            return;
        }

        this.x += this.speedX;
        if (this.x < 0) this.x = 0;
        if (this.x + this.width > canvas.width) this.x = canvas.width - this.width;

        this.y += this.velocityY;
        this.velocityY += this.gravity;

        let onGround = false;
        const groundLevel = canvas.height - this.height;

        for (const block of blocks) {
            if (checkCollision(this, block) && this.velocityY >= 0) {
                if (this.y + this.height - this.velocityY <= block.y) {
                    this.y = block.y - this.height;
                    this.velocityY = 0;
                    this.isJumping = false;
                    this.jumpCount = this.maxJumpCount;
                    onGround = true;
                    break;
                }
            }
        }

        if (this.y >= groundLevel && !onGround) {
            this.y = groundLevel;
            this.velocityY = 0;
            this.isJumping = false;
            this.jumpCount = this.maxJumpCount;
            onGround = true;
        }

        if (this.isInvincible) {
            this.invincibleTimer -= deltaTime;
            this.blinkTimer += deltaTime;
            if (this.blinkTimer >= this.blinkInterval * 2) {
                this.blinkTimer = 0;
            }
            if (this.invincibleTimer <= 0) {
                this.isInvincible = false;
                this.invincibleTimer = 0;
                this.blinkTimer = 0;
            }
        }

        // 射撃クールダウンの更新
        if (this.shootCooldown > 0) {
            this.shootCooldown -= deltaTime;
        }

        this.frameCounter++;
        if (this.frameCounter >= this.animationSpeed) {
            this.frameCounter = 0;
            if (this.isJumping) {
                this.currentFrame = (this.currentFrame + 1) % this.maxJumpFrames;
            } else if (this.speedX !== 0) {
                this.currentFrame = (this.currentFrame + 1) % this.maxRunFrames;
            } else {
                this.currentFrame = 0;
            }
        }
    },

    jump() {
        if (this.jumpCount > 0) {
            this.velocityY = this.jumpStrength;
            this.isJumping = true;
            this.jumpCount--;
            playSound(jumpSound);
            this.currentFrame = 0;
        }
    },

    takeDamage() {
        if (this.isInvincible) return;

        lives--;
        playSound(hitSound);
        updateUI();
        this.isInvincible = true;
        this.invincibleTimer = this.invincibleDuration;
        this.blinkTimer = 0;
        this.canShoot = false; // ダメージを受けると射撃能力を失う

        isGamePausedForDamage = true;
        damagePauseTimer = DAMAGE_PAUSE_DURATION;

        if (lives <= 0) {
            gameOver();
        }
    },

    heal() {
        if (lives < 3) {
            lives++;
            playSound(collectItemSound);
            updateUI();
        }
    },

    gainInvincibility() {
        this.isInvincible = true;
        this.invincibleTimer = this.invincibleDuration;
        this.blinkTimer = 0;
        playSound(collectItemSound);
    },

    // 射撃能力を取得
    gainShootAbility() {
        this.canShoot = true;
        this.shootCooldown = 0; // すぐ撃てるように
        playSound(collectItemSound); // アイテム取得音
    },

    // 射撃メソッド
    shoot() {
        if (this.canShoot && this.shootCooldown <= 0) {
            const projectileWidth = 20;
            const projectileHeight = 20;
            const projectileX = this.x + this.width;
            const projectileY = this.y + this.height / 2 - projectileHeight / 2;
            projectiles.push(new Projectile(projectileX, projectileY, projectileWidth, projectileHeight, this.projectileSpeed, this.projectileDamage, assets.playerProjectile.img));
            playSound(shootSound);
            this.shootCooldown = this.maxShootCooldown;
        }
    }
};

// ====================================================================
// 敵オブジェクト基底クラス
// ====================================================================
class Enemy {
    constructor(x, y, width, height, speed, image) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.initialHeight = height;
        this.speed = speed;
        this.image = image;
        this.active = true;
        this.isStomped = false;
        this.stompedTimer = 0;
        this.stompedDuration = 200;
        this.squishFactor = 0.2;
    }

    draw() {
        if (!this.active) return;

        let currentHeight = this.height;
        let currentY = this.y;
        let currentImage = this.image;

        if (this.isStomped) {
            currentHeight = this.initialHeight * this.squishFactor;
            currentY = this.y + (this.initialHeight - currentHeight);
        }

        if (currentImage.complete && currentImage.naturalHeight !== 0) {
            ctx.drawImage(currentImage, this.x, currentY, this.width, currentHeight);
        } else {
            ctx.fillStyle = 'green';
            ctx.fillRect(this.x, currentY, this.width, currentHeight);
        }
    }

    update(deltaTime) {
        if (isGamePausedForDamage) {
            return;
        }
        if (this.isStomped) {
            this.stompedTimer -= deltaTime;
            if (this.stompedTimer <= 0) {
                this.active = false;
            }
        } else {
            this.x -= this.speed * gameSpeed;
            if (this.x + this.width < 0) {
                this.active = false;
            }
        }
    }
}

// ====================================================================
// 飛行する敵クラス
// ====================================================================
class FlyingEnemy extends Enemy {
    constructor(x, y, width, height, speed, amplitude, frequency) {
        super(x, y, width, height, speed, assets.flyingEnemy.img);
        this.startY = y;
        this.amplitude = amplitude;
        this.frequency = frequency;
        this.angle = Math.random() * Math.PI * 2;
    }

    update(deltaTime) {
        super.update(deltaTime);
        if (isGamePausedForDamage || this.isStomped) {
            return;
        }
        this.angle += this.frequency * gameSpeed;
        this.y = this.startY + Math.sin(this.angle) * this.amplitude;
    }
}

// ====================================================================
// 地上敵2クラス
// ====================================================================
class GroundEnemy2 extends Enemy {
    constructor(x, y, width, height, speed) {
        super(x, y, width, height, speed, assets.groundEnemy2.img);
    }
}

// === ステージ2の新しい地上敵クラス ===
class Stage2GroundEnemy extends Enemy {
    constructor(x, y, width, height, speed) {
        super(x, y, width, height, speed, assets.stage2Enemy.img);
    }
}
// ------------------------------------

let enemies = [];

function spawnEnemy() {
    const random = Math.random();
    let enemyWidth, enemyHeight, enemySpeed;

    if (currentStage === 1) {
        if (random < 0.4) {
            enemyWidth = 80;
            enemyHeight = 40;
            enemySpeed = 2 + Math.random() * 2;
            enemies.push(new Enemy(canvas.width, canvas.height - enemyHeight, enemyWidth, enemyHeight, enemySpeed, assets.enemy.img));
        } else if (random < 0.7) {
            enemyWidth = 50;
            enemyHeight = 30;
            enemySpeed = 1.5 + Math.random() * 1.5;
            const flyY = canvas.height * 0.4 + Math.random() * (canvas.height * 0.2);
            const amplitude = 20 + Math.random() * 30;
            const frequency = 0.05 + Math.random() * 0.05;
            enemies.push(new FlyingEnemy(canvas.width, flyY, enemyWidth, enemyHeight, enemySpeed, amplitude, frequency));
        } else {
            enemyWidth = 80;
            enemyHeight = 110;
            enemySpeed = 2.5 + Math.random() * 1.5;
            enemies.push(new GroundEnemy2(canvas.width, canvas.height - enemyHeight, enemyWidth, enemyHeight, enemySpeed));
        }
    } else if (currentStage === 2) {
        if (random < 0.3) {
            enemyWidth = 80;
            enemyHeight = 40;
            enemySpeed = 2.5 + Math.random() * 2;
            enemies.push(new Enemy(canvas.width, canvas.height - enemyHeight, enemyWidth, enemyHeight, enemySpeed, assets.enemy.img));
        } else if (random < 0.6) {
            enemyWidth = 50;
            enemyHeight = 30;
            enemySpeed = 2 + Math.random() * 1.5;
            const flyY = canvas.height * 0.4 + Math.random() * (canvas.height * 0.2);
            const amplitude = 30 + Math.random() * 30;
            const frequency = 0.06 + Math.random() * 0.05;
            enemies.push(new FlyingEnemy(canvas.width, flyY, enemyWidth, enemyHeight, enemySpeed, amplitude, frequency));
        } else {
            enemyWidth = 70;
            enemyHeight = 70;
            enemySpeed = 3 + Math.random() * 2.5;
            enemies.push(new Stage2GroundEnemy(canvas.width, canvas.height - enemyHeight, enemyWidth, enemyHeight, enemySpeed));
        }
    }
}

// ====================================================================
// プロジェクタイル（弾丸）オブジェクト (新規追加)
// ====================================================================
class Projectile {
    constructor(x, y, width, height, speedX, damage, image) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.speedX = speedX;
        this.damage = damage;
        this.image = image;
        this.active = true;
    }

    draw() {
        if (!this.active) return;
        if (this.image.complete && this.image.naturalHeight !== 0) {
            ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
        } else {
            ctx.fillStyle = 'blue';
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
    }

    update(deltaTime) {
        if (isGamePausedForDamage) return; // ゲーム一時停止中は弾も停止
        this.x += this.speedX;
        if (this.x > canvas.width || this.x < 0) {
            this.active = false;
        }
    }
}

let projectiles = []; // 弾丸を格納する配列
// ----------------------------------------------------

// ====================================================================
// ブロックオブジェクト
// ====================================================================
class Block {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.image = assets.block.img;
    }

    draw() {
        if (this.image.complete && this.image.naturalHeight !== 0) {
            ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
        } else {
            ctx.fillStyle = 'brown';
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
    }

    update(deltaTime) {
        if (isGamePausedForDamage) {
            return;
        }
        this.x -= backgroundScrollSpeed * gameSpeed;
    }
}

// ====================================================================
// アイテム出現ブロッククラス
// ====================================================================
class BreakableBlock extends Block {
    constructor(x, y, width, height, hasItem = false, itemType = 'health') {
        super(x, y, width, height);
        this.image = assets.breakableBlock.img;
        this.isBroken = false;
        this.hasItem = hasItem;
        this.itemType = itemType;
        this.originalHeight = height;
        this.breakTimer = 0;
        this.breakDuration = 100;
    }

    draw() {
        if (this.isBroken) {
            if (this.breakTimer > 0) {
                if (this.image.complete && this.image.naturalHeight !== 0) {
                     ctx.drawImage(this.image, this.x, this.y, this.width, this.originalHeight * 0.5);
                } else {
                    ctx.fillStyle = 'gray';
                    ctx.fillRect(this.x, this.y + this.originalHeight * 0.2, this.width, this.originalHeight * 0.8);
                }
            }
            return;
        }
        super.draw();
    }

    update(deltaTime) {
        super.update(deltaTime);
        if (this.isBroken) {
            this.breakTimer -= deltaTime;
            if (this.breakTimer <= 0) {
            }
        }
    }

    hitFromBelow() {
        if (this.isBroken) return;
        this.isBroken = true;
        this.breakTimer = this.breakDuration;
        playSound(blockHitSound);

        if (this.hasItem) {
            const itemWidth = 30;
            const itemHeight = 30;
            const itemX = this.x + this.width / 2 - itemWidth / 2;
            const itemY = this.y - itemHeight - 5;

            const spawnedItem = new Item(itemX, itemY, itemWidth, itemHeight, this.itemType);
            items.push(spawnedItem);
        }
    }
}

let blocks = [];

// ====================================================================
// ステージの要素をセットアップする関数 (新しい関数)
// ====================================================================
function setupStageElements(stageNum) {
    blocks = []; // ブロックをリセット

    // ステージごとの設定
    if (stageNum === 1) {
        gameSpeed = 1.5;
        // ステージ1の初期ブロック配置
        blocks.push(new Block(50, canvas.height - 100, 100, 30));
        blocks.push(new Block(200, canvas.height - 200, 120, 30));
        blocks.push(new Block(350, canvas.height - 100, 80, 30));
    } else if (stageNum === 2) {
        gameSpeed = 2.0; // ステージ2は少し速く
        // ステージ2の初期ブロック配置
        blocks.push(new Block(50, canvas.height - 120, 80, 30));
        blocks.push(new BreakableBlock(180, canvas.height - 220, 60, 30, true, 'health'));
        blocks.push(new Block(300, canvas.height - 150, 100, 30));
        blocks.push(new Block(450, canvas.height - 250, 70, 30));
    }
    // 注意: ここではプレイヤーの状態、敵、アイテム、スコア、ライフはリセットしません。
}

// ====================================================================
// プレイヤーとステージコンテンツをリセットする関数 (新しい関数)
// ====================================================================
function resetPlayerAndStageContent() {
    player.x = 100;
    player.y = canvas.height - 50 - 50;
    player.velocityY = 0;
    player.isJumping = false;
    player.jumpCount = player.maxJumpCount;
    player.isInvincible = false;
    player.invincibleTimer = 0;
    player.canShoot = false; // 射撃能力もリセット

    enemies = []; // 敵をリセット
    items = [];   // アイテムをリセット
    projectiles = []; // 弾丸をリセット
    isStageClearItemSpawned = false; // ステージクリアアイテムもリセット
    backgroundX = 0; // 背景スクロール位置をリセット
}

// ====================================================================
// ゲーム全体を初期状態にリセットする関数 (旧 resetGameToInitialState)
// ====================================================================
function resetFullGame() {
    score = 0;
    lives = 3;
    continueCount = 3; // コンティニュー回数もリセット
    currentStage = 1;
    setupStageElements(currentStage); // ステージ1の要素をセットアップ
    resetPlayerAndStageContent(); // プレイヤーとステージコンテンツをリセット
    updateUI(); // UIを更新
    stopBGM(); // BGMを停止
}
// ------------------------------------

// ====================================================================
// アイテムオブジェクト
// ====================================================================
class Item {
    constructor(x, y, width, height, type) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.type = type;
        if (type === 'health') {
            this.image = assets.healthItem.img;
        } else if (type === 'invincibility') {
            this.image = assets.invincibilityItem.img;
        } else if (type === 'stage_clear') {
            this.image = assets.stageClearItem.img;
        } else if (type === 'shoot_ability') { // 射撃能力アイテムの画像
            this.image = assets.shootItem.img;
        }
        this.active = true;
    }

    draw() {
        if (this.active && this.image.complete && this.image.naturalHeight !== 0) {
            ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
        } else if (!this.active) {
        } else {
            if (this.type === 'health') ctx.fillStyle = 'pink';
            else if (this.type === 'invincibility') ctx.fillStyle = 'gray';
            else if (this.type === 'stage_clear') ctx.fillStyle = 'gold';
            else if (this.type === 'shoot_ability') ctx.fillStyle = 'purple'; // 新アイテムのフォールバック色
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
    }

    update() {
        if (isGamePausedForDamage) {
            return;
        }
        this.x -= backgroundScrollSpeed * gameSpeed;
        if (this.x + this.width < 0) {
            this.active = false;
        }
    }
}

let items = [];

function spawnItem() {
    const itemWidth = 30;
    const itemHeight = 30;
    const itemX = canvas.width;
    const itemY = canvas.height - itemHeight - (Math.random() * 150 + 100);
    
    let itemType;
    const random = Math.random();

    if (currentStage === 1) {
        itemType = random < 0.7 ? 'health' : 'invincibility';
    } else if (currentStage === 2) {
        // ステージ2では射撃能力アイテムも出現
        if (random < 0.5) { // 50% 回復
            itemType = 'health';
        } else if (random < 0.8) { // 30% 無敵
            itemType = 'invincibility';
        } else { // 20% 射撃能力
            itemType = 'shoot_ability';
        }
    }
    items.push(new Item(itemX, itemY, itemWidth, itemHeight, itemType));
}

// ====================================================================
// 衝突判定
// ====================================================================
function checkCollision(obj1, obj2) {
    return obj1.x < obj2.x + obj2.width &&
           obj1.x + obj1.width > obj2.x &&
           obj1.y < obj2.y + obj2.height &&
           obj1.y + obj1.height > obj2.y;
}

// ====================================================================
// ステージクリアに必要なスコアを返す関数
// ====================================================================
function getStageClearScore() {
    switch (currentStage) {
        case 1:
            return 6000;
        case 2:
            return 12000;
        default:
            return 6000;
    }
}

// ====================================================================
// ゲームオーバー処理
// ====================================================================
function gameOver() {
    gameRunning = false;
    stopBGM();
    gameOverScreen.classList.remove('hidden');
    controlsDiv.classList.add('hidden');
    updateContinueButton();
}

function updateContinueButton() {
    continueButton.textContent = `CONTINUE (${continueCount})`;
    if (continueCount <= 0) {
        continueButton.disabled = true;
        continueButton.textContent = `CONTINUE (0)`;
    } else {
        continueButton.disabled = false;
    }
}

// ====================================================================
// ゲームのリセットと開始ロジック
// ====================================================================
function startGameLoop() {
    gameOverScreen.classList.add('hidden');
    stageClearScreen.classList.add('hidden');
    controlsDiv.classList.remove('hidden');
    gameRunning = true;
    playBGMForCurrentStage(); // 現在のステージのBGMを再生
    lastFrameTime = performance.now();
    requestAnimationFrame(gameLoop);
}

function continueGame() {
    if (continueCount > 0) {
        continueCount--;
        lives = 3; // ライフを全回復
        resetPlayerAndStageContent(); // プレイヤーとステージ上のコンテンツをリセット
        setupStageElements(currentStage); // 現在のステージのブロックを再配置 (念のため)
        updateUI(); // UIを更新
        startGameLoop(); // ゲームループを再開
    }
}

function restartGame() {
    resetFullGame(); // ゲームを完全にリセット
    startGameLoop(); // ゲームループを開始
}

function stageClear() {
    gameRunning = false;
    stopBGM();
    playSound(stageClearSound);
    stageClearScreen.classList.remove('hidden');
    controlsDiv.classList.add('hidden');

    if (currentStage < MAX_STAGES) {
        nextStageButton.textContent = "NEXT STAGE";
        nextStageButton.disabled = false;
        nextStageButton.onclick = startNextStage;
    } else {
        nextStageButton.textContent = "GAME COMPLETE!";
        nextStageButton.disabled = true;
    }
}

function startNextStage() {
    if (currentStage < MAX_STAGES) {
        currentStage++;
        lives = 3; // 新しいステージではライフを全回復
        setupStageElements(currentStage); // 新しいステージの要素をセットアップ
        resetPlayerAndStageContent(); // プレイヤーとステージコンテンツをリセット
        updateUI(); // UIを更新
        startGameLoop();
    }
}

// ====================================================================
// UIの更新
// ====================================================================
function updateUI() {
    scoreDisplay.textContent = `Score: ${score} (Stage ${currentStage})`;
    livesDisplay.textContent = `Lives: ${lives}`;
}

let lastFrameTime = 0;

// ====================================================================
// ゲームループ
// ====================================================================
function gameLoop(currentTime) {
    if (!gameRunning) return;

    if (lastFrameTime === 0) {
        lastFrameTime = currentTime;
    }
    const deltaTime = currentTime - lastFrameTime;
    lastFrameTime = currentTime;

    if (isGamePausedForDamage) {
        damagePauseTimer -= deltaTime;
        if (damagePauseTimer <= 0) {
            isGamePausedForDamage = false;
        }
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 背景の描画とスクロール (ステージごとに背景を切り替え)
    let currentBackground = (currentStage === 1) ? assets.background.img : assets.backgroundStage2.img;
    if (!isGamePausedForDamage) {
        if (currentBackground.complete && currentBackground.naturalHeight !== 0) {
            ctx.drawImage(currentBackground, backgroundX, 0, canvas.width, canvas.height);
            ctx.drawImage(currentBackground, backgroundX + canvas.width, 0, canvas.width, canvas.height);
            backgroundX -= backgroundScrollSpeed * gameSpeed;
            if (backgroundX <= -canvas.width) {
                backgroundX = 0;
            }
        } else {
            ctx.fillStyle = (currentStage === 1) ? 'skyblue' : 'darkblue'; // フォールバック色
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
    } else {
        if (currentBackground.complete && currentBackground.naturalHeight !== 0) {
            ctx.drawImage(currentBackground, backgroundX, 0, canvas.width, canvas.height);
            ctx.drawImage(currentBackground, backgroundX + canvas.width, 0, canvas.width, canvas.height);
        } else {
            ctx.fillStyle = (currentStage === 1) ? 'skyblue' : 'darkblue';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
    }

    player.update(deltaTime);
    player.draw();

    if (player.y > canvas.height + 50) {
        player.takeDamage();
        // 落下によるダメージの場合、プレイヤーを安全な位置に戻す
        if (lives > 0) { // まだライフがある場合のみ
            player.x = 100;
            player.y = canvas.height - player.height;
            player.velocityY = 0;
            player.isJumping = false;
            player.jumpCount = player.maxJumpCount;
        }
    }

    if (!isGamePausedForDamage && currentTime - lastEnemySpawnTime > enemySpawnInterval) {
        spawnEnemy();
        lastEnemySpawnTime = currentTime;
    }

    enemies = enemies.filter(enemy => enemy.active || enemy.isStomped);
    enemies.forEach(enemy => {
        enemy.update(deltaTime);
        enemy.draw();

        if (checkCollision(player, enemy) && !enemy.isStomped) {
            const playerBottom = player.y + player.height;
            const enemyTop = enemy.y;

            if (player.velocityY > 0 && playerBottom < enemyTop + enemy.height / 2) {
                enemy.isStomped = true;
                enemy.stompedTimer = enemy.stompedDuration;
                score += 100;
                playSound(enemyHitSound);
                player.velocityY = player.jumpStrength / 2;
                player.isJumping = true;
            } else {
                player.takeDamage();
            }
        }
    });

    // プロジェクタイル (弾丸) の更新と描画、衝突判定
    projectiles = projectiles.filter(p => p.active);
    projectiles.forEach(p => {
        p.update(deltaTime);
        p.draw();

        enemies.forEach(enemy => {
            if (enemy.active && !enemy.isStomped && checkCollision(p, enemy)) {
                // 弾が敵に当たったら、弾と敵を非アクティブ化 (消す)
                p.active = false;
                enemy.active = false; // 敵が消える
                score += 150; // 弾で倒した場合のスコア
                playSound(enemyHitSound); // 敵を倒した音
            }
        });
    });


    blocks = blocks.filter(block => block.x + block.width > 0 && !(block instanceof BreakableBlock && block.isBroken && block.breakTimer <= 0));
    blocks.forEach(block => {
        block.update(deltaTime);
        block.draw();
    });

    if (!isGamePausedForDamage && blocks.length > 0 && blocks[blocks.length - 1].x < canvas.width * 0.8) {
        const lastBlock = blocks[blocks.length - 1];
        const newBlockWidth = 80 + Math.random() * 50;
        const gap = 50 + Math.random() * 50;
        const newBlockX = lastBlock.x + lastBlock.width + gap;
        let newBlockY = lastBlock.y + (Math.random() - 0.5) * 50;
        newBlockY = Math.max(canvas.height - 400, Math.min(canvas.height - 50, newBlockY));

        const blockTypeRoll = Math.random();
        if (blockTypeRoll < 0.25) {
            const hasItem = Math.random() < 0.8;
            const itemType = Math.random() < 0.5 ? 'health' : 'invincibility';
            blocks.push(new BreakableBlock(newBlockX, newBlockY, newBlockWidth, 30, hasItem, itemType));
        } else {
            blocks.push(new Block(newBlockX, newBlockY, newBlockWidth, 30));
        }
    }

    for (const block of blocks) {
        if (block instanceof BreakableBlock && !block.isBroken) {
            if (player.velocityY < 0 && checkCollision(player, block)) {
                if (player.y < block.y + block.height && player.y + player.height > block.y + block.height) {
                    block.hitFromBelow();
                    player.velocityY = 0;
                    player.y = block.y + block.height;
                }
            }
        }
    }

    if (!isStageClearItemSpawned && score >= getStageClearScore()) {
        const itemWidth = 40;
        const itemHeight = 40;
        const itemX = canvas.width + 100;
        const itemY = canvas.height - itemHeight - 100;
        items.push(new Item(itemX, itemY, itemWidth, itemHeight, 'stage_clear'));
        isStageClearItemSpawned = true;
    }

    items = items.filter(item => item.active);
    items.forEach(item => {
        item.update();
        item.draw();

        if (checkCollision(player, item)) {
            if (item.type === 'health') {
                player.heal();
            } else if (item.type === 'invincibility') {
                player.gainInvincibility();
            } else if (item.type === 'shoot_ability') { // 射撃能力アイテム取得
                player.gainShootAbility();
            } else if (item.type === 'stage_clear') {
                item.active = false;
                stageClear();
                return;
            }
            item.active = false;
        }
    });

    if (!isGamePausedForDamage) {
        score++;
    }
    updateUI();

    requestAnimationFrame(gameLoop);
}

// ====================================================================
// イベントリスナー
// ====================================================================
document.addEventListener('keydown', (e) => {
    if (!gameRunning || isGamePausedForDamage) return;

    if (e.code === 'Space' || e.code === 'ArrowUp') {
        player.jump();
    }
    if (e.code === 'ArrowRight') {
        player.speedX = player.maxSpeedX;
    }
    if (e.code === 'ArrowLeft') {
        player.speedX = -player.maxSpeedX;
    }
    if (e.code === 'KeyX') { // 'X' キーで射撃
        player.shoot();
    }
});

document.addEventListener('keyup', (e) => {
    if (!gameRunning || isGamePausedForDamage) return;

    if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') {
        player.speedX = 0;
    }
});

leftButton.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (gameRunning && !isGamePausedForDamage) player.speedX = -player.maxSpeedX;
});
leftButton.addEventListener('touchend', (e) => {
    e.preventDefault();
    if (gameRunning && !isGamePausedForDamage) player.speedX = 0;
});
leftButton.addEventListener('mousedown', (e) => {
    if (gameRunning && !isGamePausedForDamage) player.speedX = -player.maxSpeedX;
});
leftButton.addEventListener('mouseup', (e) => {
    if (gameRunning && !isGamePausedForDamage) player.speedX = 0;
});
leftButton.addEventListener('mouseleave', (e) => {
    if (gameRunning && !isGamePausedForDamage && e.buttons === 0) player.speedX = 0;
});

rightButton.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (gameRunning && !isGamePausedForDamage) player.speedX = player.maxSpeedX;
});
rightButton.addEventListener('touchend', (e) => {
    e.preventDefault();
    if (gameRunning && !isGamePausedForDamage) player.speedX = 0;
});
rightButton.addEventListener('mousedown', (e) => {
    if (gameRunning && !isGamePausedForDamage) player.speedX = player.maxSpeedX;
});
rightButton.addEventListener('mouseup', (e) => {
    if (gameRunning && !isGamePausedForDamage) player.speedX = 0;
});
rightButton.addEventListener('mouseleave', (e) => {
    if (gameRunning && !isGamePausedForDamage && e.buttons === 0) player.speedX = 0;
});

jumpButton.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (gameRunning && !isGamePausedForDamage) player.jump();
});
jumpButton.addEventListener('mousedown', (e) => {
    if (gameRunning && !isGamePausedForDamage) player.jump();
});


startButton.addEventListener('click', () => {
    if (assetsLoadedCount === totalAssets) {
        startScreen.classList.add('hidden');
        controlsDiv.classList.remove('hidden');
        resetFullGame(); // ゲームを完全にリセット
        startGameLoop();
    } else {
        console.log("Assets are still loading. Please wait...");
    }
});

continueButton.addEventListener('click', continueGame);
restartButton.addEventListener('click', restartGame);

nextStageButton.addEventListener('click', startNextStage);
restartFromClearButton.addEventListener('click', restartGame);

// ====================================================================
// ゲームの初期化 (DOMがロードされたらアセット読み込みを開始)
// ====================================================================
document.addEventListener('DOMContentLoaded', () => {
    updateUI();
    loadAssets().then(() => {
        console.log("All assets are ready to use!");
    }).catch(error => {
        console.error("Asset loading failed:", error);
    });
});