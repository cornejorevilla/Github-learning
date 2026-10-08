// N-body Solar System simulation (AU, years, solar masses)
function showErrorOverlay(msg){
  try{
    let el = document.getElementById('__sim_error_overlay');
    if(!el){ el = document.createElement('div'); el.id='__sim_error_overlay'; document.body.appendChild(el); }
    el.style.position='fixed'; el.style.left='12px'; el.style.right='12px'; el.style.top='12px'; el.style.zIndex=9999;
    el.style.background='rgba(255,40,40,0.95)'; el.style.color='white'; el.style.padding='10px'; el.style.borderRadius='6px'; el.style.fontFamily='sans-serif';
    el.textContent = 'Simulation error: ' + msg;
  }catch(e){ console.error('Failed to show overlay', e); }
}

const canvas = document.getElementById('c');
if(!canvas){ showErrorOverlay('Canvas element with id="c" not found.'); throw new Error('Canvas element not found'); }
const ctx = canvas.getContext('2d');
if(!ctx){ showErrorOverlay('Canvas 2D context not available in this browser.'); throw new Error('Canvas context unavailable'); }

window.addEventListener('error', ev=>{ showErrorOverlay(ev.message + ' — ' + ev.filename + ':' + ev.lineno); });
window.addEventListener('unhandledrejection', ev=>{ showErrorOverlay('Unhandled promise rejection: ' + (ev.reason && ev.reason.toString ? ev.reason.toString() : String(ev.reason))); });
function resize(){ canvas.width = innerWidth; canvas.height = innerHeight }
addEventListener('resize', resize); resize();

const G = 4*Math.PI*Math.PI; // AU^3 / (yr^2 * solarMass)

function makeSolarSystem(){
  const sun = { name:'Sun', m:1.0, x:0, y:0, vx:0, vy:0, r:0.5, color:'#ffdd99', trail:[] };
  const planets = [
    ['Mercury',0.00000017,0.387,0.0,0,0,'#aaa',0.02],
    ['Venus',0.00000245,0.723,0.0,0,0,'#f4a460',0.05],
    ['Earth',0.000003003,1.0,0.0,0,0,'#4aa3ff',0.05],
    ['Mars',0.00000032,1.524,0.0,0,0,'#ff7f4d',0.04],
    ['Jupiter',0.0009543,5.203,0.0,0,0,'#ffcc99',0.12],
    ['Saturn',0.0002857,9.537,0.0,0,0,'#ffe0b2',0.1],
    ['Uranus',0.0000436,19.191,0.0,0,0,'#b2eeff',0.08],
    ['Neptune',0.0000515,30.07,0.0,0,0,'#6b8cff',0.08]
  ].map(p=>({name:p[0],m:p[1],x:p[2],y:p[3],vx:0,vy:Math.sqrt(G* (sun.m + p[1]) / p[2]),color:p[6],r:p[7],trail:[]}));
  return [sun, ...planets];
}

let bodies = makeSolarSystem();

// simulation state
let running = true;
let trails = true;
let centerSun = true;
const dt_day = 1/365.25; // 1 day in years
let speed = 1.0;

// UI
document.getElementById('toggle').onclick = ()=>{ running = !running; document.getElementById('toggle').innerText = running? 'Pause' : 'Start'; }
document.getElementById('reset').onclick = ()=>{ bodies = makeSolarSystem(); }
document.getElementById('trails').onchange = e=>{ trails = e.target.checked; if(!trails) bodies.forEach(b=>b.trail=[]); }
document.getElementById('speed').oninput = e=>{ speed = parseFloat(e.target.value); }
document.getElementById('centerSun').onchange = e=>{ centerSun = e.target.checked }

function accelAt(i){
  const bi = bodies[i];
  let ax=0, ay=0;
  for(let j=0;j<bodies.length;j++) if(j!==i){
    const bj = bodies[j];
    const dx = bj.x - bi.x, dy = bj.y - bi.y;
    const r2 = dx*dx + dy*dy + 1e-8;
    const r = Math.sqrt(r2);
    const a = G * bj.m / (r2);
    ax += a * dx / r;
    ay += a * dy / r;
  }
  return {ax,ay};
}

