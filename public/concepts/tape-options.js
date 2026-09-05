'use strict';
const descriptions={mercury:'Liquid Mercury — glossy, rolling folds with bright green reflections.',ink:'Green Ink — slow, smoky plumes diffusing through the entire cassette.',aurora:'Aurora Gel — silky ribbons of green light flowing from one reel to the other.'};
const preview=document.getElementById('preview');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let paused=reduced.matches;
let selection='mercury';
const validOrigin=location.origin==='null'?'*':location.origin;
function sendState(){
  preview.contentWindow.postMessage({type:'solo-stereo-motion',motion:selection},validOrigin);
  preview.contentWindow.postMessage({type:'solo-stereo-pause',paused},validOrigin);
}
function renderPause(){const button=document.getElementById('pause');button.setAttribute('aria-pressed',String(paused));button.textContent=paused?'Resume motion':'Pause motion';}
for(const button of document.querySelectorAll('[data-motion]'))button.addEventListener('click',()=>{
  selection=button.dataset.motion;
  for(const other of document.querySelectorAll('[data-motion]'))other.setAttribute('aria-pressed',String(other===button));
  document.getElementById('description').textContent=descriptions[selection];
  document.getElementById('full').href=`tape.html?motion=${selection}`;
  sendState();
});
document.getElementById('pause').addEventListener('click',()=>{paused=!paused;renderPause();sendState();});
reduced.addEventListener('change',event=>{paused=event.matches;renderPause();sendState();});
preview.addEventListener('load',sendState);
renderPause();
