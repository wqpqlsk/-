'use strict';

const byId = id => document.getElementById(id);
const desktop = byId('desktop');
const compact = matchMedia('(max-width:780px)');
const reducedMotion = matchMedia('(prefers-reduced-motion:reduce)');
const apps = {
  home: { name:'PLANET.EXE', icon:'planet' },
  planet: { name:'My Planet', icon:'planet', detail:'Your biosphere' },
  devices: { name:'Eco Devices', icon:'devices', detail:'Hardware library' },
  aquarium: { name:'Aquarium', icon:'aquarium', detail:'Living reef' },
  info: { name:'System Info', icon:'info' },
  bin: { name:'Recycle Bin', icon:'bin' },
  player: { name:'Media Player', icon:'player' }
};
const shortcuts = ['planet','devices','aquarium','info','bin'];
const icon = (name, alt='') => Object.assign(new Image(), {src:'assets/'+name+'.png', alt, draggable:false});
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function appButton(id, className, label) {
  const button = element('button',className);
  button.dataset.open = id;
  button.append(icon(apps[id].icon),element('span','',label || apps[id].name));
  return button;
}
for (const id of shortcuts) byId('shortcuts').append(appButton(id,'shortcut',apps[id].name.toUpperCase()));
for (const id of Object.keys(apps)) byId('programs').append(appButton(id,'program'));
for (const id of ['planet','devices','aquarium']) {
  const button = appButton(id,'dir-link');
  button.lastChild.replaceChildren(element('strong','',apps[id].name),element('small','',apps[id].detail));
  byId('directory-links').append(button);
}

