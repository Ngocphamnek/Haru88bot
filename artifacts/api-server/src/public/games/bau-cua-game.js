(() => {
  const root = document.getElementById('app');
  if (!root) return;

  const state = {
    balance: 800000,
    bet: 15000,
    pick: '🐉',
    round: 0,
    history: []
  };
  const symbols = ['🐉', '🦅', '🐍', '🦌', '🐼', '🐺'];
  const diceFaces = ['🧿', '🪙', '🎲'];

  const container = document.createElement('section');
  container.className = 'game-shell';
  root.innerHTML = '';
  root.appendChild(container);

  function render() {
    container.innerHTML = '';
    const topbar = document.createElement('div');
    topbar.className = 'topbar';
    topbar.innerHTML = `
      <div class="title">Bầu Cua</div>
      <div class="row">
        <div class="badge"><span>💰</span><strong>${state.balance.toLocaleString('vi-VN')}₫</strong></div>
        <div class="badge"><span>🎯</span><strong>Ván ${state.round}</strong></div>
      </div>`;
    container.appendChild(topbar);

    const panel = document.createElement('div');
    panel.className = 'panel';

    const diceRow = document.createElement('div');
    diceRow.className = 'board';
    diceFaces.forEach((face) => {
      const tile = document.createElement('div');
      tile.className = 'tile';
      tile.textContent = face;
      diceRow.appendChild(tile);
    });
    panel.appendChild(diceRow);

    const pickRow = document.createElement('div');
    pickRow.className = 'row';
    symbols.forEach((sym) => {
      const btn = document.createElement('button');
      btn.className = `button ${state.pick === sym ? 'active primary' : ''}`;
      btn.textContent = sym;
      btn.addEventListener('click', () => {
        state.pick = sym;
        render();
      });
      pickRow.appendChild(btn);
    });
    panel.appendChild(pickRow);

    const amountRow = document.createElement('div');
    amountRow.className = 'row';
    [10000, 20000, 50000, 100000].forEach((amount) => {
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
    result.textContent = `Đang chờ mở: bạn chọn ${state.pick}`;
    panel.appendChild(result);

    const action = document.createElement('div');
    action.className = 'row';
    const rollBtn = document.createElement('button');
    rollBtn.className = 'button success';
    rollBtn.textContent = '🎲 Xúc xắc';
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
    const result = Array.from({ length: 3 }, () => symbols[Math.floor(Math.random() * symbols.length)]);
    let step = 0;
    const timer = setInterval(() => {
      tiles.forEach((tile, idx) => tile.classList.toggle('highlight', idx === step % tiles.length));
      step += 1;
      if (step > 14) {
        clearInterval(timer);
        tiles.forEach((tile, idx) => {
          const face = result[idx] || '🎲';
          tile.textContent = face;
          tile.classList.toggle('highlight', idx === result.findIndex((item) => item === state.pick));
        });
        const win = result.includes(state.pick);
        const payout = win ? state.bet * 1.5 : 0;
        state.balance += payout;
        state.history.unshift(`🎲 ${result.join(' ')}`);
        state.history = state.history.slice(0, 8);
        const banner = document.querySelector('.result-banner');
        if (banner) {
          banner.className = `result-banner ${win ? 'win' : 'lose'}`;
          banner.textContent = win ? `Đúng rồi! Nhận ${payout.toLocaleString('vi-VN')}₫` : `Kết quả ${result.join(' ')}`;
        }
        window.__setGameFxState?.(win ? 'win' : 'lose');
        render();
      }
    }, 120);
  }

  render();
})();
