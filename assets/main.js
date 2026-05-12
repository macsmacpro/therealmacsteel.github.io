/* ============================================================
   THE REAL MAC STEEL — Global JS
   ============================================================ */

// ── Nav scroll effect ──
const nav = document.querySelector('nav');
if (nav) {
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 50);
  });
  // Mobile burger
  const burger = nav.querySelector('.nav-burger');
  if (burger) {
    burger.addEventListener('click', () => nav.classList.toggle('open'));
    document.addEventListener('click', e => {
      if (!nav.contains(e.target)) nav.classList.remove('open');
    });
  }
}

// ── Active nav link ──
const currentPath = window.location.pathname.split('/').pop() || 'index.html';
document.querySelectorAll('.nav-links a').forEach(a => {
  if (a.getAttribute('href') === currentPath) a.classList.add('active');
});

// ── Matrix rain ──
function initMatrix(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const chars = 'OPENCLAW01ABCDEFアイウエオカキクケコサシスセソタチツテトナニヌネノ';
  const charArr = chars.split('');
  let cols, drops;

  function resize() {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    cols = Math.floor(canvas.width / 18);
    drops = Array(cols).fill(1);
  }
  resize();
  window.addEventListener('resize', resize);

  function draw() {
    ctx.fillStyle = 'rgba(10,15,26,0.05)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = '14px monospace';
    for (let i = 0; i < drops.length; i++) {
      const char = charArr[Math.floor(Math.random() * charArr.length)];
      const x = i * 18;
      const y = drops[i] * 18;
      // Primary color for recent chars, dim for older
      ctx.fillStyle = drops[i] * 18 < canvas.height * 0.1 ? '#00ffcc' : 'rgba(0,255,204,0.4)';
      ctx.fillText(char, x, y);
      if (y > canvas.height && Math.random() > 0.975) drops[i] = 0;
      drops[i]++;
    }
  }

  setInterval(draw, 55);
}
initMatrix('matrix-canvas');

// ── Neon pulse on logo/circuit ──
const logoEl = document.querySelector('.circuit-logo');
if (logoEl) {
  let t = 0;
  setInterval(() => {
    t += 0.05;
    const glow = 10 + Math.sin(t) * 8;
    logoEl.style.filter = `drop-shadow(0 0 ${glow}px #00ffcc) drop-shadow(0 0 ${glow*2}px rgba(0,255,204,0.3))`;
  }, 50);
}

// ── Counter animation ──
function animateCounter(el) {
  const target = parseInt(el.dataset.target, 10);
  const duration = 1800;
  const start = performance.now();
  function step(now) {
    const progress = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.floor(ease * target).toLocaleString();
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}
const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      animateCounter(e.target);
      observer.unobserve(e.target);
    }
  });
}, { threshold: 0.5 });
document.querySelectorAll('[data-target]').forEach(el => observer.observe(el));

// ── Scroll reveal ──
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) e.target.classList.add('revealed');
  });
}, { threshold: 0.1 });
document.querySelectorAll('.reveal').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(30px)';
  el.style.transition = 'opacity .6s ease, transform .6s ease';
  revealObserver.observe(el);
});
document.addEventListener('animationstart', e => {
  if (e.target.classList.contains('revealed')) {
    e.target.style.opacity = '1';
    e.target.style.transform = 'none';
  }
});
// Simplified reveal via class toggle
const sReveal = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.style.opacity = '1';
      e.target.style.transform = 'none';
    }
  });
}, { threshold: 0.1 });
document.querySelectorAll('.reveal').forEach(el => sReveal.observe(el));
