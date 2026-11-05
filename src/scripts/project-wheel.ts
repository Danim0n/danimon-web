import { recordInteraction, recordProjectDetails } from '../lib/analytics/instrument';
const section = document.querySelector<HTMLElement>('.projects-wheel');
if (section) mountWheel(section);

function mountWheel(root: HTMLElement) {
  const stage = root.querySelector<HTMLElement>('.wheel-stage')!;
  const items = Array.from(stage.querySelectorAll<HTMLElement>('.wheel-item'));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let visible = false, frame = 0, previous = 0;
  const tilt = 15;
  let angle = -18, radius = 0, cameraDistance = 1000, hover = -1, pinned = -1;
  let gesture: {id:number; x:number; angle:number; card:number; moved:boolean} | null = null;
  let skipClick = false;

  function draw() {
    items.forEach((item,i)=>{
      const yaw = angle + i * 360 / items.length;
      const facing = Math.cos(yaw * Math.PI / 180) * Math.cos(tilt * Math.PI / 180);
      // Mount each card tangent to the same tilted ring. On its far arc
      // show the readable side, switching precisely at the edge-on angle.
      const reverse = facing * cameraDistance < radius ? 180 : 0;
      item.style.transform = `translate(-50%, -50%) rotateX(-${tilt}deg) rotateY(${yaw}deg) translateZ(${radius}px) rotateY(${reverse}deg)`;
      item.style.zIndex = String(Math.round((1 + facing) * 1000));
    });
  }
  function tick(now:number) {
    angle=(angle + Math.min(now-previous,64)*.012)%360;
    previous=now;draw();frame=requestAnimationFrame(tick);
  }
  function sync() {
    cancelAnimationFrame(frame);
    if(!reduced.matches && visible && !document.hidden && hover<0 && pinned<0 && !gesture && !stage.contains(document.activeElement)){
      previous=performance.now();frame=requestAnimationFrame(tick);
    }
  }
  function faces() {
    items.forEach((item,i)=>{
      const open=i===(pinned>=0?pinned:hover);
      item.toggleAttribute('data-open',open);
      item.querySelector('button')!.setAttribute('aria-expanded',String(open));
    });
    sync();
  }
  items.forEach((item,i)=>{
    const button=item.querySelector('button')!;
    button.hidden=false;
    button.addEventListener('focus',()=>{
      if(!button.matches(':focus-visible'))return;
      angle=-i*360/items.length;draw();sync();
    });
    button.addEventListener('click',e=>{
      if(skipClick && e.detail!==0)return;
      pinned=pinned===i?-1:i;hover=-1;
      if (pinned >= 0) recordProjectDetails(i);
      faces();
    });
  });
  function cardAt(target: EventTarget | null) {
    const item = target instanceof Element ? target.closest<HTMLElement>('.wheel-item') : null;
    return item ? items.indexOf(item) : -1;
  }
  stage.addEventListener('pointerleave',()=>{
    if(hover>=0){hover=-1;faces();}
  });
  stage.addEventListener('pointerdown',e=>{
    if(e.button!==0 || !e.isPrimary || (e.target instanceof Element && e.target.closest('a')))return;
    const card=cardAt(e.target);
    skipClick=false;gesture={id:e.pointerId,x:e.clientX,angle,card,moved:false};
    if(card<0){hover=pinned=-1;}
    faces();
  });
  stage.addEventListener('pointermove',e=>{
    if(!gesture){
      if(e.pointerType!=='touch' && pinned<0){
        const card=cardAt(e.target);
        if(hover!==card){hover=card;faces();}
      }
      return;
    }
    if(e.pointerId!==gesture.id)return;
    const dx=e.clientX-gesture.x;
    if(!gesture.moved && Math.abs(dx)<5)return;
    if(!gesture.moved){
      gesture.moved=true;
      stage.setPointerCapture(e.pointerId);
      pinned=gesture.card;
      if (pinned >= 0) recordProjectDetails(pinned);
      hover=-1;
      faces();
    }
    angle=gesture.angle+dx*180/stage.clientWidth;draw();
  });
  function release(e:PointerEvent) {
    if(!gesture||gesture.id!==e.pointerId)return;
    // Mouse presses reveal the card only for the duration of the gesture.
    // A touch tap still uses click to toggle details without hovering.
    if (gesture.moved && e.type !== 'pointercancel') recordInteraction('project-carousel', 'drag');
    skipClick=gesture.moved || e.pointerType==='mouse' || e.type==='pointercancel';
    gesture=null;
    if(stage.hasPointerCapture(e.pointerId))stage.releasePointerCapture(e.pointerId);
    if(skipClick){
      pinned=hover=-1;
      if(document.activeElement instanceof HTMLElement && stage.contains(document.activeElement))document.activeElement.blur();
    }
    faces();
  }
  window.addEventListener('pointerup',release);
  window.addEventListener('pointercancel',release);
  stage.addEventListener('focusout',()=>queueMicrotask(sync));
  reduced.addEventListener('change',sync);
  document.addEventListener('visibilitychange',sync);
  root.classList.add('ready');
  root.querySelector<HTMLElement>('.wheel-hint')!.hidden=false;
  const resize=new ResizeObserver(()=>{
    radius = stage.clientWidth * .31;
    cameraDistance = radius * 4.4;
    stage.style.perspective = `${cameraDistance}px`;
    draw();
  });
  resize.observe(stage);
  const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;sync();});
  observer.observe(stage);sync();
}
