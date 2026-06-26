// ── STATE ──
let currentUser = null;
let currentView = 'produccion';
let selectedWeek = detectCurrentWeek();
let selectedOp = 'AGUSTIN';
let selectedProv = 'Express';
let pin = '';
let selectedRole = null;
let desglosOpen = false;

let chatMessages = JSON.parse(localStorage.getItem('impronta_chat') || '[]');
if (chatMessages.length === 0) {
  chatMessages = [
    { id: 1, rol: 'produccion', nombre: 'Produccion', texto: 'Buen dia! Ya arrancamos con la semana del 22.', hora: '08:15' },
    { id: 2, rol: 'logistica',  nombre: 'Logistica',  texto: 'Las telas de Lula todavia no llegaron, seguimos esperando.', hora: '09:02' },
    { id: 4, rol: 'director',   nombre: 'Director',   texto: 'Ok, arranquen con prioridad en la semana 22.', hora: '09:45' },
  ];
}

// ── UTILS ──
const $ = id => document.getElementById(id);

function detectCurrentWeek() {
  const weeks = ['01/06','08/06','15/06','22/06'];
  const now = new Date();
  const day = now.getDate();
  const month = now.getMonth() + 1;
  if (month !== 6) return weeks[weeks.length - 1];
  if (day >= 22) return '22/06';
  if (day >= 15) return '15/06';
  if (day >= 8)  return '08/06';
  return '01/06';
}
const fmtVal = v => v > 0 ? '$' + (v / 1000000).toFixed(1) + 'M' : '-';

const estadoColor = e => ({
  en_proceso: 'var(--yellow)',
  funda:      'var(--green)',
  terminado:  'var(--blue)',
}[e] || '#888');

const estadoLabel = e => ({
  en_proceso: 'EN PROCESO',
  funda:      'FUNDA',
  terminado:  'TERMINADO',
}[e] || e);

// ── SCREENS ──
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  $(id).classList.remove('hidden');
}

// ── LOGIN ──
document.querySelectorAll('.role-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedRole = btn.dataset.rol;
    $('pin-section').style.display = 'block';
    pin = '';
    updatePinDisplay();
    $('pin-error').textContent = '';
  });
});

document.querySelectorAll('.pin-key').forEach(key => {
  key.addEventListener('click', () => {
    const v = key.dataset.v;
    if (v === 'del') {
      pin = pin.slice(0, -1);
    } else if (pin.length < 4) {
      pin += v;
      if (pin.length === 4) setTimeout(tryLogin, 150);
    }
    updatePinDisplay();
  });
});

function updatePinDisplay() {
  document.querySelectorAll('.pin-dot').forEach((dot, i) => {
    dot.classList.toggle('filled', i < pin.length);
  });
}

function tryLogin() {
  const user = APP_DATA.usuarios.find(u => u.rol === selectedRole && u.pin === pin);
  if (user) {
    currentUser = user;
    $('topbar-role').textContent = user.nombre;
    setupNavForRole(user.rol);
    showApp();
  } else {
    $('pin-error').textContent = 'PIN incorrecto, intenta de nuevo';
    pin = '';
    updatePinDisplay();
    setTimeout(() => { $('pin-error').textContent = ''; }, 2000);
  }
}

function setupNavForRole(rol) {
  document.querySelectorAll('.nav-item').forEach(item => {
    const allowed = item.dataset.roles ? item.dataset.roles.split(',') : [];
    item.style.display = allowed.includes(rol) ? 'flex' : 'none';
  });
  const defaults = { director: 'resumen', produccion: 'produccion', logistica: 'logistica' };
  switchView(defaults[rol] || 'produccion');
}

const SHEETS_URL          = 'https://script.google.com/macros/s/AKfycbyTykntodYWTnswdmTryGFzKNdxLAVS1RfWpf1BzBVnSe6sQ8DMVSOgei7T0ClfrX6JMQ/exec';
const LOGISTICA_SHEETS_URL  = 'https://script.google.com/macros/s/AKfycbycF4XhSDJi1vEWahoCI45Aiy3zkNeDXMyDTlXuAVSOXzUX1PV0KRunDcgHKnqz6XGYww/exec';
const PRODUCCION_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbxxsWAYfSvb1laOTYrWC429SpELdjQ6WRHLBwbn5tL2_R-C--gISC0iiBMq_Hl9HG7srw/exec';
const VENTAS_SHEETS_URL      = 'https://script.google.com/macros/s/AKfycbw_LDG5SLDuh7m6nM2c3nyFHxmAaIdOJbq44VYMyUWlKtWDKBEzide1dj5xq7H_iDP1/exec';
const PRESENTISMO_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbyx8U5N9Czervy7zeZAaFg3Msu-EbFIMrxtle5xQLEt6RGXeRp4tTyRPuROBWvg1UW7/exec';

function colorToEstado(hex) {
  const h = (hex || '').toLowerCase().replace('#', '');
  if (h.length < 6) return 'noPedido';
  const r = parseInt(h.substr(0,2), 16);
  const g = parseInt(h.substr(2,2), 16);
  const b = parseInt(h.substr(4,2), 16);
  if (g > 180 && r < 100 && b < 100) return 'llego';
  if (r > 180 && g > 180 && b < 100) return 'pedido';
  if (r > 180 && b > 180 && g < 100) return 'noStock';
  if (r > 180 && g < 100 && b < 100) return 'noPedido';
  return 'noPedido';
}

