
// Haru88 3D helpers
window.Haru3D = {
  spark(x, y, n=14){
    for(let i=0;i<n;i++){
      const el=document.createElement('div');
      el.className='h3d-spark';
      const ang=Math.random()*Math.PI*2, dist=40+Math.random()*80;
      el.style.left=x+'px'; el.style.top=y+'px';
      el.style.setProperty('--dx', Math.cos(ang)*dist+'px');
      el.style.setProperty('--dy', Math.sin(ang)*dist+'px');
      el.style.background=i%2?'#40e0d0':'#f0c040';
      document.body.appendChild(el);
      setTimeout(()=>el.remove(),950);
    }
  },
  celebrate(el){
    if(!el) return;
    const r=el.getBoundingClientRect();
    this.spark(r.left+r.width/2, r.top+r.height/2, 18);
  },
  makeDice(symbol){
    const d=document.createElement('div');
    d.className='h3d-dice';
    const faces=['front','back','right','left','top','bottom'];
    faces.forEach((f,i)=>{
      const face=document.createElement('div');
      face.className='face f-'+f;
      face.textContent = i===0 ? (symbol||'🎲') : (['🦌','🦐','🐓','🍐','🐟','🦀'][i%6]);
      d.appendChild(face);
    });
    return d;
  },
  setDiceSymbol(diceEl, symbol){
    if(!diceEl) return;
    const front=diceEl.querySelector('.f-front');
    if(front) front.textContent=symbol;
    diceEl.classList.remove('spinning');
    diceEl.style.transform='rotateX(-18deg) rotateY('+(20+Math.random()*40)+'deg)';
  },
  spinDice(diceEl, ms=1200){
    if(!diceEl) return;
    diceEl.classList.add('spinning');
    setTimeout(()=>diceEl.classList.remove('spinning'), ms);
  }
};
