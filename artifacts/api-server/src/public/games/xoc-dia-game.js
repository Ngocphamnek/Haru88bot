(() => {
  const root = document.getElementById('app');
  if (!root) return;

  const params = new URLSearchParams(window.location.search);
  const tgid = params.get('tgid') || localStorage.getItem('haru88_tgid') || '';
  const token = params.get('gtoken') || localStorage.getItem('haru88_gtoken') || '';

  const state = {
    balance: 0,
    bet: 5000,
    side: 'red',
    round: 0,
    history: [],
    isConnected: false,
    countdown: 0,
    currentResult: null,
    status: 'Đang kết nối...'
  };

  const icons = {
    red: '🔴',
    white: '⚪'
  };

  let ws = null;
  const container = document.createElement('section');
  container.className = 'game-shell';
  root.innerHTML = '';
  root.appendChild(container);

  function render() {
    container.innerHTML = '';
    const topbar = document.createElement('div');
    topbar.className = 'topbar';
    topbar.innerHTML = `
      <div class="title">Xóc Đĩa Live</div>
      <div class="row">
        <div class="badge"><span>💰</span><strong>${state.balance.toLocaleString('vi-VN')}₫</strong></div>
        <div class="badge"><span>🕒</span><strong>${state.countdown}s</strong></div>
      </div>`;
    container.appendChild(topbar);

    const panel = document.createElement('div');
    panel.className = 'panel';

    const cards = document.createElement('div');
    cards.className = 'grid';
    cards.innerHTML = `
      <div class="row">
        <button class="button ${state.side === 'red' ? 'active primary' : ''}" data-side="red">🔴 Cược đỏ</button>
        <button class="button ${state.side === 'white' ? 'active primary' : ''}" data-side="white">⚪ Cược trắng</button>
      </div>
      <div class="row">
        <button class="button ${state.bet === 5000 ? 'active' : ''}" data-bet="5000">5k</button>
        <button class="button ${state.bet === 10000 ? 'active' : ''}" data-bet="10000">10k</button>
        <button class="button ${state.bet === 20000 ? 'active' : ''}" data-bet="20000">20k</button>
        <button class="button ${state.bet === 50000 ? 'active' : ''}" data-bet="50000">50k</button>
      </div>`;
    cards.querySelectorAll('[data-side]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.side = btn.getAttribute('data-side');
        render();
      });
    });
    cards.querySelectorAll('[data-bet]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.bet = Number(btn.getAttribute('data-bet'));
        render();
      });
    });
    panel.appendChild(cards);

    const bowl = document.createElement('div');
    bowl.className = 'coin-bowl';
    bowl.innerHTML = '<div class="shadow"></div><div class="plate"></div><div class="coin"></div>';
    panel.appendChild(bowl);

    const status = document.createElement('div');
    status.className = 'stat-card';
    status.innerHTML = `<h3>Trạng thái</h3><div class="value">${state.status}</div>`;
    panel.appendChild(status);

    const resultBanner = document.createElement('div');
    resultBanner.className = 'result-banner neutral';
    resultBanner.textContent = state.currentResult ? `Kết quả gần nhất: ${state.currentResult}` : 'Chọn cửa và chờ phiên mới.';
    panel.appendChild(resultBanner);

    const footer = document.createElement('div');
    footer.className = 'row';
    footer.innerHTML = '<button class="button primary" id="rollBtn">🎲 Đặt cược</button><button class="button" id="autoBtn">🔌 Kết nối</button>';
    panel.appendChild(footer);

    const rollBtn = footer.querySelector('#rollBtn');
    rollBtn.addEventListener('click', placeBet);
    footer.querySelector('#autoBtn').addEventListener('click', connectSocket);

    const historyWrap = document.createElement('div');
    historyWrap.className = 'history-list';
    state.history.slice(0, 6).forEach((item) => {
      const chip = document.createElement('div');
      chip.className = 'history-chip';
      chip.textContent = `${item.icon} ${item.result}`;
      historyWrap.appendChild(chip);
    });
    panel.appendChild(historyWrap);

    container.appendChild(panel);
  }

  async function placeBet() {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      state.status = 'Chưa kết nối WebSocket';
      render();
      return;
    }
    ws.send(JSON.stringify({ type: 'bet', betType: state.side === 'red' ? 'chan' : 'le', amount: state.bet, tgId: tgid, gameToken: token, gameType: 'xocdia' }));
    state.status = 'Đang gửi cược...';
    render();
  }

  function connectSocket() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      ws.close();
    }
    state.status = 'Đang kết nối...';
    render();
    const socketUrl = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws?gameType=xocdia&tgId=${encodeURIComponent(tgid)}&gtoken=${encodeURIComponent(token)}`;
    ws = new WebSocket(socketUrl);
    ws.addEventListener('open', () => {
      state.isConnected = true;
      state.status = 'Đã kết nối';
      ws.send(JSON.stringify({ type: 'join', tgId: tgid, gameToken: token, gameType: 'xocdia' }));
      render();
    });
    ws.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'user_info') {
          state.balance = Number(data.balance || 0);
          state.status = 'Sẵn sàng';
        } else if (data.type === 'state') {
          state.round = Number(data.sessionId || 0);
          state.countdown = Number(data.countdown || 0);
          state.status = data.state === 'result' ? 'Đã có kết quả' : data.state === 'playing' ? 'Đang diễn ra' : 'Đang chờ phiên mới';
          if (data.result) {
            const resultText = data.result.redCount !== undefined ? `${data.result.redCount} đỏ / ${4 - data.result.redCount} trắng` : JSON.stringify(data.result);
            state.currentResult = resultText;
          }
          if (data.history?.length) {
            state.history = data.history.slice(0, 6).map((item) => ({ result: item.result?.redCount !== undefined ? `${item.result.redCount} đỏ` : JSON.stringify(item.result), icon: '🎲' }));
          }
        } else if (data.type === 'bet_result') {
          state.status = data.success ? 'Cược đã ghi nhận' : data.message;
        } else if (data.type === 'balance_update') {
          state.balance = Number(data.balance || state.balance);
        } else if (data.type === 'error') {
          state.status = data.message || 'Lỗi';
        }
        render();
      } catch {}
    });
    ws.addEventListener('close', () => {
      state.isConnected = false;
      state.status = 'Mất kết nối';
      render();
    });
    ws.addEventListener('error', () => {
      state.isConnected = false;
      state.status = 'Lỗi kết nối';
      render();
    });
  }

  render();
  connectSocket();
})();