async function fetchTelasFromSheets() {
  $('view-telas').innerHTML = '<div class="content" style="text-align:center;padding:40px;color:var(--text2)">Actualizando telas...</div>';
  try {
    const res = await fetch(SHEETS_URL);
    const rows = await res.json();
    APP_DATA.telas = rows
      .filter(r => r.tela)
      .map(r => {
        const estado = colorToEstado(r.color);
        return {
          orden:   r.orden,
          cliente: r.cliente,
          tela:    r.tela,
          metros:  r.metros,
          prov:    r.prov,
          pedido:  estado === 'pedido',
          llego:   estado === 'llego',
          noStock: estado === 'noStock',
        };
      });
    renderTelas();
  } catch(e) {
    $('view-telas').innerHTML = '<div class="content" style="text-align:center;padding:40px;color:var(--red)">Error al cargar telas. Revisá la conexión.</div>';
  }
}

function showApp() {
  localStorage.removeItem('impronta_telas');
  localStorage.removeItem('impronta_telas_v2');
  showScreen('app');
}

$('logout-btn').addEventListener('click', () => {
  currentUser = null; pin = ''; selectedRole = null;
  document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('selected'));
  $('pin-section').style.display = 'none';
  showScreen('login');
});

// ── NAV ──
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => switchView(item.dataset.view));
});

function switchView(view) {
  currentView = view;
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  const el = $('view-' + view);
  if (el) el.classList.remove('hidden');
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.view === view);
  });
  renderView(view);
}

function renderView(view) {
  if (view === 'resumen')    fetchResumenData();
  if (view === 'produccion') fetchProduccionFromSheets();
  if (view === 'telas')      fetchTelasFromSheets();
  if (view === 'logistica')  fetchLogisticaFromSheets();
  if (view === 'chat')       renderChat();
}

async function fetchResumenData() {
  $('view-resumen').innerHTML = '<div class="content" style="text-align:center;padding:40px;color:var(--text2)">Cargando...</div>';
  try {
    const res = await fetch(VENTAS_SHEETS_URL);
    APP_DATA.ventas = await res.json();
  } catch(e) {
    APP_DATA.ventas = [];
  }
  renderResumen();
}

// ── DEDUPLICAR ──
// Si la misma orden aparece en varios operarios, queda solo la que tiene valor > 0.
function deduplicar(pedidos) {
  const map = new Map();
  pedidos.forEach(p => {
    const key = p.oc ? p.oc : p.cliente + '|' + p.modelo;
    if (!map.has(key) || (p.valor || 0) > (map.get(key).valor || 0)) {
      map.set(key, p);
    }
  });
  return [...map.values()];
}

// ── RESUMEN (Admin) ──
function renderResumen() {
  const ventas = APP_DATA.ventas || [];
  const fmt = v => v >= 1000000 ? '$' + (v/1000000).toFixed(1) + 'M' : v > 0 ? '$' + (v/1000).toFixed(0) + 'k' : '-';

  const totalVentas = ventas.reduce((s, v) => s + (v.valor || 0), 0);

  // Por punto de venta
  const puntos = {};
  ventas.forEach(v => {
    const p = v.punto || 'Otro';
    if (!puntos[p]) puntos[p] = { count: 0, total: 0 };
    puntos[p].count++;
    puntos[p].total += v.valor || 0;
  });

  const puntoLabels = { NOR: 'Local Norcenter', REC: 'Recomendación', ONL: 'Online', AD: 'Cartera A. Daniel', TIG: 'Local Tigre' };

  let html = `<div class="section-title">Ventas - Junio 2026</div>`;

  // KPIs
  html += `<div class="kpi-grid" style="margin-bottom:14px">
    <div class="kpi-card"><div class="kpi-label">Total ventas</div><div class="kpi-value" style="font-size:20px;color:var(--gold)">${fmt(totalVentas)}</div></div>
    <div class="kpi-card"><div class="kpi-label">Operaciones</div><div class="kpi-value">${ventas.length}</div></div>
  </div>`;

  // Por punto de venta
  html += `<div class="section-title" style="margin-top:4px">Por punto de venta</div>
  <div class="card" style="margin-bottom:14px">`;
  const puntosOrdenados = Object.entries(puntos).sort((a,b) => b[1].total - a[1].total);
  const maxTotal = puntosOrdenados[0]?.[1].total || 1;
  puntosOrdenados.forEach(([key, val]) => {
    const pct = Math.round((val.total / maxTotal) * 100);
    html += `<div style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px">
        <span style="font-weight:600">${puntoLabels[key] || key}</span>
        <span style="color:var(--gold);font-weight:700">${fmt(val.total)}</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <div style="flex:1;height:5px;background:var(--border);border-radius:3px">
          <div style="width:${pct}%;height:5px;background:var(--beige);border-radius:3px"></div>
        </div>
        <span style="font-size:11px;color:var(--text2)">${val.count} op.</span>
      </div>
    </div>`;
  });
  html += `</div>`;

  // Tabla de ventas
  html += `<div class="section-title">Detalle de ventas</div>
  <div class="card" style="padding:0;overflow:hidden">
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead>
        <tr style="background:var(--bg3);color:var(--text2)">
          <th style="padding:8px 10px;text-align:left;font-size:10px;font-weight:700">FECHA</th>
          <th style="padding:8px 10px;text-align:left;font-size:10px;font-weight:700">CLIENTE</th>
          <th style="padding:8px 10px;text-align:left;font-size:10px;font-weight:700">MODELO</th>
          <th style="padding:8px 10px;text-align:right;font-size:10px;font-weight:700">VALOR</th>
        </tr>
      </thead>
      <tbody>`;

  [...ventas].reverse().forEach(v => {
    const fecha = String(v.fecha).replace(/-/g,'/').slice(0,8);
    html += `<tr style="border-top:1px solid var(--border)">
      <td style="padding:9px 10px;color:var(--text2);white-space:nowrap">${fecha}</td>
      <td style="padding:9px 10px;font-weight:600">${v.nombre}</td>
      <td style="padding:9px 10px;color:var(--text2)">${v.modelo}</td>
      <td style="padding:9px 10px;text-align:right;color:var(--gold);font-weight:700">${fmt(v.valor)}</td>
    </tr>`;
  });

  html += `</tbody></table></div>`;

  $('view-resumen').innerHTML = '<div class="content">' + html + '</div>';
}