function step(dt){
  // velocity verlet
  const n = bodies.length;
  const ax = new Array(n), ay = new Array(n);
  for(let i=0;i<n;i++){ const a = accelAt(i); ax[i]=a.ax; ay[i]=a.ay; }
  for(let i=0;i<n;i++){
    bodies[i].x += bodies[i].vx * dt + 0.5 * ax[i] * dt*dt;
    bodies[i].y += bodies[i].vy * dt + 0.5 * ay[i] * dt*dt;
  }
  for(let i=0;i<n;i++){ const a2 = accelAt(i); bodies[i].vx += 0.5*(ax[i]+a2.ax)*dt; bodies[i].vy += 0.5*(ay[i]+a2.ay)*dt; }
  if(trails){ bodies.forEach(b=>{ b.trail = b.trail || []; b.trail.push({x:b.x,y:b.y}); if(b.trail.length>200) b.trail.shift(); }) }
}

// background stars
const stars = Array.from({length:400}, ()=>({x:Math.random(), y:Math.random(), s:Math.random()*1.5+0.2}));

function draw(){
  ctx.fillStyle = 'black'; ctx.fillRect(0,0,canvas.width,canvas.height);
  // stars
  ctx.save();
  ctx.translate(0,0);
  for(const s of stars){ ctx.fillStyle = 'rgba(255,255,255,'+(0.2+0.8*s.s).toFixed(2)+')'; ctx.fillRect(s.x*canvas.width, s.y*canvas.height, s.s, s.s); }
  ctx.restore();

  // compute center offset
  let cx = 0, cy = 0; if(centerSun){ const sun = bodies[0]; cx = sun.x; cy = sun.y; }

  const viewAU = 40; // half-width in AU
  const scale = Math.min(canvas.width, canvas.height) / (viewAU*2);

  // trails
  if(trails){
    for(const b of bodies){ if(!b.trail) continue; ctx.beginPath(); for(let i=0;i<b.trail.length;i++){ const p=b.trail[i]; const px = canvas.width/2 + (p.x - cx)*scale; const py = canvas.height/2 + (p.y - cy)*scale; if(i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py); } ctx.strokeStyle = b.color || '#fff'; ctx.globalAlpha = 0.6; ctx.stroke(); ctx.globalAlpha = 1; }
  }

  // bodies
  for(const b of bodies){ const px = canvas.width/2 + (b.x - cx)*scale; const py = canvas.height/2 + (b.y - cy)*scale; const radius = Math.max(1, b.r * scale * 0.8); ctx.beginPath(); ctx.fillStyle = b.color || '#fff'; ctx.arc(px,py, radius, 0, Math.PI*2); ctx.fill(); }

  // labels
  ctx.font = Math.max(12, Math.round(12 * (Math.min(canvas.width,canvas.height)/800))) + 'px sans-serif';
  ctx.textBaseline = 'top';
  for(const b of bodies){
    const px = canvas.width/2 + (b.x - cx)*scale;
    const py = canvas.height/2 + (b.y - cy)*scale;
    const radius = Math.max(1, b.r * scale * 0.8);
    const label = b.name || '';
    if(!label) continue;
    const lx = px + radius + 6;
    const ly = py - 6;
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.fillStyle = '#fff';
    ctx.strokeText(label, lx, ly);
    ctx.fillText(label, lx, ly);
  }

}

let last = performance.now();
function loop(t){
  const now = performance.now();
  let delta = (now - last)/1000; last = now;
  // step multiple simulation dt's based on speed
  if(running){
    const simDt = dt_day * speed; // years
    // adaptive substeps for stability
    const steps = Math.max(1, Math.min(20, Math.ceil(simDt / (1/365.25))));
    const sub = simDt / steps;
    for(let i=0;i<steps;i++) step(sub);
  }
  draw();
  document.getElementById('timeInfo').innerText = `Time step: ${(dt_day*speed*365.25).toFixed(2)} days · ${running? 'Running' : 'Paused'}`;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
