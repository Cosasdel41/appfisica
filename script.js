const STATE_KEY = 'fisica_avance_v3';

let materias = [];
fetch('materias.json')
  .then(r => r.json())
  .then(data => {
    materias = data.materias.sort((a,b)=>a.id-b.id);
    init();
  });

function loadState(){
  try{
    return JSON.parse(localStorage.getItem(STATE_KEY)) || {aprobadas:{}, cursadas:{}};
  }catch(e){
    return {aprobadas:{}, cursadas:{}};
  }
}
function saveState(st){ localStorage.setItem(STATE_KEY, JSON.stringify(st)); }

function init(){
  if ('serviceWorker' in navigator){ navigator.serviceWorker.register('sw.js'); }
  setupModal();
  setupBuscador();
  setupCollapsibles();
  setupExportImport();
  renderProgreso();
  renderChecklist();
  renderMatriz();
}

/* =======================
   PROMEDIO AUTOMÁTICO
   ======================= */
function calcularPromedio(state){
  const notas = Object.values(state.aprobadas || {})
    .map(r => Number(r.nota))
    .filter(n => !Number.isNaN(n));

  if(notas.length === 0) return null;
  return notas.reduce((a,b)=>a+b,0) / notas.length;
}

function setupModal(){
  const dlg = document.getElementById('modal');
  document.getElementById('modal-close').onclick = ()=> dlg.close();
}

// === Reglas de aprobación ===
function passThreshold(m){
  const fmt = (m.formato || '').toLowerCase();
  return fmt.includes('asignatura') ? 4 : 7;
}
function isAprobada(m, state){
  const reg = state.aprobadas[m.id];
  if(!reg) return false;
  const nota = Number(reg.nota);
  return !Number.isNaN(nota) && nota >= passThreshold(m);
}
function hasCursada(m, state){
  return !!state.cursadas[m.id] || isAprobada(m, state);
}

// === Buscador ===
function setupBuscador(){
  const input = document.getElementById('search');
  const ul = document.getElementById('search-results');
  input.addEventListener('input', ()=>{
    const q = input.value.trim().toLowerCase();
    ul.innerHTML='';
    if(!q) return;
    materias.filter(m => m.nombre.toLowerCase().includes(q)).slice(0,10).forEach(m => {
      const li = document.createElement('li');
      li.textContent = `${m.id}. ${m.nombre}`;
      li.onclick = ()=>{
        const el = document.querySelector(`[data-card-id="${m.id}"]`);
        if(el){ el.scrollIntoView({behavior:'smooth',block:'center'}); el.classList.add('pulse'); setTimeout(()=>el.classList.remove('pulse'),800); }
      };
      ul.appendChild(li);
    });
  });
}

// === Correlatividades ===
function isHabilitada(m, state){
  const haveApproved = id => {
    const mm = materias.find(x=>x.id===id);
    return mm ? isAprobada(mm, state) : false;
  };
  const haveCursada = id => {
    const mm = materias.find(x=>x.id===id);
    return mm ? hasCursada(mm, state) : false;
  };
  const allC = arr => arr.every(x => typeof x==='number' ? haveCursada(x) : x?.anyOf?.some(id=>haveCursada(id)) ?? true);
  const allA = arr => arr.every(x => typeof x==='number' ? haveApproved(x) : x?.anyOf?.some(id=>haveApproved(id)) ?? true);

  return allC(m.prerrequisitos.requiresCursada||[]) && allA(m.prerrequisitos.requiresAcreditar||[]);
}
function statusDeMateria(m, state){
  if (isAprobada(m, state)) return {tipo:'APROBADA', clase:'aprobada'};
  return isHabilitada(m, state) ? {tipo:'HABILITADA', clase:'habilitada'} : {tipo:'BLOQUEADA', clase:'bloqueada'};
}