// Window state is independent of visibility, so a minimized app retains its task.
const windows = new Map();
let layer = 3, activeId = 'home';
function refreshTasks() {
  const tasks = byId('tasks');
  for (const [id, state] of windows) {
    let task = tasks.querySelector('[data-task="'+id+'"]');
    if (!state.open) { task?.remove(); continue; }
    if (!task) {
      task = element('button','task');
      task.dataset.task = id;
      task.title = apps[id].name;
      task.setAttribute('aria-label',apps[id].name);
      task.append(icon(apps[id].icon),element('span','',apps[id].name));
      tasks.append(task);
    }
    task.classList.toggle('active',id === activeId);
    task.setAttribute('aria-pressed',String(id === activeId));
  }
}
function raise(id) {
  if (!id || !windows.has(id)) return;
  activeId = id;
  windows.get(id).order = ++layer;
  byId(id).style.zIndex = layer;
  refreshTasks();
}
function startMenu(show, returnFocus=false) {
  byId('start-menu').hidden = !show;
  byId('start').setAttribute('aria-expanded',String(show));
  if (show) byId('programs').querySelector('button').focus();
  else if (returnFocus) byId('start').focus();
}
function openApp(id, focus=true) {
  const win = byId(id);
  windows.get(id).open = true;
  startMenu(false);
  win.hidden = false;
  raise(id);
  if (focus) {
    win.querySelector('.chrome').focus({preventScroll:true});
    if (compact.matches && !win.classList.contains('dialog')) win.scrollIntoView({block:'nearest',behavior:'instant'});
    systemTone('open');
  }
}
function hideApp(id, close) {
  const win = byId(id);
  win.hidden = true;
  if (close) {
    windows.get(id).open = false;
    win.classList.remove('expanded');
    win.querySelector('.max').setAttribute('aria-label','Maximize');
    win.querySelector('.max').title = 'Maximize';
    if (id === 'player') setPlaying(false);
  }
  activeId = [...windows].filter(([key])=>!byId(key).hidden).sort((a,b)=>b[1].order-a[1].order)[0]?.[0] || '';
  refreshTasks();
  const nextFocus = activeId ? byId(activeId).querySelector('.chrome') : byId('start');
  nextFocus.focus({preventScroll:true});
  systemTone('close');
}
function maximize(win) {
  const expanded = win.classList.toggle('expanded');
  const label = expanded ? 'Restore size' : 'Maximize';
  const btn = win.querySelector('.max');
  btn.title = label;
  btn.setAttribute('aria-label',label);
  raise(win.id);
}
function place(win,x,y) {
  const area = desktop.getBoundingClientRect();
  const maxX = Math.max(0,area.width-win.offsetWidth);
  const maxY = Math.max(0,area.height-Math.min(win.offsetHeight,area.height));
  win.style.left = Math.max(0,Math.min(maxX,x))+'px';
  win.style.top = Math.max(0,Math.min(maxY,y))+'px';
}
function bindDrag(win,title) {
  let drag = null;
  title.addEventListener('pointerdown',event=>{
    if (event.button !== 0 || event.target.closest('button') || win.classList.contains('expanded')) return;
    const rect = win.getBoundingClientRect();
    drag = {dx:event.clientX-rect.left,dy:event.clientY-rect.top,mobile:compact.matches};
    title.setPointerCapture(event.pointerId);
  });
  title.addEventListener('pointermove',event=>{
    if (!drag) return;
    const area = desktop.getBoundingClientRect();
    if (drag.mobile) {
      win.classList.add('dragged-mobile');
      win.style.setProperty('--drag-x',Math.max(0,Math.min(innerWidth-win.offsetWidth,event.clientX-drag.dx))+'px');
      win.style.setProperty('--drag-y',Math.max(area.top,Math.min(area.bottom-34,event.clientY-drag.dy))+'px');
    } else place(win,event.clientX-area.left-drag.dx,event.clientY-area.top-drag.dy);
  });
  title.addEventListener('lostpointercapture',()=>{drag=null});
  title.addEventListener('dblclick',event=>{if (!event.target.closest('button')) maximize(win)});
  title.addEventListener('keydown',event=>{
    if (compact.matches || !event.altKey || !event.key.startsWith('Arrow') || win.classList.contains('expanded')) return;
    event.preventDefault();
    const dx = event.key === 'ArrowLeft' ? -16 : event.key === 'ArrowRight' ? 16 : 0;
    const dy = event.key === 'ArrowUp' ? -16 : event.key === 'ArrowDown' ? 16 : 0;
    place(win,win.offsetLeft+dx,win.offsetTop+dy);
  });
}
for (const win of document.querySelectorAll('.window')) {
  const id = win.id, title = win.querySelector('.chrome');
  windows.set(id,{open:!win.hidden,order:id==='home'?3:2});
  title.tabIndex = -1;
  title.append(icon(apps[id].icon),element('strong','',title.dataset.title));
  const controls = element('div','win-controls');
  for (const [action,label,fn] of [
    ['min','Minimize',()=>hideApp(id,false)],['max','Maximize',()=>maximize(win)],['close','Close',()=>hideApp(id,true)]
  ]) {
    const button = element('button',action);
    button.title=label;button.setAttribute('aria-label',label);
    button.addEventListener('click',fn);controls.append(button);
  }
  title.append(controls);bindDrag(win,title);
  win.addEventListener('pointerdown',()=>raise(id));
  win.addEventListener('focusin',()=>{if (activeId!==id) raise(id)});
}
refreshTasks();
document.addEventListener('click', event=>{
  const launcher = event.target.closest('[data-open]');
  if (launcher) openApp(launcher.dataset.open);
  const task = event.target.closest('[data-task]');
  if (task) {
    const id = task.dataset.task;
    if (id === activeId && !byId(id).hidden) hideApp(id,false);
    else openApp(id);
  }
  if (!event.target.closest('#start,#start-menu')) startMenu(false);
});
byId('start').addEventListener('click',()=>{systemTone('menu');startMenu(byId('start-menu').hidden)});
document.addEventListener('keydown',e=>{if(e.key==='Escape' && !byId('start-menu').hidden) startMenu(false,true)});
window.addEventListener('resize',()=>{
  for (const [id] of windows) {
    const win=byId(id);
    if (win.hidden || win.classList.contains('expanded')) continue;
    if (compact.matches || win.classList.contains('dragged-mobile')) {
      win.classList.remove('dragged-mobile');win.style.left='';win.style.top='';
    } else if (win.style.left) place(win,win.offsetLeft,win.offsetTop);
  }
});

