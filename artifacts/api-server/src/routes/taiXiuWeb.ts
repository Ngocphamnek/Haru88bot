import { Router, type Request, type Response } from "express";
import { getWebUser } from "./webAuth.js";
import { storage } from "../lib/storage.js";

const router = Router();

const HTML = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <title>🎲 Tài Xỉu - Haru88</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 100%; height: 100%; }
    body {
      background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
      color: #e2e8f0;
      font-family: 'Arial', sans-serif;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      user-select: none;
    }
    
    /* Header */
    .header {
      background: linear-gradient(135deg, #cc0000, #660000);
      border-bottom: 3px solid #ff6600;
      padding: 12px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 4px 20px rgba(0,0,0,0.8);
    }
    .logo { font-size: 22px; font-weight: 700; color: #fff; text-shadow: 2px 2px 4px rgba(0,0,0,0.5); }
    .user-info { display: flex; gap: 20px; align-items: center; }
    .balance-display { text-align: right; }
    .balance-label { font-size: 12px; color: #ffd700; }
    .balance-value { font-size: 18px; font-weight: 700; color: #ffd700; }
    
    /* Main Container */
    .main-container { flex: 1; display: flex; overflow: hidden; position: relative; }
    
    /* Left Betting Panel */
    .left-panel {
      width: 200px;
      background: linear-gradient(135deg, #2a2a2a, #1a1a1a);
      border-right: 3px solid #cc0000;
      padding: 16px 12px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    
    /* Right Info Panel */
    .right-panel {
      width: 220px;
      background: linear-gradient(135deg, #2a2a2a, #1a1a1a);
      border-left: 3px solid #cc0000;
      padding: 16px 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      overflow-y: auto;
    }
    
    /* Center Game Area */
    .game-area { flex: 1; display: flex; align-items: center; justify-content: center; }
    
    /* Table Container */
    .table-container {
      position: absolute;
      cursor: move;
      filter: drop-shadow(0 10px 30px rgba(0,0,0,0.7));
      touch-action: none;
    }
    
    /* Gaming Table */
    .gaming-table {
      width: 500px;
      height: 300px;
      background: linear-gradient(135deg, #8b0000, #1a0000);
      border: 4px solid #ffd700;
      border-radius: 40px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 20px;
      box-shadow: 0 15px 50px rgba(0,0,0,0.9), inset 0 0 30px rgba(255, 215, 0, 0.1);
      position: relative;
    }
    
    .gaming-table::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.3) 100%);
      border-radius: 40px;
      pointer-events: none;
    }
    
    /* Dice Container */
    .dice-container {
      display: flex;
      gap: 12px;
      justify-content: center;
      flex-wrap: wrap;
      z-index: 2;
      position: relative;
    }
    
    .dice {
      width: 60px;
      height: 60px;
      background: linear-gradient(135deg, #fff, #f0f0f0);
      border: 2px solid #ffd700;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 36px;
      font-weight: 700;
      color: #000;
      box-shadow: 0 4px 15px rgba(255, 215, 0, 0.4), inset 0 2px 4px rgba(255,255,255,0.5);
    }
    
    .dice.rolling { animation: dice-roll 0.08s infinite; }
    @keyframes dice-roll {
      0% { transform: rotateX(0deg) rotateY(0deg); }
      50% { transform: rotateX(30deg) rotateY(30deg); }
      100% { transform: rotateX(0deg) rotateY(0deg); }
    }
    
    /* Result Panel */
    .result-panel {
      background: rgba(255, 215, 0, 0.15);
      border: 2px solid #ffd700;
      border-radius: 10px;
      padding: 12px 20px;
      text-align: center;
      display: none;
      animation: result-pop 0.4s ease;
      z-index: 2;
      position: relative;
      min-width: 250px;
    }
    .result-panel.show { display: block; }
    @keyframes result-pop { from { transform: scale(0.6); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    
    .result-total { font-size: 13px; color: #ffd700; margin-bottom: 6px; }
    .result-value { font-size: 28px; font-weight: 700; color: #fff; margin-bottom: 8px; }
    .result-outcome { font-size: 16px; font-weight: 700; }
    .result-win { color: #00ff00; }
    .result-lose { color: #ff6666; }
    
    /* Panel Sections */
    .panel-section { display: flex; flex-direction: column; gap: 8px; }
    .section-title {
      font-size: 11px;
      font-weight: 700;
      color: #ffd700;
      text-transform: uppercase;
      letter-spacing: 1px;
      border-bottom: 2px solid #cc0000;
      padding-bottom: 6px;
    }
    
    /* Bet Buttons */
    .bet-btn {
      padding: 12px;
      border: 2px solid #ffd700;
      border-radius: 8px;
      background: linear-gradient(135deg, #330000, #1a0000);
      color: #ffd700;
      cursor: pointer;
      font-weight: 700;
      font-size: 12px;
      transition: all 0.2s ease;
      text-align: center;
    }
    .bet-btn:hover { background: linear-gradient(135deg, #660000, #330000); transform: translateY(-2px); }
    .bet-btn.active {
      background: linear-gradient(135deg, #ffaa00, #ff8800);
      color: #000;
      box-shadow: 0 4px 12px rgba(255, 170, 0, 0.5);
    }
    
    /* Amount Buttons */
    .amount-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
    }
    .amount-btn {
      padding: 8px 6px;
      border: 1px solid #ffd700;
      border-radius: 6px;
      background: linear-gradient(135deg, #330000, #1a0000);
      color: #ffd700;
      cursor: pointer;
      font-weight: 600;
      font-size: 10px;
      transition: all 0.2s ease;
    }
    .amount-btn:hover { border-color: #ffaa00; }
    .amount-btn.active {
      background: linear-gradient(135deg, #ffaa00, #ff8800);
      color: #000;
    }
    
    /* Input */
    .custom-input {
      padding: 8px 10px;
      background: rgba(0, 0, 0, 0.7);
      border: 2px solid #ffd700;
      border-radius: 6px;
      color: #ffd700;
      font-size: 12px;
      font-weight: 600;
    }
    .custom-input:focus { outline: none; border-color: #ffaa00; }
    
    /* Roll Button */
    .roll-btn {
      width: 100%;
      padding: 12px;
      background: linear-gradient(135deg, #ffaa00, #ff8800);
      border: none;
      border-radius: 8px;
      color: #000;
      font-weight: 700;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.3s ease;
      margin-top: 8px;
    }
    .roll-btn:hover:not(:disabled) { transform: scale(1.05); box-shadow: 0 6px 20px rgba(255, 170, 0, 0.5); }
    .roll-btn:disabled { opacity: 0.6; cursor: not-allowed; }
    
    /* Info Box */
    .info-box {
      background: rgba(0, 0, 0, 0.5);
      border: 1px solid #ffd700;
      border-radius: 6px;
      padding: 8px;
      text-align: center;
      font-size: 10px;
    }
    .info-label { color: #ffd700; margin-bottom: 3px; }
    .info-value { font-weight: 700; color: #fff; }
    
    /* History */
    .history-box {
      background: rgba(0, 0, 0, 0.5);
      border: 1px solid #ffd700;
      border-radius: 6px;
      padding: 10px;
      flex: 1;
      overflow-y: auto;
    }
    .history-item {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
      border-bottom: 1px solid #333;
      font-size: 9px;
    }
    .history-item:last-child { border-bottom: none; }
    .history-bet { color: #ffd700; }
    .history-win { color: #00ff00; font-weight: 700; }
    .history-lose { color: #ff6666; font-weight: 700; }
    
    /* Toast */
    .toast {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: linear-gradient(135deg, #cc0000, #660000);
      border: 3px solid #ffd700;
      padding: 16px 24px;
      border-radius: 10px;
      color: #fff;
      font-size: 14px;
      font-weight: 700;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s ease;
      z-index: 2000;
      text-align: center;
      box-shadow: 0 10px 40px rgba(0,0,0,0.9);
    }
    .toast.show { opacity: 1; pointer-events: auto; }
    
    /* Status */
    .status-bar {
      background: rgba(0, 0, 0, 0.5);
      border: 1px solid #ffd700;
      border-radius: 6px;
      padding: 8px;
      text-align: center;
      color: #ffd700;
      font-size: 11px;
      font-weight: 600;
    }
  
/* Tai Xiu 3D dice table */
body{background:radial-gradient(ellipse at 50% 0%,#1a3a2a,#0a1210 50%,#050808 100%)!important}
.dice,.xucxac,.die{
  transform-style:preserve-3d!important;
  box-shadow:0 12px 24px rgba(0,0,0,.45)!important;
}
.table,.board,.game-wrap{
  box-shadow:0 24px 48px rgba(0,0,0,.5)!important;
  border:1px solid rgba(240,192,64,.2)!important;
}
</style>
<style id="haru3d-kit">

/* Haru88 Immersive 3D Visual Kit */
:root{
  --h3d-gold:#f0c040;--h3d-cyan:#40e0d0;--h3d-bg0:#050510;--h3d-bg1:#0c0c24;
  --h3d-depth:28px;--h3d-ease:cubic-bezier(.22,1,.36,1);
}
.h3d-scene{perspective:900px;perspective-origin:50% 40%;transform-style:preserve-3d}
.h3d-floor{
  position:absolute;left:50%;bottom:8%;width:140%;height:55%;
  transform:translateX(-50%) rotateX(68deg);transform-origin:center top;
  background:
    radial-gradient(ellipse at 50% 0%,rgba(240,192,64,.12),transparent 55%),
    linear-gradient(180deg,rgba(20,30,60,.0),rgba(5,8,20,.85));
  border-radius:50%;filter:blur(.2px);pointer-events:none;z-index:0;
}
.h3d-glow{
  position:absolute;inset:-20%;pointer-events:none;z-index:0;
  background:
    radial-gradient(circle at 50% 30%,rgba(100,80,255,.18),transparent 45%),
    radial-gradient(circle at 20% 80%,rgba(0,200,180,.08),transparent 40%),
    radial-gradient(circle at 80% 70%,rgba(240,192,64,.07),transparent 35%);
  animation:h3d-ambient 8s ease-in-out infinite alternate;
}
@keyframes h3d-ambient{from{opacity:.7;transform:scale(1)}to{opacity:1;transform:scale(1.05)}}
.h3d-card{
  position:relative;transform-style:preserve-3d;
  border-radius:16px;background:linear-gradient(145deg,#161632,#0d0d22);
  border:1px solid rgba(255,255,255,.08);
  box-shadow:
    0 1px 0 rgba(255,255,255,.06) inset,
    0 12px 28px rgba(0,0,0,.45),
    0 2px 0 rgba(0,0,0,.3);
  transition:transform .25s var(--h3d-ease),box-shadow .25s;
}
.h3d-card:active{transform:translateY(2px) scale(.98)}
.h3d-card.selected{
  border-color:rgba(240,192,64,.7);
  box-shadow:0 0 0 2px rgba(240,192,64,.35),0 16px 40px rgba(240,192,64,.15),0 12px 28px rgba(0,0,0,.5);
  transform:translateY(-4px) rotateX(6deg);
}
/* 3D Dice cube */
.h3d-dice{
  width:72px;height:72px;position:relative;transform-style:preserve-3d;
  transform:rotateX(-22deg) rotateY(28deg);
  transition:transform .6s var(--h3d-ease);
}
.h3d-dice.spinning{animation:h3d-dice-spin .35s linear infinite}
@keyframes h3d-dice-spin{
  0%{transform:rotateX(0) rotateY(0) rotateZ(0)}
  100%{transform:rotateX(360deg) rotateY(480deg) rotateZ(180deg)}
}
.h3d-dice .face{
  position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
  font-size:34px;border-radius:14px;backface-visibility:hidden;
  background:linear-gradient(145deg,#f8f4e8,#d9d0b8);
  border:2px solid rgba(0,0,0,.12);
  box-shadow:inset 0 2px 6px rgba(255,255,255,.55),inset 0 -4px 10px rgba(0,0,0,.12);
  color:#1a1030;text-shadow:0 1px 0 #fff;
}
.h3d-dice .f-front{transform:translateZ(36px)}
.h3d-dice .f-back{transform:rotateY(180deg) translateZ(36px)}
.h3d-dice .f-right{transform:rotateY(90deg) translateZ(36px)}
.h3d-dice .f-left{transform:rotateY(-90deg) translateZ(36px)}
.h3d-dice .f-top{transform:rotateX(90deg) translateZ(36px)}
.h3d-dice .f-bottom{transform:rotateX(-90deg) translateZ(36px)}
/* Bowl / plate for xoc dia */
.h3d-bowl{
  width:min(280px,78vw);aspect-ratio:1;margin:0 auto;position:relative;
  transform-style:preserve-3d;transform:rotateX(52deg);
}
.h3d-bowl-rim{
  position:absolute;inset:0;border-radius:50%;
  background:
    radial-gradient(circle at 50% 42%,#5a3a1a 0%,#3a220e 42%,#1a0e06 70%,#0a0502 100%);
  box-shadow:
    0 20px 40px rgba(0,0,0,.55),
    inset 0 8px 20px rgba(255,200,100,.15),
    inset 0 -16px 30px rgba(0,0,0,.5);
  border:3px solid rgba(240,192,64,.25);
}
.h3d-bowl-inner{
  position:absolute;inset:12%;border-radius:50%;
  background:radial-gradient(circle at 50% 40%,#2a1810,#120a06 70%);
  box-shadow:inset 0 10px 24px rgba(0,0,0,.65);
  overflow:hidden;
}
.h3d-coin{
  width:38px;height:38px;border-radius:50%;position:absolute;
  transform-style:preserve-3d;
  box-shadow:0 4px 10px rgba(0,0,0,.45),inset 0 2px 4px rgba(255,255,255,.35);
  transition:transform .5s var(--h3d-ease);
}
.h3d-coin.red{background:radial-gradient(circle at 35% 30%,#ff6b6b,#c62828 55%,#7f1010)}
.h3d-coin.white{background:radial-gradient(circle at 35% 30%,#fff,#e0e0e0 55%,#9e9e9e)}
.h3d-coin.flip{animation:h3d-coin-flip .45s ease-in-out}
@keyframes h3d-coin-flip{
  0%{transform:rotateY(0) translateZ(0)}
  50%{transform:rotateY(180deg) translateZ(24px) scale(1.1)}
  100%{transform:rotateY(360deg) translateZ(0)}
}
/* Race track 3D */
.h3d-track{
  position:relative;height:220px;border-radius:18px;overflow:hidden;
  perspective:700px;background:#0a1420;
  box-shadow:inset 0 0 40px rgba(0,0,0,.6),0 12px 30px rgba(0,0,0,.4);
}
.h3d-track-road{
  position:absolute;left:8%;right:8%;top:10%;bottom:8%;
  transform:rotateX(58deg);transform-origin:center bottom;transform-style:preserve-3d;
  background:
    repeating-linear-gradient(90deg,transparent 0 46%,rgba(255,255,255,.15) 46% 54%,transparent 54% 100%),
    linear-gradient(180deg,#1e293b,#0f172a);
  border:2px solid rgba(148,163,184,.25);border-radius:12px;
}
.h3d-car{
  position:absolute;width:42px;height:24px;border-radius:8px 12px 6px 6px;
  transform:translateZ(20px);
  box-shadow:0 8px 14px rgba(0,0,0,.5);
  transition:left .8s var(--h3d-ease);
}
/* Crash sky depth */
.h3d-sky{
  background:
    radial-gradient(ellipse at 50% 120%,rgba(16,185,129,.15),transparent 50%),
    radial-gradient(ellipse at 70% 20%,rgba(59,130,246,.12),transparent 40%),
    linear-gradient(180deg,#071018 0%,#0a1628 40%,#050a12 100%);
}
.h3d-plane-float{animation:h3d-plane-bob 2.4s ease-in-out infinite;filter:drop-shadow(0 12px 20px rgba(16,185,129,.45))}
@keyframes h3d-plane-bob{0%,100%{transform:translateY(0) rotate(-6deg)}50%{transform:translateY(-14px) rotate(4deg)}}
/* Wheel 3D */
.h3d-wheel-wrap{perspective:1000px;display:flex;justify-content:center;align-items:center}
.h3d-wheel{
  width:min(320px,70vw);aspect-ratio:1;border-radius:50%;position:relative;
  transform-style:preserve-3d;transform:rotateX(18deg);
  box-shadow:
    0 25px 50px rgba(0,0,0,.55),
    0 0 0 10px rgba(240,192,64,.15),
    0 0 0 14px rgba(0,0,0,.4),
    inset 0 0 30px rgba(0,0,0,.35);
}
.h3d-wheel::after{
  content:"";position:absolute;inset:-8px;border-radius:50%;
  border:3px solid rgba(240,192,64,.35);pointer-events:none;
  box-shadow:0 0 20px rgba(240,192,64,.2);
}
/* HUD chips */
.h3d-chip{
  display:inline-flex;align-items:center;justify-content:center;
  min-width:56px;height:40px;padding:0 12px;border-radius:999px;
  font-weight:800;font-size:13px;letter-spacing:.3px;
  background:radial-gradient(circle at 30% 25%,#fff7,#0000 40%),linear-gradient(145deg,#2a2a55,#14142e);
  border:2px dashed rgba(240,192,64,.55);
  box-shadow:0 6px 0 #0a0a18,0 10px 18px rgba(0,0,0,.35);
  transform:translateZ(8px);transition:transform .15s,box-shadow .15s;
}
.h3d-chip:active{transform:translateY(4px);box-shadow:0 2px 0 #0a0a18,0 4px 8px rgba(0,0,0,.3)}
.h3d-chip.on{background:linear-gradient(145deg,#f0c040,#c49220);color:#1a1000;border-color:#fff6}
/* Particles */
.h3d-spark{position:fixed;pointer-events:none;z-index:9999;width:6px;height:6px;border-radius:50%;background:#f0c040;box-shadow:0 0 8px #f0c040;animation:h3d-spark .9s ease-out forwards}
@keyframes h3d-spark{to{transform:translate(var(--dx),var(--dy)) scale(0);opacity:0}}
/* Status neon */
.h3d-status{
  text-align:center;padding:12px 16px;border-radius:14px;font-weight:800;
  letter-spacing:.5px;position:relative;overflow:hidden;
  box-shadow:0 10px 30px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.08);
}
.h3d-status::before{
  content:"";position:absolute;inset:0;
  background:linear-gradient(110deg,transparent 30%,rgba(255,255,255,.08) 48%,transparent 62%);
  animation:h3d-sheen 3.5s linear infinite;
}
@keyframes h3d-sheen{from{transform:translateX(-60%)}to{transform:translateX(60%)}}
/* Mobile safe */
@media (max-width:420px){
  .h3d-dice{width:58px;height:58px}
  .h3d-dice .face{font-size:28px;border-radius:12px}
  .h3d-dice .f-front,.h3d-dice .f-back,.h3d-dice .f-right,.h3d-dice .f-left,.h3d-dice .f-top,.h3d-dice .f-bottom{transform:none}
  .h3d-dice .f-front{transform:translateZ(29px)}
  .h3d-dice .f-back{transform:rotateY(180deg) translateZ(29px)}
  .h3d-dice .f-right{transform:rotateY(90deg) translateZ(29px)}
  .h3d-dice .f-left{transform:rotateY(-90deg) translateZ(29px)}
  .h3d-dice .f-top{transform:rotateX(90deg) translateZ(29px)}
  .h3d-dice .f-bottom{transform:rotateX(-90deg) translateZ(29px)}
}

</style>
<script id="haru3d-js">

// Haru88 3D helpers
window.Haru3D = {
  spark(x, y, n=14){
    for(let i=0;i<n;i++){
      const el=document.createElement('div');
      el.className='h3d-spark';
      const ang=Math.random()*Math.PI*2, dist=40+Math.random()*80;
      el.style.left=x+'px'; el.style.top=y+'px';
      el.style.setProperty('--dx', Math.cos(ang)*dist+'px');
      el.style.setProperty('--dy', Math.sin(ang)*dist+'px');
      el.style.background=i%2?'#40e0d0':'#f0c040';
      document.body.appendChild(el);
      setTimeout(()=>el.remove(),950);
    }
  },
  celebrate(el){
    if(!el) return;
    const r=el.getBoundingClientRect();
    this.spark(r.left+r.width/2, r.top+r.height/2, 18);
  },
  makeDice(symbol){
    const d=document.createElement('div');
    d.className='h3d-dice';
    const faces=['front','back','right','left','top','bottom'];
    faces.forEach((f,i)=>{
      const face=document.createElement('div');
      face.className='face f-'+f;
      face.textContent = i===0 ? (symbol||'🎲') : (['🦌','🦐','🐓','🍐','🐟','🦀'][i%6]);
      d.appendChild(face);
    });
    return d;
  },
  setDiceSymbol(diceEl, symbol){
    if(!diceEl) return;
    const front=diceEl.querySelector('.f-front');
    if(front) front.textContent=symbol;
    diceEl.classList.remove('spinning');
    diceEl.style.transform='rotateX(-18deg) rotateY('+(20+Math.random()*40)+'deg)';
  },
  spinDice(diceEl, ms=1200){
    if(!diceEl) return;
    diceEl.classList.add('spinning');
    setTimeout(()=>diceEl.classList.remove('spinning'), ms);
  }
};

</script>
</head>
<body>
  <!-- Header -->
  <div class="header">
    <div class="logo">🎲 TÀI XỈU - BÀNG ĐỎ ĐEN</div>
    <div class="user-info">
      <div class="balance-display">
        <div class="balance-label">SỐ DƯ</div>
        <div class="balance-value" id="balance">0đ</div>
      </div>
    </div>
  </div>

  <!-- Main Container -->
  <div class="main-container">
    <!-- Left Panel -->
    <div class="left-panel">
      <div class="section-title">🎯 Loại Cược</div>
      <div class="panel-section">
        <button class="bet-btn active" data-type="tai" onclick="selectBet(this, 'tai')">
          📈 TÀI (≥18)
        </button>
        <button class="bet-btn" data-type="xiu" onclick="selectBet(this, 'xiu')">
          📉 XỈU (≤17)
        </button>
        <button class="bet-btn" data-type="chan" onclick="selectBet(this, 'chan')">
          🔢 CHẴN
        </button>
        <button class="bet-btn" data-type="le" onclick="selectBet(this, 'le')">
          🔢 LẺ
        </button>
      </div>
      
      <div class="section-title" style="margin-top: 12px;">💰 Pot</div>
      <div class="panel-section">
        <div class="info-box">
          <div class="info-label">TÀI</div>
          <div class="info-value" id="potTai">0đ</div>
        </div>
        <div class="info-box">
          <div class="info-label">XỈU</div>
          <div class="info-value" id="potXiu">0đ</div>
        </div>
      </div>
      
      <div class="status-bar" id="status" style="margin-top: auto;">
        Phiên #<span id="sessionId">0</span>
      </div>
    </div>

    <!-- Game Area -->
    <div class="game-area">
      <div class="table-container" id="tableContainer">
        <div class="gaming-table">
          <!-- Dice Display -->
          <div class="dice-container">
            <div class="dice" id="dice1">🎲</div>
            <div class="dice" id="dice2">🎲</div>
            <div class="dice" id="dice3">🎲</div>
            <div class="dice" id="dice4">🎲</div>
            <div class="dice" id="dice5">🎲</div>
          </div>
          
          <!-- Result Panel -->
          <div class="result-panel" id="resultPanel">
            <div class="result-total">TỔNG ĐIỂM</div>
            <div class="result-value" id="resultTotal">--</div>
            <div class="result-outcome" id="resultOutcome">--</div>
            <div style="font-size: 11px; color: #ffd700; margin-top: 8px;" id="resultPayout">--</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Right Panel -->
    <div class="right-panel">
      <div class="section-title">💵 Số Tiền</div>
      <div class="panel-section">
        <div class="amount-grid">
          <button class="amount-btn" onclick="setBetAmount(10000)">10K</button>
          <button class="amount-btn" onclick="setBetAmount(50000)">50K</button>
          <button class="amount-btn" onclick="setBetAmount(100000)">100K</button>
          <button class="amount-btn" onclick="setBetAmount(500000)">500K</button>
        </div>
        <input type="number" class="custom-input" id="customAmount" placeholder="Nhập số tiền" min="1000" step="1000">
        <button class="roll-btn" id="rollBtn" onclick="placeBet()">⚡ QUAY XÁC</button>
      </div>
      
      <div class="section-title" style="margin-top: 12px;">ℹ️ Thông Tin</div>
      <div class="panel-section">
        <div class="info-box">
          <div class="info-label">TRẠNG THÁI</div>
          <div class="info-value" id="gameStatus">CHỜ ĐẶT</div>
        </div>
        <div class="info-box">
          <div class="info-label">LỖI SUẤT</div>
          <div class="info-value">1.95x</div>
        </div>
      </div>
      
      <div class="section-title" style="margin-top: 12px;">📋 Lịch Sử</div>
      <div class="history-box" id="historyBox">
        <div style="text-align: center; color: #666; font-size: 10px; padding: 15px 0;">Chưa có dữ liệu</div>
      </div>
    </div>
  </div>

  <script>
    const API = "/api";
    let currentBetType = "tai";
    let currentAmount = 10000;
    let isRolling = false;
    let userBalance = 0;
    
    // Draggable Table
    const tableContainer = document.getElementById('tableContainer');
    let offsetX = 0, offsetY = 0, startX = 0, startY = 0;
    
    tableContainer.addEventListener('mousedown', (e) => {
      startX = e.clientX - tableContainer.offsetLeft;
      startY = e.clientY - tableContainer.offsetTop;
      document.addEventListener('mousemove', dragTable);
      document.addEventListener('mouseup', stopDrag);
    });
    
    function dragTable(e) {
      offsetX = e.clientX - startX;
      offsetY = e.clientY - startY;
      tableContainer.style.left = offsetX + 'px';
      tableContainer.style.top = offsetY + 'px';
    }
    
    function stopDrag() {
      document.removeEventListener('mousemove', dragTable);
      document.removeEventListener('mouseup', stopDrag);
    }
    
    // Initialize table position
    tableContainer.style.left = '50%';
    tableContainer.style.top = '50%';
    tableContainer.style.transform = 'translate(-50%, -50%)';
    
    function selectBet(el, type) {
      document.querySelectorAll('.bet-btn').forEach(b => b.classList.remove('active'));
      el.classList.add('active');
      currentBetType = type;
    }

    function setBetAmount(amount) {
      currentAmount = amount;
      document.getElementById('customAmount').value = '';
      document.querySelectorAll('.amount-btn').forEach(b => b.classList.remove('active'));
      event.target.classList.add('active');
    }

    function formatCurrency(v) {
      return Math.round(v).toLocaleString('vi-VN') + 'đ';
    }

    function updateBalance(v) {
      userBalance = v;
      document.getElementById('balance').textContent = formatCurrency(v);
    }

    function updateStatus(text) {
      document.getElementById('status').innerHTML = text;
    }

    function showToast(msg) {
      const toast = document.getElementById('toast') || createToast();
      toast.textContent = msg;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 3000);
    }

    function createToast() {
      const toast = document.createElement('div');
      toast.id = 'toast';
      toast.className = 'toast';
      document.body.appendChild(toast);
      return toast;
    }

    async function loadBalance() {
      try {
        const res = await fetch(API + '/web/game/taixiu/state');
        const data = await res.json();
        updateBalance(data.balance || 0);
        document.getElementById('sessionId').textContent = (data.sessionId || 0);
      } catch {}
    }

    async function loadHistory() {
      try {
        const res = await fetch(API + '/web/game/taixiu5d/my-history');
        const data = await res.json() || [];
        if (data.length === 0) return;
        const box = document.getElementById('historyBox');
        box.innerHTML = data.slice(0, 12).map(h => {
          const won = h.won ? '✅' : '❌';
          const bType = h.betType === 'tai' ? '📈' : h.betType === 'xiu' ? '📉' : h.betType === 'chan' ? 'C' : 'L';
          return '<div class="history-item"><span class="history-bet">' + bType + ' ' + formatCurrency(h.betAmount) + '</span><span class="' + (h.won ? 'history-win' : 'history-lose') + '">' + won + '</span></div>';
        }).join('');
      } catch {}
    }

    async function placeBet() {
      const customAmt = parseInt(document.getElementById('customAmount').value) || 0;
      const amt = customAmt > 0 ? customAmt : currentAmount;

      if (amt <= 0 || amt > userBalance) {
        showToast('❌ Số tiền không hợp lệ');
        return;
      }

      isRolling = true;
      document.getElementById('rollBtn').disabled = true;

      const dices = [1,2,3,4,5].map(i => document.getElementById('dice' + i));
      const rollInterval = setInterval(() => {
        dices.forEach(d => d.classList.add('rolling'));
      }, 100);

      try {
        const res = await fetch(API + '/web/game/taixiu5d/roll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ betAmount: amt, betType: currentBetType })
        });
        const data = await res.json();

        clearInterval(rollInterval);
        dices.forEach(d => d.classList.remove('rolling'));

        if (data.error) {
          showToast('❌ ' + data.error);
          return;
        }

        data.dice.forEach((d, i) => {
          document.getElementById('dice' + (i+1)).textContent = d;
        });

        const panel = document.getElementById('resultPanel');
        document.getElementById('resultTotal').textContent = data.total;
        document.getElementById('resultOutcome').textContent = (data.won ? '✅ THẮNG' : '❌ THUA');
        document.getElementById('resultPayout').textContent = data.won ? '+' + formatCurrency(data.payout - amt) : '-' + formatCurrency(amt);
        
        panel.classList.add('show');
        if (data.won) {
          document.getElementById('resultOutcome').classList.add('result-win');
          document.getElementById('resultOutcome').classList.remove('result-lose');
          showToast('🎉 THẮNG ' + formatCurrency(data.payout - amt));
        } else {
          document.getElementById('resultOutcome').classList.add('result-lose');
          document.getElementById('resultOutcome').classList.remove('result-win');
          showToast('😢 THUA ' + formatCurrency(amt));
        }

        updateBalance(parseFloat(data.newBalance));
        loadHistory();
      } catch (err) {
        showToast('❌ Lỗi: ' + err.message);
      } finally {
        isRolling = false;
        document.getElementById('rollBtn').disabled = false;
      }
    }

    // Initialize
    loadBalance();
    loadHistory();
    setInterval(loadBalance, 15000);
  </script>
</body>
</html>`;

router.get("/web/games/taixiu.html", (_req: Request, res: Response): void => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.send(HTML);
});

router.get("/web/games/taixiu", (_req: Request, res: Response): void => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.send(HTML);
});

router.get("/web/game/taixiu/state", async (req: Request, res: Response): Promise<void> => {
  try {
    const webUser = await getWebUser(req);
    if (!webUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    let balance = 0;
    // Prefer linked telegram bot user balance when available
    const tgId = (webUser as any).telegramId || (webUser as any).telegram_id;
    if (tgId) {
      const botUser = await storage.getBotUser(String(tgId));
      if (botUser) balance = parseFloat(botUser.balance || "0") || 0;
    } else if ((webUser as any).balance != null) {
      balance = parseFloat(String((webUser as any).balance)) || 0;
    }
    res.json({
      sessionId: `tx-${webUser.id}-${Date.now()}`,
      userId: webUser.id,
      balance,
      status: "ready",
      demo: false,
    });
  } catch (err) {
    req.log.error({ err }, "taixiu/state error");
    res.status(500).json({ error: "Lỗi server" });
  }
});

export default router;
