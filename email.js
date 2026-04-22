/* ═══════════════════════════════════════════════════════════════════════════
   SIS-C AI — Módulo E-mail v2.0.0  ·  DEX Engine
   ═══════════════════════════════════════════════════════════════════════════ */
;(function () {
  'use strict';

  /* ─── Helpers ─── */
  var $ = function (id) { return document.getElementById(id); };
  var $$ = function (sel, ctx) { return (ctx || document).querySelectorAll(sel); };
  var uid = function () { return '_' + Math.random().toString(36).substr(2, 9); };
  var clamp = function (v, lo, hi) { return Math.max(lo, Math.min(hi, v)); };
  var esc = function (s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; };
  var ago = function (d) {
    var ms = Date.now() - new Date(d).getTime();
    var s = ms / 1000, m = s / 60, h = m / 60, dy = h / 24;
    if (dy >= 1) return Math.floor(dy) + 'd';
    if (h >= 1) return Math.floor(h) + 'h';
    if (m >= 1) return Math.floor(m) + 'min';
    return 'agora';
  };
  var fmtDate = function (d) {
    var dt = new Date(d);
    return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ' ' + dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };
  var fmtShortDate = function (d) {
    var dt = new Date(d), now = new Date();
    if (dt.toDateString() === now.toDateString()) return dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  };
  var stripHtml = function (s) { return (s || '').replace(/<[^>]+>/g, ' '); };

  /* ─── Constants ─── */
  var STORAGE_KEY = 'sisc_email_v2';
  var SOUNDS = {
    newEmail: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQ==',
    sent: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQ==',
    dex: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQ=='
  };

  /* ─── Companies & Domain Mapping ─── */
  var COMPANIES = [
    { id: 'c1', name: 'Oliveira & Santos Ltda', cnpj: '12.345.678/0001-01', domains: ['oliveirasantos.com.br'], color: '#0891b2' },
    { id: 'c2', name: 'Tech Solutions S.A.', cnpj: '23.456.789/0001-02', domains: ['techsolutions.com.br', 'tech-sol.com'], color: '#7c3aed' },
    { id: 'c3', name: 'BR Comércio Eireli', cnpj: '34.567.890/0001-03', domains: ['brcomercio.com.br'], color: '#ea580c' },
    { id: 'c4', name: 'Construmax Engenharia', cnpj: '45.678.901/0001-04', domains: ['construmax.eng.br', 'construmax.com.br'], color: '#16a34a' },
    { id: 'c5', name: 'MedVida Clínica', cnpj: '56.789.012/0001-05', domains: ['medvida.com.br'], color: '#dc2626' },
    { id: 'c6', name: 'Agro Norte S.A.', cnpj: '67.890.123/0001-06', domains: ['agronorte.agr.br'], color: '#f59e0b' },
    { id: 'c7', name: 'JM Transportes', cnpj: '78.901.234/0001-07', domains: ['jmtransportes.com.br'], color: '#2563eb' },
    { id: 'c8', name: 'Rede Farma Popular', cnpj: '89.012.345/0001-08', domains: ['redefarma.com.br'], color: '#ec4899' }
  ];

  /* ─── Labels ─── */
  var LABELS = [
    { id: 'l1', name: 'Fiscal', color: '#16a34a' },
    { id: 'l2', name: 'Contábil', color: '#2563eb' },
    { id: 'l3', name: 'DP', color: '#7c3aed' },
    { id: 'l4', name: 'Financeiro', color: '#f59e0b' },
    { id: 'l5', name: 'Societário', color: '#ec4899' },
    { id: 'l6', name: 'Urgente', color: '#dc2626' },
    { id: 'l7', name: 'Pendente', color: '#ea580c' },
    { id: 'l8', name: 'Resolvido', color: '#059669' }
  ];

  /* ─── Seed Emails ─── */
  var SEED_EMAILS = [];

  /* ─── Default Automation Rules ─── */
  var DEFAULT_RULES = [];

  /* ════════════════════════════════════════════
     DEX AI ENGINE
     ════════════════════════════════════════════ */
  var DexEngine = {
    name: 'DEX',
    fullName: 'Data Exchange Expert',
    version: '2.0.0',
    actionsLog: [],
    learningData: {},

    /* Sentiment analysis */
    analyzeSentiment: function (text) {
      var t = (text || '').toLowerCase();
      var neg = ['urgente', 'problema', 'erro', 'divergência', 'vencendo', 'incorret', 'multa', 'notificação', 'atraso', 'pendência', 'reclamação', 'cancelar'];
      var pos = ['obrigado', 'aprovei', 'perfeito', 'excelente', 'parabéns', 'ótimo', 'confirmado', 'ok', 'correto'];
      var nScore = 0, pScore = 0;
      neg.forEach(function (w) { if (t.indexOf(w) >= 0) nScore++; });
      pos.forEach(function (w) { if (t.indexOf(w) >= 0) pScore++; });
      if (nScore > pScore) return { mood: 'negativo', score: clamp(-nScore, -5, 0), icon: 'fa-face-frown', color: '#dc2626' };
      if (pScore > nScore) return { mood: 'positivo', score: clamp(pScore, 0, 5), icon: 'fa-face-smile', color: '#16a34a' };
      return { mood: 'neutro', score: 0, icon: 'fa-face-meh', color: '#94a3b8' };
    },

    /* Intent detection */
    detectIntent: function (text) {
      var t = (text || '').toLowerCase();
      var intents = [
        { id: 'envio_docs', keywords: ['segue', 'encaminho', 'envio', 'anexo', 'seguem'], label: 'Envio de Documentos', icon: 'fa-file-arrow-up' },
        { id: 'duvida', keywords: ['dúvida', 'gostaria de esclarecer', 'consulta', 'orientação', 'como', 'qual'], label: 'Dúvida/Consulta', icon: 'fa-circle-question' },
        { id: 'urgencia', keywords: ['urgente', 'urgência', 'vencendo', 'imediato', 'máxima urgência'], label: 'Urgência', icon: 'fa-triangle-exclamation' },
        { id: 'solicitacao', keywords: ['solicito', 'precisamos', 'preciso', 'necessário', 'favor providenciar', 'incluir', 'processar'], label: 'Solicitação', icon: 'fa-hand' },
        { id: 'confirmacao', keywords: ['aprovei', 'confirmado', 'ok', 'prosseguir', 'de acordo'], label: 'Confirmação', icon: 'fa-circle-check' },
        { id: 'notificacao', keywords: ['notificação', 'divergência', 'identificamos', 'regularizar'], label: 'Notificação Fiscal', icon: 'fa-landmark' },
        { id: 'correcao', keywords: ['correção', 'corrigir', 'ajuste', 'incorret', 'erro'], label: 'Correção', icon: 'fa-pen' }
      ];
      var best = null, maxScore = 0;
      intents.forEach(function (intent) {
        var score = 0;
        intent.keywords.forEach(function (kw) { if (t.indexOf(kw) >= 0) score++; });
        if (score > maxScore) { maxScore = score; best = intent; }
      });
      return best || { id: 'geral', keywords: [], label: 'Geral', icon: 'fa-envelope' };
    },

    /* Department classification */
    classifyDepartment: function (text, subject) {
      var t = ((text || '') + ' ' + (subject || '')).toLowerCase();
      var depts = [
        { id: 'fiscal', keywords: ['nota fiscal', 'nfe', 'xml', 'cfop', 'icms', 'pis', 'cofins', 'sefaz', 'sped', 'itr', 'tribut', 'simples nacional', 'lucro presumido', 'iss', 'enquadramento'], label: 'Fiscal' },
        { id: 'contabil', keywords: ['balanço', 'contábil', 'contabilidade', 'comprovante', 'lançamento', 'conciliação', 'razão', 'balancete', 'faturamento'], label: 'Contábil' },
        { id: 'dp', keywords: ['folha', 'pagamento', 'rescisão', 'férias', 'vale-transporte', 'inss', 'fgts', 'funcionário', 'pró-labore', 'admissão', 'demissão', 'clt'], label: 'DP' },
        { id: 'financeiro', keywords: ['financeiro', 'pagamento', 'boleto', 'transferência', 'faturamento', 'receita', 'despesa', 'fluxo de caixa'], label: 'Financeiro' },
        { id: 'societario', keywords: ['contrato social', 'sócio', 'alteração', 'cnpj', 'junta comercial', 'constituição', 'distrato'], label: 'Societário' }
      ];
      var best = null, maxScore = 0;
      depts.forEach(function (d) {
        var score = 0;
        d.keywords.forEach(function (kw) { if (t.indexOf(kw) >= 0) score++; });
        if (score > maxScore) { maxScore = score; best = d; }
      });
      return best || { id: 'geral', label: 'Geral' };
    },

    /* Priority detection */
    detectPriority: function (text, subject) {
      var t = ((text || '') + ' ' + (subject || '')).toLowerCase();
      var highKeys = ['urgente', 'urgência', 'vencendo', 'multa', 'notificação', 'prazo', 'imediato', 'máxima urgência', 'até sexta'];
      var medKeys = ['dúvida', 'correção', 'solicitação', 'necessário', 'favor'];
      var hScore = 0, mScore = 0;
      highKeys.forEach(function (k) { if (t.indexOf(k) >= 0) hScore++; });
      medKeys.forEach(function (k) { if (t.indexOf(k) >= 0) mScore++; });
      if (hScore >= 2) return 'high';
      if (hScore >= 1 || mScore >= 2) return 'medium';
      return 'low';
    },

    /* Route to company folder */
    routeToCompany: function (emailAddr) {
      if (!emailAddr) return null;
      var domain = emailAddr.split('@')[1];
      if (!domain) return null;
      domain = domain.toLowerCase();
      for (var i = 0; i < COMPANIES.length; i++) {
        for (var j = 0; j < COMPANIES[i].domains.length; j++) {
          if (domain === COMPANIES[i].domains[j]) return COMPANIES[i];
        }
      }
      return null;
    },

    /* Generate suggested responses */
    suggestResponses: function (email) {
      var intent = this.detectIntent(email.body);
      var responses = [];
      switch (intent.id) {
        case 'envio_docs':
          responses.push('Documentos recebidos com sucesso. Já estamos processando. Obrigado!');
          responses.push('Recebemos os documentos. Identificamos ' + (email.attachments || []).length + ' anexo(s). Retornamos em breve.');
          break;
        case 'duvida':
          responses.push('Obrigado pela consulta. Vamos analisar e retornamos em até 24h úteis.');
          responses.push('Entendemos sua dúvida. Encaminhamos ao setor responsável para análise detalhada.');
          break;
        case 'urgencia':
          responses.push('Recebemos sua solicitação urgente. Já estamos priorizando o atendimento.');
          responses.push('Entendemos a urgência. Nossa equipe está trabalhando nisso agora.');
          break;
        case 'solicitacao':
          responses.push('Solicitação registrada. Encaminhamos ao departamento responsável.');
          responses.push('Recebemos sua solicitação. Necessitamos dos seguintes documentos adicionais para prosseguir: [listar]');
          break;
        case 'confirmacao':
          responses.push('Perfeito! Confirmação registrada. Daremos prosseguimento.');
          break;
        case 'notificacao':
          responses.push('Analisamos a notificação. Estamos verificando as pendências e retornamos com plano de ação.');
          break;
        case 'correcao':
          responses.push('Identificamos o ajuste necessário. A correção será processada e enviaremos comprovante.');
          break;
        default:
          responses.push('Recebemos seu e-mail. Retornamos em breve.');
      }
      return responses;
    },

    /* Full analysis */
    analyzeEmail: function (email) {
      var sentiment = this.analyzeSentiment(email.body);
      var intent = this.detectIntent(email.body);
      var dept = this.classifyDepartment(email.body, email.subject);
      var priority = this.detectPriority(email.body, email.subject);
      var company = this.routeToCompany(email.email);
      var suggestions = this.suggestResponses(email);
      var result = {
        sentiment: sentiment,
        intent: intent,
        department: dept,
        priority: priority,
        company: company,
        suggestions: suggestions,
        timestamp: new Date().toISOString()
      };
      this.log('analyze', 'Analisou e-mail: "' + (email.subject || '').substr(0, 40) + '..."', company);
      return result;
    },

    /* Log action */
    log: function (type, message, company) {
      this.actionsLog.unshift({
        id: uid(),
        type: type,
        message: message,
        company: company ? company.name : null,
        time: new Date().toISOString()
      });
      if (this.actionsLog.length > 100) this.actionsLog.length = 100;
    },

    /* Chat responses */
    chat: function (question, state) {
      var q = (question || '').toLowerCase();
      var totalEmails = state.emails ? state.emails.length : 0;
      var unread = state.emails ? state.emails.filter(function (e) { return e.unread; }).length : 0;
      var highP = state.emails ? state.emails.filter(function (e) { return e.priority === 'high'; }).length : 0;

      if (q.indexOf('quantos') >= 0 && q.indexOf('email') >= 0) {
        return 'Você tem ' + totalEmails + ' e-mails no total, ' + unread + ' não lidos e ' + highP + ' de alta prioridade.';
      }
      if (q.indexOf('urgente') >= 0 || q.indexOf('prioridade') >= 0) {
        return 'Há ' + highP + ' e-mails de alta prioridade que precisam de atenção imediata. Recomendo revisar a caixa "Prioritários" primeiro.';
      }
      if (q.indexOf('empresa') >= 0 || q.indexOf('companhia') >= 0 || q.indexOf('cliente') >= 0) {
        var companyCounts = {};
        (state.emails || []).forEach(function (e) {
          var c = DexEngine.routeToCompany(e.email);
          if (c) companyCounts[c.name] = (companyCounts[c.name] || 0) + 1;
        });
        var parts = [];
        Object.keys(companyCounts).forEach(function (k) {
          parts.push(k + ': ' + companyCounts[k]);
        });
        return 'Distribuição por empresa:\n' + parts.join('\n') + '\nTotal: ' + totalEmails + ' e-mails.';
      }
      if (q.indexOf('resumo') >= 0 || q.indexOf('status') >= 0) {
        return '📊 Resumo do dia:\n• ' + totalEmails + ' e-mails totais\n• ' + unread + ' não lidos\n• ' + highP + ' alta prioridade\n• ' + COMPANIES.length + ' empresas mapeadas\n• ' + (state.rules || []).filter(function (r) { return r.enabled; }).length + ' regras ativas';
      }
      if (q.indexOf('ajuda') >= 0 || q.indexOf('help') >= 0) {
        return 'Sou DEX, sua IA de e-mail. Posso:\n• Classificar e-mails por departamento\n• Rotear para pastas de empresas\n• Detectar urgências\n• Sugerir respostas\n• Dar resumos e estatísticas\n\nPergunte qualquer coisa!';
      }
      return 'Analisei sua pergunta. No momento tenho ' + totalEmails + ' e-mails monitorados de ' + COMPANIES.length + ' empresas. Como posso ajudar especificamente?';
    },

    /* Stats */
    getStats: function (emails) {
      var total = emails.length;
      var unread = emails.filter(function (e) { return e.unread; }).length;
      var highP = emails.filter(function (e) { return e.priority === 'high'; }).length;
      var today = new Date().toDateString();
      var todayCount = emails.filter(function (e) { return new Date(e.date).toDateString() === today; }).length;
      return { total: total, unread: unread, highPriority: highP, today: todayCount };
    }
  };

  /* ════════════════════════════════════════════
     STATE
     ════════════════════════════════════════════ */
  var State = {
    user: null,
    emails: [],
    rules: [],
    companyFolders: {},
    notifications: [],
    settings: {
      theme: 'light',
      notifications: true,
      sound: true,
      soundMode: 'voice',
      dexAutoAnalyze: true,
      dexAutoRoute: true,
      dexAutoClassify: true,
      signature: '',
      checkInterval: 30
    },
    ui: {
      activeFolder: 'inbox',
      activeCompany: 'all',
      activeLabel: null,
      activeEmail: null,
      selectedEmails: [],
      sortBy: 'date',
      dexOpen: false,
      searchQuery: '',
      newEmailCount: 0
    }
  };

  function clearSelectedEmails() {
    State.ui.selectedEmails = [];
  }

  function getSelectedEmailsFromCurrentView() {
    var filteredIds = getFilteredEmails().map(function (email) { return email.id; });
    return State.ui.selectedEmails.filter(function (id) { return filteredIds.indexOf(id) >= 0; });
  }

  function syncBatchSelectionUi(emailsInView) {
    var selectAll = $('selectAll');
    var batchDeleteBtn = $('batchDeleteBtn');
    var selectedInView = emailsInView ? emailsInView.filter(function (email) { return State.ui.selectedEmails.indexOf(email.id) >= 0; }).length : 0;

    if (selectAll) {
      selectAll.checked = !!emailsInView.length && selectedInView === emailsInView.length;
      selectAll.indeterminate = selectedInView > 0 && selectedInView < emailsInView.length;
    }

    if (batchDeleteBtn) {
      batchDeleteBtn.disabled = selectedInView === 0;
      batchDeleteBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i> Excluir selecionados' + (selectedInView > 0 ? ' (' + selectedInView + ')' : '');
    }
  }

  function deleteSelectedEmails() {
    var selectedIds = getSelectedEmailsFromCurrentView();
    if (!selectedIds.length) {
      toast('Selecione ao menos um e-mail', 'warning');
      return;
    }

    selectedIds.forEach(function (id) {
      var email = State.emails.find(function (item) { return item.id === id; });
      if (!email) return;
      if (email.folder === 'trash') return;
      email.folder = 'trash';
      if (State.ui.activeEmail === id) State.ui.activeEmail = null;
    });

    clearSelectedEmails();
    rebuildCompanyFolders();
    save();
    renderEmailList();
    renderReader();
    renderSidebar();
    toast(selectedIds.length + ' e-mail(s) movido(s) para lixeira', 'info');
  }

  function isDocumentFolder(folderId) {
    return folderId === 'docs_received' || folderId === 'docs_sent';
  }

  function getAttachmentIcon(name) {
    if ((name || '').match(/\.pdf$/i)) return 'fa-file-pdf';
    if ((name || '').match(/\.xlsx?$/i)) return 'fa-file-excel';
    if ((name || '').match(/\.zip$/i)) return 'fa-file-zipper';
    if ((name || '').match(/\.docx?$/i)) return 'fa-file-word';
    if ((name || '').match(/\.jpe?g$|\.png$|\.gif$|\.webp$/i)) return 'fa-file-image';
    return 'fa-file-lines';
  }

  function getDocumentEntries(folderId) {
    var entries = [];
    var receivedOnly = folderId === 'docs_received';
    var sentOnly = folderId === 'docs_sent';

    State.emails.forEach(function (email) {
      if (!email.attachments || !email.attachments.length) return;
      if (sentOnly && email.folder !== 'sent') return;
      if (receivedOnly && (email.folder === 'sent' || email.folder === 'trash' || email.folder === 'drafts')) return;

      if (State.ui.activeCompany && State.ui.activeCompany !== 'all' && email.companyId !== State.ui.activeCompany) return;
      if (State.ui.activeLabel && (!email.labels || email.labels.indexOf(State.ui.activeLabel) < 0)) return;

      var company = getCompanyById(email.companyId);
      email.attachments.forEach(function (attachment, index) {
        entries.push({
          id: email.id + '__' + index,
          emailId: email.id,
          name: attachment.name,
          size: attachment.size || '-',
          date: email.date,
          subject: email.subject || '(sem assunto)',
          from: email.from || 'Desconhecido',
          to: email.to || 'contabil@escritorio.com.br',
          company: company,
          priority: email.priority || 'low',
          direction: sentOnly ? 'sent' : 'received',
          icon: getAttachmentIcon(attachment.name)
        });
      });
    });

    if (State.ui.searchQuery) {
      var q = State.ui.searchQuery.toLowerCase();
      entries = entries.filter(function (entry) {
        return (entry.name || '').toLowerCase().indexOf(q) >= 0 ||
               (entry.subject || '').toLowerCase().indexOf(q) >= 0 ||
               (entry.from || '').toLowerCase().indexOf(q) >= 0 ||
               (entry.to || '').toLowerCase().indexOf(q) >= 0 ||
               (entry.company && entry.company.name.toLowerCase().indexOf(q) >= 0);
      });
    }

    if (State.ui.sortBy === 'from') {
      entries.sort(function (a, b) { return (a.from || '').localeCompare(b.from || ''); });
    } else if (State.ui.sortBy === 'priority') {
      var weights = { high: 3, medium: 2, low: 1 };
      entries.sort(function (a, b) { return (weights[b.priority] || 0) - (weights[a.priority] || 0); });
    } else {
      entries.sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
    }

    return entries;
  }

  function getCompanyById(companyId) {
    return COMPANIES.find(function (company) { return company.id === companyId; }) || null;
  }

  function normalizeFolderEntry(folder) {
    return {
      id: folder && folder.id ? folder.id : uid(),
      name: folder && folder.name ? folder.name : 'Nova pasta',
      count: folder && typeof folder.count === 'number' ? folder.count : 0,
      unread: folder && typeof folder.unread === 'number' ? folder.unread : 0
    };
  }

  function normalizeCompanyFolderState(entry) {
    return {
      count: entry && typeof entry.count === 'number' ? entry.count : 0,
      unread: entry && typeof entry.unread === 'number' ? entry.unread : 0,
      folders: entry && Array.isArray(entry.folders) ? entry.folders.map(normalizeFolderEntry) : []
    };
  }

  function ensureCompanyFolderState(companyId) {
    State.companyFolders[companyId] = normalizeCompanyFolderState(State.companyFolders[companyId]);
    return State.companyFolders[companyId];
  }

  function findCompanyCustomFolder(companyId, folderId) {
    var companyState = ensureCompanyFolderState(companyId);
    return companyState.folders.find(function (folder) { return folder.id === folderId; }) || null;
  }

  function getCustomFolderKey(companyId, folderId) {
    return 'companyfolder_' + companyId + '__' + folderId;
  }

  function parseCustomFolderKey(folderKey) {
    if (!folderKey || folderKey.indexOf('companyfolder_') !== 0) return null;
    var raw = folderKey.replace('companyfolder_', '');
    var parts = raw.split('__');
    if (parts.length < 2) return null;
    return { companyId: parts[0], folderId: parts.slice(1).join('__') };
  }

  function routeEmailToCustomFolder(email, companyId, folderId) {
    var company = getCompanyById(companyId);
    var folder = findCompanyCustomFolder(companyId, folderId);
    if (!company || !folder) return false;
    email.companyId = companyId;
    email.companyFolderId = folder.id;
    DexEngine.log('route', 'Direcionou e-mail para a pasta "' + folder.name + '" em ' + company.name, company);
    return true;
  }

  /* ─── Persistence ─── */
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        user: State.user,
        emails: State.emails,
        rules: State.rules,
        companyFolders: State.companyFolders,
        notifications: State.notifications,
        settings: State.settings,
        dexLog: DexEngine.actionsLog
      }));
    } catch (e) { /* quota */ }
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      var d = JSON.parse(raw);
      if (d.user) State.user = d.user;
      if (d.emails && d.emails.length) State.emails = d.emails;
      if (d.rules && d.rules.length) State.rules = d.rules;
      if (d.companyFolders) State.companyFolders = d.companyFolders;
      if (d.notifications) State.notifications = d.notifications;
      if (d.settings) {
        Object.keys(d.settings).forEach(function (k) { State.settings[k] = d.settings[k]; });
      }
      if (d.dexLog) DexEngine.actionsLog = d.dexLog;
      return true;
    } catch (e) { return false; }
  }

  /* ════════════════════════════════════════════
     NOTIFICATION SYSTEM
     ════════════════════════════════════════════ */
  var NotifSystem = {
    permission: 'default',
    lastSpeechAt: 0,

    bellProfiles: {
      'bell-soft': [
        { frequency: 880, duration: 0.12, delay: 0, type: 'sine', gain: 0.05 },
        { frequency: 1174, duration: 0.18, delay: 0.08, type: 'sine', gain: 0.035 }
      ],
      'bell-classic': [
        { frequency: 1046, duration: 0.08, delay: 0, type: 'triangle', gain: 0.07 },
        { frequency: 1318, duration: 0.12, delay: 0.06, type: 'triangle', gain: 0.055 },
        { frequency: 1567, duration: 0.16, delay: 0.13, type: 'sine', gain: 0.04 }
      ],
      'bell-double': [
        { frequency: 988, duration: 0.07, delay: 0, type: 'triangle', gain: 0.07 },
        { frequency: 1318, duration: 0.09, delay: 0.06, type: 'triangle', gain: 0.055 },
        { frequency: 988, duration: 0.07, delay: 0.22, type: 'triangle', gain: 0.07 },
        { frequency: 1318, duration: 0.09, delay: 0.28, type: 'triangle', gain: 0.055 }
      ]
    },

    playBellPattern: function (pattern) {
      try {
        var ctx = new (window.AudioContext || window.webkitAudioContext)();
        pattern.forEach(function (step) {
          var osc = ctx.createOscillator();
          var gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = step.frequency;
          osc.type = step.type || 'sine';
          gain.gain.setValueAtTime(step.gain || 0.05, ctx.currentTime + (step.delay || 0));
          gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (step.delay || 0) + step.duration);
          osc.start(ctx.currentTime + (step.delay || 0));
          osc.stop(ctx.currentTime + (step.delay || 0) + step.duration);
        });
      } catch (e) { /* no audio */ }
    },

    speakNewEmail: function () {
      if (!('speechSynthesis' in window)) return;
      var now = Date.now();
      if (now - this.lastSpeechAt < 1200) return;
      this.lastSpeechAt = now;

      try {
        window.speechSynthesis.cancel();
        var utterance = new SpeechSynthesisUtterance('email');
        utterance.lang = 'pt-BR';
        utterance.rate = 0.78;
        utterance.pitch = 0.72;
        utterance.volume = 1;

        var voices = window.speechSynthesis.getVoices ? window.speechSynthesis.getVoices() : [];
        var preferredVoice = voices.find(function (voice) {
          return /pt[-_]br/i.test(voice.lang || '') || /portuguese|brazil/i.test(voice.name || '');
        });
        if (preferredVoice) utterance.voice = preferredVoice;

        window.speechSynthesis.speak(utterance);
      } catch (e) { /* speech unavailable */ }
    },

    init: function () {
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().then(function (p) { NotifSystem.permission = p; });
      } else if ('Notification' in window) {
        this.permission = Notification.permission;
      }

      if ('speechSynthesis' in window && window.speechSynthesis.getVoices) {
        try { window.speechSynthesis.getVoices(); } catch (e) { /* no voices yet */ }
      }
    },

    push: function (title, body, icon) {
      if (this.permission === 'granted') {
        try {
          new Notification(title, {
            body: body,
            icon: icon || 'icosis-c.png',
            badge: icon || 'icosis-c.png',
            tag: 'sisc-email-notification',
            renotify: true,
            requireInteraction: true
          });
        } catch (e) { /* mobile */ }
      }
    },

    playSound: function (type) {
      if (!State.settings.sound) return;
      if (type === 'new') {
        if (State.settings.soundMode === 'voice') this.speakNewEmail();
        else this.playBellPattern(this.bellProfiles[State.settings.soundMode] || this.bellProfiles['bell-soft']);
        return;
      }
      try {
        var ctx = new (window.AudioContext || window.webkitAudioContext)();
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        gain.gain.value = 0.08;
        if (type === 'new') { osc.frequency.value = 880; osc.type = 'sine'; }
        else if (type === 'sent') { osc.frequency.value = 660; osc.type = 'triangle'; }
        else { osc.frequency.value = 523; osc.type = 'sine'; }
        osc.start(); osc.stop(ctx.currentTime + 0.15);
      } catch (e) { /* no audio */ }
    },

    addNotif: function (type, message, emailId) {
      var n = { id: uid(), type: type, message: message, emailId: emailId || null, time: new Date().toISOString(), read: false };
      State.notifications.unshift(n);
      if (State.notifications.length > 50) State.notifications.length = 50;
      this.updateBadge();
      save();
      return n;
    },

    updateBadge: function () {
      var badge = $('notifBadge');
      if (!badge) return;
      var count = State.notifications.filter(function (n) { return !n.read; }).length;
      badge.textContent = count > 0 ? (count > 99 ? '99+' : count) : '';
    }
  };

  /* ════════════════════════════════════════════
     TOAST
     ════════════════════════════════════════════ */
  function toast(msg, type) {
    type = type || 'info';
    var wrap = $('toastWrap');
    if (!wrap) return;
    var icons = { success: 'fa-circle-check', error: 'fa-circle-xmark', info: 'fa-circle-info', warning: 'fa-triangle-exclamation', ai: 'fa-brain' };
    var el = document.createElement('div');
    el.className = 'email-toast email-toast--' + type;
    el.innerHTML = '<i class="fa-solid ' + (icons[type] || icons.info) + '"></i><span>' + esc(msg) + '</span>';
    wrap.appendChild(el);
    setTimeout(function () { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(function () { el.remove(); }, 300); }, 3500);
  }

  /* ════════════════════════════════════════════
     AUTOMATION ENGINE
     ════════════════════════════════════════════ */
  function getRuleMatchValue(rule, email) {
    if (rule.condition.field === 'email') return (email.email || '').toLowerCase();
    if (rule.condition.field === 'subject') return (email.subject || '').toLowerCase();
    if (rule.condition.field === 'from') return (email.from || '').toLowerCase();
    if (rule.condition.field === 'priority') return (email.priority || '').toLowerCase();
    if (rule.condition.field === 'content') {
      return [email.subject || '', email.from || '', email.email || '', stripHtml(email.body || '')].join(' ').toLowerCase();
    }
    return '';
  }

  function ruleMatchesEmail(rule, email) {
    if (!rule || !rule.enabled) return false;
    if (rule.companyId && email.companyId !== rule.companyId) return false;

    var match = false;
    var val = getRuleMatchValue(rule, email);
    var cv = (rule.condition.value || '').toLowerCase();
    if (!cv && rule.condition.field !== 'priority') return false;

    if (rule.condition.op === 'contains') match = val.indexOf(cv) >= 0;
    else if (rule.condition.op === 'equals') match = val === cv;
    else if (rule.condition.op === 'starts') match = val.indexOf(cv) === 0;
    return match;
  }

  function applyRuleToEmail(rule, email, options) {
    options = options || {};
    if (!ruleMatchesEmail(rule, email)) return false;

    if (rule.action.type === 'label') {
      if (!email.labels) email.labels = [];
      if (email.labels.indexOf(rule.action.value) < 0) {
        email.labels.push(rule.action.value);
        return true;
      }
      return false;
    }
    if (rule.action.type === 'star') {
      if (!email.starred) {
        email.starred = true;
        return true;
      }
      return false;
    }
    if (rule.action.type === 'priority') {
      if (email.priority !== rule.action.value) {
        email.priority = rule.action.value;
        return true;
      }
      return false;
    }
    if (rule.action.type === 'notify') {
      if (!options.silent) NotifSystem.playSound('new');
      return true;
    }
    if (rule.action.type === 'route_folder') {
      return routeEmailToCustomFolder(email, rule.action.companyId || rule.companyId || email.companyId, rule.action.value);
    }
    return false;
  }

  function runAutomation(email, options) {
    var applied = [];
    State.rules.forEach(function (rule) {
      if (applyRuleToEmail(rule, email, options)) applied.push(rule.name);
    });
    return applied;
  }

  /* Route email to company folder */
  function routeEmailToCompany(email) {
    var company = DexEngine.routeToCompany(email.email);
    if (company) {
      email.companyId = company.id;
      if (!State.companyFolders[company.id]) {
        State.companyFolders[company.id] = normalizeCompanyFolderState();
        DexEngine.log('route', 'Criou pasta automática: ' + company.name, company);
      }
      ensureCompanyFolderState(company.id);
      State.companyFolders[company.id].count++;
      if (email.unread) State.companyFolders[company.id].unread++;
      DexEngine.log('route', 'Roteou e-mail para ' + company.name, company);
      return company;
    }
    return null;
  }

  /* Process new email through DEX */
  function processNewEmail(email) {
    /* Route to company */
    var company = routeEmailToCompany(email);

    /* Run automation rules */
    var rulesApplied = runAutomation(email);
    if (rulesApplied.length) {
      DexEngine.log('classify', 'Aplicou regras: ' + rulesApplied.join(', '), company);
    }

    /* DEX auto-classify */
    if (State.settings.dexAutoClassify) {
      var dept = DexEngine.classifyDepartment(email.body, email.subject);
      var labelMap = { fiscal: 'l1', contabil: 'l2', dp: 'l3', financeiro: 'l4', societario: 'l5' };
      var lbl = labelMap[dept.id];
      if (lbl && (!email.labels || email.labels.indexOf(lbl) < 0)) {
        if (!email.labels) email.labels = [];
        email.labels.push(lbl);
        DexEngine.log('classify', 'Auto-classificou como ' + dept.label, company);
      }
    }

    /* DEX auto-priority */
    if (State.settings.dexAutoAnalyze) {
      var detPriority = DexEngine.detectPriority(email.body, email.subject);
      if (detPriority === 'high' && email.priority !== 'high') {
        email.priority = 'high';
        DexEngine.log('priority', 'Detectou prioridade ALTA', company);
      }
    }

    /* Notification */
    if (email.unread && State.settings.notifications) {
      var notifMsg = 'Novo e-mail de ' + (email.from || 'desconhecido');
      if (company) notifMsg += ' (' + company.name + ')';
      NotifSystem.addNotif('new', notifMsg, email.id);
      if (State.settings.sound) NotifSystem.playSound('new');
      NotifSystem.push('SIS-C E-mail', notifMsg);
    }
  }

  /* Rebuild company folder counts */
  function rebuildCompanyFolders() {
    var previousFolders = {};
    Object.keys(State.companyFolders || {}).forEach(function (companyId) {
      previousFolders[companyId] = ensureCompanyFolderState(companyId).folders.map(function (folder) {
        return { id: folder.id, name: folder.name, count: 0, unread: 0 };
      });
    });

    State.companyFolders = {};
    Object.keys(previousFolders).forEach(function (companyId) {
      State.companyFolders[companyId] = { count: 0, unread: 0, folders: previousFolders[companyId] };
    });

    State.emails.forEach(function (email) {
      var company = DexEngine.routeToCompany(email.email);
      if (company) {
        email.companyId = company.id;
        if (!State.companyFolders[company.id]) State.companyFolders[company.id] = normalizeCompanyFolderState();
        var companyState = ensureCompanyFolderState(company.id);
        companyState.count++;
        if (email.unread) companyState.unread++;

        if (email.companyFolderId) {
          var folder = findCompanyCustomFolder(company.id, email.companyFolderId);
          if (folder) {
            folder.count++;
            if (email.unread) folder.unread++;
          } else {
            delete email.companyFolderId;
          }
        }
      }
    });
  }

  function createFolderForCompany(companyId) {
    var company = getCompanyById(companyId);
    if (!company) return;
    var folderName = prompt('Nome da nova pasta para ' + company.name + ':', 'Processos');
    if (!folderName) return;
    folderName = folderName.trim();
    if (!folderName) {
      toast('Informe um nome de pasta válido', 'warning');
      return;
    }

    var companyState = ensureCompanyFolderState(companyId);
    var exists = companyState.folders.some(function (folder) { return folder.name.toLowerCase() === folderName.toLowerCase(); });
    if (exists) {
      toast('Essa pasta já existe para a empresa', 'warning');
      return;
    }

    companyState.folders.push({ id: uid(), name: folderName, count: 0, unread: 0 });
    save();
    renderSidebar();
    renderDexPanel();
    toast('Pasta criada em ' + company.name, 'success');
  }

  function createKeywordRuleForCompany(companyId) {
    var company = getCompanyById(companyId);
    var companyState = ensureCompanyFolderState(companyId);
    if (!company || !companyState.folders.length) {
      toast('Crie ao menos uma pasta antes de cadastrar a regra', 'warning');
      return;
    }

    var keyword = prompt('Qual palavra ou termo deve acionar a regra em ' + company.name + '?', 'boleto');
    if (!keyword) return;
    keyword = keyword.trim();
    if (!keyword) {
      toast('Informe uma palavra-chave válida', 'warning');
      return;
    }

    var folderList = companyState.folders.map(function (folder) { return '- ' + folder.name; }).join('\n');
    var folderName = prompt('Para qual pasta o e-mail deve ir?\n\nPastas disponíveis:\n' + folderList, companyState.folders[0].name);
    if (!folderName) return;
    folderName = folderName.trim().toLowerCase();

    var targetFolder = companyState.folders.find(function (folder) { return folder.name.toLowerCase() === folderName; });
    if (!targetFolder) {
      toast('Pasta não encontrada para essa empresa', 'error');
      return;
    }

    var rule = {
      id: uid(),
      name: company.name.split(' ')[0] + ': "' + keyword + '" → ' + targetFolder.name,
      enabled: true,
      companyId: companyId,
      condition: { field: 'content', op: 'contains', value: keyword },
      action: { type: 'route_folder', value: targetFolder.id, companyId: companyId }
    };

    State.rules.unshift(rule);

    var movedCount = 0;
    State.emails.forEach(function (email) {
      if (applyRuleToEmail(rule, email, { silent: true })) movedCount++;
    });

    rebuildCompanyFolders();
    save();
    renderAll();
    toast('Regra criada. ' + movedCount + ' e-mail(s) vinculados à pasta.', 'success');
  }

  /* ════════════════════════════════════════════
     RENDERING
     ════════════════════════════════════════════ */

  /* ─── Sidebar ─── */
  function renderSidebar() {
    var nav = $('sidebarNav');
    if (!nav) return;

    var docsReceivedCount = getDocumentEntries('docs_received').length;
    var docsSentCount = getDocumentEntries('docs_sent').length;

    var folders = [
      { id: 'inbox', icon: 'fa-inbox', label: 'Caixa de Entrada', count: State.emails.filter(function (e) { return e.unread && !e.folder; }).length },
      { id: 'starred', icon: 'fa-star', label: 'Favoritos', count: State.emails.filter(function (e) { return e.starred; }).length },
      { id: 'important', icon: 'fa-bookmark', label: 'Prioritários', count: State.emails.filter(function (e) { return e.priority === 'high'; }).length },
      { id: 'sent', icon: 'fa-paper-plane', label: 'Enviados', count: 0 },
      { id: 'snoozed', icon: 'fa-clock', label: 'Adiados', count: State.emails.filter(function (e) { return e.snoozed; }).length },
      { id: 'drafts', icon: 'fa-file', label: 'Rascunhos', count: 0 },
      { id: 'trash', icon: 'fa-trash-can', label: 'Lixeira', count: 0 }
    ];

    var html = '<div class="email-nav-section">Pastas</div>';
    folders.forEach(function (f) {
      html += '<div class="email-nav-item' + (State.ui.activeFolder === f.id ? ' is-active' : '') + '" data-folder="' + f.id + '">';
      html += '<i class="fa-solid ' + f.icon + '"></i><span>' + f.label + '</span>';
      if (f.count > 0) html += '<span class="email-nav-item__badge' + (f.id === 'important' ? ' is-danger' : '') + '">' + f.count + '</span>';
      html += '</div>';
    });

    html += '<div class="email-nav-divider"></div>';
    html += '<div class="email-nav-section"><i class="fa-solid fa-paperclip" style="margin-right:3px"></i> Documentos</div>';
    html += '<div class="email-nav-item' + (State.ui.activeFolder === 'docs_received' ? ' is-active' : '') + '" data-folder="docs_received">';
    html += '<i class="fa-solid fa-folder-open"></i><span>Anexos recebidos</span>';
    if (docsReceivedCount > 0) html += '<span class="email-nav-item__badge">' + docsReceivedCount + '</span>';
    html += '</div>';
    html += '<div class="email-nav-item' + (State.ui.activeFolder === 'docs_sent' ? ' is-active' : '') + '" data-folder="docs_sent">';
    html += '<i class="fa-solid fa-file-circle-arrow-up"></i><span>Anexos enviados</span>';
    if (docsSentCount > 0) html += '<span class="email-nav-item__badge">' + docsSentCount + '</span>';
    html += '</div>';

    /* Company folders */
    var companiesWithEmails = COMPANIES.filter(function (c) {
      var companyState = State.companyFolders[c.id];
      return companyState && (companyState.count > 0 || (companyState.folders && companyState.folders.length > 0));
    });
    if (companiesWithEmails.length > 0) {
      html += '<div class="email-nav-divider"></div>';
      html += '<div class="email-nav-section"><i class="fa-solid fa-building" style="margin-right:3px"></i> Empresas (auto)</div>';
      companiesWithEmails.forEach(function (c) {
        var fd = ensureCompanyFolderState(c.id);
        html += '<div class="email-nav-item is-company' + (State.ui.activeFolder === 'company_' + c.id ? ' is-active' : '') + '" data-folder="company_' + c.id + '">';
        html += '<div class="email-company-node"><i class="fa-solid fa-folder" style="color:' + c.color + '"></i><span>' + c.name.split(' ')[0] + '</span></div>';
        html += '<div class="email-company-tools">';
        html += '<button class="email-nav-mini-btn" type="button" title="Criar pasta" data-company-action="add-folder" data-company="' + c.id + '"><i class="fa-solid fa-folder-plus"></i></button>';
        html += '<button class="email-nav-mini-btn" type="button" title="Criar regra por palavra-chave" data-company-action="add-rule" data-company="' + c.id + '"><i class="fa-solid fa-wand-magic-sparkles"></i></button>';
        html += '</div>';
        if (fd.unread > 0) html += '<span class="email-nav-item__badge">' + fd.unread + '</span>';
        html += '</div>';

        fd.folders.forEach(function (folder) {
          html += '<div class="email-nav-item is-company-folder' + (State.ui.activeFolder === getCustomFolderKey(c.id, folder.id) ? ' is-active' : '') + '" data-folder="' + getCustomFolderKey(c.id, folder.id) + '">';
          html += '<i class="fa-solid fa-folder-tree"></i><span>' + esc(folder.name) + '</span>';
          if (folder.unread > 0) html += '<span class="email-nav-item__badge">' + folder.unread + '</span>';
          else if (folder.count > 0) html += '<span class="email-nav-item__meta">' + folder.count + '</span>';
          html += '</div>';
        });
      });
    }

    nav.innerHTML = html;

    /* Bind clicks */
    $$('.email-nav-item', nav).forEach(function (el) {
      el.addEventListener('click', function () {
        clearSelectedEmails();
        State.ui.activeFolder = el.dataset.folder;
        State.ui.activeLabel = null;
        State.ui.activeEmail = null;
        renderSidebar(); renderEmailList(); renderReader();
      });
    });

    $$('[data-company-action]', nav).forEach(function (btn) {
      btn.addEventListener('click', function (ev) {
        ev.stopPropagation();
        if (btn.dataset.companyAction === 'add-folder') createFolderForCompany(btn.dataset.company);
        else if (btn.dataset.companyAction === 'add-rule') createKeywordRuleForCompany(btn.dataset.company);
      });
    });

    /* Labels */
    var labelsEl = $('sidebarLabels');
    if (labelsEl) {
      var lhtml = '';
      LABELS.forEach(function (l) {
        var cnt = State.emails.filter(function (e) { return e.labels && e.labels.indexOf(l.id) >= 0; }).length;
        lhtml += '<div class="email-label-item' + (State.ui.activeLabel === l.id ? ' is-active' : '') + '" data-label="' + l.id + '">';
        lhtml += '<span class="email-label-dot" style="background:' + l.color + '"></span>';
        lhtml += '<span>' + l.name + '</span>';
        if (cnt > 0) lhtml += '<span class="email-label-item__count">' + cnt + '</span>';
        lhtml += '</div>';
      });
      labelsEl.innerHTML = lhtml;
      $$('.email-label-item', labelsEl).forEach(function (el) {
        el.addEventListener('click', function () {
          clearSelectedEmails();
          State.ui.activeLabel = State.ui.activeLabel === el.dataset.label ? null : el.dataset.label;
          State.ui.activeFolder = 'inbox';
          State.ui.activeEmail = null;
          renderSidebar(); renderEmailList(); renderReader();
        });
      });
    }

    /* Automation rules */
    var autoEl = $('sidebarAuto');
    if (autoEl) {
      var ahtml = '<h4><i class="fa-solid fa-bolt"></i> Automação <span class="email-sidebar__auto-badge">' + State.rules.filter(function (r) { return r.enabled; }).length + '</span></h4>';
      State.rules.slice(0, 4).forEach(function (r) {
        ahtml += '<div class="email-auto-rule"><i class="fa-solid fa-robot"></i><span>' + esc(r.name) + '</span>';
        if (r.companyId) ahtml += '<span class="email-auto-rule__scope">' + esc((getCompanyById(r.companyId) || {}).name || 'Empresa') + '</span>';
        ahtml += '<span class="email-auto-rule__dot" style="background:' + (r.enabled ? 'var(--email-success)' : 'var(--email-text-faint)') + '"></span></div>';
      });
      autoEl.innerHTML = ahtml;
    }

    /* Company select */
    var compSel = $('companySelect');
    if (compSel) {
      compSel.value = State.ui.activeCompany || 'all';
    }
  }

  /* ─── Email List ─── */
  function getFilteredEmails() {
    var emails = State.emails.slice();
    var folder = State.ui.activeFolder;
    var customFolder = parseCustomFolderKey(folder);

    /* Company filter */
    if (customFolder) {
      emails = emails.filter(function (e) {
        return e.companyId === customFolder.companyId && e.companyFolderId === customFolder.folderId;
      });
    } else if (folder && folder.indexOf('company_') === 0) {
      var cid = folder.replace('company_', '');
      emails = emails.filter(function (e) { return e.companyId === cid; });
    } else if (folder === 'starred') {
      emails = emails.filter(function (e) { return e.starred; });
    } else if (folder === 'important') {
      emails = emails.filter(function (e) { return e.priority === 'high'; });
    } else if (folder === 'snoozed') {
      emails = emails.filter(function (e) { return e.snoozed; });
    } else if (folder === 'sent') {
      emails = emails.filter(function (e) { return e.folder === 'sent'; });
    } else if (folder === 'trash') {
      emails = emails.filter(function (e) { return e.folder === 'trash'; });
    } else if (folder === 'drafts') {
      emails = emails.filter(function (e) { return e.folder === 'drafts'; });
    }

    /* Company dropdown */
    if (State.ui.activeCompany && State.ui.activeCompany !== 'all' && folder && folder.indexOf('company_') !== 0) {
      emails = emails.filter(function (e) { return e.companyId === State.ui.activeCompany; });
    }

    /* Label filter */
    if (State.ui.activeLabel) {
      emails = emails.filter(function (e) { return e.labels && e.labels.indexOf(State.ui.activeLabel) >= 0; });
    }

    /* Search */
    if (State.ui.searchQuery) {
      var q = State.ui.searchQuery.toLowerCase();
      emails = emails.filter(function (e) {
        return (e.subject || '').toLowerCase().indexOf(q) >= 0 ||
               (e.from || '').toLowerCase().indexOf(q) >= 0 ||
               (e.email || '').toLowerCase().indexOf(q) >= 0 ||
               (e.body || '').toLowerCase().indexOf(q) >= 0;
      });
    }

    /* Sort */
    if (State.ui.sortBy === 'date') {
      emails.sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
    } else if (State.ui.sortBy === 'from') {
      emails.sort(function (a, b) { return (a.from || '').localeCompare(b.from || ''); });
    } else if (State.ui.sortBy === 'priority') {
      var pw = { high: 3, medium: 2, low: 1 };
      emails.sort(function (a, b) { return (pw[b.priority] || 0) - (pw[a.priority] || 0); });
    }

    return emails;
  }

  function renderEmailList() {
    var body = $('emailListBody');
    var count = $('emailListCount');
    var newBar = $('newEmailBar');
    if (!body) return;

    var emails = getFilteredEmails();
    State.ui.selectedEmails = State.ui.selectedEmails.filter(function (id) {
      return State.emails.some(function (email) { return email.id === id; });
    });
    if (isDocumentFolder(State.ui.activeFolder)) {
      var docs = getDocumentEntries(State.ui.activeFolder);
      if (count) count.textContent = docs.length + ' documentos';
      syncBatchSelectionUi([]);

      if (docs.length === 0) {
        body.innerHTML = '<div class="email-list__empty"><i class="fa-solid fa-paperclip"></i><p>Nenhum documento encontrado</p></div>';
        return;
      }

      var docsHtml = '<div class="email-doc-list">';
      docs.forEach(function (doc) {
        docsHtml += '<div class="email-doc-row" data-email-id="' + doc.emailId + '">';
        docsHtml += '<div class="email-doc-row__icon"><i class="fa-solid ' + doc.icon + '"></i></div>';
        docsHtml += '<div class="email-doc-row__content">';
        docsHtml += '<div class="email-doc-row__top"><span class="email-doc-row__name">' + esc(doc.name) + '</span>';
        docsHtml += '<span class="email-doc-row__date">' + fmtShortDate(doc.date) + '</span></div>';
        docsHtml += '<div class="email-doc-row__meta">';
        docsHtml += '<span>' + esc(doc.subject) + '</span>';
        docsHtml += '<span>' + esc(doc.direction === 'sent' ? doc.to : doc.from) + '</span>';
        if (doc.company) docsHtml += '<span class="email-doc-row__company" style="background:' + doc.company.color + '12;color:' + doc.company.color + '">' + esc(doc.company.name.split(' ')[0]) + '</span>';
        docsHtml += '</div>';
        docsHtml += '</div>';
        docsHtml += '<div class="email-doc-row__size">' + esc(doc.size) + '</div>';
        docsHtml += '</div>';
      });
      docsHtml += '</div>';
      body.innerHTML = docsHtml;

      $$('.email-doc-row', body).forEach(function (row) {
        row.addEventListener('click', function () {
          State.ui.activeEmail = row.dataset.emailId;
          renderEmailList();
          renderReader();
        });
      });
      return;
    }

    if (count) count.textContent = emails.length + ' e-mails';

    syncBatchSelectionUi(emails);

    if (emails.length === 0) {
      body.innerHTML = '<div class="email-list__empty"><i class="fa-solid fa-inbox"></i><p>Nenhum e-mail encontrado</p></div>';
      return;
    }

    var html = '';
    emails.forEach(function (e) {
      var company = DexEngine.routeToCompany(e.email);
      var analysis = State.settings.dexAutoAnalyze ? DexEngine.analyzeEmail(e) : null;
      html += '<div class="email-row' + (e.unread ? ' is-unread' : '') + (State.ui.activeEmail === e.id ? ' is-active' : '') + '" data-id="' + e.id + '">';
      html += '<input type="checkbox" class="email-row__check" data-id="' + e.id + '"' + (State.ui.selectedEmails.indexOf(e.id) >= 0 ? ' checked' : '') + '>';
      html += '<button class="email-row__star' + (e.starred ? ' is-starred' : '') + '" data-id="' + e.id + '"><i class="fa-' + (e.starred ? 'solid' : 'regular') + ' fa-star"></i></button>';
      html += '<div class="email-row__content">';
      html += '<div class="email-row__top">';
      html += '<span class="email-row__from">' + esc(e.from || 'Desconhecido') + '</span>';
      if (company) html += '<span class="email-row__company-tag" style="background:' + company.color + '12;color:' + company.color + '">' + company.name.split(' ')[0] + '</span>';
      html += '<span class="email-row__date">' + fmtShortDate(e.date) + '</span>';
      html += '</div>';
      html += '<div class="email-row__subject">' + esc(e.subject || '(sem assunto)') + '</div>';
      html += '<div class="email-row__preview">' + esc((e.body || '').replace(/<[^>]+>/g, '').substr(0, 80)) + '</div>';
      html += '<div class="email-row__meta">';
      if (e.priority === 'high') html += '<span class="email-row__priority is-high"><i class="fa-solid fa-arrow-up"></i> Alta</span>';
      else if (e.priority === 'medium') html += '<span class="email-row__priority is-medium"><i class="fa-solid fa-minus"></i> Média</span>';
      if (e.labels) {
        e.labels.forEach(function (lid) {
          var lb = LABELS.find(function (l) { return l.id === lid; });
          if (lb) html += '<span class="email-row__label-tag" style="background:' + lb.color + '">' + lb.name + '</span>';
        });
      }
      if (e.attachments && e.attachments.length > 0) html += '<span class="email-row__attach"><i class="fa-solid fa-paperclip"></i> ' + e.attachments.length + '</span>';
      if (analysis && analysis.intent) html += '<span class="email-row__dex-tag">' + analysis.intent.label + '</span>';
      if (e.snoozed) html += '<span class="email-row__snooze"><i class="fa-solid fa-clock"></i> ' + fmtShortDate(e.snoozedUntil) + '</span>';
      html += '</div>';
      html += '</div></div>';
    });

    body.innerHTML = html;

    /* Bind clicks */
    $$('.email-row', body).forEach(function (el) {
      el.addEventListener('click', function (ev) {
        if (ev.target.closest('.email-row__check') || ev.target.closest('.email-row__star')) return;
        State.ui.activeEmail = el.dataset.id;
        renderEmailList(); renderReader();
        /* Mobile: show reader */
        var reader = document.querySelector('.email-reader');
        if (reader && window.innerWidth <= 900) reader.classList.add('is-mobile-open');
      });
      el.addEventListener('contextmenu', function (ev) {
        ev.preventDefault();
        showContextMenu(ev.clientX, ev.clientY, el.dataset.id);
      });
    });

    /* Star toggle */
    $$('.email-row__star', body).forEach(function (btn) {
      btn.addEventListener('click', function (ev) {
        ev.stopPropagation();
        var email = State.emails.find(function (e) { return e.id === btn.dataset.id; });
        if (email) { email.starred = !email.starred; save(); renderEmailList(); renderSidebar(); }
      });
    });

    $$('.email-row__check', body).forEach(function (checkbox) {
      checkbox.addEventListener('click', function (ev) {
        ev.stopPropagation();
      });
      checkbox.addEventListener('change', function () {
        if (checkbox.checked) {
          if (State.ui.selectedEmails.indexOf(checkbox.dataset.id) < 0) State.ui.selectedEmails.push(checkbox.dataset.id);
        } else {
          State.ui.selectedEmails = State.ui.selectedEmails.filter(function (id) { return id !== checkbox.dataset.id; });
        }
        syncBatchSelectionUi(emails);
      });
    });

    /* New bar */
    if (newBar) {
      if (State.ui.newEmailCount > 0) {
        newBar.classList.add('is-visible');
        $('newEmailCount') && ($('newEmailCount').textContent = State.ui.newEmailCount);
      } else {
        newBar.classList.remove('is-visible');
      }
    }
  }

  /* ─── Reader ─── */
  function renderReader() {
    var reader = $('readerContent');
    if (!reader) return;

    if (!State.ui.activeEmail) {
      if (isDocumentFolder(State.ui.activeFolder)) {
        reader.innerHTML = '<div class="email-reader__empty"><div class="email-reader__empty-orb"></div><h3>Central de Documentos</h3><p>Selecione um anexo recebido ou enviado para abrir o e-mail de origem e consultar o contexto.</p></div>';
      } else {
        reader.innerHTML = '<div class="email-reader__empty"><div class="email-reader__empty-orb"></div><h3>SIS-C E-mail</h3><p>Selecione um e-mail para ler ou clique em <strong>Compor</strong> para enviar uma nova mensagem.</p></div>';
      }
      var replyBox = $('replyBox');
      if (replyBox) replyBox.classList.remove('is-visible');
      return;
    }

    var email = State.emails.find(function (e) { return e.id === State.ui.activeEmail; });
    if (!email) return;

    /* Mark as read */
    if (email.unread) {
      email.unread = false;
      if (email.companyId && State.companyFolders[email.companyId]) {
        State.companyFolders[email.companyId].unread = Math.max(0, State.companyFolders[email.companyId].unread - 1);
      }
      save(); renderEmailList(); renderSidebar();
    }

    /* DEX analysis */
    var analysis = DexEngine.analyzeEmail(email);
    var company = analysis.company;

    var html = '';

    /* Back button mobile */
    html += '<div class="email-reader__back"><button class="email-btn email-btn--ghost" id="readerBack"><i class="fa-solid fa-arrow-left"></i> Voltar</button></div>';

    /* Header */
    html += '<div class="email-reader__head">';
    html += '<div class="email-reader__subject"><span>' + esc(email.subject || '(sem assunto)') + '</span>';
    html += '<div class="email-reader__subject-labels">';
    if (email.labels) {
      email.labels.forEach(function (lid) {
        var lb = LABELS.find(function (l) { return l.id === lid; });
        if (lb) html += '<span class="email-row__label-tag" style="background:' + lb.color + '">' + lb.name + '</span>';
      });
    }
    html += '</div></div>';

    html += '<div class="email-reader__meta">';
    var initial = (email.from || '?').charAt(0).toUpperCase();
    html += '<div class="email-reader__avatar"' + (company ? ' style="background:' + company.color + '"' : '') + '>' + initial + '</div>';
    html += '<div class="email-reader__meta-info">';
    html += '<div class="email-reader__from-line">' + esc(email.from || 'Desconhecido') + '<span>&lt;' + esc(email.email || '') + '&gt;</span></div>';
    html += '<div class="email-reader__to-line">Para: ' + esc(email.to || 'contabil@escritorio.com.br') + '</div>';
    html += '</div>';
    html += '<div class="email-reader__date">' + fmtDate(email.date) + '</div>';
    html += '<div class="email-reader__actions">';
    html += '<button class="email-btn email-btn--icon" title="Responder" data-action="reply"><i class="fa-solid fa-reply"></i></button>';
    html += '<button class="email-btn email-btn--icon" title="Encaminhar" data-action="forward"><i class="fa-solid fa-share"></i></button>';
    html += '<button class="email-btn email-btn--icon" title="Adiar" data-action="snooze"><i class="fa-solid fa-clock"></i></button>';
    html += '<button class="email-btn email-btn--icon" title="Mais" data-action="more"><i class="fa-solid fa-ellipsis-vertical"></i></button>';
    html += '</div>';
    html += '</div></div>';

    /* DEX Analysis Box */
    html += '<div class="email-reader__dex-box">';
    html += '<div class="email-reader__dex-box-head"><i class="fa-solid fa-brain"></i> Análise DEX</div>';
    html += '<div class="email-reader__dex-grid">';
    html += '<div class="email-reader__dex-card"><label>Sentimento</label><span><i class="fa-solid ' + analysis.sentiment.icon + '" style="color:' + analysis.sentiment.color + '"></i> ' + analysis.sentiment.mood + '</span></div>';
    html += '<div class="email-reader__dex-card"><label>Intenção</label><span><i class="fa-solid ' + analysis.intent.icon + '"></i> ' + analysis.intent.label + '</span></div>';
    html += '<div class="email-reader__dex-card"><label>Departamento</label><span>' + analysis.department.label + '</span></div>';
    html += '<div class="email-reader__dex-card"><label>Prioridade</label><span class="email-row__priority is-' + analysis.priority + '">' + (analysis.priority === 'high' ? '🔴 Alta' : analysis.priority === 'medium' ? '🟡 Média' : '🟢 Baixa') + '</span></div>';
    if (company) html += '<div class="email-reader__dex-card"><label>Empresa</label><span style="color:' + company.color + '">' + company.name + '</span></div>';
    html += '</div>';
    html += '<div class="email-reader__dex-actions">';
    analysis.suggestions.forEach(function (s, i) {
      html += '<button class="email-btn email-btn--xs email-btn--ai" data-suggestion="' + i + '"><i class="fa-solid fa-wand-magic-sparkles"></i> Sugestão ' + (i + 1) + '</button>';
    });
    html += '</div></div>';

    /* Body */
    html += '<div class="email-reader__body"><div class="email-reader__content">' + (email.body || '') + '</div>';

    /* Attachments */
    if (email.attachments && email.attachments.length) {
      html += '<div class="email-reader__attachments"><h4><i class="fa-solid fa-paperclip"></i> Anexos (' + email.attachments.length + ')</h4>';
      html += '<div class="email-attach-list">';
      email.attachments.forEach(function (a) {
        var icon = getAttachmentIcon(a.name);
        html += '<div class="email-attach-item"><i class="fa-solid ' + icon + '"></i><span>' + esc(a.name) + '</span><span class="size">' + a.size + '</span></div>';
      });
      html += '</div></div>';
    }

    html += '</div>';

    reader.innerHTML = html;

    /* Bind actions */
    var backBtn = $('readerBack');
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        document.querySelector('.email-reader').classList.remove('is-mobile-open');
        State.ui.activeEmail = null; renderReader(); renderEmailList();
      });
    }

    $$('[data-action]', reader).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var action = btn.dataset.action;
        if (action === 'reply') { showReply(email); }
        else if (action === 'forward') { openCompose({ subject: 'Fwd: ' + email.subject, body: '<p>---------- Encaminhado ----------</p>' + email.body }); }
        else if (action === 'snooze') { snoozeEmail(email); }
      });
    });

    $$('[data-suggestion]', reader).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(btn.dataset.suggestion);
        var suggestion = analysis.suggestions[idx];
        if (suggestion) {
          showReply(email, suggestion);
          DexEngine.log('reply', 'Sugeriu resposta para "' + email.subject.substr(0, 30) + '..."', company);
        }
      });
    });

    /* Show reply box */
    var replyBox = $('replyBox');
    if (replyBox) replyBox.classList.add('is-visible');
  }

  /* ─── DEX Panel ─── */
  function renderDexPanel() {
    var panel = $('dexPanel');
    if (!panel) return;

    var stats = DexEngine.getStats(State.emails);

    /* Stats */
    var statsEl = $('dexStats');
    if (statsEl) {
      statsEl.innerHTML =
        '<div class="email-dex__stat"><div class="email-dex__stat-value">' + stats.total + '</div><div class="email-dex__stat-label">Total</div></div>' +
        '<div class="email-dex__stat"><div class="email-dex__stat-value">' + stats.unread + '</div><div class="email-dex__stat-label">Não lidos</div></div>' +
        '<div class="email-dex__stat"><div class="email-dex__stat-value">' + stats.highPriority + '</div><div class="email-dex__stat-label">Urgentes</div></div>' +
        '<div class="email-dex__stat"><div class="email-dex__stat-value">' + stats.today + '</div><div class="email-dex__stat-label">Hoje</div></div>';
    }

    /* Activity log */
    var logEl = $('dexLog');
    if (logEl) {
      var logHtml = '';
      DexEngine.actionsLog.slice(0, 15).forEach(function (item) {
        logHtml += '<div class="email-dex__log-item">';
        logHtml += '<div class="email-dex__log-icon is-' + item.type + '"><i class="fa-solid ' + getLogIcon(item.type) + '"></i></div>';
        logHtml += '<div class="email-dex__log-text">' + esc(item.message) + '</div>';
        logHtml += '<div class="email-dex__log-time">' + ago(item.time) + '</div>';
        logHtml += '</div>';
      });
      logEl.innerHTML = logHtml || '<div style="padding:12px;text-align:center;color:var(--email-text-faint);font-size:11px">Nenhuma atividade ainda</div>';
    }

    /* Company folders */
    var foldersEl = $('dexFolders');
    if (foldersEl) {
      var fhtml = '';
      COMPANIES.forEach(function (c) {
        var fd = State.companyFolders[c.id];
        if (!fd) return;
        fhtml += '<div class="email-dex__folder" data-company="' + c.id + '">';
        fhtml += '<i class="fa-solid fa-folder" style="color:' + c.color + '"></i>';
        fhtml += '<span>' + c.name.split(' ').slice(0, 2).join(' ') + '</span>';
        fhtml += '<span class="email-dex__folder__count">' + fd.count + '</span>';
        if (fd.unread > 0) fhtml += '<span class="email-dex__folder__new">' + fd.unread + '</span>';
        fhtml += '</div>';
      });
      foldersEl.innerHTML = fhtml || '<div style="padding:8px;text-align:center;color:var(--email-text-faint);font-size:10px">Nenhuma empresa detectada</div>';

      $$('.email-dex__folder', foldersEl).forEach(function (el) {
        el.addEventListener('click', function () {
          State.ui.activeFolder = 'company_' + el.dataset.company;
          State.ui.activeEmail = null;
          renderSidebar(); renderEmailList(); renderReader();
        });
      });
    }
  }

  function getLogIcon(type) {
    var map = { route: 'fa-route', classify: 'fa-tags', priority: 'fa-arrow-up', reply: 'fa-reply', analyze: 'fa-brain', notify: 'fa-bell' };
    return map[type] || 'fa-circle-info';
  }

  /* ─── Reply Box ─── */
  function showReply(email, suggestion) {
    var replyBox = $('replyBox');
    if (!replyBox) return;
    replyBox.classList.add('is-visible');
    var textarea = replyBox.querySelector('textarea');
    if (textarea && suggestion) textarea.value = suggestion;
    else if (textarea && !textarea.value) textarea.value = '';
    if (textarea) textarea.focus();
  }

  /* ─── Snooze ─── */
  function snoozeEmail(email) {
    var hours = prompt('Adiar por quantas horas?', '4');
    if (!hours || isNaN(hours)) return;
    email.snoozed = true;
    email.snoozedUntil = new Date(Date.now() + parseInt(hours) * 3600000).toISOString();
    DexEngine.log('classify', 'Adiou e-mail por ' + hours + 'h: "' + email.subject.substr(0, 30) + '"', DexEngine.routeToCompany(email.email));
    toast('E-mail adiado por ' + hours + ' hora(s)', 'info');
    save(); renderEmailList();
  }

  /* ─── Compose ─── */
  function openCompose(prefill) {
    var overlay = $('composeOverlay');
    if (!overlay) return;
    overlay.classList.add('is-open');
    if (prefill) {
      var toField = $('composeTo');
      var subField = $('composeSubject');
      var bodyField = $('composeBody');
      if (toField && prefill.to) toField.value = prefill.to;
      if (subField && prefill.subject) subField.value = prefill.subject;
      if (bodyField && prefill.body) bodyField.value = prefill.body.replace(/<[^>]+>/g, '');
    }
  }

  function closeCompose() {
    var overlay = $('composeOverlay');
    if (overlay) overlay.classList.remove('is-open');
    /* Clear fields */
    ['composeTo', 'composeSubject', 'composeBody'].forEach(function (id) {
      var el = $(id);
      if (el) el.value = '';
    });
    var dexBar = $('composeDexBar');
    if (dexBar) dexBar.classList.remove('is-visible');
  }

  function sendCompose() {
    var to = ($('composeTo') || {}).value || '';
    var subject = ($('composeSubject') || {}).value || '';
    var body = ($('composeBody') || {}).value || '';
    if (!to || !subject) { toast('Preencha destinatário e assunto', 'warning'); return; }
    var email = {
      id: uid(), from: State.user ? State.user.name : 'Escritório', email: 'contabil@escritorio.com.br',
      to: to, subject: subject, body: '<p>' + esc(body).replace(/\n/g, '</p><p>') + '</p>',
      date: new Date().toISOString(), labels: [], priority: 'low', unread: false, starred: false,
      attachments: [], folder: 'sent'
    };
    State.emails.unshift(email);
    DexEngine.log('reply', 'E-mail enviado para ' + to, null);
    NotifSystem.playSound('sent');
    toast('E-mail enviado com sucesso!', 'success');
    save(); closeCompose(); renderEmailList(); renderSidebar();
  }

  /* DEX compose suggestion */
  function dexSuggestCompose() {
    var body = ($('composeBody') || {}).value || '';
    var subject = ($('composeSubject') || {}).value || '';
    if (!body && !subject) { toast('Escreva algo para DEX analisar', 'info'); return; }
    var text = subject + ' ' + body;
    var sentiment = DexEngine.analyzeSentiment(text);
    var dept = DexEngine.classifyDepartment(text, subject);
    var bar = $('composeDexBar');
    var barText = $('composeDexText');
    if (bar && barText) {
      bar.classList.add('is-visible');
      barText.innerHTML = '<strong>Tom:</strong> ' + sentiment.mood + ' · <strong>Departamento:</strong> ' + dept.label +
        '<br>💡 Sugestão: Considere incluir referência ao período/competência e número de protocolo se aplicável.';
    }
    DexEngine.log('analyze', 'Analisou rascunho: ' + subject.substr(0, 30), null);
  }

  /* ─── Context Menu ─── */
  function showContextMenu(x, y, emailId) {
    var menu = $('contextMenu');
    if (!menu) return;
    menu.style.left = x + 'px'; menu.style.top = y + 'px';
    menu.classList.add('is-open');
    menu.dataset.emailId = emailId;

    /* Close on outside click */
    setTimeout(function () {
      document.addEventListener('click', function handler() {
        menu.classList.remove('is-open');
        document.removeEventListener('click', handler);
      });
    }, 10);
  }

  function handleContextAction(action) {
    var menu = $('contextMenu');
    var emailId = menu ? menu.dataset.emailId : null;
    if (!emailId) return;
    var email = State.emails.find(function (e) { return e.id === emailId; });
    if (!email) return;
    menu.classList.remove('is-open');

    switch (action) {
      case 'read':
        email.unread = !email.unread; break;
      case 'star':
        email.starred = !email.starred; break;
      case 'label':
        var labelName = prompt('Etiqueta (Fiscal, Contábil, DP, Financeiro, Societário, Urgente, Pendente, Resolvido):');
        if (labelName) {
          var lb = LABELS.find(function (l) { return l.name.toLowerCase() === labelName.toLowerCase(); });
          if (lb) { if (!email.labels) email.labels = []; if (email.labels.indexOf(lb.id) < 0) email.labels.push(lb.id); toast('Etiqueta adicionada', 'success'); }
          else toast('Etiqueta não encontrada', 'error');
        }
        break;
      case 'snooze':
        snoozeEmail(email); break;
      case 'dex-analyze':
        var analysis = DexEngine.analyzeEmail(email);
        toast('DEX: ' + analysis.intent.label + ' · ' + analysis.department.label + ' · ' + analysis.sentiment.mood, 'ai');
        break;
      case 'dex-classify':
        var dept = DexEngine.classifyDepartment(email.body, email.subject);
        var labelMap = { fiscal: 'l1', contabil: 'l2', dp: 'l3', financeiro: 'l4', societario: 'l5' };
        var lid = labelMap[dept.id];
        if (lid && (!email.labels || email.labels.indexOf(lid) < 0)) {
          if (!email.labels) email.labels = [];
          email.labels.push(lid);
          toast('DEX classificou como ' + dept.label, 'ai');
        }
        break;
      case 'trash':
        email.folder = 'trash';
        State.ui.selectedEmails = State.ui.selectedEmails.filter(function (id) { return id !== emailId; });
        if (State.ui.activeEmail === emailId) State.ui.activeEmail = null;
        toast('E-mail movido para lixeira', 'info');
        break;
    }
    rebuildCompanyFolders(); save(); renderEmailList(); renderReader(); renderSidebar();
  }

  /* ─── Notification Drawer ─── */
  function toggleNotifDrawer() {
    var drawer = $('notifDrawer');
    if (!drawer) return;
    var open = drawer.classList.toggle('is-open');
    if (open) renderNotifDrawer();
  }

  function renderNotifDrawer() {
    var body = $('notifDrawerBody');
    if (!body) return;
    if (State.notifications.length === 0) {
      body.innerHTML = '<div style="padding:24px;text-align:center;color:var(--email-text-faint);font-size:11px"><i class="fa-solid fa-bell-slash" style="font-size:24px;opacity:.3;margin-bottom:8px;display:block"></i>Nenhuma notificação</div>';
      return;
    }
    var html = '';
    State.notifications.forEach(function (n) {
      var iconClass = n.type === 'new' ? 'is-new' : n.type === 'dex' ? 'is-dex' : 'is-auto';
      var icon = n.type === 'new' ? 'fa-envelope' : n.type === 'dex' ? 'fa-brain' : 'fa-robot';
      html += '<div class="email-notif-item' + (!n.read ? ' is-unread' : '') + '" data-id="' + n.id + '">';
      html += '<div class="email-notif-item__icon ' + iconClass + '"><i class="fa-solid ' + icon + '"></i></div>';
      html += '<div class="email-notif-item__text">' + esc(n.message) + '</div>';
      html += '<div class="email-notif-item__time">' + ago(n.time) + '</div>';
      html += '</div>';
    });
    body.innerHTML = html;

    /* Mark as read on click */
    $$('.email-notif-item', body).forEach(function (el) {
      el.addEventListener('click', function () {
        var n = State.notifications.find(function (n) { return n.id === el.dataset.id; });
        if (n) { n.read = true; save(); NotifSystem.updateBadge(); renderNotifDrawer(); }
        if (n && n.emailId) {
          State.ui.activeEmail = n.emailId;
          renderEmailList(); renderReader();
          toggleNotifDrawer();
        }
      });
    });
  }

  /* ─── Settings Modal ─── */
  function openSettings() {
    var overlay = $('settingsOverlay');
    if (overlay) overlay.classList.add('is-open');
    renderSettingsContent();
  }

  function closeSettings() {
    var overlay = $('settingsOverlay');
    if (overlay) overlay.classList.remove('is-open');
  }

  function renderSettingsContent() {
    /* Account tab */
    var acct = $('settingsAccount');
    if (acct) {
      acct.innerHTML = '<div class="email-setting-group"><h4><i class="fa-solid fa-user"></i> Perfil</h4>' +
        '<div class="email-setting-row"><label>Nome</label><input type="text" id="setName" value="' + esc((State.user || {}).name || '') + '"></div>' +
        '<div class="email-setting-row"><label>E-mail</label><input type="email" id="setEmail" value="' + esc((State.user || {}).email || '') + '"></div>' +
        '<div class="email-setting-row"><label>Assinatura</label><textarea id="setSignature">' + esc(State.settings.signature || '') + '</textarea></div>' +
        '</div>';
    }

    /* Automation tab */
    var autoTab = $('settingsAutomation');
    if (autoTab) {
      var html = '<div class="email-setting-group"><h4><i class="fa-solid fa-bolt"></i> Regras de Automação</h4>';
      State.rules.forEach(function (r, i) {
        html += '<div class="email-rule-card" data-idx="' + i + '">';
        html += '<div class="email-rule-card__head"><h5><i class="fa-solid fa-robot"></i> ' + esc(r.name) + '</h5>';
        html += '<label class="email-toggle"><input type="checkbox" ' + (r.enabled ? 'checked' : '') + ' data-rule-toggle="' + i + '"><span class="email-toggle__track"></span></label></div>';
        if (r.companyId) {
          html += '<div class="email-rule-card__meta">Empresa: ' + esc((getCompanyById(r.companyId) || {}).name || '') + '</div>';
        }
        html += '<div class="email-rule-card__row"><span>SE</span><select data-rule-field="' + i + '">' +
          '<option value="email"' + (r.condition.field === 'email' ? ' selected' : '') + '>E-mail remetente</option>' +
          '<option value="subject"' + (r.condition.field === 'subject' ? ' selected' : '') + '>Assunto</option>' +
          '<option value="from"' + (r.condition.field === 'from' ? ' selected' : '') + '>Nome remetente</option>' +
          '<option value="content"' + (r.condition.field === 'content' ? ' selected' : '') + '>Qualquer conteúdo</option>' +
          '<option value="priority"' + (r.condition.field === 'priority' ? ' selected' : '') + '>Prioridade</option></select>';
        html += '<select data-rule-op="' + i + '">' +
          '<option value="contains"' + (r.condition.op === 'contains' ? ' selected' : '') + '>contém</option>' +
          '<option value="equals"' + (r.condition.op === 'equals' ? ' selected' : '') + '>é igual</option>' +
          '<option value="starts"' + (r.condition.op === 'starts' ? ' selected' : '') + '>começa com</option></select>';
        html += '<input type="text" value="' + esc(r.condition.value) + '" data-rule-val="' + i + '"></div>';
        html += '<div class="email-rule-card__row"><span>ENTÃO</span><select data-rule-action="' + i + '">' +
          '<option value="label"' + (r.action.type === 'label' ? ' selected' : '') + '>Adicionar etiqueta</option>' +
          '<option value="star"' + (r.action.type === 'star' ? ' selected' : '') + '>Marcar favorito</option>' +
          '<option value="priority"' + (r.action.type === 'priority' ? ' selected' : '') + '>Definir prioridade</option>' +
          '<option value="route_folder"' + (r.action.type === 'route_folder' ? ' selected' : '') + '>Mover para pasta da empresa</option>' +
          '<option value="notify"' + (r.action.type === 'notify' ? ' selected' : '') + '>Notificar</option></select>';
        html += '<input type="text" value="' + esc(r.action.value) + '" data-rule-actionval="' + i + '"></div>';
        if (r.action.type === 'route_folder' && r.companyId) {
          var ruleFolder = findCompanyCustomFolder(r.companyId, r.action.value);
          html += '<div class="email-rule-card__meta">Destino atual: ' + esc(ruleFolder ? ruleFolder.name : 'Pasta removida') + '</div>';
        }
        html += '</div>';
      });
      html += '<button class="email-btn email-btn--primary email-btn--sm" id="addRuleBtn"><i class="fa-solid fa-plus"></i> Nova Regra</button></div>';
      autoTab.innerHTML = html;

      /* Bind toggle */
      $$('[data-rule-toggle]', autoTab).forEach(function (cb) {
        cb.addEventListener('change', function () {
          var idx = parseInt(cb.dataset.ruleToggle);
          State.rules[idx].enabled = cb.checked;
          save(); renderSidebar();
        });
      });

      var addBtn = $('addRuleBtn');
      if (addBtn) {
        addBtn.addEventListener('click', function () {
          State.rules.push({ id: uid(), name: 'Nova Regra', enabled: true, condition: { field: 'content', op: 'contains', value: '' }, action: { type: 'label', value: 'l1' } });
          save(); renderSettingsContent();
        });
      }
    }

    /* DEX tab */
    var dexTab = $('settingsDex');
    if (dexTab) {
      dexTab.innerHTML = '<div class="email-setting-group"><h4><i class="fa-solid fa-brain"></i> DEX AI — Configuração</h4>' +
        '<div class="email-setting-row"><label>Auto-analisar e-mails</label><label class="email-toggle"><input type="checkbox" id="setDexAnalyze" ' + (State.settings.dexAutoAnalyze ? 'checked' : '') + '><span class="email-toggle__track"></span></label></div>' +
        '<div class="email-setting-row"><label>Auto-rotear para empresas</label><label class="email-toggle"><input type="checkbox" id="setDexRoute" ' + (State.settings.dexAutoRoute ? 'checked' : '') + '><span class="email-toggle__track"></span></label></div>' +
        '<div class="email-setting-row"><label>Auto-classificar departamento</label><label class="email-toggle"><input type="checkbox" id="setDexClassify" ' + (State.settings.dexAutoClassify ? 'checked' : '') + '><span class="email-toggle__track"></span></label></div>' +
        '</div>' +
        '<div class="email-setting-group"><h4><i class="fa-solid fa-chart-bar"></i> Estatísticas DEX</h4>' +
        '<div class="email-setting-row"><label>Ações realizadas</label><span style="font-weight:700">' + DexEngine.actionsLog.length + '</span></div>' +
        '<div class="email-setting-row"><label>Empresas mapeadas</label><span style="font-weight:700">' + Object.keys(State.companyFolders).length + '</span></div>' +
        '<div class="email-setting-row"><label>Regras ativas</label><span style="font-weight:700">' + State.rules.filter(function (r) { return r.enabled; }).length + '</span></div>' +
        '</div>';
    }

    /* Appearance tab */
    var apTab = $('settingsAppearance');
    if (apTab) {
      apTab.innerHTML = '<div class="email-setting-group"><h4><i class="fa-solid fa-palette"></i> Aparência</h4>' +
        '<div class="email-setting-row"><label>Tema escuro</label><label class="email-toggle"><input type="checkbox" id="setDark" ' + (State.settings.theme === 'dark' ? 'checked' : '') + '><span class="email-toggle__track"></span></label></div>' +
        '<div class="email-setting-row"><label>Sons</label><label class="email-toggle"><input type="checkbox" id="setSound" ' + (State.settings.sound ? 'checked' : '') + '><span class="email-toggle__track"></span></label></div>' +
        '<div class="email-setting-row"><label>Som de novo e-mail</label><select id="setSoundMode">' +
        '<option value="voice"' + (State.settings.soundMode === 'voice' ? ' selected' : '') + '>Voz falando "email"</option>' +
        '<option value="bell-soft"' + (State.settings.soundMode === 'bell-soft' ? ' selected' : '') + '>Sino suave</option>' +
        '<option value="bell-classic"' + (State.settings.soundMode === 'bell-classic' ? ' selected' : '') + '>Sino clássico</option>' +
        '<option value="bell-double"' + (State.settings.soundMode === 'bell-double' ? ' selected' : '') + '>Sino duplo</option>' +
        '</select></div>' +
        '<div class="email-setting-row"><label>Notificações push</label><label class="email-toggle"><input type="checkbox" id="setNotif" ' + (State.settings.notifications ? 'checked' : '') + '><span class="email-toggle__track"></span></label></div>' +
        '</div>';
    }
  }

  function saveSettings() {
    var name = ($('setName') || {}).value;
    var email = ($('setEmail') || {}).value;
    if (name && State.user) State.user.name = name;
    if (email && State.user) State.user.email = email;
    var sig = ($('setSignature') || {}).value;
    if (sig !== undefined) State.settings.signature = sig;

    var dexA = $('setDexAnalyze'); if (dexA) State.settings.dexAutoAnalyze = dexA.checked;
    var dexR = $('setDexRoute'); if (dexR) State.settings.dexAutoRoute = dexR.checked;
    var dexC = $('setDexClassify'); if (dexC) State.settings.dexAutoClassify = dexC.checked;

    var dark = $('setDark');
    if (dark) {
      State.settings.theme = dark.checked ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', State.settings.theme);
    }
    var sound = $('setSound'); if (sound) State.settings.sound = sound.checked;
    var soundMode = $('setSoundMode'); if (soundMode) State.settings.soundMode = soundMode.value;
    var notif = $('setNotif'); if (notif) State.settings.notifications = notif.checked;

    /* Save rule edits */
    State.rules.forEach(function (r, i) {
      var f = document.querySelector('[data-rule-field="' + i + '"]');
      var o = document.querySelector('[data-rule-op="' + i + '"]');
      var v = document.querySelector('[data-rule-val="' + i + '"]');
      var a = document.querySelector('[data-rule-action="' + i + '"]');
      var av = document.querySelector('[data-rule-actionval="' + i + '"]');
      if (f) r.condition.field = f.value;
      if (o) r.condition.op = o.value;
      if (v) r.condition.value = v.value;
      if (a) r.action.type = a.value;
      if (av) r.action.value = av.value;
    });

    save();
    toast('Configurações salvas!', 'success');
    closeSettings();
    renderAll();
  }

  /* ─── DEX Chat ─── */
  function sendDexChat() {
    var input = $('dexChatInput');
    if (!input || !input.value.trim()) return;
    var q = input.value.trim();
    input.value = '';

    var msgContainer = $('dexChatMessages');
    if (!msgContainer) return;

    /* User message */
    var userMsg = document.createElement('div');
    userMsg.className = 'email-dex__chat-msg is-user';
    userMsg.textContent = q;
    msgContainer.appendChild(userMsg);

    /* DEX response */
    var response = DexEngine.chat(q, State);
    setTimeout(function () {
      var dexMsg = document.createElement('div');
      dexMsg.className = 'email-dex__chat-msg is-dex';
      dexMsg.textContent = response;
      msgContainer.appendChild(dexMsg);
      msgContainer.scrollTop = msgContainer.scrollHeight;
      DexEngine.log('reply', 'Respondeu chat: "' + q.substr(0, 30) + '"', null);
    }, 400);
  }

  /* ─── Simulate New Email ─── */
  function simulateNewEmail() {
    var senders = [
      { from: 'Carlos Oliveira', email: 'carlos@oliveirasantos.com.br', subjects: ['Envio de balancete mensal', 'Dúvida sobre DCTF', 'Relatório de despesas Q1'] },
      { from: 'Marina Silva', email: 'marina@techsolutions.com.br', subjects: ['Solicitação de DIRF', 'Novo funcionário - admissão', 'Contrato de prestação de serviço'] },
      { from: 'Fernanda Costa', email: 'fernanda@construmax.eng.br', subjects: ['URGENTE: Alvará vencendo', 'Medição da obra nº 15', 'Nota de retenção'] },
      { from: 'Amanda Rocha', email: 'amanda@redefarma.com.br', subjects: ['Inventário anual 2024', 'Transferência entre filiais', 'Relatório de vendas consolidado'] },
      { from: 'Roberto Mendes', email: 'roberto@brcomercio.com.br', subjects: ['Consulta sobre Difal', 'Notas de importação', 'Revisão de enquadramento'] }
    ];
    var sender = senders[Math.floor(Math.random() * senders.length)];
    var subject = sender.subjects[Math.floor(Math.random() * sender.subjects.length)];
    var newEmail = {
      id: uid(), from: sender.from, email: sender.email, to: 'contabil@escritorio.com.br',
      subject: subject, body: '<p>Prezados,</p><p>Segue informação referente ao assunto: ' + subject + '.</p><p>Favor analisar e retornar.</p><p>Att,<br>' + sender.from + '</p>',
      date: new Date().toISOString(), labels: [], priority: 'low', unread: true, starred: false, attachments: []
    };

    processNewEmail(newEmail);
    State.emails.unshift(newEmail);
    State.ui.newEmailCount++;
    save();
    renderAll();
    toast('📩 Novo e-mail de ' + sender.from, 'ai');
    DexEngine.log('notify', 'Novo e-mail recebido de ' + sender.from, DexEngine.routeToCompany(sender.email));
    renderDexPanel();
  }

  /* ─── New Email Timer ─── */
  var newEmailTimer = null;
  function startNewEmailSimulation() {
    if (newEmailTimer) return;
    newEmailTimer = setInterval(function () {
      if (Math.random() < 0.3) simulateNewEmail();
    }, (State.settings.checkInterval || 30) * 1000);
  }

  /* ════════════════════════════════════════════
     WELCOME GATE
     ════════════════════════════════════════════ */
  function showWelcome() {
    var gate = $('welcomeGate');
    if (gate) gate.classList.remove('is-hidden');
  }

  function hideWelcome() {
    var gate = $('welcomeGate');
    if (gate) gate.classList.add('is-hidden');
  }

  function handleWelcomeSubmit() {
    var name = ($('welcomeName') || {}).value || '';
    var email = ($('welcomeEmail') || {}).value || '';
    var role = ($('welcomeRole') || {}).value || 'contador';
    if (!name.trim()) { toast('Digite seu nome', 'warning'); return; }
    if (!email.trim()) { toast('Digite seu e-mail', 'warning'); return; }

    State.user = { name: name.trim(), email: email.trim(), role: role };

    /* Initialize clean workspace */
    State.emails = [];
    State.rules = [];
    State.companyFolders = {};
    State.notifications = [];
    clearSelectedEmails();

    DexEngine.log('analyze', 'DEX inicializado — Bem-vindo, ' + name.trim() + '!', null);

    save(); hideWelcome();
    toast('Bem-vindo ao SIS-C E-mail, ' + name.trim() + '!', 'ai');
    NotifSystem.playSound('dex');
    renderAll();
  }

  /* ════════════════════════════════════════════
     RENDER ALL
     ════════════════════════════════════════════ */
  function renderAll() {
    renderSidebar();
    renderEmailList();
    renderReader();
    renderDexPanel();
    NotifSystem.updateBadge();
  }

  /* ════════════════════════════════════════════
     INIT
     ════════════════════════════════════════════ */
  function init() {
    var hasData = load();

    /* Theme */
    if (State.settings.theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');

    /* If no user, show welcome */
    if (!State.user) {
      showWelcome();
    } else {
      hideWelcome();
      if (!Array.isArray(State.rules)) State.rules = [];
      rebuildCompanyFolders();
      renderAll();
    }

    NotifSystem.init();

    /* ── Event Bindings ── */

    /* Welcome form */
    var welcomeBtn = $('welcomeEnter');
    if (welcomeBtn) welcomeBtn.addEventListener('click', handleWelcomeSubmit);
    var welcomeForm = $('welcomeForm');
    if (welcomeForm) {
      welcomeForm.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') handleWelcomeSubmit();
      });
    }

    /* Compose */
    var composeBtn = $('composeBtn');
    if (composeBtn) composeBtn.addEventListener('click', function () { openCompose(); });
    var composeCloseBtn = $('composeClose');
    if (composeCloseBtn) composeCloseBtn.addEventListener('click', closeCompose);
    var composeSendBtn = $('composeSend');
    if (composeSendBtn) composeSendBtn.addEventListener('click', sendCompose);
    var composeDexBtn = $('composeDexSuggest');
    if (composeDexBtn) composeDexBtn.addEventListener('click', dexSuggestCompose);

    /* Reply send */
    var replySendBtn = $('replySend');
    if (replySendBtn) {
      replySendBtn.addEventListener('click', function () {
        var textarea = document.querySelector('.email-reply-box textarea');
        var text = textarea ? textarea.value : '';
        if (!text.trim()) { toast('Escreva algo para responder', 'warning'); return; }
        var email = State.emails.find(function (e) { return e.id === State.ui.activeEmail; });
        if (email) {
          DexEngine.log('reply', 'Respondeu e-mail de ' + email.from, DexEngine.routeToCompany(email.email));
          toast('Resposta enviada!', 'success');
          NotifSystem.playSound('sent');
          if (textarea) textarea.value = '';
        }
      });
    }

    var replyDexBtn = $('replyDexSuggest');
    if (replyDexBtn) {
      replyDexBtn.addEventListener('click', function () {
        var email = State.emails.find(function (e) { return e.id === State.ui.activeEmail; });
        if (email) {
          var suggestions = DexEngine.suggestResponses(email);
          if (suggestions.length) {
            var textarea = document.querySelector('.email-reply-box textarea');
            if (textarea) textarea.value = suggestions[0];
            toast('DEX sugeriu uma resposta', 'ai');
          }
        }
      });
    }

    /* Search */
    var searchInput = $('searchInput');
    if (searchInput) {
      var debounce = null;
      searchInput.addEventListener('input', function () {
        clearTimeout(debounce);
        debounce = setTimeout(function () {
          State.ui.searchQuery = searchInput.value;
          renderEmailList();
        }, 250);
      });
    }

    /* Sort */
    var sortSelect = $('sortSelect');
    if (sortSelect) {
      sortSelect.addEventListener('change', function () {
        State.ui.sortBy = sortSelect.value;
        renderEmailList();
      });
    }

    /* Company select */
    var companySelect = $('companySelect');
    if (companySelect) {
      companySelect.addEventListener('change', function () {
        clearSelectedEmails();
        State.ui.activeCompany = companySelect.value;
        renderEmailList();
      });
    }

    var selectAll = $('selectAll');
    if (selectAll) {
      selectAll.addEventListener('change', function () {
        var currentIds = getFilteredEmails().map(function (email) { return email.id; });
        if (selectAll.checked) {
          currentIds.forEach(function (id) {
            if (State.ui.selectedEmails.indexOf(id) < 0) State.ui.selectedEmails.push(id);
          });
        } else {
          State.ui.selectedEmails = State.ui.selectedEmails.filter(function (id) { return currentIds.indexOf(id) < 0; });
        }
        renderEmailList();
      });
    }

    var batchDeleteBtn = $('batchDeleteBtn');
    if (batchDeleteBtn) batchDeleteBtn.addEventListener('click', deleteSelectedEmails);

    /* DEX toggle */
    var dexToggle = $('dexToggle');
    if (dexToggle) {
      dexToggle.addEventListener('click', function () {
        State.ui.dexOpen = !State.ui.dexOpen;
        var shell = document.querySelector('.email-shell');
        if (shell) shell.classList.toggle('dex-open', State.ui.dexOpen);
        if (State.ui.dexOpen) renderDexPanel();
      });
    }

    /* Notification bell */
    var notifBtn = $('notifBtn');
    if (notifBtn) notifBtn.addEventListener('click', toggleNotifDrawer);

    var notifClear = $('notifClear');
    if (notifClear) {
      notifClear.addEventListener('click', function () {
        State.notifications.forEach(function (n) { n.read = true; });
        save(); NotifSystem.updateBadge(); renderNotifDrawer();
      });
    }

    var notifClose = $('notifClose');
    if (notifClose) notifClose.addEventListener('click', toggleNotifDrawer);

    /* Settings */
    var settingsBtn = $('settingsBtn');
    if (settingsBtn) settingsBtn.addEventListener('click', openSettings);
    var settingsClose = $('settingsClose');
    if (settingsClose) settingsClose.addEventListener('click', closeSettings);
    var settingsSave = $('settingsSave');
    if (settingsSave) settingsSave.addEventListener('click', saveSettings);

    /* Settings tabs */
    $$('.email-modal__tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        $$('.email-modal__tab').forEach(function (t) { t.classList.remove('is-active'); });
        $$('.email-modal__panel').forEach(function (p) { p.classList.remove('is-active'); });
        tab.classList.add('is-active');
        var target = $(tab.dataset.tab);
        if (target) target.classList.add('is-active');
      });
    });

    /* Context menu */
    $$('.email-context__item').forEach(function (item) {
      item.addEventListener('click', function () {
        handleContextAction(item.dataset.action);
      });
    });

    /* New email bar */
    var newBar = $('newEmailBar');
    if (newBar) {
      newBar.addEventListener('click', function () {
        State.ui.newEmailCount = 0;
        renderEmailList();
      });
    }

    /* DEX chat */
    var chatSendBtn = $('dexChatSend');
    if (chatSendBtn) chatSendBtn.addEventListener('click', sendDexChat);
    var chatInput = $('dexChatInput');
    if (chatInput) {
      chatInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') sendDexChat();
      });
    }

    /* Simulate new email button */
    var simBtn = $('simNewEmail');
    if (simBtn) simBtn.addEventListener('click', simulateNewEmail);

    /* Theme toggle topbar */
    var themeBtn = $('themeBtn');
    if (themeBtn) {
      themeBtn.addEventListener('click', function () {
        State.settings.theme = State.settings.theme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', State.settings.theme);
        save();
      });
    }

    /* Reset data */
    var resetBtn = $('resetBtn');
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        if (confirm('Tem certeza? Isso apagará todos os dados salvos.')) {
          localStorage.removeItem(STORAGE_KEY);
          location.reload();
        }
      });
    }

    /* Keyboard shortcuts */
    document.addEventListener('keydown', function (e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      if (e.key === 'c') openCompose();
      if (e.key === 'd') { State.ui.dexOpen = !State.ui.dexOpen; var sh = document.querySelector('.email-shell'); if (sh) sh.classList.toggle('dex-open', State.ui.dexOpen); if (State.ui.dexOpen) renderDexPanel(); }
      if (e.key === 'n') toggleNotifDrawer();
      if (e.key === 'Escape') { closeCompose(); closeSettings(); var nd = $('notifDrawer'); if (nd) nd.classList.remove('is-open'); var cm = $('contextMenu'); if (cm) cm.classList.remove('is-open'); }
      if (e.key === '/') { e.preventDefault(); var si = $('searchInput'); if (si) si.focus(); }
    });
  }

  /* Boot */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* Public API */
  window.EmailApp = {
    getState: function () { return State; },
    getDex: function () { return DexEngine; },
    simulateNewEmail: simulateNewEmail,
    renderAll: renderAll,
    toast: toast,
    reset: function () { localStorage.removeItem(STORAGE_KEY); location.reload(); }
  };

})();