// ── TABLA MENSUAL ──
function buildTablaResumen() {
  const semanas = Object.keys(APP_DATA.produccion);
  const opList  = ['AGUSTIN', 'FRANCIS', 'LUIS', 'NICOLAS'];

  const rows = opList.map(op => {
    let planPedidos = 0, planValor = 0, prodPedidos = 0, prodValor = 0;
    semanas.forEach(sem => {
      (APP_DATA.produccion[sem][op] || []).forEach(p => {
        planPedidos++;
        planValor += p.valor || 0;
        if (p.estado === 'funda' || p.estado === 'terminado') {
          prodPedidos++;
          prodValor += p.valor || 0;
        }
      });
    });
    const pct = planPedidos > 0 ? Math.round((prodPedidos / planPedidos) * 100) : 0;
    return { op, planPedidos, planValor, prodPedidos, prodValor, pct };
  });

  const tot = rows.reduce((a, r) => ({
    planPedidos: a.planPedidos + r.planPedidos,
    planValor:   a.planValor   + r.planValor,
    prodPedidos: a.prodPedidos + r.prodPedidos,
    prodValor:   a.prodValor   + r.prodValor,
  }), { planPedidos: 0, planValor: 0, prodPedidos: 0, prodValor: 0 });
  const totPct = tot.planPedidos > 0 ? Math.round((tot.prodPedidos / tot.planPedidos) * 100) : 0;

  const barColor = pct => pct >= 70 ? 'var(--green)' : pct >= 40 ? 'var(--yellow)' : 'var(--red)';
  const fmt = v => v >= 1000000 ? '$' + (v/1000000).toFixed(1) + 'M' : v > 0 ? '$' + (v/1000).toFixed(0) + 'k' : '-';

  let html = `
  <div class="section-title">Resumen mensual - Junio 2026</div>
  <div class="card" style="padding:0;overflow:hidden;margin-bottom:16px">
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead>
        <tr style="background:var(--bg3);color:var(--text2)">
          <th style="padding:10px 12px;text-align:left;font-weight:700;font-size:11px;letter-spacing:0.5px">OPERARIO</th>
          <th style="padding:10px 8px;text-align:center;font-weight:700;font-size:11px">PLAN</th>
          <th style="padding:10px 8px;text-align:center;font-weight:700;font-size:11px">HECHO</th>
          <th style="padding:10px 12px;text-align:right;font-weight:700;font-size:11px">VALOR PROD.</th>
        </tr>
      </thead>
      <tbody>`;

  rows.forEach(r => {
    html += `
        <tr style="border-top:1px solid var(--border)">
          <td style="padding:12px 12px 4px"><div style="font-weight:700">${r.op.charAt(0)+r.op.slice(1).toLowerCase()}</div></td>
          <td style="padding:12px 8px 4px;text-align:center;color:var(--text2)">${r.planPedidos}</td>
          <td style="padding:12px 8px 4px;text-align:center;font-weight:700;color:${barColor(r.pct)}">${r.prodPedidos}</td>
          <td style="padding:12px 12px 4px;text-align:right;color:var(--gold);font-weight:600">${fmt(r.prodValor)}</td>
        </tr>
        <tr style="border-bottom:1px solid var(--border)">
          <td colspan="4" style="padding:4px 12px 10px">
            <div style="display:flex;align-items:center;gap:8px">
              <div style="flex:1;height:5px;background:var(--border);border-radius:3px">
                <div style="width:${r.pct}%;height:5px;background:${barColor(r.pct)};border-radius:3px"></div>
              </div>
              <span style="font-size:11px;font-weight:700;color:${barColor(r.pct)};width:32px;text-align:right">${r.pct}%</span>
            </div>
          </td>
        </tr>`;
  });

  html += `
        <tr style="border-top:2px solid var(--border);background:var(--bg3)">
          <td style="padding:12px 12px;font-weight:800">TOTAL</td>
          <td style="padding:12px 8px;text-align:center;font-weight:700;color:var(--text2)">${tot.planPedidos}</td>
          <td style="padding:12px 8px;text-align:center;font-weight:800;color:${barColor(totPct)}">${tot.prodPedidos}</td>
          <td style="padding:12px 12px;text-align:right;font-weight:800;color:var(--gold)">${fmt(tot.prodValor)}</td>
        </tr>
        <tr style="background:var(--bg3)">
          <td colspan="4" style="padding:4px 12px 12px">
            <div style="display:flex;align-items:center;gap:8px">
              <div style="flex:1;height:6px;background:var(--border);border-radius:3px">
                <div style="width:${totPct}%;height:6px;background:${barColor(totPct)};border-radius:3px"></div>
              </div>
              <span style="font-size:12px;font-weight:800;color:${barColor(totPct)};width:32px;text-align:right">${totPct}%</span>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>`;

  return html;
}

