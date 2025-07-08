// js/audio.js

const bgm = document.getElementById('bgm');
const jumpSound = document.getElementById('jumpSound');
const hitSound = document.getElementById('hitSound'); // プレイヤーがダメージを受けた時

// 新しい効果音
const enemyHitSound = new Audio('assets/bgm/attack.wav'); // 敵を倒した音
const collectItemSound = new Audio('assets/bgm/item.wav'); // アイテム取得音


function playBGM() {
    bgm.play().catch(e => console.log("BGM再生エラー:", e));
}

function stopBGM() {
    bgm.pause();
    bgm.currentTime = 0; // 最初に戻す
}

function playJumpSound() {
    jumpSound.currentTime = 0; // 最初から再生
    jumpSound.play().catch(e => console.log("ジャンプ音再生エラー:", e));
}

function playHitSound() { // プレイヤーがダメージを受けた時
    hitSound.currentTime = 0; // 最初から再生
    hitSound.play().catch(e => console.log("ヒット音再生エラー:", e));
}

function playEnemyHitSound() { // 敵を倒した時
    enemyHitSound.currentTime = 0;
    enemyHitSound.play().catch(e => console.log("敵ヒット音再生エラー:", e));
}

function playCollectItemSound() { // アイテム取得時
    collectItemSound.currentTime = 0;
    collectItemSound.play().catch(e => console.log("アイテム取得音再生エラー:", e));
}

// ゲーム開始時にBGMを再生
document.addEventListener('DOMContentLoaded', () => {
    // ユーザーインタラクションがないと自動再生できない場合があるため、
    // 最初のクリックなどで再生を開始するトリガーを用意すると良い
    playBGM();
});