(() => {
  const root = document.getElementById('app');
  if (!root) return;

  const state = {
    balance: 320000,
    bet: 5000,
    side: 'red',
    round: 0,
    history: []
  };

  const icons = {
    red: '🔴',
    white: '⚪'
  };

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
        <div class="badge"><span>🎯</span><strong>Ván ${state.round}</strong></div>
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
    status.innerHTML = `<h3>Kết quả</h3><div class="value">${icons[state.side]} Đang chờ lắc</div>`;
    panel.appendChild(status);

    const resultBanner = document.createElement('div');
    resultBanner.className = 'result-banner neutral';
    resultBanner.textContent = 'Chọn cửa và bấm lắc để bắt đầu.';
    panel.appendChild(resultBanner);

    const footer = document.createElement('div');
    footer.className = 'row';
    footer.innerHTML = '<button class="button primary" id="rollBtn">🎲 Lắc ngay</button><button class="button" id="autoBtn">⚡ Tự động</button>';
    panel.appendChild(footer);

    const rollBtn = footer.querySelector('#rollBtn');
    rollBtn.addEventListener('click', playRound);
    footer.querySelector('#autoBtn').addEventListener('click', () => {
      playRound();
    });

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

  function playRound() {
    if (state.balance < state.bet) {
      return;
    }
    state.balance -= state.bet;
    state.round += 1;
    const coin = document.querySelector('.coin-bowl .coin');
    if (coin) {
      coin.classList.add('spinning');
    }
    const banner = document.querySelector('.result-banner');
    if (banner) {
      banner.className = 'result-banner neutral';
      banner.textContent = 'Đang lắc...';
    }
    window.__setGameFxState?.('roll');
    setTimeout(() => {
      const result = Math.random() > 0.5 ? 'red' : 'white';
      const win = state.side === result;
      const payout = win ? state.bet * 1.92 : 0;
      state.balance += payout;
      state.history.unshift({ result, icon: result === 'red' ? '🔴' : '⚪' });
      state.history = state.history.slice(0, 8);
      const coin = document.querySelector('.coin-bowl .coin');
      if (coin) {
        coin.className = `coin ${result}`;
        coin.classList.remove('spinning');
      }
      if (banner) {
        banner.className = `result-banner ${win ? 'win' : 'lose'}`;
        banner.textContent = win ? `Thắng! ${payout.toLocaleString('vi-VN')}₫` : `Thua rồi, kết quả ${result === 'red' ? '🔴 đỏ' : '⚪ trắng'}`;
      }
      const stat = document.querySelector('.stat-card .value');
      if (stat) {
        stat.textContent = `${result === 'red' ? '🔴' : '⚪'} ${result === 'red' ? 'Đỏ' : 'Trắng'}`;
      }
      window.__setGameFxState?.(win ? 'win' : 'lose');
      render();
    }, 1000);
  }

  render();
})();