// My Planet, Eco Devices and Recycle Bin share one small, local device collection.
const devices = [
  {id:'fern',name:'Fern Terminal',desc:'A leaf-powered desktop concept.',icon:'devices'},
  {id:'filter',name:'Reef Filter',desc:'A little water loop for your habitat.',icon:'aquarium'},
  {id:'solar',name:'Solar Leaf',desc:'A sun-tracking desktop collector.',icon:'leaf'},
  {id:'wave',name:'Wave Pod',desc:'A pocket player for ocean soundscapes.',icon:'player'}
];
function readLocal(key,fallback) {
  try {const value=localStorage.getItem('planetexe.'+key);return value===null?fallback:JSON.parse(value)} catch {return fallback}
}
function saveLocal(key,value) {try {localStorage.setItem('planetexe.'+key,JSON.stringify(value))} catch {/* Private sessions keep the current in-memory state. */}}
const saved = readLocal('devices',{});
const collection = new Map(devices.map(d=>[d.id,['installed','recycled'].includes(saved?.[d.id]) ? saved[d.id] : 'available']));
function deviceRow(d,label,action,desc) {
  const row=element('div','device-row'),copy=element('div');
  copy.append(element('strong','',d.name));
  if(desc) copy.append(element('small','',d.desc));
  const button=element('button','shell-button',label);
  button.setAttribute('aria-label',label+' '+d.name);
  button.disabled = !action;
  if(action) button.addEventListener('click',()=>{
    const list = row.parentElement;
    collection.set(d.id,action);saveLocal('devices',Object.fromEntries(collection));renderDevices();systemTone('menu');
    (list.querySelector('button:not(:disabled)') || byId(activeId)?.querySelector('.chrome'))?.focus({preventScroll:true});
  });
  row.append(icon(d.icon),copy,button);return row;
}
function renderDevices() {
  for(const id of ['catalog','installed','recycled']) byId(id).replaceChildren();
  for(const d of devices) {
    const state=collection.get(d.id);
    byId('catalog').append(deviceRow(d,state==='installed'?'Installed':state==='recycled'?'Restore':'Install',state==='installed'?null:'installed',true));
    if(state==='installed') byId('installed').append(deviceRow(d,'Recycle','recycled'));
    if(state==='recycled') byId('recycled').append(deviceRow(d,'Restore','installed'));
  }
  if(!byId('installed').children.length) byId('installed').append(element('p','empty','Your habitat is ready for its first device.'));
  if(!byId('recycled').children.length) byId('recycled').append(element('p','empty','Your bin is empty. Devices recycled from My Planet appear here.'));
}
renderDevices();
for(const [name,value] of [['System','Planet OS 2004'],['Edition','Biosphere'],['Interface','Aero Desktop'],['Storage','Local device collection']]) byId('properties').append(element('dt','',name),element('dd','',value));