// === Checklist ===
function renderChecklist(){
  const cont = document.getElementById('checklist');
  const state = loadState();
  cont.innerHTML = '';
  materias.forEach(m => {
    const st = statusDeMateria(m, state);
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.cardId = m.id;

    const head = document.createElement('div');
    head.className = 'card-header';
    head.innerHTML = `<div class="card-title">${m.id}. ${m.nombre}</div><span class="badge ${st.clase}">${st.tipo}</span>`;

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = `Año: ${m.anio} • Régimen: ${m.regimen} • Formato: ${m.formato}`;

    const row = document.createElement('div'); row.className='row';

    const chk = document.createElement('input'); chk.type='checkbox'; chk.checked=!!state.cursadas[m.id]; chk.id=`cursada-${m.id}`;
    const lbl = document.createElement('label'); lbl.htmlFor=chk.id; lbl.textContent='Cursada';
    chk.onchange=()=>{ const s=loadState(); chk.checked? s.cursadas[m.id]=true : delete s.cursadas[m.id]; saveState(s); renderChecklist(); renderMatriz(); renderProgreso(); };

    const input = document.createElement('input'); input.type='number'; input.min='0'; input.max='10'; input.step='0.1'; input.placeholder='Nota'; input.className='input-nota'; input.value=state.aprobadas[m.id]?.nota ?? '';
    const btn = document.createElement('button'); btn.className='btn'; btn.textContent='Guardar nota';
    btn.onclick=()=>{ const n=parseFloat(input.value); const s=loadState(); if(!Number.isNaN(n)){ s.aprobadas[m.id]??={}; s.aprobadas[m.id].nota=n; } else delete s.aprobadas[m.id]; saveState(s); renderChecklist(); renderMatriz(); renderProgreso(); };

    const um = document.createElement('div'); um.className='meta'; um.textContent=`Aprueba con ≥ ${passThreshold(m)}`;

    row.append(chk,lbl,input,btn);
    card.append(head,meta,row,um);
    cont.appendChild(card);
  });
}

// === Matriz ===
function renderMatriz(){
  const grid = document.getElementById('matriz');
  const state = loadState();
  grid.innerHTML='';
  materias.forEach(m => {
    const st = statusDeMateria(m, state);
    const box = document.createElement('div');
    box.className = `materia-box ${st.clase}`;
    const nota = state.aprobadas[m.id]?.nota;
    const notaTxt = nota!==undefined && nota!=='' ? ` • Nota: ${nota}` : '';
    box.innerHTML = `<div class="nombre">${m.id}. ${m.nombre}</div><div class="detalle">Año ${m.anio} • ${m.regimen} • ${m.formato}${notaTxt}</div>`;
    grid.appendChild(box);
  });
}

// === Progreso ===
function renderProgreso(){
  const state = loadState();
  const total = materias.length;
  const aprobadas = Object.keys(state.aprobadas).filter(id=>{
    const m = materias.find(x=>x.id===Number(id));
    return m && isAprobada(m,state);
  }).length;
  const porcentaje = total ? Math.round((aprobadas/total)*100) : 0;

  const topline = document.getElementById('progreso-topline');
  if(topline){
    const curs = Object.keys(state.cursadas||{}).length;
    const prom = calcularPromedio(state);
    const promTxt = prom!==null ? ` • Promedio: ${prom.toFixed(2)}` : '';
    topline.textContent = `Aprobadas: ${aprobadas}/${total} (${porcentaje}%) • Cursadas: ${curs}${promTxt}`;
  }

  const fill = document.getElementById('progress-fill');
  if(fill) fill.style.width = porcentaje+'%';

  const nota = document.getElementById('progreso-nota');
  if(nota){
    nota.textContent = porcentaje===100 ? 'Felicitaciones, podes anotarte en el 108 A'
      : porcentaje>=75 ? 'Podes anotarte en el listado 108 b Item 4'
      : porcentaje>=50 ? 'Podes anotarte en el listado 108 b Item 5'
      : porcentaje>25 ? 'Podes anotarte en el listado de Emergencia'
      : 'Seguí sumando materias para habilitar listados.';
  }
}

// === Colapsables ===
function setupCollapsibles(){
  document.querySelectorAll('.collapse-toggle').forEach(btn=>{
    const panel=document.getElementById(btn.dataset.target);
    btn.onclick=()=>{ panel.classList.toggle('collapsed'); btn.textContent=btn.textContent.includes('▾')?btn.textContent.replace('▾','▸'):btn.textContent.replace('▸','▾'); };
  });
}

// === Export / Import ===
function setupExportImport(){
  const btnExp=document.getElementById('exportar-estado');
  const btnImp=document.getElementById('importar-estado');
  const inputFile=document.getElementById('import-file');

  if(btnExp){ btnExp.onclick=()=>{
    const payload={version:1,exportedAt:new Date().toISOString(),appKey:STATE_KEY,totalMaterias:materias.length,state:loadState()};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='progreso-profesorado-fisica.json'; document.body.appendChild(a); a.click(); a.remove();
  }; }

  if(btnImp&&inputFile){ btnImp.onclick=()=>inputFile.click(); inputFile.onchange=async()=>{
    try{ const data=JSON.parse(await inputFile.files[0].text()); if(!data?.state) throw 0; localStorage.setItem(STATE_KEY,JSON.stringify(data.state)); renderChecklist(); renderMatriz(); renderProgreso(); alert('Estado importado correctamente.'); }
    catch{ alert('Archivo inválido.'); }
    finally{ inputFile.value=''; }
  }; }
}
