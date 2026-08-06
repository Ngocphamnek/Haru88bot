(() => {
  const STYLE_ID = 'haru-immersive-kit';
  const DEFAULT_SELECTOR = '.game-area, .game-table, .board, #app, #gameWrap, .header';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      :root {
        --haru-tilt-x: 0deg;
        --haru-tilt-y: 0deg;
        --haru-glow-x: 50%;
        --haru-glow-y: 50%;
        --haru-accent: rgba(240, 192, 64, 0.9);
        --haru-cyan: rgba(64, 224, 208, 0.9);
      }

      .haru-immersive-root {
        position: relative;
        isolation: isolate;
        overflow: hidden;
      }

      .haru-immersive-scene {
        position: fixed;
        inset: -12%;
        pointer-events: none;
        z-index: 0;
        overflow: hidden;
      }

      .haru-immersive-scene::before,
      .haru-immersive-scene::after {
        content: '';
        position: absolute;
        inset: 0;
        background:
          radial-gradient(circle at var(--haru-glow-x) var(--haru-glow-y), rgba(255,255,255,0.11), transparent 26%),
          radial-gradient(circle at 20% 20%, rgba(64,224,208,0.16), transparent 22%),
          radial-gradient(circle at 80% 15%, rgba(240,192,64,0.14), transparent 24%),
          radial-gradient(circle at 50% 100%, rgba(255,255,255,0.06), transparent 26%);
        filter: blur(2px);
        animation: haru-ambient 9s ease-in-out infinite alternate;
      }

      .haru-immersive-scene::after {
        transform: scale(1.06) translate3d(0, 0, 0);
        opacity: 0.8;
        animation-duration: 12s;
      }

      .haru-immersive-glow {
        position: absolute;
        inset: 5%;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(255,255,255,0.14), transparent 68%);
        filter: blur(40px);
        opacity: 0.8;
        transform: translate3d(0, 0, 0);
        animation: haru-glow 8s ease-in-out infinite alternate;
      }

      .haru-immersive-orb {
        position: absolute;
        width: 18vmax;
        height: 18vmax;
        border-radius: 50%;
        background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.5), rgba(240,192,64,0.16) 40%, transparent 70%);
        filter: blur(2px);
        opacity: 0.7;
        mix-blend-mode: screen;
      }

      .haru-immersive-orb.orb-a {
        left: -8%;
        top: 8%;
        animation: haru-float 10s ease-in-out infinite alternate;
      }

      .haru-immersive-orb.orb-b {
        right: -6%;
        bottom: -5%;
        animation: haru-float 12s ease-in-out infinite alternate-reverse;
      }

      .haru-immersive-grid {
        position: absolute;
        inset: 0;
        background-image: linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px);
        background-size: 70px 70px;
        mask-image: linear-gradient(180deg, rgba(0,0,0,0.2), rgba(0,0,0,0.8));
        opacity: 0.15;
        transform: perspective(1200px) rotateX(62deg) translateY(18%);
        pointer-events: none;
      }

      .haru-immersive-root > *:not(.haru-immersive-scene) {
        position: relative;
        z-index: 1;
      }

      .haru-immersive-root .haru-tilt-surface {
        transform: perspective(1000px) rotateX(var(--haru-tilt-x)) rotateY(var(--haru-tilt-y));
        transition: transform 0.18s ease-out, box-shadow 0.18s ease-out;
      }

      .haru-immersive-root.haru-state-roll .haru-tilt-surface,
      .haru-immersive-root.haru-state-roll .chip,
      .haru-immersive-root.haru-state-roll .bet,
      .haru-immersive-root.haru-state-roll .sym-btn,
      .haru-immersive-root.haru-state-roll .dice-box,
      .haru-immersive-root.haru-state-roll .bet-card,
      .haru-immersive-root.haru-state-roll .slot,
      .haru-immersive-root.haru-state-roll .btn,
      .haru-immersive-root.haru-state-roll button {
        animation: haru-shiver 0.24s ease-in-out infinite;
      }

      .haru-immersive-root.haru-state-win .haru-tilt-surface,
      .haru-immersive-root.haru-state-win .chip,
      .haru-immersive-root.haru-state-win .bet,
      .haru-immersive-root.haru-state-win .sym-btn,
      .haru-immersive-root.haru-state-win .dice-box,
      .haru-immersive-root.haru-state-win .bet-card,
      .haru-immersive-root.haru-state-win .slot,
      .haru-immersive-root.haru-state-win .btn,
      .haru-immersive-root.haru-state-win button {
        box-shadow: 0 0 0 1px rgba(64,224,208,0.3), 0 0 28px rgba(64,224,208,0.24);
      }

      .haru-immersive-root.haru-state-lose .haru-tilt-surface,
      .haru-immersive-root.haru-state-lose .chip,
      .haru-immersive-root.haru-state-lose .bet,
      .haru-immersive-root.haru-state-lose .sym-btn,
      .haru-immersive-root.haru-state-lose .dice-box,
      .haru-immersive-root.haru-state-lose .bet-card,
      .haru-immersive-root.haru-state-lose .slot,
      .haru-immersive-root.haru-state-lose .btn,
      .haru-immersive-root.haru-state-lose button {
        box-shadow: 0 0 0 1px rgba(255,100,100,0.24), 0 0 26px rgba(255,100,100,0.2);
      }

      @keyframes haru-ambient {
        from { transform: translate3d(-2%, -1%, 0) scale(1); opacity: 0.7; }
        to { transform: translate3d(2%, 1%, 0) scale(1.04); opacity: 1; }
      }

      @keyframes haru-glow {
        from { transform: scale(0.96); opacity: 0.72; }
        to { transform: scale(1.04); opacity: 1; }
      }

      @keyframes haru-float {
        from { transform: translate3d(0, 0, 0) scale(0.95); }
        to { transform: translate3d(4%, -3%, 0) scale(1.05); }
      }

      @keyframes haru-shiver {
        0%, 100% { transform: translate3d(0, 0, 0) rotate(0deg); }
        25% { transform: translate3d(-1px, 1px, 0) rotate(-0.7deg); }
        50% { transform: translate3d(1px, -1px, 0) rotate(0.7deg); }
        75% { transform: translate3d(-1px, -1px, 0) rotate(-0.4deg); }
      }
    `;
    document.head.appendChild(style);
  }

  function getTargets(root, selector) {
    const targets = [];
    if (selector) {
      const selected = root.querySelectorAll(selector);
      selected.forEach((el) => {
        if (!el.classList.contains('haru-immersive-scene')) {
          targets.push(el);
        }
      });
    }
    if (targets.length === 0) {
      targets.push(root);
    }
    return targets;
  }

  function createScene(root) {
    const scene = document.createElement('div');
    scene.className = 'haru-immersive-scene';
    scene.setAttribute('aria-hidden', 'true');

    const glow = document.createElement('div');
    glow.className = 'haru-immersive-glow';

    const orbA = document.createElement('div');
    orbA.className = 'haru-immersive-orb orb-a';

    const orbB = document.createElement('div');
    orbB.className = 'haru-immersive-orb orb-b';

    const grid = document.createElement('div');
    grid.className = 'haru-immersive-grid';

    scene.append(glow, orbA, orbB, grid);
    root.appendChild(scene);
    return scene;
  }

  function init(options = {}) {
    injectStyles();

    const target = options.target || document.body;
    const selector = options.scopeSelector || DEFAULT_SELECTOR;
    const scope = target instanceof Element ? target : document.body;

    if (!scope) return null;

    scope.classList.add('haru-immersive-root');
    scope.classList.add('haru-state-idle');

    const scene = scope.querySelector('.haru-immersive-scene') || createScene(scope);
    const targets = getTargets(scope, selector)
      .filter((el) => el !== scene);

    targets.forEach((el) => {
      el.classList.add('haru-tilt-surface');
    });

    let audioContext;
    let audioUnlocked = false;

    function ensureAudio() {
      if (audioContext) return audioContext;
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return null;
      audioContext = new AudioCtor();
      audioUnlocked = true;
      return audioContext;
    }

    function playCue(type) {
      const ctx = ensureAudio();
      if (!ctx) return;
      if (ctx.state === 'suspended' && audioUnlocked) {
        ctx.resume().catch(() => {});
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const freqMap = { roll: 700, win: 1040, lose: 260, idle: 540 };
      const freq = freqMap[type] || 680;
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.045, ctx.currentTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    }

    function vibrate(pattern) {
      if (navigator.vibrate) {
        navigator.vibrate(pattern);
      }
    }

    function resetTilt() {
      scope.style.setProperty('--haru-tilt-x', '0deg');
      scope.style.setProperty('--haru-tilt-y', '0deg');
      scope.style.setProperty('--haru-glow-x', '50%');
      scope.style.setProperty('--haru-glow-y', '50%');
      targets.forEach((el) => {
        el.style.setProperty('--haru-tilt-x', '0deg');
        el.style.setProperty('--haru-tilt-y', '0deg');
      });
    }

    function onPointerMove(event) {
      const bounds = scope.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / bounds.width - 0.5;
      const y = (event.clientY - bounds.top) / bounds.height - 0.5;
      const tiltX = (y * 8).toFixed(2);
      const tiltY = (x * 8).toFixed(2);
      scope.style.setProperty('--haru-tilt-x', `${tiltX}deg`);
      scope.style.setProperty('--haru-tilt-y', `${tiltY}deg`);
      scope.style.setProperty('--haru-glow-x', `${((x + 0.5) * 100).toFixed(2)}%`);
      scope.style.setProperty('--haru-glow-y', `${((y + 0.5) * 100).toFixed(2)}%`);

      targets.forEach((el) => {
        el.style.setProperty('--haru-tilt-x', `${tiltX}deg`);
        el.style.setProperty('--haru-tilt-y', `${tiltY}deg`);
      });
    }

    function onPointerLeave() {
      resetTilt();
    }

    function onInteraction() {
      playCue('roll');
      vibrate([10, 20, 10]);
      api.setState('roll');
      window.clearTimeout(onInteraction._timeout);
      onInteraction._timeout = window.setTimeout(() => {
        api.setState('idle');
      }, 380);
    }

    let interactiveSelector = 'button, .btn, .chip, .bet, .sym-btn, .bet-card, .slot, .tbtn, .amount-btn, .action-btn, a, [role="button"]';
    scope.addEventListener('pointermove', onPointerMove);
    scope.addEventListener('pointerleave', onPointerLeave);
    scope.addEventListener('pointerdown', (event) => {
      if (event.target.closest(interactiveSelector)) {
        onInteraction();
      }
    });
    window.addEventListener('blur', onPointerLeave);

    const api = {
      setState(state) {
        scope.classList.remove('haru-state-idle', 'haru-state-roll', 'haru-state-win', 'haru-state-lose');
        if (state) {
          scope.classList.add(`haru-state-${state}`);
        }
        if (state === 'win') {
          playCue('win');
          vibrate([18, 10, 18]);
        } else if (state === 'lose') {
          playCue('lose');
          vibrate([8, 18, 8]);
        } else if (state === 'roll') {
          playCue('roll');
          vibrate([10, 20, 10]);
        }
      },
      playCue,
      vibrate,
      destroy() {
        scope.classList.remove('haru-immersive-root', 'haru-state-idle', 'haru-state-roll', 'haru-state-win', 'haru-state-lose');
        targets.forEach((el) => el.classList.remove('haru-tilt-surface'));
        if (scene && scene.parentNode) {
          scene.remove();
        }
        scope.removeEventListener('pointermove', onPointerMove);
        scope.removeEventListener('pointerleave', onPointerLeave);
        window.removeEventListener('blur', onPointerLeave);
      }
    };

    window.HaruImmersive = window.HaruImmersive || {};
    window.HaruImmersive.init = init;
    window.HaruImmersive.setState = api.setState;
    window.__setGameFxState = api.setState;
    return api;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.HaruImmersive = window.HaruImmersive || {};
      window.HaruImmersive.init = init;
      window.HaruImmersive.init({ target: document.body, scopeSelector: '.game-area, .game-table, .board, #app, #gameWrap' });
    }, { once: true });
  } else {
    window.HaruImmersive = window.HaruImmersive || {};
    window.HaruImmersive.init = init;
    window.HaruImmersive.init({ target: document.body, scopeSelector: '.game-area, .game-table, .board, #app, #gameWrap' });
  }
})();