// All audio is synthesized locally. AudioContext starts on a user gesture.
let ctx,master,musicGain,muted=readLocal('muted',false)===true;
function audioReady(){
  if(!ctx){
    const Context=window.AudioContext||window.webkitAudioContext;
    if(!Context) return false;
    ctx=new Context();master=ctx.createGain();musicGain=ctx.createGain();
    master.gain.value=muted?0:.4;musicGain.gain.value=Number(byId('volume').value)/100;
    musicGain.connect(master);master.connect(ctx.destination);
  }
  if(ctx.state==='suspended') ctx.resume().catch(()=>{});
  return true;
}
function note(freq,at,length,gain,channel,timbre='sine'){
  const osc=ctx.createOscillator(),amp=ctx.createGain();
  osc.type=timbre;osc.frequency.value=freq;osc.connect(amp);amp.connect(channel);
  amp.gain.setValueAtTime(.0001,at);amp.gain.exponentialRampToValueAtTime(gain,at+Math.min(.035,length/5));
  amp.gain.exponentialRampToValueAtTime(.0001,at+length);
  osc.start(at);osc.stop(at+length+.02);osc.onended=()=>{osc.disconnect();amp.disconnect()};
}
function systemTone(type){
  if(muted||!audioReady())return;
  const tones={open:[523.25,783.99],close:[523.25,392],menu:[659.25],feed:[880,1174.66]};
  tones[type].forEach((f,i)=>note(f,ctx.currentTime+.065*i,.15,.075,master));
}
function renderMute(){
  const label=muted?'Unmute sound':'Mute sound';
  byId('mute').setAttribute('aria-label',label);byId('mute').title=label;byId('mute').setAttribute('aria-pressed',String(muted));
  byId('mute').innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" stroke="#245986" stroke-width="1" d="M2 9h4l6-5v16l-6-5H2z"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="'+(muted?'M16 9l6 6m0-6l-6 6':'M15 8q4 4 0 8m3-11q7 7 0 14')+'"/></svg>';
}
byId('mute').addEventListener('click',()=>{muted=!muted;saveLocal('muted',muted);if(audioReady())master.gain.setTargetAtTime(muted?0:.4,ctx.currentTime,.014);renderMute();if(!muted)systemTone('menu')});
renderMute();
const tracks=[
  {name:'Aquatic Drift',root:196,notes:[0,7,12,14,7,3,10,7],beat:.52},
  {name:'Photosynthesis',root:220,notes:[0,4,7,11,9,7,4,2],beat:.43},
  {name:'Cloud Memory',root:174.61,notes:[12,7,2,5,9,7,0,2],beat:.62}
];
let track=0,playing=false,elapsed=0,startTime=0,lastStep=-1;
const eq=byId('eq');
for(let i=0;i<24;i++){const bar=element('i');bar.style.height=(3+Math.round(Math.abs(Math.sin(i*.53)*Math.cos(i*.15))*11))+'px';eq.append(bar)}
function position(){return elapsed+(playing?(performance.now()-startTime)/1000:0)}
function renderPlayer(){
  const t=tracks[track],seconds=Math.floor(position());
  byId('timer').textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
  byId('play').textContent=playing?'Ⅱ':'▶';byId('play').setAttribute('aria-label',playing?'Pause':'Play');
  byId('track-title').textContent=t.name;byId('track-num').textContent='0'+(track+1)+' / 03';
}
function setPlaying(on){
  if(on===playing)return;
  if(on && !audioReady())return;
  if(on){startTime=performance.now();lastStep=-1;musicGain.gain.setTargetAtTime(Number(byId('volume').value)/100,ctx.currentTime,.02)}
  else {elapsed=position();musicGain?.gain.setTargetAtTime(0,ctx.currentTime,.025)}
  playing=on;renderPlayer();
}
function changeTrack(direction){
  track=(track+direction+tracks.length)%tracks.length;elapsed=0;startTime=performance.now();lastStep=-1;renderPlayer();
}
byId('play').addEventListener('click',()=>setPlaying(!playing));
byId('prev').addEventListener('click',()=>changeTrack(-1));
byId('next').addEventListener('click',()=>changeTrack(1));
byId('volume').addEventListener('input',()=>{if(playing)musicGain.gain.setTargetAtTime(Number(byId('volume').value)/100,ctx.currentTime,.015)});
setInterval(()=>{
  if(!playing)return;
  const t=tracks[track],step=Math.floor(position()/t.beat);
  if(step>=64){changeTrack(1);return}
  if(step!==lastStep){
    lastStep=step;const pitch=t.root*2**(t.notes[step%8]/12);
    note(pitch*2,ctx.currentTime,t.beat*1.8,.12,musicGain);
    if(step%4===0)note(t.root*(step%16<8?.5:2/3),ctx.currentTime,t.beat*3.7,.16,musicGain);
    if(!reducedMotion.matches) Array.from(eq.children).forEach((bar,i)=>{bar.style.height=(2+Math.abs(Math.sin(i*.72+step)*Math.cos(i*.15-step*.2))*12)+'px'});
  }
  renderPlayer();
},100);
function setClock(){byId('clock').textContent=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',hour12:false})}
setClock();setInterval(setClock,10000);

// The fish glide toward food in tank coordinates, which also work when maximized.
const tank=byId('tank'),fish=[],food=[];
for(const [i,species] of ['clownfish','butterflyfish','clownfish','butterflyfish'].entries()){
  const frame=element('span','fish');frame.style.width=[23,18,13,12][i]+'%';
  const sprite=icon(species);frame.append(sprite);byId('swimmers').append(frame);
  fish.push({frame,sprite,x:[.36,.70,.13,.83][i],y:[.48,.27,.68,.58][i],direction:i%2?1:-1,phase:i*1.61});
}
let foodTarget=null,lastFrame=0,simTime=0,bubbleTime=0;
function feed(x=.5,y=.43){
  const now=performance.now();
  foodTarget={x,y,until:now+3300};
  while(food.length>24)food.shift().node.remove();
  for(let i=0;i<6;i++){
    const node=element('span','pellet');const px=Math.max(.02,Math.min(.98,x+(Math.random()-.5)*.08));
    node.style.left=px*100+'%';node.style.top=y*100+'%';tank.append(node);
    food.push({node,x:px,y,start:now});
  }
  byId('tank-state').textContent='Feeding the reef';systemTone('feed');
}
tank.addEventListener('click',e=>{
  const r=tank.getBoundingClientRect();
  if(!e.detail)feed();else feed((e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height);
});
byId('feed').addEventListener('click',()=>feed(.35+Math.random()*.3,.36));
function swim(stamp){
  const dt=Math.min(.055,(stamp-lastFrame)/1000);lastFrame=stamp;
  if(foodTarget && stamp>foodTarget.until){foodTarget=null;byId('tank-state').replaceChildren(element('i','led'),document.createTextNode(' Reef habitat'))}
  for(let i=food.length-1;i>=0;i--){
    const f=food[i],age=(stamp-f.start)/1000;
    if(age>2.9){f.node.remove();food.splice(i,1)}else f.node.style.top=Math.min(.96,f.y+age*.043)*100+'%';
  }
  if(!byId('aquarium').hidden){
    const w=tank.clientWidth,h=tank.clientHeight;simTime+=dt;
    fish.forEach((f,i)=>{
      const oldX=f.x;
      if(foodTarget){
        f.x+=(Math.max(.12,Math.min(.88,foodTarget.x))+(i-1.5)*.055-f.x)*Math.min(1,dt*1.6);
        f.y+=(Math.max(.13,Math.min(.87,foodTarget.y))+(i%2)*.09-f.y)*Math.min(1,dt*1.5);
      } else if(!reducedMotion.matches){
        f.x+=f.direction*dt*(.038+i*.004);
        if(f.x>.90)f.direction=-1;if(f.x<.10)f.direction=1;
        f.y+=(.42+.17*Math.sin(simTime*.48+f.phase)+i*.027-f.y)*dt;
      }
      const facing=foodTarget?(f.x>=oldX?1:-1):f.direction;
      f.frame.style.transform='translate('+Math.round(f.x*w-f.frame.offsetWidth/2)+'px,'+Math.round(f.y*h-f.frame.offsetHeight/2)+'px)';
      f.sprite.style.transform='scaleX('+facing+')';
    });
    if(!reducedMotion.matches && stamp-bubbleTime>900){
      bubbleTime=stamp;const b=element('i','bubble');b.style.left=(8+Math.random()*84)+'%';b.style.bottom='-8px';tank.append(b);setTimeout(()=>b.remove(),4100);
    }
  }
  requestAnimationFrame(swim);
}
requestAnimationFrame(swim);
