'use strict';

// Standalone concept gallery. No Spotify calls, audio access, or database writes.
// The playback readout uses explicitly labeled sample tracks from the archive.
const CONCEPTS = {
  core: { number: '01 / 03', description: 'Liquid Core — a precision hi-fi shell containing a living, liquid-green heart.' },
  tape: { number: '02 / 03', description: 'Living Tape — a green cassette playing inside a vintage stereo. Its label follows the song and artist.' },
  bloom: { number: '03 / 03', description: 'Signal Bloom — the familiar graffiti wall, awakened by an organic green portal inside the stereo.' },
};
const TRACKS = [
  { title: 'Where Is My Mind?', artist: 'Pixies', album: 'Surfer Rosa' },
  { title: 'The Ghosts of Beverly Drive', artist: 'Death Cab for Cutie', album: 'Kintsugi' },
  { title: 'No Known Drink Or Drug', artist: 'Japandroids', album: 'Near to the Wild Heart of Life' },
  { title: 'Weighty Ghost', artist: 'Wintersleep', album: 'Welcome to the Night Sky' },
  { title: 'Stick Season', artist: 'Noah Kahan', album: 'Stick Season' },
];

const vertexSource = `
attribute vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }
`;

const fragmentSource = `
precision mediump float;
uniform vec2 resolution;
uniform float time;
uniform float mode;
uniform float pulse;
uniform vec2 pointer;

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b-a) / k, 0.0, 1.0);
  return mix(b, a, h) - k*h*(1.0-h);
}
mat2 rot(float a) { float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }
float field(vec3 p) {
  float t=time * 0.53;
  p.xy *= rot(0.15*sin(t*0.6));
  p.xz *= rot(t*0.25);
  float wobble = sin(p.x*4.0+t)*sin(p.y*3.0-t*.7)*sin(p.z*3.2+t*.3)*0.055;
  if (mode > 1.5) {
    // A fluid torus with an uneven, rotating perimeter: the green boot-screen bloom.
    p.xy *= rot(t*0.32);
    float angle=atan(p.y,p.x);
    float radius=.72+.09*sin(angle*5.0+t)+.065*sin(angle*3.0-t*1.4);
    float ring=length(vec2(length(p.xy)-radius,p.z))-(.19+.045*sin(angle*4.0-t));
    vec3 bud=vec3(.70*cos(t),.66*sin(t),.12*sin(t*1.4));
    return smin(ring,length(p-bud)-.34,.30)+wobble;
  }
  // Smoothly connected metaballs: the liquid changes shape, not just position.
  vec3 a=vec3(-.46+.25*sin(t*.91),.25*sin(t*.76),.19*cos(t));
  vec3 b=vec3(.43+.20*cos(t*.83),.25*cos(t*.94),.25*sin(t*.73));
  vec3 c=vec3(.25*sin(t*.63),.42*sin(t*.69+1.8),.20*cos(t*.86));
  vec3 d=vec3(.75*cos(t*.47),.35*sin(t*.85+3.0),.13*sin(t*.82));
  float f=length(p-a)-.54;
  f=smin(f,length(p-b)-.46,.38);
  f=smin(f,length(p-c)-.43,.34);
  f=smin(f,length(p-d)-.25,.3);
  return f+wobble-pulse*.035;
}
vec3 normalAt(vec3 p) {
  vec2 e=vec2(.003,0.0);
  return normalize(vec3(field(p+e.xyy)-field(p-e.xyy),field(p+e.yxy)-field(p-e.yxy),field(p+e.yyx)-field(p-e.yyx)));
}
void main() {
  vec2 uv=(gl_FragCoord.xy*2.0-resolution)/resolution.y;
  float t=time;
  if (mode > .5 && mode < 1.5) {
    // Two counter-rotating liquid eddies, kept inside the cassette reel masks.
    vec2 q=gl_FragCoord.xy/resolution;
    vec2 center=q.x<.515?vec2(.25,.50):vec2(.78,.50);
    vec2 v=(q-center)*vec2(2.35,1.0);
    float r=length(v), a=atan(v.y,v.x);
    float direction=q.x<.515?1.0:-1.0;
    float curl=a*3.0+r*24.0-t*1.3*direction + sin(a*4.0-r*10.0+t*.75)*1.9;
    float lines=pow(.5+.5*sin(curl),8.0);
    float fluid=.5+.5*sin(a*2.0-r*15.0+t*.8+sin(a*3.0+t*.4));
    float edge=smoothstep(.52,.40,r)*smoothstep(.06,.17,r);
    vec3 green=mix(vec3(.03,.10,.003),vec3(.45,.98,.05),fluid*.65+lines*.45);
    green+=vec3(.65,1.0,.32)*pow(lines,3.0)*.55;
    green*=edge*(.75+pulse*.9);
    gl_FragColor=vec4(green,1.0);
    return;
  }
  vec3 ro=vec3(pointer.x*.10,pointer.y*.08,3.1);
  vec3 rd=normalize(vec3(uv*.79,-2.2));
  float travel=0.0;
  float nearGlow=0.0;
  for (int i=0; i<56; i++) {
    vec3 p=ro+rd*travel;
    float d=field(p);
    nearGlow += exp(-abs(d)*12.0)*.010;
    if (d<.003 || travel>5.5) break;
    travel+=max(d*.75,.007);
  }
  vec3 color=vec3(.003,.012,.003);
  float haze=exp(-dot(uv*vec2(.7,1.0),uv*vec2(.7,1.0))*.75);
  color+=vec3(.025,.075,.003)*haze;
  if (travel<5.5) {
    vec3 p=ro+rd*travel;
    vec3 n=normalAt(p);
    vec3 l=normalize(vec3(-1.0,1.5,2.0));
    vec3 l2=normalize(vec3(1.0,-.7,1.0));
    float diffuse=max(dot(n,l),0.0);
    float fill=max(dot(n,l2),0.0);
    float fresnel=pow(1.0-max(dot(n,-rd),0.0),2.5);
    float spec=pow(max(dot(reflect(-l,n),-rd),0.0),38.0);
    float spec2=pow(max(dot(reflect(-l2,n),-rd),0.0),24.0);
    float veins=.5+.5*sin(p.x*7.0+p.y*4.0+t*.48+sin(p.z*8.0-t*.5));
    color=vec3(.10,.24,.005)*(.3+diffuse*.9);
    color+=vec3(.33,.75,.018)*pow(diffuse,2.0)*(.4+veins*.7);
    color+=vec3(.33,.94,.075)*fill*.35;
    color+=vec3(.48,1.0,.17)*fresnel*.9;
    color+=vec3(.91,1.0,.69)*spec*.95;
    color+=vec3(.65,1.0,.25)*spec2*.6;
    color+=vec3(.055,.16,.003)*sin(p.y*8.0-t)*sin(p.x*5.0+t)*.5;
    color*=1.0+pulse*.55;
  }
  color+=vec3(.15,.66,.035)*nearGlow*(.38+pulse*.7);
  // Phosphor softness, no hard full-page scanlines.
  color*=.98+.02*sin(gl_FragCoord.y*2.3);
  gl_FragColor=vec4(pow(max(color,vec3(0.0)),vec3(.85)),1.0);
}
`;

