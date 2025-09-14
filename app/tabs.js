export function initTabs(){
    const tabBtns = document.querySelectorAll('.tab-btn');
    function setTab(targetSel){
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
      const target = document.querySelector(targetSel);
      target.classList.remove('hidden');
      target.classList.add('block');
      tabBtns.forEach(b=>{
        const on = b.getAttribute('data-target')===targetSel;
        b.setAttribute('aria-selected', on ? 'true':'false');
        b.classList.toggle('active', on);
        b.classList.toggle('inactive', !on);
      });
    }
    tabBtns.forEach(b=> b.addEventListener('click', ()=> setTab(b.getAttribute('data-target'))));
  }
  