// ── PRODUCCION ──
let produccionTab = 'produccion';

const tabsHTML = () => `<div style="display:flex;gap:8px;margin-bottom:16px">
  <div onclick="window.switchProdTab('produccion')" style="flex:1;text-align:center;padding:10px;border-radius:12px;cursor:pointer;font-weight:700;font-size:13px;background:${produccionTab==='produccion'?'var(--beige)':'var(--bg2)'};color:${produccionTab==='produccion'?'#1e1c1b':'var(--text2)'};border:1.5px solid ${produccionTab==='produccion'?'var(--beige)':'var(--border)'}">🪑 Producción</div>
  <div onclick="window.switchProdTab('presentismo')" style="flex:1;text-align:center;padding:10px;border-radius:12px;cursor:pointer;font-weight:700;font-size:13px;background:${produccionTab==='presentismo'?'var(--beige)':'var(--bg2)'};color:${produccionTab==='presentismo'?'#1e1c1b':'var(--text2)'};border:1.5px solid ${produccionTab==='presentismo'?'var(--beige)':'var(--border)'}">📋 Presentismo</div>
</div>`;

window.switchProdTab = function(tab) {
  produccionTab = tab;
  if (tab === 'presentismo') fetchPresentismoFromSheets();
  else renderProduccion();
};

async function fetchProduccionFromSheets() {
  $('view-produccion').innerHTML = '<div class="content" style="text-align:center;padding:40px;color:var(--text2)">Actualizando producción...</div>';
  try {
    const res = await fetch(PRODUCCION_SHEETS_URL);
    APP_DATA.produccion = await res.json();
  } catch(e) {
    $('view-produccion').innerHTML = '<div class="content" style="text-align:center;padding:40px;color:var(--red)">Error al cargar producción. Revisá la conexión.</div>';
    return;
  }
  produccionTab = 'produccion';
  renderProduccion();
}

async function fetchPresentismoFromSheets() {
  $('view-produccion').innerHTML = '<div class="content" style="text-align:center;padding:40px;color:var(--text2)">Cargando presentismo...</div>';
  try {
    const res = await fetch(PRESENTISMO_SHEETS_URL);
    APP_DATA.presentismo = await res.json();
  } catch(e) {
    APP_DATA.presentismo = [];
  }
  renderPresentismo();
}

function renderPresentismo() {
  const todos = APP_DATA.presentismo || [];
  const opList = ['AGUSTIN','FRANCISCO','LUIS','NICOLAS'];
  const ops = todos.filter(e => opList.includes((e.nombre||'').toUpperCase()));
  const estadoColor = { presente:'var(--green)', falta:'var(--red)', feriado:'var(--yellow)', vacaciones:'var(--blue)', finde:'var(--border)' };

  let totalP = 0, totalF = 0;
  ops.forEach(o => { totalP += o.presente||0; totalF += o.faltas||0; });

  let html = tabsHTML();
  html += `<div class="kpi-grid" style="margin-bottom:14px">
    <div class="kpi-card"><div class="kpi-label" style="color:var(--green)">Asistencias</div><div class="kpi-value" style="color:var(--green)">${totalP}</div></div>
    <div class="kpi-card"><div class="kpi-label" style="color:var(--red)">Faltas</div><div class="kpi-value" style="color:var(--red)">${totalF}</div></div>
  </div>`;

  ops.forEach(op => {
    const tot = (op.presente||0) + (op.faltas||0);
    const pct = tot > 0 ? Math.round(((op.presente||0)/tot)*100) : 100;
    const barC = pct>=90?'var(--green)':pct>=75?'var(--yellow)':'var(--red)';
    html += `<div class="card" style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div><div style="font-weight:700;font-size:15px">${op.nombre.charAt(0)+op.nombre.slice(1).toLowerCase()}</div>
        <div style="font-size:12px;color:var(--text2);margin-top:2px">${op.presente||0} presentes · <span style="color:var(--red)">${op.faltas||0} faltas</span></div></div>
        <div style="font-size:20px;font-weight:800;color:${barC}">${pct}%</div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:3px;margin-bottom:8px">`;
    (op.dias||[]).forEach(d => {
      if (d.estado==='finde') return;
      const c = estadoColor[d.estado]||'var(--border)';
      html += `<div style="width:26px;height:26px;border-radius:5px;background:${c};display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:#fff">${d.dia}</div>`;
    });
    html += `</div><div style="height:5px;background:var(--border);border-radius:3px">
      <div style="width:${pct}%;height:5px;background:${barC};border-radius:3px"></div></div></div>`;
  });

  html += `<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">
    <div style="display:flex;align-items:center;gap:5px"><div style="width:12px;height:12px;border-radius:3px;background:var(--green)"></div><span style="font-size:11px;color:var(--text2)">Presente</span></div>
    <div style="display:flex;align-items:center;gap:5px"><div style="width:12px;height:12px;border-radius:3px;background:var(--red)"></div><span style="font-size:11px;color:var(--text2)">Falta</span></div>
    <div style="display:flex;align-items:center;gap:5px"><div style="width:12px;height:12px;border-radius:3px;background:var(--yellow)"></div><span style="font-size:11px;color:var(--text2)">Feriado</span></div>
    <div style="display:flex;align-items:center;gap:5px"><div style="width:12px;height:12px;border-radius:3px;background:var(--blue)"></div><span style="font-size:11px;color:var(--text2)">Vacaciones</span></div>
  </div>`;

  $('view-produccion').innerHTML = '<div class="content">' + html + '</div>';
}

