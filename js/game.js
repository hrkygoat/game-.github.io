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

// 新しく追加したコントロールボタンの要素を取得
const controlsDiv = document.getElementById('controls');
const leftButton = document.getElementById('leftButton');
const rightButton = document.getElementById('rightButton');
const jumpButton = document.getElementById('jumpButton');
// ----------------------------------------------------

// キャンバスのサイズを正方形に変更 (例: 幅500px, 高さ500px)
canvas.width = 500;
canvas.height = 500;

// ====================================================================
// ゲームの状態変数
// ====================================================================
let gameRunning = false; // ゲーム開始前はfalse
let score = 0;
let lives = 3;
let continueCount = 3;
let backgroundX = 0;
const backgroundScrollSpeed = 1;
const gameSpeed = 1.5; // 強制スクロールの速さ (調整可能)

let lastEnemySpawnTime = 0;
const enemySpawnInterval = 1500; // 敵を生成する間隔 (ミリ秒)

let lastItemSpawnTime = 0;
const itemSpawnInterval = 5000; // アイテムを生成する間隔 (ミリ秒)

// ====================================================================
// オーディオ関連 (audio.jsの内容を統合)
// ====================================================================
const bgm = document.getElementById('bgm');
const jumpSound = document.getElementById('jumpSound');
const hitSound = document.getElementById('hitSound'); // プレイヤーがダメージを受けた時
const enemyHitSound = document.getElementById('enemyHitSound'); // 敵を倒した時
const collectItemSound = document.getElementById('collectItemSound'); // アイテム取得時

function playSound(audioElement) {
    if (audioElement) {
        audioElement.currentTime = 0; // 最初から再生
        audioElement.play().catch(e => console.warn("Audio play error:", e));
    }
}

