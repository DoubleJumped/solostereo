/** Approved Liquid Mercury renderer. Each mount owns and releases its GPU resources. */
export function startLiquidMotion(root, onPause) {
  const byId = id => root.querySelector('[id="' + id + '"]');
  const canvas = byId('fluid');
  const windowElement = root.querySelector('.liquid-window');
  const pauseButton = byId('stop');
  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = motionPreference.matches;
  let renderer = null;
  let time = 12;
  let previousTime = null;
  let animation;
  const selected = 'mercury';
  const presets = {mercury: 0};
const meterChannels = [
  {fill:byId('meter-left'),peak:byId('peak-left'),level:.56,held:.56,hold:0},
  {fill:byId('meter-right'),peak:byId('peak-right'),level:.51,held:.51,hold:0},
];
function updateMeters(dt){
  const beat=Math.pow(.5+.5*Math.sin(time*5.2),5);
  const phrase=.5+.5*Math.sin(time*.71+Math.sin(time*.23));
  meterChannels.forEach((channel,i)=>{
    if(!channel.fill || !channel.peak)return;
    const texture=Math.sin(time*2.7+i*.8)*.055+Math.sin(time*8.1+i*.5)*.022;
    const target=Math.min(.96,Math.max(.09,.22+phrase*.34+beat*.30+texture));
    const rate=target>channel.level?19:3.3;
    channel.level+=(target-channel.level)*(1-Math.exp(-rate*dt));
    if(channel.level>=channel.held){channel.held=channel.level;channel.hold=.65;}
    else if(channel.hold>0){channel.hold=Math.max(0,channel.hold-dt);}
    else{channel.held=Math.max(channel.level,channel.held-dt*.16);}
    // Align the illuminated run to a whole number of LED segments.
    const lit=Math.floor(channel.level*32)/32;
    channel.fill.style.setProperty('--unlit',`${(100-lit*100).toFixed(3)}%`);
    channel.peak.style.setProperty('--peak',`${(channel.held*100).toFixed(3)}%`);
  });
}


const vertex = `
attribute vec2 position;
void main(){gl_Position=vec4(position,0.0,1.0);}
`;
const fragment = `
precision highp float;
uniform vec2 resolution;
uniform float time;
uniform float variant;

float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){
  vec2 i=floor(p), f=fract(p);
  vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);
}
float fbm(vec2 p){
  float value=0.0, amplitude=.57;
  mat2 turn=mat2(.80,.60,-.60,.80);
  for(int i=0;i<4;i++){
    value+=amplitude*noise(p);
    p=turn*p*2.03+vec2(3.1,1.7);
    amplitude*=.48;
  }
  return value;
}
void main(){
  vec2 uv=gl_FragCoord.xy/resolution;
  vec2 p=vec2(uv.x*1.61,uv.y)*2.5;
  float t=time*.23;
  // Domain warping transports the whole field together across both reels and
  // their connecting tape path. Shared coordinates keep the flow continuous.
  vec2 drift=vec2(.17*t,-.11*t);
  vec2 q=vec2(fbm(p+drift),fbm(p+vec2(4.8,1.3)-drift*.8));
  vec2 r=vec2(fbm(p+q*2.9+vec2(1.2,.3*t)),fbm(p+q*2.6+vec2(7.1,-.23*t)));
  float f=fbm(p+r*3.1+vec2(-.12*t,.1*t));
  vec3 color=vec3(0.0);
  if(variant<.5){
    // Liquid Mercury: rolling, reflective folds and caustics in viscous gel.
    float folds=sin(f*14.0+q.x*3.0+t*.42);
    float ridge=pow(1.0-abs(folds),4.0);
    float pool=smoothstep(.25,.74,f);
    float highlight=pow(max(0.0,sin(f*16.0+r.y*2.0)),22.0);
    color=mix(vec3(.005,.023,.001),vec3(.18,.46,.007),pool);
    color+=vec3(.42,.88,.10)*ridge*.66;
    color+=vec3(.83,1.0,.42)*highlight*.50;
    color*=.72+.28*smoothstep(.06,.94,uv.y);
  }else if(variant<1.5){
    // Green Ink: broad diffusion plumes without hard contours or separate orbs.
    float density=smoothstep(.24,.74,f+sin(uv.x*4.0+t*.3)*.08);
    float silk=smoothstep(.42,.73,r.x*.7+f*.6);
    float plume=pow(density,1.8);
    color=vec3(.07,.40,.013)*plume;
    color+=vec3(.26,.62,.08)*silk*plume;
    color+=vec3(.035,.12,.001)*density;
    color*=.75+.25*sin(uv.y*2.0+q.x*3.0);
  }else{
    // Aurora Gel: luminous, continuous ribbons carried by the same liquid field.
    float phase=p.y*2.7+p.x*.65+r.x*6.5+t*.48;
    float ribbon=exp(-pow(sin(phase)*3.0,2.0));
    float veil=exp(-pow(sin(phase*.64+q.y*2.0)*1.8,2.0));
    float threads=pow(.5+.5*sin(phase*9.0+f*12.0),16.0)*ribbon;
    color=vec3(.17,.57,.047)*ribbon*.8;
    color+=vec3(.015,.18,.048)*veil;
    color+=vec3(.62,.95,.27)*threads*.33;
  }
  // The dark reel centers and paper label are excluded by the physical cavity
  // mask, while a low-reflectance perimeter sits beneath the existing shell.
  float softness=smoothstep(0.0,.10,uv.x)*smoothstep(0.0,.10,1.0-uv.x);
  softness*=smoothstep(0.0,.08,uv.y)*smoothstep(0.0,.08,1.0-uv.y);
  gl_FragColor=vec4(color*softness,1.0);
}
`;


function shader(gl,type,source){
  const result=gl.createShader(type);
  if(!result)throw new Error('Shader unavailable');
  gl.shaderSource(result,source);gl.compileShader(result);
  if(!gl.getShaderParameter(result,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(result));
  return result;
}
function startRenderer(){
  const gl=canvas.getContext('webgl',{alpha:false,antialias:false,depth:false,powerPreference:'low-power'});
  if(!gl)throw new Error('WebGL unavailable');
  const program=gl.createProgram();
  if(!program)throw new Error('Program unavailable');
  const vs=shader(gl,gl.VERTEX_SHADER,vertex),fs=shader(gl,gl.FRAGMENT_SHADER,fragment);
  gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
  gl.deleteShader(vs);gl.deleteShader(fs);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);
  const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
  const pos=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
  const uniforms={};for(const key of ['resolution','time','variant'])uniforms[key]=gl.getUniformLocation(program,key);
  function draw(){
    if(gl.isContextLost())return;
    gl.useProgram(program);
    gl.uniform2f(uniforms.resolution,canvas.width,canvas.height);
    gl.uniform1f(uniforms.time,time);
    gl.uniform1f(uniforms.variant,presets[selected]);
    gl.drawArrays(gl.TRIANGLES,0,6);
  }
  function resize(){
    const rect=canvas.getBoundingClientRect();
    const scale=Math.min(devicePixelRatio||1,1.25,620/Math.max(rect.width,1));
    canvas.width=Math.max(1,Math.round(rect.width*scale));canvas.height=Math.max(1,Math.round(rect.height*scale));
    gl.viewport(0,0,canvas.width,canvas.height);draw();
  }
  const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
  return{draw,resize,dispose(){observer.disconnect();gl.deleteBuffer(buffer);gl.deleteProgram(program);}};
}
function fallback(){canvas.style.visibility='hidden';windowElement.classList.add('fluid-fallback');}
function initialize(){
  try{renderer=startRenderer();canvas.style.visibility='';windowElement.classList.remove('fluid-fallback');}
  catch(error){fallback();console.warn('Using lightweight fluid motion:',error.message);}
}

  function setPaused(value) {
    paused = value;
    previousTime = null;
    root.classList.toggle('paused', paused);
    pauseButton.setAttribute('aria-pressed', String(paused));
    pauseButton.setAttribute('aria-label', paused ? 'Resume animation' : 'Pause animation');
    onPause(paused);
  }
  const toggle = () => setPaused(!paused);
  const preference = event => setPaused(event.matches);
  const visibility = () => { previousTime = null; };
  const lost = event => { event.preventDefault(); renderer?.dispose(); renderer = null; fallback(); };
  canvas.addEventListener('webglcontextlost', lost);
  canvas.addEventListener('webglcontextrestored', initialize);
  pauseButton.addEventListener('click', toggle);
  motionPreference.addEventListener('change', preference);
  document.addEventListener('visibilitychange', visibility);
  function frame(timestamp) {
    animation = requestAnimationFrame(frame);
    if (document.hidden || paused) {previousTime = null; return;}
    if (previousTime === null) {previousTime = timestamp; return;}
    if (timestamp - previousTime < 1000 / 30) return;
    const dt = Math.min((timestamp - previousTime) / 1000, .1);
    previousTime = timestamp;
    time += dt;
    updateMeters(dt);
    renderer?.draw();
  }
  setPaused(paused);
  initialize();
  updateMeters(0);
  animation = requestAnimationFrame(frame);
  return () => {
    cancelAnimationFrame(animation);
    renderer?.dispose();
    canvas.removeEventListener('webglcontextlost', lost);
    canvas.removeEventListener('webglcontextrestored', initialize);
    pauseButton.removeEventListener('click', toggle);
    motionPreference.removeEventListener('change', preference);
    document.removeEventListener('visibilitychange', visibility);
  };
}