let active = 'core';
let trackIndex = 0;
let elapsed = 7;
let lastFrame = 0;
let trackTimer = 0;
let energy = 0;
let visible = !document.hidden;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let paused = reduceMotion.matches;
const pointer = { x: 0, y: 0 };
const renderers = new Map();

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Shader unavailable');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const detail = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(detail || 'Shader compilation failed');
  }
  return shader;
}

function createRenderer(canvas) {
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
  if (!gl) throw new Error('WebGL unavailable');
  const program = gl.createProgram();
  if (!program) throw new Error('Program unavailable');
  const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
  const location = gl.getAttribLocation(program, 'position');
  gl.enableVertexAttribArray(location);
  gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
  const uniforms = {};
  for (const name of ['resolution', 'time', 'mode', 'pulse', 'pointer']) uniforms[name] = gl.getUniformLocation(program, name);
  const mode = canvas.dataset.fluid === 'core' ? 0 : canvas.dataset.fluid === 'tape' ? 1 : 2;
  let width = 0;
  let height = 0;
  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    const scale = Math.min(window.devicePixelRatio || 1, 1.5, 800 / rect.width);
    width = Math.max(1, Math.round(rect.width * scale));
    height = Math.max(1, Math.round(rect.height * scale));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    }
  };
  const observer = new ResizeObserver(() => { resize(); draw(); });
  function draw() {
    if (!width || !height || gl.isContextLost()) return;
    gl.useProgram(program);
    gl.uniform2f(uniforms.resolution, width, height);
    gl.uniform1f(uniforms.time, elapsed);
    gl.uniform1f(uniforms.mode, mode);
    gl.uniform1f(uniforms.pulse, energy);
    gl.uniform2f(uniforms.pointer, pointer.x, pointer.y);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  observer.observe(canvas);
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    canvas.hidden = true;
    canvas.parentElement.classList.add('animation-fallback');
  });
  canvas.addEventListener('webglcontextrestored', () => {
    observer.disconnect();
    renderers.delete(canvas.dataset.fluid);
    activateRenderer(canvas.dataset.fluid);
  });
  resize();
  draw();
  return { draw, resize };
}

function activateRenderer(key) {
  if (renderers.has(key)) {
    renderers.get(key).resize();
    renderers.get(key).draw();
    return;
  }
  const canvas = document.querySelector(`[data-fluid="${key}"]`);
  if (!canvas) return;
  try {
    canvas.hidden = false;
    canvas.parentElement.classList.remove('animation-fallback');
    renderers.set(key, createRenderer(canvas));
  } catch (error) {
    // Keep a moving, green surface even on devices without GPU support.
    canvas.hidden = true;
    canvas.parentElement.classList.add('animation-fallback');
    console.warn('Using the lightweight fluid fallback:', error.message);
  }
}

