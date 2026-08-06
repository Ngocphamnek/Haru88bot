(() => {
  const app = document.getElementById('app');
  if (!app) return;

  const state = {
    balance: 0,
    phase: 'idle',
    roundId: 0,
    timeLeft: 0,
    multiplier: 1,
    crashAt: 0,
    myBet: 0,
    myCashout: 0,
    history: [],
    betAmount: 10000,
    audioEnabled: true,
  };

  let eventSource = null;
  let hasPlacedBet = false;
  const audioCtx = typeof AudioContext !== 'undefined' ? new AudioContext() : null;

  function fmt(n) {
    return Math.round(n || 0).toLocaleString('vi-VN') + 'đ';
  }

  function beep(type) {
    if (!state.audioEnabled || !audioCtx) return;
    const ctx = audioCtx;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type === 'win' ? 'triangle' : 'sine';
    osc.frequency.value = type === 'win' ? 980 : 580;
    gain.gain.value = 0.02;
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  }

  function render() {
    app.innerHTML = `
      <section class="game-shell">
        <div class="topbar">
          <div class="title">✈️ Máy Bay 3D</div>
          <div class="row">
            <div class="badge"><span>💰</span><strong>${fmt(state.balance)}</strong></div>
            <div class="badge"><span>🕒</span><strong>Ván ${state.roundId}</strong></div>
          </div>
        </div>
        <div class="panel">
          <div class="stat-card">
            <h3>Trạng thái</h3>
            <div class="value" id="phaseText">${phaseLabel(state.phase)}</div>
          </div>
          <div class="stat-card">
            <h3>Tỷ lệ</h3>
            <div class="value" id="multiplierText">x${state.multiplier.toFixed(2)}</div>
          </div>
          <div class="stat-card">
            <h3>Thời gian</h3>
            <div class="value" id="timeText">${state.timeLeft}s</div>
          </div>
          <div class="result-banner ${state.phase === 'crashed' ? 'lose' : state.phase === 'flying' ? 'win' : 'neutral'}" id="resultBanner">
            ${resultMessage()}
          </div>
          <div class="row" id="betRow">
            ${[10000, 20000, 50000, 100000].map((v) => `<button class="button ${state.betAmount === v ? 'active' : ''}" data-bet="${v}">${fmt(v)}</button>`).join('')}
          </div>
          <div class="row" style="margin-top:8px">
            <button class="button primary" id="betBtn">🎯 Đặt cược</button>
            <button class="button" id="cashoutBtn">🧳 Rút lãi</button>
          </div>
          <div class="row" style="margin-top:8px">
            <button class="button" id="soundBtn">🔊 ${state.audioEnabled ? 'Bật âm' : 'Tắt âm'}</button>
            <button class="button" id="refreshBtn">🔄 Làm mới</button>
          </div>
          <div class="history-list" id="historyList"></div>
        </div>
      </section>
    `;

    document.querySelectorAll('[data-bet]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.betAmount = Number(btn.getAttribute('data-bet'));
        render();
      });
    });

    document.getElementById('betBtn').addEventListener('click', placeBet);
    document.getElementById('cashoutBtn').addEventListener('click', cashOut);
    document.getElementById('soundBtn').addEventListener('click', toggleSound);
    document.getElementById('refreshBtn').addEventListener('click', fetchState);

    const history = document.getElementById('historyList');
    history.innerHTML = (state.history || []).slice(0, 8).map((item) => `<div class="history-chip">x${item.toFixed(2)}</div>`).join('');
  }

  function phaseLabel(phase) {
    return phase === 'waiting' ? 'Đang mở cửa đặt cược' : phase === 'flying' ? 'Máy bay đang bay' : phase === 'crashed' ? 'Máy bay nổ' : 'Sẵn sàng';
  }

  function resultMessage() {
    if (state.phase === 'flying') return `Máy bay đang tăng, hiện tại ${state.multiplier.toFixed(2)}x`;
    if (state.phase === 'crashed') return `Nổ tại x${state.crashAt.toFixed(2)} — bạn ${state.myCashout > 0 ? 'đã rút lãi' : 'thua cược'}`;
    if (state.phase === 'waiting') return 'Cửa đặt cược đang mở, chờ máy bay cất cánh';
    return 'Sẵn sàng cho vòng mới';
  }

  function updateText() {
    const phase = document.getElementById('phaseText');
    const mult = document.getElementById('multiplierText');
    const time = document.getElementById('timeText');
    const banner = document.getElementById('resultBanner');
    if (phase) phase.textContent = phaseLabel(state.phase);
    if (mult) mult.textContent = `x${state.multiplier.toFixed(2)}`;
    if (time) time.textContent = `${state.timeLeft}s`;
    if (banner) {
      banner.className = `result-banner ${state.phase === 'crashed' ? 'lose' : state.phase === 'flying' ? 'win' : 'neutral'}`;
      banner.textContent = resultMessage();
    }
  }

  async function fetchState() {
    try {
      const params = new URLSearchParams(window.location.search);
      const tgid = params.get('tgid') || localStorage.getItem('haru88_tgid') || '';
      const token = params.get('gtoken') || localStorage.getItem('haru88_gtoken') || '';
      const res = await fetch(`/api/crash/games/crash-state${tgid ? `?tgid=${encodeURIComponent(tgid)}` : ''}`, {
        headers: token ? { 'x-game-token': token } : {}
      });
      const data = await res.json();
      state.balance = Number(data.balance || 0);
      state.phase = data.phase || 'idle';
      state.roundId = Number(data.roundId || 0);
      state.timeLeft = Number(data.timeLeft || 0);
      state.multiplier = Number(data.multiplier || 1);
      state.crashAt = Number(data.crashAt || 1);
      state.history = data.history || [];
      render();
      updateText();
    } catch (err) {
      console.error(err);
    }
  }

  async function placeBet() {
    try {
      const params = new URLSearchParams(window.location.search);
      const tgid = params.get('tgid') || localStorage.getItem('haru88_tgid') || '';
      const token = params.get('gtoken') || localStorage.getItem('haru88_gtoken') || '';
      const res = await fetch('/api/crash/games/crash-bet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'x-game-token': token } : {})
        },
        body: JSON.stringify({ amount: state.betAmount, tgid })
      });
      const data = await res.json();
      if (data.ok) {
        hasPlacedBet = true;
        state.myBet = state.betAmount;
        beep('win');
        await fetchState();
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function cashOut() {
    try {
      const params = new URLSearchParams(window.location.search);
      const tgid = params.get('tgid') || localStorage.getItem('haru88_tgid') || '';
      const token = params.get('gtoken') || localStorage.getItem('haru88_gtoken') || '';
      const res = await fetch('/api/crash/games/crash-cashout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'x-game-token': token } : {})
        },
        body: JSON.stringify({ tgid })
      });
      const data = await res.json();
      if (data.ok) {
        state.myCashout = Number(data.payout || 0);
        beep('win');
        await fetchState();
      }
    } catch (err) {
      console.error(err);
    }
  }

  function toggleSound() {
    state.audioEnabled = !state.audioEnabled;
    render();
  }

  function connectSSE() {
    if (eventSource) eventSource.close();
    const params = new URLSearchParams(window.location.search);
    const tgid = params.get('tgid') || localStorage.getItem('haru88_tgid') || '';
    const token = params.get('gtoken') || localStorage.getItem('haru88_gtoken') || '';
    const url = `/api/crash/games/crash-stream${tgid ? `?tgid=${encodeURIComponent(tgid)}` : ''}${token ? `&gtoken=${encodeURIComponent(token)}` : ''}`;
    eventSource = new EventSource(url);
    eventSource.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data);
        if (data.type === 'phase') {
          state.phase = data.phase || 'idle';
          state.roundId = Number(data.roundId || 0);
          state.crashAt = Number(data.crashAt || 1);
          state.timeLeft = Number(data.timeLeft || 0);
          state.multiplier = Number(data.multiplier || 1);
          if (state.phase === 'flying') beep('win');
          if (state.phase === 'crashed') beep('lose');
        } else if (data.type === 'tick_fly') {
          state.multiplier = Number(data.multiplier || state.multiplier);
        } else if (data.type === 'tick_wait') {
          state.timeLeft = Number(data.timeLeft || state.timeLeft);
        } else if (data.type === 'balance_update') {
          state.balance = Number(data.balance || state.balance);
        } else if (data.type === 'result') {
          state.myCashout = Number(data.payout || 0);
        }
        render();
        updateText();
      } catch {}
    };
  }

  render();
  fetchState();
  connectSSE();
})();
