/* Apply before the stylesheet paints; keep the preference separate from league data. */
(() => {
  'use strict';
  const key='noah-draft-lab-theme';
  const system=window.matchMedia('(prefers-color-scheme: dark)');
  let preference=null;
  try{const saved=localStorage.getItem(key);if(saved==='dark'||saved==='light')preference=saved;}catch{}
  function apply(mode){
    document.documentElement.dataset.theme=mode;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content',mode==='dark'?'#141820':'#eae9e0');
    const toggle=document.getElementById('theme-toggle');
    if(toggle){toggle.setAttribute('aria-pressed',String(mode==='dark'));toggle.title='Switch to '+(mode==='dark'?'light':'dark')+' mode';}
  }
  function refresh(){apply(preference||(system.matches?'dark':'light'));}
  refresh();
  function setup(){
    const toggle=document.getElementById('theme-toggle');if(!toggle)return;
    toggle.hidden=false;refresh();
    toggle.addEventListener('click',()=>{
      preference=document.documentElement.dataset.theme==='dark'?'light':'dark';
      try{localStorage.setItem(key,preference);}catch{}
      refresh();
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
  system.addEventListener('change',()=>{if(!preference)refresh();});
  window.addEventListener('storage',event=>{
    if(event.key!==key&&event.key!==null)return;
    preference=event.newValue==='dark'||event.newValue==='light'?event.newValue:null;refresh();
  });
})();