function renderProduccion() {
  const semanas = Object.keys(APP_DATA.produccion);
  const opList  = ['AGUSTIN', 'FRANCIS', 'LUIS', 'NICOLAS'];
  const showBtns = currentUser.rol === 'produccion' || currentUser.rol === 'director';

  // Todos los pedidos del mes
  const todos = [];
  semanas.forEach(sem => {
    opList.forEach(op => {
      (APP_DATA.produccion[sem][op] || []).forEach((p, idx) => {
        todos.push({ ...p, sem, op, idx });
      });
    });
  });

  const todosDedup  = deduplicar(todos);
  const enProcesoAll = todosDedup.filter(p => p.estado === 'en_proceso');
  const fundaAll     = todosDedup.filter(p => p.estado === 'funda');
  const terminadoAll = todosDedup.filter(p => p.estado === 'terminado');
  const hechos       = [...fundaAll, ...terminadoAll];

  const pctAvance = todosDedup.length > 0 ? Math.round((hechos.length / todosDedup.length) * 100) : 0;
  const barC = pctAvance >= 70 ? 'var(--green)' : pctAvance >= 40 ? 'var(--yellow)' : 'var(--red)';
  const fmt = v => v >= 1000000 ? '$' + (v/1000000).toFixed(1) + 'M' : v > 0 ? '$' + (v/1000).toFixed(0) + 'k' : '-';

  const pedidoRow = (p, color, btns) => `
    <div class="pedido-row">
      <div class="pedido-dot" style="background:${color}"></div>
      <div class="pedido-info">
        <div class="pedido-cliente">${p.cliente}</div>
        <div class="pedido-modelo">${p.modelo}${p.oc ? ' · OC ' + p.oc : ''} <span style="color:var(--text2);font-size:11px">· ${p.op.charAt(0)+p.op.slice(1).toLowerCase()}</span></div>
        ${btns ? `<div class="estado-btns">
          <button class="estado-btn ${p.estado==='en_proceso'?'active-prod':''}" onclick="cambiarEstadoUnif('${p.sem}','${p.op}',${p.idx},'en_proceso')">EN PROCESO</button>
          <button class="estado-btn ${p.estado==='funda'?'active-listo':''}" onclick="cambiarEstadoUnif('${p.sem}','${p.op}',${p.idx},'funda')">FUNDA ✓</button>
          <button class="estado-btn ${p.estado==='terminado'?'active-entregado':''}" onclick="cambiarEstadoUnif('${p.sem}','${p.op}',${p.idx},'terminado')">TERMINADO</button>
        </div>` : ''}
      </div>
      <div class="pedido-valor">${fmt(p.valor)}</div>
    </div>`;

  let html = tabsHTML() + buildTablaResumen();

  // Barra de avance global
  html += `
  <div class="card" style="margin-bottom:16px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <div style="font-size:15px;font-weight:700">Avance del mes</div>
      <div style="font-size:22px;font-weight:800;color:${barC}">${pctAvance}%</div>
    </div>
    <div class="progress-bar" style="height:8px;margin-bottom:12px">
      <div class="progress-fill" style="width:${pctAvance}%;background:${barC}"></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;text-align:center">
      <div><div style="font-size:11px;color:var(--text2);margin-bottom:2px">TERMINADOS</div><div style="font-weight:800;color:var(--blue)">${hechos.length}</div></div>
      <div><div style="font-size:11px;color:var(--text2);margin-bottom:2px">EN PROCESO</div><div style="font-weight:800;color:var(--yellow)">${enProcesoAll.length}</div></div>
      <div><div style="font-size:11px;color:var(--text2);margin-bottom:2px">TOTAL MES</div><div style="font-weight:800">${todosDedup.length}</div></div>
    </div>
  </div>`;

  // EN PROCESO
  if (enProcesoAll.length > 0) {
    html += `<div class="section-title" style="color:var(--yellow)">EN PROCESO (${enProcesoAll.length})</div><div class="card">`;
    enProcesoAll.forEach(p => { html += pedidoRow(p, 'var(--yellow)', showBtns); });
    html += '</div>';
  }

  // FUNDA
  if (fundaAll.length > 0) {
    html += `<div class="section-title" style="color:var(--green)">FUNDA (${fundaAll.length})</div><div class="card">`;
    fundaAll.forEach(p => { html += pedidoRow(p, 'var(--green)', showBtns); });
    html += '</div>';
  }

  // TERMINADO
  if (terminadoAll.length > 0) {
    html += `<div class="section-title" style="color:var(--blue)">TERMINADOS (${terminadoAll.length})</div><div class="card">`;
    terminadoAll.forEach(p => { html += pedidoRow(p, 'var(--blue)', showBtns); });
    html += '</div>';
  }

  // Desglose colapsable
  html += `
  <div style="margin-top:8px;margin-bottom:4px">
    <button onclick="toggleDesglose()" style="width:100%;background:var(--bg2);border:1.5px solid var(--border);border-radius:12px;padding:12px 16px;color:var(--text2);font-size:13px;font-weight:600;cursor:pointer;display:flex;justify-content:space-between;align-items:center">
      <span>Ver desglose por semana y operario</span>
      <span>${desglosOpen ? '▲' : '▼'}</span>
    </button>
  </div>
  <div id="desglose-panel" style="display:${desglosOpen ? 'block' : 'none'}">`;

  html += '<div class="week-tabs" style="margin-top:12px">';
  semanas.forEach(sem => {
    html += `<div class="week-tab ${sem === selectedWeek ? 'active' : ''}" onclick="selectWeek('${sem}')">${sem}</div>`;
  });
  html += '</div><div class="op-tabs">';
  opList.forEach(op => {
    html += `<div class="op-tab ${op === selectedOp ? 'active' : ''}" onclick="selectOp('${op}')">${op.charAt(0)+op.slice(1).toLowerCase()}</div>`;
  });
  html += '</div>';

  const pedidosSem = (APP_DATA.produccion[selectedWeek] || {})[selectedOp] || [];
  if (pedidosSem.length === 0) {
    html += '<div class="empty">Sin pedidos esta semana</div>';
  } else {
    [
      [pedidosSem.filter(p => p.estado === 'en_proceso'), 'EN PROCESO', 'var(--yellow)'],
      [pedidosSem.filter(p => p.estado === 'funda'),      'FUNDA',      'var(--green)'],
      [pedidosSem.filter(p => p.estado === 'terminado'),  'TERMINADOS', 'var(--blue)'],
    ].forEach(([arr, label, color]) => {
      if (!arr.length) return;
      html += `<div class="section-title" style="color:${color}">${label} (${arr.length})</div><div class="card">`;
      arr.forEach(p => {
        const idx = (APP_DATA.produccion[selectedWeek][selectedOp] || []).indexOf(p);
        html += pedidoRow({ ...p, sem: selectedWeek, op: selectedOp, idx }, color, showBtns);
      });
      html += '</div>';
    });
  }

  html += '</div>';
  $('view-produccion').innerHTML = '<div class="content">' + html + '</div>';
}

