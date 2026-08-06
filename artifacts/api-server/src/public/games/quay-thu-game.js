(() => {
  const root = document.getElementById('app');
  if (!root) return;

  const params = new URLSearchParams(window.location.search);
  const tgid = params.get('tgid') || localStorage.getItem('haru88_tgid') || '';
  const token = params.get('gtoken') || localStorage.getItem('haru88_gtoken') || '';

  const state = {
    balance: 0,
    bet: 10000,
    pick: 'Yến',
    round: 0,
    history: [],
    countdown: 0,
    status: 'Đang kết nối...'
  };
  const items = [
    { id: 'Yến', label: '🕊️ Yến' },
    { id: 'Bồ Câu', label: '🕊️ Bồ Câu' },
    { id: 'Gấu Trúc', label: '🐼 Gấu Trúc' },
    { id: 'Khỉ', label: '🐵 Khỉ' },
    { id: 'Thỏ', label: '🐰 Thỏ' },
    { id: 'Công', label: '🦚 Công' },
    { id: 'Hổ', label: '🐯 Hổ' },
    { id: 'Đại Bàng', label: '🦅 Đại Bàng' },
    { id: 'Cá Mập Xanh', label: '🦈 Cá Mập Xanh' },
    { id: 'Cá Mập Vàng', label: '🟡 Cá Mập Vàng' },
    { id: 'Rương', label: '💎 Rương' },
    { id: 'Bom', label: '💣 Bom' }
  ];

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
      <div class="title">Quay Thú</div>
      <div class="row">
        <div class="badge"><span>💰</span><strong>${state.balance.toLocaleString('vi-VN')}₫</strong></div>
        <div class="badge"><span>🕒</span><strong>${state.countdown}s</strong></div>
      </div>`;
    container.appendChild(topbar);

    const panel = document.createElement('div');
    panel.className = 'panel';

    const board = document.createElement('div');
    board.className = 'board';
    items.forEach((item) => {
      const tile = document.createElement('div');
      tile.className = 'tile';
      tile.textContent = item;
      board.appendChild(tile);
    });
    panel.appendChild(board);

    const pickRow = document.createElement('div');
    pickRow.className = 'row';
    items.slice(0, 6).forEach((item) => {
      const btn = document.createElement('button');
      btn.className = `button ${state.pick === item.id ? 'active primary' : ''}`;
      btn.textContent = item.label;
      btn.addEventListener('click', () => {
        state.pick = item.id;
        render();
      });
      pickRow.appendChild(btn);
    });
    panel.appendChild(pickRow);

    const amountRow = document.createElement('div');
    amountRow.className = 'row';
    [5000, 10000, 20000, 50000].forEach((amount) => {
      const btn = document.createElement('button');
      btn.className = `button ${state.bet === amount ? 'active' : ''}`;
      btn.textContent = `${amount.toLocaleString('vi-VN')}₫`;
      btn.addEventListener('click', () => {
        state.bet = amount;
        render();
      });
      amountRow.appendChild(btn);
    });
    panel.appendChild(amountRow);

    const result = document.createElement('div');
    result.className = 'result-banner neutral';
    result.textContent = state.status;
    panel.appendChild(result);

    const action = document.createElement('div');
    action.className = 'row';
    const rollBtn = document.createElement('button');
    rollBtn.className = 'button primary';
    rollBtn.textContent = '🎰 Đặt cược';
    rollBtn.addEventListener('click', placeBet);
    action.appendChild(rollBtn);
    panel.appendChild(action);

    const historyWrap = document.createElement('div');
    historyWrap.className = 'history-list';
    state.history.slice(0, 6).forEach((item) => {
      const chip = document.createElement('div');
      chip.className = 'history-chip';
      chip.textContent = item;
      historyWrap.appendChild(chip);
    });
    panel.appendChild(historyWrap);

    container.appendChild(panel);
  }

  function placeBet() {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      state.status = 'Chưa kết nối WebSocket';
      render();
      return;
    }
    ws.send(JSON.stringify({ type: 'bet', betType: state.pick, amount: state.bet, tgId: tgid, gameToken: token, gameType: 'quaythu' }));
    state.status = 'Đang gửi cược...';
    render();
  }

  function connectSocket() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) ws.close();
    state.status = 'Đang kết nối...';
    render();
    const socketUrl = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws?gameType=quaythu&tgId=${encodeURIComponent(tgid)}&gtoken=${encodeURIComponent(token)}`;
    ws = new WebSocket(socketUrl);
    ws.addEventListener('open', () => {
      ws.send(JSON.stringify({ type: 'join', tgId: tgid, gameToken: token, gameType: 'quaythu' }));
      state.status = 'Đã kết nối';
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
          if (data.result?.winner) {
            state.history.unshift(`🎯 ${data.result.winner}`);
            state.history = state.history.slice(0, 8);
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
      state.status = 'Mất kết nối';
      render();
    });
  }

  render();
  connectSocket();
})();