function stopBGM() {
    if (bgm) {
        bgm.pause();
        bgm.currentTime = 0;
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
    block: { img: new Image(), src: 'assets/images/block.png' },
    healthItem: { img: new Image(), src: 'assets/images/health_item.png' },
    background: { img: new Image(), src: 'assets/images/background.png' },
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
                    resolve(); // 全ての画像が読み込まれたらPromiseを解決
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
// プレイヤーオブジェクト (モーション追加)
// ====================================================================
const player = {
    x: 100, // プレイヤーのx座標は初期位置。D-padで移動可能になる
    // プレイヤーのY座標を新しい高さに合わせて調整
    y: canvas.height - 50 - 50, // canvas.height - player.height - 50 となるように
    width: 50,
    height: 50,
    velocityY: 0,
    isJumping: false,
    speedX: 0,  // 横移動速度を復活
    maxSpeedX: 5, // 横移動の最大速度を復活
    gravity: 0.8,
    jumpStrength: -15,

    // アニメーション関連
    currentFrame: 0,
    frameCounter: 0,
    animationSpeed: 5, // フレーム切り替えの速さ (小さいほど速い)
    maxRunFrames: 6,   // player_run.png のフレーム数 (仮の値, 画像に合わせて調整)
    maxJumpFrames: 1,  // player_jump.png のフレーム数 (仮の値, 画像に合わせて調整)
    frameWidth: 32,    // スプライトシートの1フレームの幅 (仮の値, 画像に合わせて調整)
    frameHeight: 32,   // スプライトシートの1フレームの高さ (仮の値, 画像に合わせて調整)

    draw() {
        let currentImage = assets.playerRun.img;
        let sx = 0;

        if (this.isJumping) {
            currentImage = assets.playerJump.img;
            sx = this.currentFrame * this.frameWidth;
        } else {
            currentImage = assets.playerRun.img;
            // 横移動していない場合は立ち絵 (0フレーム目) を表示
            if (this.speedX === 0) {
                sx = 0; // 走行アニメーションの0フレーム目を立ち絵として利用
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

    update() {
        this.x += this.speedX; // 横移動を復活
        // 画面端での位置制限も復活
        if (this.x < 0) this.x = 0;
        if (this.x + this.width > canvas.width) this.x = canvas.width - this.width;

        this.y += this.velocityY;
        this.velocityY += this.gravity;

        let onGround = false;
        const groundLevel = canvas.height - this.height;

        // ブロックとの衝突判定
        for (const block of blocks) {
            if (checkCollision(this, block) && this.velocityY >= 0) { // 下方向に移動中にブロックと衝突
                if (this.y + this.height - this.velocityY <= block.y) {
                    this.y = block.y - this.height;
                    this.velocityY = 0;
                    this.isJumping = false;
                    onGround = true;
                    break;
                }
            }
        }

        // 地面に着地
        if (this.y >= groundLevel && !onGround) {
            this.y = groundLevel;
            this.velocityY = 0;
            this.isJumping = false;
            onGround = true;
        }

        // アニメーションフレームの更新
        this.frameCounter++;
        if (this.frameCounter >= this.animationSpeed) {
            this.frameCounter = 0;
            if (this.isJumping) {
                this.currentFrame = (this.currentFrame + 1) % this.maxJumpFrames;
            } else if (this.speedX !== 0) { // 横移動している場合のみ走行アニメーション
                this.currentFrame = (this.currentFrame + 1) % this.maxRunFrames;
            } else {
                this.currentFrame = 0; // 静止している場合は0フレーム目 (立ち絵)
            }
        }
    },

    jump() {
        if (!this.isJumping) {
            this.velocityY = this.jumpStrength;
            this.isJumping = true;
            playSound(jumpSound);
            this.currentFrame = 0;
        }
    },

    takeDamage() {
        lives--;
        playSound(hitSound);
        updateUI();
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
        this.speed = speed;
        this.image = image;
        this.active = true;
    }

    draw() {
        if (this.image.complete && this.image.naturalHeight !== 0) {
            ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
        } else {
            ctx.fillStyle = 'green';
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
    }

    update() {
        this.x -= this.speed * gameSpeed; // gameSpeedを適用
        if (this.x + this.width < 0) {
            this.active = false;
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

    update() {
        super.update();
        this.angle += this.frequency * gameSpeed; // gameSpeedを適用
        this.y = this.startY + Math.sin(this.angle) * this.amplitude;
    }
}

// ====================================================================
// 地上敵2クラス
// ====================================================================
class GroundEnemy2 extends Enemy {
    constructor(x, y, width, height, speed) {
        super(x, y, width, height, speed, assets.groundEnemy2.img);
        // 特定の行動パターンを追加する場合はここに記述
    }
}

let enemies = [];

function spawnEnemy() {
    const random = Math.random();
    let enemyWidth, enemyHeight, enemySpeed;

    if (random < 0.4) { // 40%の確率で既存の地上敵
        enemyWidth = 80;
        enemyHeight = 40;
        enemySpeed = 2 + Math.random() * 2;
        enemies.push(new Enemy(canvas.width, canvas.height - enemyHeight, enemyWidth, enemyHeight, enemySpeed, assets.enemy.img));
    } else if (random < 0.7) { // 30%の確率で飛行する敵
        enemyWidth = 50;
        enemyHeight = 30;
        enemySpeed = 1.5 + Math.random() * 1.5;
        // 縦長の画面に合わせて飛行敵のY座標範囲を調整 (500x500でも既存の計算で調整される)
        const flyY = canvas.height * 0.4 + Math.random() * (canvas.height * 0.2);
        const amplitude = 20 + Math.random() * 30;
        const frequency = 0.05 + Math.random() * 0.05;
        enemies.push(new FlyingEnemy(canvas.width, flyY, enemyWidth, enemyHeight, enemySpeed, amplitude, frequency));
    } else { // 30%の確率で新しい地上敵2
        enemyWidth = 80;
        enemyHeight = 110;
        enemySpeed = 2.5 + Math.random() * 1.5;
        enemies.push(new GroundEnemy2(canvas.width, canvas.height - enemyHeight, enemyWidth, enemyHeight, enemySpeed));
    }
}


// ====================================================================
// ブロックオブジェクト
// ====================================================================
class Block {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }

    draw() {
        if (assets.block.img.complete && assets.block.img.naturalHeight !== 0) {
            ctx.drawImage(assets.block.img, this.x, this.y, this.width, this.height);
        } else {
            ctx.fillStyle = 'brown';
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
    }

    update() {
        this.x -= backgroundScrollSpeed * gameSpeed; // gameSpeedを適用
    }
}

let blocks = [];

function setupInitialBlocks() {
    // 初期ブロックを配置 (新しい正方形画面に合わせて調整)
    blocks = []; // リセット時にクリア
    blocks.push(new Block(50, canvas.height - 100, 100, 30)); // x座標、y座標を調整
    blocks.push(new Block(200, canvas.height - 200, 120, 30)); // x, y座標を調整
    blocks.push(new Block(350, canvas.height - 100, 80, 30)); // x座標、y座標を調整
}


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
        this.image = assets.healthItem.img; // 今は回復アイテムのみ
        this.active = true;
    }

    draw() {
        if (this.image.complete && this.image.naturalHeight !== 0) {
            ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
        } else {
            ctx.fillStyle = (this.type === 'health') ? 'pink' : 'gray';
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
    }

    update() {
        this.x -= backgroundScrollSpeed * gameSpeed; // gameSpeedを適用
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
    // 縦長の画面に合わせてアイテムのY座標範囲を調整 (500x500でも既存の計算で調整される)
    const itemY = canvas.height - itemHeight - (Math.random() * 250 + 100);

    items.push(new Item(itemX, itemY, itemWidth, itemHeight, 'health'));
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
// ゲームオーバー処理
// ====================================================================
function gameOver() {
    gameRunning = false;
    stopBGM();
    gameOverScreen.classList.remove('hidden');
    controlsDiv.classList.add('hidden'); // ゲームオーバー時にコントロールを隠す
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

function continueGame() {
    if (continueCount > 0) {
        continueCount--;
        lives = 3;
        score = 0; // スコアもリセット
        player.x = 100; // プレイヤーのX座標をリセット
        player.y = canvas.height - 50 - 50; // プレイヤーのY座標をリセット (新しい高さ基準)
        player.velocityY = 0;
        player.isJumping = false;
        enemies = [];
        blocks = [];
        items = [];
        setupInitialBlocks();
        updateUI();
        gameOverScreen.classList.add('hidden');
        controlsDiv.classList.remove('hidden'); // ゲーム再開時にコントロールを表示
        gameRunning = true;
        playSound(bgm); // BGMを再開
        requestAnimationFrame(gameLoop); // ゲームループを再開
    }
}

function restartGame() {
    continueCount = 3;
    lives = 3;
    score = 0;
    player.x = 100; // プレイヤーのX座標をリセット
    player.y = canvas.height - 50 - 50; // プレイヤーのY座標をリセット (新しい高さ基準)
    player.velocityY = 0;
    player.isJumping = false;
    enemies = [];
    blocks = [];
    items = [];
    setupInitialBlocks();
    updateUI();
    gameOverScreen.classList.add('hidden');
    controlsDiv.classList.remove('hidden'); // ゲーム再開時にコントロールを表示
    gameRunning = true;
    playSound(bgm);
    requestAnimationFrame(gameLoop);
}

// ====================================================================
// UIの更新
// ====================================================================
function updateUI() {
    scoreDisplay.textContent = `Score: ${score}`;
    livesDisplay.textContent = `Lives: ${lives}`;
}

// ====================================================================
// ゲームループ
// ====================================================================
function gameLoop(currentTime) {
    if (!gameRunning) return;

    if (typeof currentTime === 'undefined') {
        currentTime = performance.now();
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 背景の描画とスクロール
    if (assets.background.img.complete && assets.background.img.naturalHeight !== 0) {
        // 背景画像の描画を新しいcanvasの縦横比に合わせる
        ctx.drawImage(assets.background.img, backgroundX, 0, canvas.width, canvas.height);
        ctx.drawImage(assets.background.img, backgroundX + canvas.width, 0, canvas.width, canvas.height);
        backgroundX -= backgroundScrollSpeed * gameSpeed; // gameSpeedを適用
        if (backgroundX <= -canvas.width) {
            backgroundX = 0;
        }
    } else {
        ctx.fillStyle = 'skyblue';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // プレイヤーの更新と描画
    player.update();
    player.draw();

    // 落下場所 (穴) のダメージ判定
    if (player.y > canvas.height + 50) { // 画面外に落ちたら
        player.takeDamage();
        // プレイヤーの位置をリセット (地面に戻す)
        player.x = 100; // 固定位置に戻す
        player.y = canvas.height - player.height;
        player.velocityY = 0;
        player.isJumping = false;
    }

    // 敵の生成
    if (currentTime - lastEnemySpawnTime > enemySpawnInterval) {
        spawnEnemy();
        lastEnemySpawnTime = currentTime;
    }

    // 敵の更新と描画、衝突判定
    enemies = enemies.filter(enemy => enemy.active);
    enemies.forEach(enemy => {
        enemy.update();
        enemy.draw();

        if (checkCollision(player, enemy)) {
            player.takeDamage();
            playSound(enemyHitSound); // 敵ヒット音再生 (敵を倒したというより、ダメージを受けた音)
            enemy.active = false;
            score += 10;
        }
    });

    // ブロックの更新と描画
    blocks = blocks.filter(block => block.x + block.width > 0);
    blocks.forEach(block => {
        block.update();
        block.draw();
    });
    // 新しいブロックの生成ロジック
    if (blocks.length > 0 && blocks[blocks.length - 1].x < canvas.width * 0.8) {
        const lastBlockX = blocks[blocks.length - 1].x;
        const lastBlockY = blocks[blocks.length - 1].y;

        const newBlockWidth = 80 + Math.random() * 50;
        const gap = 50 + Math.random() * 50; // ブロック間の隙間を調整
        const newBlockX = lastBlockX + blocks[blocks.length - 1].width + gap;
        let newBlockY = lastBlockY + (Math.random() - 0.5) * 50;
        // 縦長の画面に合わせてブロックのY座標範囲を調整
        newBlockY = Math.max(canvas.height - 400, Math.min(canvas.height - 50, newBlockY));

        blocks.push(new Block(newBlockX, newBlockY, newBlockWidth, 30));
    }


    // アイテムの生成
    if (currentTime - lastItemSpawnTime > itemSpawnInterval) {
        spawnItem();
        lastItemSpawnTime = currentTime;
    }

    // アイテムの更新と描画、取得判定
    items = items.filter(item => item.active);
    items.forEach(item => {
        item.update();
        item.draw();

        if (checkCollision(player, item)) {
            if (item.type === 'health') {
                player.heal();
            }
            item.active = false;
        }
    });

    score++;
    updateUI();

    requestAnimationFrame(gameLoop);
}

// ====================================================================
// イベントリスナー
// ====================================================================
// キーボードイベントリスナー（PCでのテスト用として復活）
document.addEventListener('keydown', (e) => {
    if (!gameRunning) return;

    if (e.code === 'Space' || e.code === 'ArrowUp') {
        player.jump();
    }
    if (e.code === 'ArrowRight') {
        player.speedX = player.maxSpeedX;
    }
    if (e.code === 'ArrowLeft') {
        player.speedX = -player.maxSpeedX;
    }
});

document.addEventListener('keyup', (e) => {
    if (!gameRunning) return;

    if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') {
        player.speedX = 0;
        // player.currentFrame = 0; // キーアップでアニメーション停止 (必要であれば)
    }
});

// コントロールボタンのイベントリスナーを追加 (タッチイベントとマウスイベントの両方に対応)
// 左ボタン
leftButton.addEventListener('touchstart', (e) => {
    e.preventDefault(); // デフォルトのタッチ挙動（スクロールなど）を防止
    if (gameRunning) player.speedX = -player.maxSpeedX;
});
leftButton.addEventListener('touchend', (e) => {
    e.preventDefault();
    if (gameRunning) player.speedX = 0;
});
leftButton.addEventListener('mousedown', (e) => { // PC用
    if (gameRunning) player.speedX = -player.maxSpeedX;
});
leftButton.addEventListener('mouseup', (e) => { // PC用
    if (gameRunning) player.speedX = 0;
});
leftButton.addEventListener('mouseleave', (e) => { // ボタンからカーソルが離れた場合も停止（PC用）
    if (gameRunning && e.buttons === 0) player.speedX = 0;
});


// 右ボタン
rightButton.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (gameRunning) player.speedX = player.maxSpeedX;
});
rightButton.addEventListener('touchend', (e) => {
    e.preventDefault();
    if (gameRunning) player.speedX = 0;
});
rightButton.addEventListener('mousedown', (e) => { // PC用
    if (gameRunning) player.speedX = player.maxSpeedX;
});
rightButton.addEventListener('mouseup', (e) => { // PC用
    if (gameRunning) player.speedX = 0;
});
rightButton.addEventListener('mouseleave', (e) => { // PC用
    if (gameRunning && e.buttons === 0) player.speedX = 0;
});

// ジャンプボタン
jumpButton.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (gameRunning) player.jump();
});
jumpButton.addEventListener('mousedown', (e) => { // PC用
    if (gameRunning) player.jump();
});


startButton.addEventListener('click', () => {
    // 全アセットのロードが完了しているか確認
    if (assetsLoadedCount === totalAssets) {
        startScreen.classList.add('hidden'); // スタート画面を隠す
        controlsDiv.classList.remove('hidden'); // コントロールを表示
        gameRunning = true;
        playSound(bgm); // BGM再生を開始
        setupInitialBlocks(); // ゲーム開始時に初期ブロックを配置
        updateUI();
        requestAnimationFrame(gameLoop); // ゲームループを開始
    } else {
        console.log("Assets are still loading. Please wait...");
        // ユーザーにロード中であることを示すUIを表示するなどの配慮も可能
    }
});

continueButton.addEventListener('click', continueGame);
restartButton.addEventListener('click', restartGame);

// ====================================================================
// ゲームの初期化 (DOMがロードされたらアセット読み込みを開始)
// ====================================================================
document.addEventListener('DOMContentLoaded', () => {
    updateUI(); // UIを初期表示
    // アセットの読み込みを開始
    loadAssets().then(() => {
        console.log("All assets are ready to use!");
        // ロード完了後もゲーム開始はstartButtonのクリックを待つ
    }).catch(error => {
        console.error("Asset loading failed:", error);
    });
});
