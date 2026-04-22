/* ========================================
   SIS-C AI — Login + Modulos (JS puro)
   ======================================== */

(function () {
  'use strict';

  // ===================================
  // SISTEMA DE PARTICULAS ANIMADAS
  // ===================================
  var canvas = document.getElementById('particulas-canvas');
  var ctx = canvas ? canvas.getContext('2d') : null;
  var particulas = [];
  var animFrameId = null;
  var mouseX = -1000;
  var mouseY = -1000;

  function resizeCanvas() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function criarParticulas() {
    particulas = [];
    if (!canvas) return;
    var qtd = Math.floor((canvas.width * canvas.height) / 12000);
    if (qtd > 150) qtd = 150;
    if (qtd < 40) qtd = 40;

    var cores = [
      'rgba(52, 211, 153, ',   // verde
      'rgba(0, 229, 255, ',    // ciano
      'rgba(139, 92, 246, ',   // roxo
      'rgba(245, 158, 11, ',   // amber
      'rgba(255, 255, 255, '   // branco
    ];

    for (var i = 0; i < qtd; i++) {
      particulas.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: Math.random() * 2 + 0.5,
        cor: cores[Math.floor(Math.random() * cores.length)],
        opBase: Math.random() * 0.5 + 0.15,
        pulseOffset: Math.random() * Math.PI * 2
      });
    }
  }

  function desenharParticulas(tempo) {
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (var i = 0; i < particulas.length; i++) {
      var p = particulas[i];

      // Mover
      p.x += p.vx;
      p.y += p.vy;

      // Wrap nas bordas
      if (p.x < -10) p.x = canvas.width + 10;
      if (p.x > canvas.width + 10) p.x = -10;
      if (p.y < -10) p.y = canvas.height + 10;
      if (p.y > canvas.height + 10) p.y = -10;

      // Efeito de pulsacao
      var pulse = Math.sin(tempo * 0.001 + p.pulseOffset) * 0.3 + 0.7;
      var op = p.opBase * pulse;

      // Reacao ao mouse
      var dx = p.x - mouseX;
      var dy = p.y - mouseY;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 150) {
        op = Math.min(1, op + (1 - dist / 150) * 0.6);
        p.x += dx * 0.008;
        p.y += dy * 0.008;
      }

      // Desenhar particula
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.cor + op + ')';
      ctx.fill();

      // Linhas de conexao
      for (var j = i + 1; j < particulas.length; j++) {
        var p2 = particulas[j];
        var dx2 = p.x - p2.x;
        var dy2 = p.y - p2.y;
        var d = Math.sqrt(dx2 * dx2 + dy2 * dy2);
        if (d < 120) {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = 'rgba(52, 211, 153, ' + (0.08 * (1 - d / 120)) + ')';
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }
  }

  function animLoop(tempo) {
    desenharParticulas(tempo);
    animFrameId = requestAnimationFrame(animLoop);
  }

  function iniciarParticulas() {
    resizeCanvas();
    criarParticulas();
    if (animFrameId) cancelAnimationFrame(animFrameId);
    animFrameId = requestAnimationFrame(animLoop);
  }

  function pararParticulas() {
    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
  }

  // Mouse tracking
  document.addEventListener('mousemove', function (e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  window.addEventListener('resize', function () {
    resizeCanvas();
    criarParticulas();
  });

  // ===================================
  // LOGICA DE LOGIN / MODULOS
  // ===================================

  // ---------- Elementos ----------
  var telaLogin   = document.getElementById('tela-login');
  var telaModulos = document.getElementById('tela-modulos');
  var formLogin   = document.getElementById('form-login');
  var inputEmail  = document.getElementById('input-email');
  var loginErro   = document.getElementById('login-erro');
  var btnSair     = document.getElementById('btn-sair');
  var avatarLetra = document.getElementById('avatar-letra');
  var usuarioNome = document.getElementById('usuario-nome');
  var heroNome    = document.getElementById('hero-nome');
  var btnSistemasExternos = document.getElementById('btn-sistemas-externos');
  var cardSistemasExternos = document.getElementById('card-sistemas-externos');
  var areaSistemasExternos = document.getElementById('modulos-tools');

  // ---------- Helpers ----------
  function getUsuario() {
    try {
      var raw = localStorage.getItem('sisc_usuario');
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  }

  function setUsuario(dados) {
    localStorage.setItem('sisc_usuario', JSON.stringify(dados));
  }

  function removeUsuario() {
    localStorage.removeItem('sisc_usuario');
  }

  function exibirNome(nome) {
    var n = nome || 'Usuario';
    avatarLetra.textContent = n.charAt(0).toUpperCase();
    usuarioNome.textContent = n;
    heroNome.textContent    = n;
  }

  function fecharCardSistemasExternos() {
    if (!cardSistemasExternos || !btnSistemasExternos) return;
    cardSistemasExternos.hidden = true;
    btnSistemasExternos.setAttribute('aria-expanded', 'false');
  }

  function alternarCardSistemasExternos() {
    if (!cardSistemasExternos || !btnSistemasExternos) return;
    var abrir = cardSistemasExternos.hidden;
    cardSistemasExternos.hidden = !abrir;
    btnSistemasExternos.setAttribute('aria-expanded', abrir ? 'true' : 'false');
  }

  // ---------- Navegacao entre telas ----------
  function mostrarLogin() {
    telaLogin.style.display   = 'flex';
    telaModulos.style.display = 'none';
    fecharCardSistemasExternos();
    inputEmail.value = '';
    loginErro.style.display = 'none';
    inputEmail.focus();
    iniciarParticulas();
  }

  function mostrarModulos(usuario) {
    telaLogin.style.display   = 'none';
    telaModulos.style.display = 'block';
    exibirNome(usuario.nome);
    pararParticulas();
  }

  // ---------- Verificar sessao ----------
  var usuario = getUsuario();
  if (usuario) {
    mostrarModulos(usuario);
  } else {
    iniciarParticulas();
  }

  // ---------- Submit do login ----------
  formLogin.addEventListener('submit', function (e) {
    e.preventDefault();
    loginErro.style.display = 'none';

    var email = inputEmail.value.trim();
    if (!email) {
      loginErro.textContent = 'Digite seu e-mail para continuar.';
      loginErro.style.display = 'block';
      return;
    }

    // Autenticacao simulada — substituir por API real
    var dados = {
      nome: email.split('@')[0],
      email: email
    };
    setUsuario(dados);
    mostrarModulos(dados);
  });

  // ---------- Logout ----------
  btnSair.addEventListener('click', function () {
    removeUsuario();
    mostrarLogin();
  });

  if (btnSistemasExternos) {
    btnSistemasExternos.addEventListener('click', function (e) {
      e.stopPropagation();
      alternarCardSistemasExternos();
    });
  }

  document.addEventListener('click', function (e) {
    if (!areaSistemasExternos || !cardSistemasExternos || cardSistemasExternos.hidden) return;
    if (areaSistemasExternos.contains(e.target)) return;
    fecharCardSistemasExternos();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') fecharCardSistemasExternos();
  });

})();
