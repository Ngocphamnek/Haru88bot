(() => {
  const root = document.getElementById('app');
  if (!root) return;

  const state = {
    balance: 500000,
    bet: 10000,
    pick: '🐱',
    round: 0,
    history: []
  };
  const items = ['🐱', '🐶', '🦊', '🐸', '🦁', '🐼', '🐯', '🐰', '🐵', '🐢', '🐲'];

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
        <div class="badge"><span>🎯</span><strong>Ván ${state.round}</strong></div>
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
    ['🐱', '🐶', '🦊', '🐸', '🦁', '🐼'].forEach((item) => {
      const btn = document.createElement('button');
      btn.className = `button ${state.pick === item ? 'active primary' : ''}`;
      btn.textContent = item;
      btn.addEventListener('click', () => {
        state.pick = item;
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
    result.textContent = `Đang chờ quay: bạn chọn ${state.pick}`;
    panel.appendChild(result);

    const action = document.createElement('div');
    action.className = 'row';
    const rollBtn = document.createElement('button');
    rollBtn.className = 'button primary';
    rollBtn.textContent = '🎰 Quay ngay';
    rollBtn.addEventListener('click', playRound);
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

  function playRound() {
    if (state.balance < state.bet) return;
    state.balance -= state.bet;
    state.round += 1;
    const tiles = Array.from(document.querySelectorAll('.tile'));
    tiles.forEach((tile) => tile.classList.remove('highlight'));
    window.__setGameFxState?.('roll');
    const resultIndex = Math.floor(Math.random() * items.length);
    const result = items[resultIndex];
    let step = 0;
    const timer = setInterval(() => {
      tiles.forEach((tile, idx) => tile.classList.toggle('highlight', idx === step % items.length));
      step += 1;
      if (step > 18) {
        clearInterval(timer);
        const finalIndex = resultIndex;
        tiles.forEach((tile, idx) => tile.classList.toggle('highlight', idx === finalIndex));
        const win = result === state.pick;
        const payout = win ? state.bet * 2 : 0;
        state.balance += payout;
        state.history.unshift(`🎯 ${result}`);
        state.history = state.history.slice(0, 8);
        const banner = document.querySelector('.result-banner');
        if (banner) {
          banner.className = `result-banner ${win ? 'win' : 'lose'}`;
          banner.textContent = win ? `Trúng rồi! Nhận ${payout.toLocaleString('vi-VN')}₫` : `Không trúng, kết quả ${result}`;
        }
        window.__setGameFxState?.(win ? 'win' : 'lose');
        render();
      }
    }, 90);
  }

  render();
})();