window.toggleDesglose = function() {
  desglosOpen = !desglosOpen;
  renderProduccion();
  if (desglosOpen) setTimeout(() => {
    const p = document.getElementById('desglose-panel');
    if (p) p.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 50);
};

window.selectWeek = function(sem) { selectedWeek = sem; renderProduccion(); };
window.selectOp   = function(op)  { selectedOp = op;   renderProduccion(); };

window.cambiarEstadoUnif = function(sem, op, idx, estado) {
  APP_DATA.produccion[sem][op][idx].estado = estado;
  renderProduccion();
};

// ── TELAS ──
// 🔴 ROJO  = no pedido
// 🟡 AMARILLO = pedido, esperando que llegue
// 🟣 VIOLETA = no hay stock
// 🟢 VERDE = llegó (archivado)
function renderTelas() {
  const telas        = APP_DATA.telas;
  const noPedido     = telas.filter(t => !t.pedido && !t.llego && !t.noStock);
  const pedidoEspera = telas.filter(t => t.pedido && !t.llego && !t.noStock);
  const noStock      = telas.filter(t => t.noStock && !t.llego);
  const llegaron     = telas.filter(t => t.llego);
  const canToggle    = currentUser.rol === 'logistica' || currentUser.rol === 'director';

  const C = {
    rojo:    'var(--red)',
    amarillo:'var(--yellow)',
    violeta: '#a78bfa',
    verde:   'var(--green)',
  };

  let html = `
    <div class="kpi-grid" style="margin-bottom:14px">
      <div class="kpi-card"><div class="kpi-label" style="color:${C.rojo}">No pedido</div><div class="kpi-value" style="color:${C.rojo}">${noPedido.length}</div></div>
      <div class="kpi-card"><div class="kpi-label" style="color:${C.amarillo}">Pedido</div><div class="kpi-value" style="color:${C.amarillo}">${pedidoEspera.length}</div></div>
      <div class="kpi-card"><div class="kpi-label" style="color:${C.violeta}">Sin stock</div><div class="kpi-value" style="color:${C.violeta}">${noStock.length}</div></div>
      <div class="kpi-card"><div class="kpi-label" style="color:${C.verde}">Llego</div><div class="kpi-value" style="color:${C.verde}">${llegaron.length}</div></div>
    </div>`;

  const renderGrupo = (arr, titulo, color, archivado) => {
    if (!arr.length) return '';
    let h = `<div class="section-title" style="color:${color}">${titulo} (${arr.length})</div>`;
    h += `<div class="card" style="${archivado ? 'opacity:0.5' : ''}">`;
    arr.forEach(t => {
      const idx = telas.indexOf(t);
      const btnPedido  = `border-color:${C.amarillo};color:${C.amarillo};background:rgba(251,191,36,0.15)`;
      const btnNoStock = `border-color:${C.violeta};color:${C.violeta};background:rgba(167,139,250,0.15)`;
      const btnLlego   = `border-color:${C.verde};color:${C.verde};background:rgba(52,211,153,0.15)`;
      h += `<div class="tela-row">
        <div class="pedido-dot" style="background:${color};flex-shrink:0;width:10px;height:10px;border-radius:50%"></div>
        <div class="tela-info">
          <div class="tela-nombre">${t.cliente}${t.orden ? ' · #' + t.orden : ''}</div>
          <div class="tela-detalle">${t.tela}${t.prov ? ' <span style="color:var(--text2);font-size:10px">· ' + t.prov + '</span>' : ''}</div>
          ${canToggle ? `<div class="estado-btns" style="margin-top:6px">
            <button class="estado-btn" style="${t.pedido && !t.llego ? btnPedido : ''}" onclick="toggleTela(${idx},'pedido')">Pedido</button>
            <button class="estado-btn" style="${t.noStock && !t.llego ? btnNoStock : ''}" onclick="toggleTela(${idx},'noStock')">Sin stock</button>
            <button class="estado-btn" style="${t.llego ? btnLlego : ''}" onclick="toggleTela(${idx},'llego')">Llego ✓</button>
          </div>` : ''}
        </div>
        <div class="tela-metros">${t.metros ? t.metros + 'm' : ''}</div>
      </div>`;
    });
    h += '</div>';
    return h;
  };

  html += renderGrupo(noPedido,     'NO PEDIDO',              C.rojo,    false);
  html += renderGrupo(pedidoEspera, 'PEDIDO — FALTA LLEGAR',  C.amarillo,false);
  html += renderGrupo(noStock,      'SIN STOCK',              C.violeta, false);
  html += renderGrupo(llegaron,     'LLEGO',                  C.verde,   true);

  $('view-telas').innerHTML = '<div class="content">' + html + '</div>';
}

function telaKey(t) { return (t.orden || '') + '|' + t.tela; }

function saveTelasState() {
  const state = {};
  APP_DATA.telas.forEach(t => {
    state[telaKey(t)] = { pedido: t.pedido, llego: t.llego, noStock: t.noStock };
  });
  localStorage.setItem('impronta_telas_v2', JSON.stringify(state));
}

function loadTelasState() {
  const saved = localStorage.getItem('impronta_telas_v2');
  if (!saved) return;
  try {
    const state = JSON.parse(saved);
    APP_DATA.telas.forEach(t => {
      const s = state[telaKey(t)];
      if (s) {
        t.pedido  = s.pedido  || false;
        t.llego   = s.llego   || false;
        t.noStock = s.noStock || false;
      }
    });
  } catch(e) {}
}

window.toggleTela = function(idx, campo) {
  const t = APP_DATA.telas[idx];
  if (campo === 'llego' && !t.llego) {
    t.pedido  = false;
    t.noStock = false;
  }
  if (campo === 'pedido' && !t.pedido) {
    t.noStock = false;
  }
  if (campo === 'noStock' && !t.noStock) {
    t.pedido = false;
    t.llego  = false;
  }
  t[campo] = !t[campo];
  saveTelasState();
  renderTelas();
};

// ── LOGÍSTICA ──
async function fetchLogisticaFromSheets() {
  $('view-logistica').innerHTML = '<div class="content" style="text-align:center;padding:40px;color:var(--text2)">Actualizando tareas...</div>';
  try {
    const res = await fetch(LOGISTICA_SHEETS_URL);
    const rows = await res.json();
    const saved = JSON.parse(localStorage.getItem('impronta_tareas') || '[]');
    APP_DATA.tareas = rows.map((r, i) => {
      const key = r.fecha + '|' + r.tarea;
      const s = saved.find(x => x.key === key);
      return {
        id: i + 1,
        fecha:       r.fecha,
        horario:     r.horario,
        tarea:       r.tarea,
        direccion:   r.direccion,
        contacto:    r.contacto,
        observacion: r.observacion,
        hecho:       s ? s.hecho : false,
      };
    });
    renderLogistica();
  } catch(e) {
    $('view-logistica').innerHTML = '<div class="content" style="text-align:center;padding:40px;color:var(--red)">Error al cargar tareas. Revisá la conexión.</div>';
  }
}


function renderLogistica() {
  const tareas = APP_DATA.tareas;
  const canToggle = currentUser.rol === 'logistica' || currentUser.rol === 'director';

  // Agrupar por fecha
  const porFecha = {};
  tareas.forEach(t => {
    if (!porFecha[t.fecha]) porFecha[t.fecha] = [];
    porFecha[t.fecha].push(t);
  });

  const hechas  = tareas.filter(t => t.hecho).length;
  const total   = tareas.length;
  const pct     = total ? Math.round(hechas / total * 100) : 0;

  let html = `
    <div class="content">
      <div class="kpi-grid" style="margin-bottom:14px">
        <div class="kpi-card"><div class="kpi-label" style="color:var(--green)">Completadas</div><div class="kpi-value" style="color:var(--green)">${hechas}</div></div>
        <div class="kpi-card"><div class="kpi-label" style="color:var(--text2)">Pendientes</div><div class="kpi-value">${total - hechas}</div></div>
        <div class="kpi-card"><div class="kpi-label" style="color:var(--gold)">Total</div><div class="kpi-value" style="color:var(--gold)">${total}</div></div>
      </div>
      <div class="card" style="margin-bottom:14px;padding:12px 16px">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px">
          <span style="color:var(--text2);font-size:12px">AVANCE DEL DÍA</span>
          <span style="color:var(--green);font-weight:700">${pct}%</span>
        </div>
        <div style="background:var(--bg3);border-radius:4px;height:6px">
          <div style="background:var(--green);width:${pct}%;height:6px;border-radius:4px;transition:width .3s"></div>
        </div>
      </div>`;

  Object.entries(porFecha).forEach(([fecha, items]) => {
    html += `<div class="section-title">${fecha}</div><div class="card">`;
    items.forEach(t => {
      const idx = tareas.indexOf(t);
      html += `<div onclick="${canToggle ? `toggleTarea(${idx})` : ''}" style="
        padding:12px 0;
        border-bottom:1px solid var(--border);
        cursor:${canToggle ? 'pointer' : 'default'};
        background:${t.hecho ? 'rgba(52,211,153,0.08)' : 'transparent'};
        border-radius:6px;
        padding:12px 8px;
        margin-bottom:4px;
      ">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="
            width:22px;height:22px;border-radius:50%;flex-shrink:0;
            border:2px solid ${t.hecho ? 'var(--green)' : 'var(--border)'};
            background:${t.hecho ? 'var(--green)' : 'transparent'};
            display:flex;align-items:center;justify-content:center;
            font-size:12px;
          ">${t.hecho ? '✓' : ''}</div>
          <div style="flex:1">
            <div style="font-weight:600;color:${t.hecho ? 'var(--green)' : 'var(--text)'};${t.hecho ? 'text-decoration:line-through;opacity:0.7' : ''}">${t.tarea}</div>
            ${t.horario ? `<div style="font-size:11px;color:var(--gold);margin-top:2px">🕐 ${t.horario}</div>` : ''}
            ${t.hecho && t.horaHecho ? `<div style="font-size:11px;color:var(--green);margin-top:2px">✓ Completado a las ${t.horaHecho}</div>` : ''}
            ${t.direccion ? `<div style="font-size:11px;color:var(--text2);margin-top:2px">📍 ${t.direccion}</div>` : ''}
            ${t.contacto && t.contacto !== '-' ? `<div style="font-size:11px;color:var(--text2);margin-top:2px">📞 ${t.contacto}</div>` : ''}
            ${t.observacion ? `<div style="font-size:11px;color:var(--text2);margin-top:2px">📝 ${t.observacion}</div>` : ''}
          </div>
        </div>
      </div>`;
    });
    html += '</div>';
  });

  html += '</div>';
  $('view-logistica').innerHTML = html;
}

window.toggleTarea = function(idx) {
  const t = APP_DATA.tareas[idx];
  t.hecho = !t.hecho;
  if (t.hecho) {
    const now = new Date();
    t.horaHecho = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0');
  } else {
    t.horaHecho = null;
  }
  localStorage.setItem('impronta_tareas', JSON.stringify(APP_DATA.tareas.map(t => ({ key: t.fecha + '|' + t.tarea, hecho: t.hecho, horaHecho: t.horaHecho || null }))));
  renderLogistica();
};

// ── CHAT ──
function renderChat() {
  const rolColors = {
    director:   'var(--gold)',
    produccion: 'var(--yellow)',
    logistica:  'var(--blue)',
  };

  let html = '<div class="chat-messages" id="chat-list">';
  chatMessages.forEach(m => {
    const isMe = m.rol === currentUser.rol;
    html += `<div class="msg ${isMe ? 'mine' : 'other'}">
      ${!isMe ? `<div style="font-size:11px;color:${rolColors[m.rol]||'#888'};margin-bottom:3px;padding-left:4px">${m.nombre}</div>` : ''}
      <div class="msg-bubble">${m.texto}</div>
      <div class="msg-meta">${m.hora}</div>
    </div>`;
  });
  html += '</div>';
  html += `<div class="chat-input-wrap">
    <input class="chat-input" id="chat-input" type="text" placeholder="Escribir mensaje...">
    <button class="chat-send" onclick="sendMsg()">↑</button>
  </div>`;

  $('view-chat').innerHTML = '<div class="content" style="padding-bottom:130px">' + html + '</div>';

  const input = $('chat-input');
  if (input) input.addEventListener('keydown', e => { if (e.key === 'Enter') sendMsg(); });

  setTimeout(() => {
    const content = $('view-chat').querySelector('.content');
    if (content) content.scrollTop = content.scrollHeight;
  }, 50);
}

window.sendMsg = function() {
  const input = $('chat-input');
  if (!input || !input.value.trim()) return;
  const now  = new Date();
  const hora = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0');
  chatMessages.push({ id: Date.now(), rol: currentUser.rol, nombre: currentUser.nombre, texto: input.value.trim(), hora });
  localStorage.setItem('impronta_chat', JSON.stringify(chatMessages));
  input.value = '';
  renderChat();
};

// ── PULL TO REFRESH ──
(function() {
  let startY = 0, pulling = false;
  document.addEventListener('touchstart', e => {
    startY = e.touches[0].clientY;
    pulling = true;
  }, { passive: true });
  document.addEventListener('touchend', e => {
    if (!pulling) return;
    const dy = e.changedTouches[0].clientY - startY;
    if (dy > 80 && currentUser) {
      const el = document.querySelector('.view:not(.hidden)');
      if (el) {
        const scrollTop = el.querySelector('.content') ? el.querySelector('.content').scrollTop : el.scrollTop;
        if (scrollTop <= 0) renderView(currentView);
      }
    }
    pulling = false;
  }, { passive: true });
})();

// ── INIT ──
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
showScreen('login');
