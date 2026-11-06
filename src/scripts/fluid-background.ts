import { trackOnce } from '../lib/analytics';
import vertex from '../shaders/fluid.vert.glsl?raw';
import fragment from '../shaders/fluid.frag.glsl?raw';

const canvas = document.querySelector<HTMLCanvasElement>('.fluid-background');
if (canvas) mount(canvas);

function mount(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext('webgl', {alpha:false, antialias:false, depth:false, powerPreference:'low-power'});
  if (!gl) { trackOnce('webgl_initialization_failed', {reason:'unsupported'}); trackOnce('graphics_fallback_activated', {reason:'unsupported'}); return; }
  const program = gl.createProgram();
  if (!program) {trackOnce('webgl_initialization_failed',{reason:'program'});trackOnce('graphics_fallback_activated',{reason:'program'});return;}
  for (const [type, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]] as const) {
    const shader = gl.createShader(type);
    if (!shader) { gl.deleteProgram(program); return; }
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    gl.attachShader(program, shader);
    gl.deleteShader(shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { trackOnce('webgl_initialization_failed',{reason:'program'});trackOnce('graphics_fallback_activated',{reason:'program'}); gl.deleteProgram(program); return; }
  const buffer = gl.createBuffer();
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program,'a_position');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
  const time = gl.getUniformLocation(program,'u_time');
  const resolution = gl.getUniformLocation(program,'u_resolution');
  const horizontalScale = gl.getUniformLocation(program,'u_horizontalScale');
  const mouse = gl.getUniformLocation(program,'u_mouse');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let x=.5, y=.5, seconds=0, previous=0, frame=0;
  let cropX=1;
  const controller = new AbortController();
  const options = {signal:controller.signal};

  function draw() {
    if (!gl) return;
    gl.viewport(0,0,canvas.width,canvas.height);
    gl.uniform2f(resolution,canvas.width,canvas.height);
    gl.uniform1f(horizontalScale,cropX);
    gl.uniform2f(mouse,x*canvas.width,y*canvas.height);
    gl.uniform1f(time,seconds);
    gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
  }
  function render(now:number) {
    seconds += previous ? Math.min(now-previous,100)/1000 : 0;
    previous=now;
    draw();
    frame=requestAnimationFrame(render);
  }
  function sync() {
    cancelAnimationFrame(frame);
    previous=0;
    if (!document.hidden && !reduced.matches) frame=requestAnimationFrame(render);
  }
  function resize() {
    const w=canvas.clientWidth,h=canvas.clientHeight;
    // Portrait phones show the centre of the desktop scene, without stretching it
    // or allocating an oversized offscreen canvas on a mobile GPU.
    cropX=w<=740 && h>w ? (w/h)/(16/9) : 1;
    const scale=Math.min(1,Math.sqrt(1200000/Math.max(1,w*h)));
    canvas.width=Math.max(1,Math.round(w*scale));
    canvas.height=Math.max(1,Math.round(h*scale));
    draw();
  }
  const observer=new ResizeObserver(resize);
  observer.observe(canvas);
  resize();
  canvas.style.visibility='visible';
  sync();
  reduced.addEventListener('change',()=>{
    trackOnce(reduced.matches?'animation_paused':'animation_resumed',{experience:'fluid-background',reason:'system-preference'});
    sync();
  },options);
  window.addEventListener('pointermove',event=>{
    if (!reduced.matches && event.pointerType!=='touch') {
      x=event.clientX/canvas.clientWidth;
      y=1-event.clientY/canvas.clientHeight;
    }
  },{...options,passive:true});
  document.addEventListener('visibilitychange',sync,options);
  function dispose() {
    cancelAnimationFrame(frame);
    controller.abort();
    observer.disconnect();
    gl?.deleteBuffer(buffer);
    gl?.deleteProgram(program);
    canvas.style.visibility='hidden';
  }
  canvas.addEventListener('webglcontextlost',event=>{
    event.preventDefault();
    trackOnce('graphics_fallback_activated',{reason:'context-lost'});
    dispose();
    canvas.addEventListener('webglcontextrestored',()=>mount(canvas),{once:true});
  },options);
  window.addEventListener('pagehide',event=>{if(!event.persisted)dispose();},options);
}
