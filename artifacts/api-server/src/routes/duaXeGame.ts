import { Router, type Request, type Response } from "express";
import { gameServer, registerSSEGameClient, removeSSEGameClient } from "../lib/gameServer";
import { storage } from "../lib/storage";
import { resolveGameUserId, issueGameToken } from "../lib/security.js";
import { getSetting } from "../lib/settings.js";
import { validateBetAmount } from "../lib/limits.js";

const router = Router();

async function __gameBotToken(): Promise<string> {
  return (await getSetting("bot_token")) || process.env["BOT_TOKEN"] || "";
}

async function __requireGameTgid(req: import("express").Request, res: import("express").Response): Promise<string | null> {
  const { tgid, error } = resolveGameUserId(req, { botToken: await __gameBotToken(), requireAuth: true });
  if (!tgid) {
    res.status(401).json({ success: false, ok: false, error: error || "Unauthorized", message: error || "Unauthorized" });
    return null;
  }
  return tgid;
}

const GAME_TYPE = "duaxe";

const HTML = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<title>🏎️ Đua Xe Haru88</title>
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

<style>
*{box-sizing:border-box;margin:0;padding:0}
body{
  font-family:system-ui,-apple-system,sans-serif;min-height:100vh;color:#eef2ff;
  background:
    radial-gradient(ellipse at 20% 0%,rgba(37,99,235,.25),transparent 45%),
    radial-gradient(ellipse at 80% 100%,rgba(240,192,64,.12),transparent 40%),
    linear-gradient(165deg,#050814 0%,#0a1228 50%,#070b17 100%);
  overflow-x:hidden;
}
.page{max-width:480px;margin:0 auto;padding:16px 14px 28px;position:relative;z-index:1}
h1{
  margin:0 0 14px;font-size:26px;text-align:center;font-weight:900;letter-spacing:1px;
  background:linear-gradient(180deg,#fff,#93c5fd 60%,#3b82f6);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;
  filter:drop-shadow(0 4px 12px rgba(59,130,246,.35));
}
.card{
  background:linear-gradient(145deg,rgba(17,24,39,.95),rgba(15,23,42,.98));
  border:1px solid rgba(148,163,184,.18);border-radius:18px;padding:14px 16px;margin-bottom:14px;
  box-shadow:0 16px 36px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.05);
  transform:translateZ(0);
}
.label{color:#94a3b8;font-size:11px;margin-bottom:4px;display:block;text-transform:uppercase;letter-spacing:.8px}
.value{font-size:22px;font-weight:800;color:#5eead4;text-shadow:0 0 16px rgba(45,212,191,.35)}
#status{margin-top:10px;min-height:22px;font-size:13px;color:#cbd5e1}
.h3d-track{height:200px;margin:12px 0 4px;border-radius:16px}
.h3d-track-road{display:flex;flex-direction:column;justify-content:space-evenly;padding:10px 8px}
.lane{
  height:22%;margin:2px 0;border-radius:8px;position:relative;
  background:linear-gradient(90deg,#1e293b,#0f172a 40%,#1e293b);
  border:1px solid rgba(148,163,184,.15);
  box-shadow:inset 0 0 12px rgba(0,0,0,.4);
}
.lane-label{position:absolute;left:8px;top:50%;transform:translateY(-50%);font-size:11px;color:#94a3b8;z-index:2}
.car{
  position:absolute;left:8%;top:50%;transform:translateY(-50%);
  width:48px;height:22px;border-radius:8px 14px 6px 6px;
  transition:left .85s cubic-bezier(.22,1,.36,1);
  box-shadow:0 6px 12px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.25);
  z-index:3;
}
.car::after{content:"";position:absolute;right:6px;top:5px;width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.5)}
.car.c1{background:linear-gradient(90deg,#ef4444,#b91c1c)}.car.c2{background:linear-gradient(90deg,#3b82f6,#1d4ed8)}
.car.c3{background:linear-gradient(90deg,#22c55e,#15803d)}.car.c4{background:linear-gradient(90deg,#eab308,#a16207)}
.bets{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-top:10px}
.bets button{
  border:none;border-radius:14px;padding:14px 10px;font-size:14px;font-weight:700;cursor:pointer;
  color:#fff;position:relative;overflow:hidden;
  box-shadow:0 8px 0 rgba(0,0,0,.35),0 12px 20px rgba(0,0,0,.3);
  transition:transform .12s,box-shadow .12s;
}
.bets button:active{transform:translateY(4px);box-shadow:0 3px 0 rgba(0,0,0,.35)}
.bets button:disabled{opacity:.45;cursor:not-allowed}
#lane1Btn{background:linear-gradient(145deg,#f87171,#b91c1c)}
#lane2Btn{background:linear-gradient(145deg,#60a5fa,#1d4ed8)}
#lane3Btn{background:linear-gradient(145deg,#4ade80,#15803d)}
#lane4Btn{background:linear-gradient(145deg,#facc15,#a16207);color:#1a1000}
.pots{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-top:10px}
.pot-item{
  background:linear-gradient(145deg,#0f172a,#111827);border:1px solid #1f2937;border-radius:14px;padding:12px;
  box-shadow:0 8px 18px rgba(0,0,0,.3);transform:rotateX(4deg);
}
.pot-label{font-size:11px;color:#94a3b8;text-transform:uppercase}
.pot-value{font-size:16px;font-weight:800;margin-top:6px;color:#e2e8f0}
.result-box{
  margin-top:10px;padding:14px;border-radius:14px;
  background:linear-gradient(145deg,#0f172a,#111827);border:1px solid rgba(59,130,246,.25);
  box-shadow:0 10px 24px rgba(0,0,0,.35);min-height:48px;
}
.amount-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
.amount-row button{
  flex:1;min-width:64px;border:1px solid rgba(148,163,184,.25);border-radius:999px;
  background:rgba(15,23,42,.9);color:#e2e8f0;padding:10px;font-weight:700;cursor:pointer;
}
.amount-row button.on{background:linear-gradient(145deg,#f0c040,#c49220);color:#1a1000;border-color:transparent}
input[type=number]{
  width:100%;margin-top:8px;padding:12px 14px;border-radius:12px;border:1px solid #334155;
  background:#0f172a;color:#fff;font-size:16px;font-weight:700;
}
</style>
</head>
<body class="h3d-scene">
  <div class="h3d-glow"></div>
  <div class="page">
    <h1>🏎️ ĐUA XE</h1>
    <div class="card">
      <span class="label">Số dư</span>
      <div class="value" id="balance">0đ</div>
      <div class="h3d-track" id="track">
        <div class="h3d-track-road">
          <div class="lane"><span class="lane-label">XE 1</span><div class="car c1" id="car1"></div></div>
          <div class="lane"><span class="lane-label">XE 2</span><div class="car c2" id="car2"></div></div>
          <div class="lane"><span class="lane-label">XE 3</span><div class="car c3" id="car3"></div></div>
          <div class="lane"><span class="lane-label">XE 4</span><div class="car c4" id="car4"></div></div>
        </div>
      </div>
      <div id="status">Đang kết nối…</div>
      <div class="result-box" id="result">Chọn xe và đặt cược</div>
    </div>
    <div class="card">
      <span class="label">Mức cược</span>
      <div class="amount-row" id="chips">
        <button type="button" data-amt="1000">1K</button>
        <button type="button" data-amt="5000" class="on">5K</button>
        <button type="button" data-amt="10000">10K</button>
        <button type="button" data-amt="50000">50K</button>
        <button type="button" data-amt="100000">100K</button>
      </div>
      <input id="amount" type="number" value="5000" min="1000" step="1000"/>
      <div class="bets">
        <button id="lane1Btn" type="button">Cược Xe 1</button>
        <button id="lane2Btn" type="button">Cược Xe 2</button>
        <button id="lane3Btn" type="button">Cược Xe 3</button>
        <button id="lane4Btn" type="button">Cược Xe 4</button>
      </div>
    </div>
    <div class="card">
      <span class="label">Tổng cược theo làn</span>
      <div class="pots">
        <div class="pot-item"><div class="pot-label">Xe 1</div><div class="pot-value" id="pot1">0đ</div></div>
        <div class="pot-item"><div class="pot-label">Xe 2</div><div class="pot-value" id="pot2">0đ</div></div>
        <div class="pot-item"><div class="pot-label">Xe 3</div><div class="pot-value" id="pot3">0đ</div></div>
        <div class="pot-item"><div class="pot-label">Xe 4</div><div class="pot-value" id="pot4">0đ</div></div>
      </div>
    </div>
  </div>
<script>

    const API = "/api";
    const __qs=new URLSearchParams(location.search);
const tgId=__qs.get("tgid")||"";
const gameToken=__qs.get("gtoken")||__qs.get("gameToken")||localStorage.getItem("haru88_gtoken")||"";
if(gameToken)try{localStorage.setItem("haru88_gtoken",gameToken);}catch(e){}
    let betAmount = 10000;
    let balance = 0;
    let currentState = "waiting";
    let currentResult = null;
    let sse = null;

    function fmt(v) {
      return Math.round(v).toLocaleString("vi-VN") + "đ";
    }

    function setStatus(text) {
      document.getElementById("status").textContent = text;
    }

    function setBetAmount(value) {
      betAmount = value;
      document.getElementById("customAmount").value = "";
      setStatus('Số tiền cược: ' + fmt(value));
    }

    function getBetAmount() {
      const custom = Number(document.getElementById("customAmount").value) || 0;
      return custom > 0 ? custom : betAmount;
    }

    function updateBalance(value) {
      balance = value;
      document.getElementById("balance").textContent = fmt(balance);
    }

    function setCountdown(value) {
      document.getElementById("countdown").textContent = value + "s";
    }

    function setState(value) {
      currentState = value;
      document.getElementById("state").textContent = value;
    }

    function updatePots(pot) {
      document.getElementById("pot1").textContent = fmt(pot["lane_1"] || 0);
      document.getElementById("pot2").textContent = fmt(pot["lane_2"] || 0);
      document.getElementById("pot3").textContent = fmt(pot["lane_3"] || 0);
      document.getElementById("pot4").textContent = fmt(pot["lane_4"] || 0);
    }

    function renderResult(result) {
      const box = document.getElementById("resultBox");
      if (!result) {
        box.style.display = "none";
        return;
      }
      const winner = result.winner;
      const positions = result.positions || [];
      box.innerHTML = '<div><strong>Kết quả</strong></div><div>Xe thắng: <strong>Xe ' + winner + '</strong></div><div style="margin-top:8px;">Vị trí: ' + positions.map(function(p,i){ return '[' + (i+1) + ': ' + p + ']'; }).join(' ') + '</div>';
      box.style.display = "block";
    }

    async function placeBet(racer) {
      if (!tgId) {
        alert("Cần tgid trong URL");
        return;
      }
      if (currentState !== "countdown") {
        setStatus("Phiên cược đã đóng, chờ phiên mới.");
        return;
      }
      const amount = getBetAmount();
      if (amount <= 0 || amount > balance) {
        setStatus("Số dư không đủ hoặc tiền cược không hợp lệ.");
        return;
      }

      try {
        const res = await fetch(API + "/games/dua-xe-bet", {
          method: "POST",
          headers:{'x-game-token':gameToken||'', "Content-Type": "application/json" },
          body: JSON.stringify({gameToken:gameToken||undefined, tgid: tgId, racer, amount })
        });
        const data = await res.json();
        if (data.ok) {
          setStatus('Đã cược Xe ' + racer + ': ' + fmt(amount));
        } else {
          setStatus('Lỗi: ' + (data.message || data.msg || "Không thành công"));
        }
      } catch (error) {
        console.error(error);
        setStatus("Lỗi kết nối.");
      }
    }

    function applySnapshot(snapshot) {
      updateBalance(Number(snapshot.balance || balance));
      setState(snapshot.state || "waiting");
      setCountdown(snapshot.countdown ?? 0);
      document.getElementById("sessionId").textContent = '#' + (snapshot.sessionId || 0);
      updatePots(snapshot.pot || {});
      currentResult = snapshot.result || null;
      renderResult(currentResult);
      if (snapshot.history && snapshot.history.length > 0) {
        setStatus('Lịch sử ' + snapshot.history.length + ' phiên đã trả về.');
      }
    }

    function connectSSE() {
      if (!tgId) {
        setStatus("Không tìm thấy tgid trong URL.");
        return;
      }
      sse = new EventSource(API + "/games/dua-xe-stream?tgid=" + encodeURIComponent(tgId) + "&gtoken=" + encodeURIComponent(gameToken||""));
      sse.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "init") {
            updateBalance(data.balance || 0);
          }
          if (data.type === "state") {
            applySnapshot(data);
          }
        } catch (err) {
          console.error(err);
        }
      };
      sse.onerror = () => {
        setStatus("Mất kết nối SSE, đang cố gắng kết nối lại...");
      };
    }

    function loadState() {
      return fetch(API + "/games/dua-xe-state?tgid=" + encodeURIComponent(tgId))
        .then((res) => res.json())
        .then((data) => applySnapshot(data))
        .catch((err) => console.error(err));
    }

    connectSSE();
    loadState();
  

document.getElementById('lane1Btn')?.addEventListener('click',()=>typeof placeBet==='function'?placeBet(1):null);
document.getElementById('lane2Btn')?.addEventListener('click',()=>typeof placeBet==='function'?placeBet(2):null);
document.getElementById('lane3Btn')?.addEventListener('click',()=>typeof placeBet==='function'?placeBet(3):null);
document.getElementById('lane4Btn')?.addEventListener('click',()=>typeof placeBet==='function'?placeBet(4):null);

// UI polish hooks
(function(){
  const chips=document.getElementById('chips');
  const amount=document.getElementById('amount');
  if(chips&&amount){
    chips.addEventListener('click',e=>{
      const b=e.target.closest('button[data-amt]');
      if(!b) return;
      chips.querySelectorAll('button').forEach(x=>x.classList.remove('on'));
      b.classList.add('on');
      amount.value=b.getAttribute('data-amt');
    });
  }
  // Animate cars on result if winner lane known
  const _setResult=window.showResult||null;
  window.animateRace=function(winnerLane){
    for(let i=1;i<=4;i++){
      const c=document.getElementById('car'+i);
      if(!c) continue;
      c.style.left=(i===Number(winnerLane)?'78%':'35%');
    }
    try{const el=document.getElementById('car'+winnerLane);if(el&&window.Haru3D){const r=el.getBoundingClientRect();Haru3D.spark(r.left+r.width/2,r.top,16)}}catch(e){}
  };
})();
</script>
</body>
</html>`;

router.get("/games/dua-xe", (_req: Request, res: Response): void => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.send(HTML);
});

router.get("/games/dua-xe.html", (_req: Request, res: Response): void => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.send(HTML);
});

router.get("/games/dua-xe-stream", async (req: Request, res: Response): Promise<void> => {
  const __authTgid = await __requireGameTgid(req, res);
  if (!__authTgid) return;
  const tgid = __authTgid;
  const tgId = __authTgid;
  if (!tgId) {
    res.status(400).json({ error: "tgid required" });
    return;
  }

  const user = await storage.getBotUser(tgId);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const balance = parseFloat(user.balance || "0");
  const name = user.firstName || user.username || `Player${tgId.slice(-4)}`;

  gameServer.joinRoomSSE(tgId, GAME_TYPE, name, balance);
  registerSSEGameClient(tgId, GAME_TYPE, res);

  res.write(`data: ${JSON.stringify({ type: "init", balance, name })}\n\n`);
  res.write(`data: ${JSON.stringify(gameServer.getSnapshot(GAME_TYPE))}\n\n`);

  const keepalive = setInterval(() => {
    try {
      res.write(': keepalive\n\n');
    } catch {
      cleanup();
    }
  }, 25000);

  function cleanup() {
    clearInterval(keepalive);
    removeSSEGameClient(tgId, GAME_TYPE);
    gameServer.removePlayer(tgId, GAME_TYPE);
  }

  req.on("close", cleanup);
});

router.get("/games/dua-xe-state", async (req: Request, res: Response): Promise<void> => {
  const tgId = String(req.query["tgid"] || "");
  try {
    const user = tgId ? await storage.getBotUser(tgId) : null;
    const balance = user ? parseFloat(user.balance || "0") : 0;
    const snapshot = gameServer.getSnapshot(GAME_TYPE);
    res.json({ ...snapshot, balance });
  } catch (err) {
    req.log.error({ err }, "dua-xe-state error");
    res.status(500).json({ error: "server error" });
  }
});

router.post("/games/dua-xe-bet", async (req: Request, res: Response): Promise<void> => {
  const __authTgid = await __requireGameTgid(req, res);
  if (!__authTgid) return;
  const tgid = __authTgid;
  const tgId = __authTgid;
  const { racer, amount } = req.body;

  if (!tgid || racer == null || amount == null) {
    res.status(400).json({ ok: false, msg: "Missing parameters" });
    return;
  }

  if (!/^\d{5,15}$/.test(String(tgid))) {
    res.status(400).json({ ok: false, msg: "Invalid tgid" });
    return;
  }

  const racerNum = Number(racer);
  if (![1, 2, 3, 4].includes(racerNum)) {
    res.status(400).json({ ok: false, msg: "Invalid racer" });
    return;
  }

  const amountCheck = validateBetAmount(amount);
  if (!amountCheck.ok) {
    res.status(400).json({ ok: false, msg: amountCheck.message });
    return;
  }
  const amountNum = amountCheck.amount;

  try {
    const result = await gameServer.placeBet(String(tgid), GAME_TYPE, `lane_${racerNum}`, amountNum);
    if (!result.success) {
      res.json({ ok: false, msg: result.message });
      return;
    }
    res.json({ ok: true, msg: "Bet placed" });
  } catch (err) {
    req.log.error({ err }, "dua-xe-bet error");
    res.status(500).json({ ok: false, msg: "Server error" });
  }
});

export default router;