function selectConcept(key, updateHash = true) {
  if (!Object.hasOwn(CONCEPTS, key)) key = 'core';
  if (key === 'tape') {
    location.replace('tape.html?motion=mercury');
    return;
  }
  active = key;
  document.body.dataset.concept = key;
  for (const section of document.querySelectorAll('.concept')) section.hidden = section.id !== key;
  for (const button of document.querySelectorAll('[data-select]')) button.setAttribute('aria-pressed', String(button.dataset.select === key));
  document.getElementById('study-number').textContent = CONCEPTS[key].number;
  document.getElementById('study-description').textContent = CONCEPTS[key].description;
  if (updateHash) history.replaceState(null, '', `#${key}`);
  activateRenderer(key);
  if (key === 'tape') syncTapeLabel();
}

function syncTapeLabel() {
  const track = TRACKS[trackIndex];
  const title = document.querySelector('.tape-song-title');
  const artist = document.querySelector('.tape-song-artist');
  if (!title || !artist) return;
  title.textContent = track.title;
  artist.textContent = track.artist;
  document.querySelector('.tape-position').textContent = `${String(trackIndex + 1).padStart(2, '0')} / ${String(TRACKS.length).padStart(2, '0')}`;
  for (const line of document.querySelectorAll('.tape-label-text')) {
    line.classList.remove('label-scroll');
    const overflow = line.scrollWidth - line.parentElement.clientWidth;
    if (overflow > 1) {
      line.style.setProperty('--label-travel', `${-overflow}px`);
      // Layout measurement also restarts the marquee for a newly selected track.
      void line.offsetWidth;
      line.classList.add('label-scroll');
    }
  }
}

function updateTrack(delta) {
  trackIndex = (trackIndex + delta + TRACKS.length) % TRACKS.length;
  const track = TRACKS[trackIndex];
  for (const title of document.querySelectorAll('.track-title')) title.textContent = track.title;
  for (const artist of document.querySelectorAll('.track-artist')) artist.textContent = `${track.artist} · ${track.album}`;
  syncTapeLabel();
  trackTimer = 0;
}

function setPaused(value) {
  paused = value;
  document.body.classList.toggle('paused', value);
  document.getElementById('pause').setAttribute('aria-pressed', String(value));
  document.getElementById('pause-label').textContent = value ? 'Resume motion' : 'Pause motion';
  document.querySelector('.pause-icon').textContent = value ? '▷' : 'Ⅱ';
  document.getElementById('motion-status').textContent = value ? 'Motion paused.' : 'Motion running.';
  lastFrame = 0;
}

function pulseEnergy() {
  energy = 1.5;
  if (paused) setPaused(false);
  document.getElementById('motion-status').textContent = 'Energy pulse sent.';
}

for (const button of document.querySelectorAll('[data-select]')) button.addEventListener('click', () => selectConcept(button.dataset.select));
for (const button of document.querySelectorAll('[data-step]')) button.addEventListener('click', () => updateTrack(Number(button.dataset.step)));
for (const button of document.querySelectorAll('.energy-control')) button.addEventListener('click', pulseEnergy);
document.getElementById('energy-button').addEventListener('click', pulseEnergy);
document.getElementById('pause').addEventListener('click', () => setPaused(!paused));
window.addEventListener('hashchange', () => {
  const key = location.hash.slice(1);
  if (Object.hasOwn(CONCEPTS, key)) selectConcept(key, false);
});
reduceMotion.addEventListener('change', event => setPaused(event.matches));
document.addEventListener('visibilitychange', () => { visible = !document.hidden; lastFrame = 0; });
document.getElementById('stage').addEventListener('pointermove', event => {
  const rect = document.getElementById('stage').getBoundingClientRect();
  pointer.x = (event.clientX - rect.left) / rect.width * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height * 2 - 1);
});
document.getElementById('stage').addEventListener('pointerleave', () => { pointer.x = 0; pointer.y = 0; });
window.addEventListener('resize', syncTapeLabel);

function frame(timestamp) {
  requestAnimationFrame(frame);
  if (!visible || paused) { lastFrame = 0; return; }
  if (!lastFrame) { lastFrame = timestamp; return; }
  if (timestamp - lastFrame < 1000 / 30) return;
  const delta = Math.min((timestamp - lastFrame) / 1000, .1);
  lastFrame = timestamp;
  elapsed += delta * (1 + energy * .6);
  energy = Math.max(0, energy - delta * .7);
  trackTimer += delta;
  if (trackTimer > 9) updateTrack(1);
  renderers.get(active)?.draw();
}

setPaused(paused);
selectConcept(location.hash.slice(1) || 'core', false);
requestAnimationFrame(frame);
