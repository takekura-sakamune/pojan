'use strict';
// 効果音の生成と音量設定
const SoundManager= {
  context:null,
  master:null,
  enabled:true,
  volume:0.75,
  pending:null,
  primedContext:null,
  unlock() {
    if(typeof window==='undefined')return;
    try {
      const Audio=window.AudioContext||window.webkitAudioContext;
      if(!Audio)return;
      if(!this.context||this.context.state==='closed') {
        this.context=new Audio();
        this.primedContext=null;
        this.master=this.context.createGain();
        this.master.gain.value=this.enabled?this.volume:0;
        this.master.connect(this.context.destination);
      }
      const ctx=this.context;
      // iPhone may only allow audio to start at the end of a tap. Start a silent
      // sample inside that gesture, then recover both suspended and interrupted audio.
      if(this.primedContext!==ctx&&typeof ctx.createBufferSource==='function') {
        const source=ctx.createBufferSource();
        source.buffer=ctx.createBuffer(1,1,ctx.sampleRate);
        source.connect(this.master);
        source.onended=()=>source.disconnect();
        source.start(0);
        this.primedContext=ctx;
      }
      if(ctx.state==='suspended'||ctx.state==='interrupted') {
        return ctx.resume().then(()=>this.flush(ctx)).catch(()=>{});
      }
      this.flush(ctx);
    }
    catch(_) {
      /* Audio must never interrupt a game. */
    }
  },
  flush(ctx) {
    if(ctx!==this.context||ctx.state!=='running')return;
    const pending=this.pending;
    this.pending=null;
    if(pending&&pending.context===ctx&&Date.now()-pending.at<1000)this.play(pending.event);
  },
  update() {
    if(this.master)this.master.gain.setTargetAtTime(this.enabled?this.volume:0, this.context.currentTime, 0.015);
  },
  play(event) {
    const ctx=this.context;
    if(!this.enabled||!this.volume||!ctx)return;
    if(ctx.state!=='running') {
      // Retain only the latest sound briefly; never replay a backlog after returning.
      this.pending={event,at:Date.now(),context:ctx};
      this.unlock();
      return;
    }
    const patterns= {
      draw:[[620, 0, .07, 880, .13]],
      discard:[[240, 0, .065, 110, .22]],
      select:[[920, 0, .035, 1100, .05]],
      tsumo:[[523, 0, .13, 523, .15], [659, .10, .14, 659, .15], [784, .20, .16, 784, .15], [1047, .33, .30, 1047, .17]],
      ron:[[330, 0, .09, 440, .20], [660, .09, .12, 880, .19], [988, .20, .30, 988, .18]],
      drawEnd:[[440, 0, .16, 392, .11], [330, .18, .25, 294, .10]],
      start:[[440, 0, .09, 440, .09], [660, .10, .13, 660, .10]]
    };
    try {
      for(const [hz, delay, duration, end, level] of patterns[event]||[]) {
        const o=ctx.createOscillator(),
        g=ctx.createGain(),
        t=ctx.currentTime+delay;
        o.type=['discard', 'ron'].includes(event)?'triangle':'sine';
        o.frequency.setValueAtTime(hz, t);
        o.frequency.exponentialRampToValueAtTime(end, t+duration);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(level, t+.006);
        g.gain.exponentialRampToValueAtTime(.0001, t+duration);
        o.connect(g);
        g.connect(this.master);
        o.onended=()=> {
          o.disconnect();
          g.disconnect();
        };
        o.start(t);
        o.stop(t+duration+.02);
      }
    }
    catch(_) {}
  },
  bind() {
    const toggle=document.getElementById('sound-toggle'),
    volume=document.getElementById('sound-volume');
    document.addEventListener('pointerdown', ()=>this.unlock(), {
      capture:true
    });
    document.addEventListener('keydown', ()=>this.unlock(), {
      capture:true
    });
    document.addEventListener('touchend', ()=>this.unlock(), {capture:true,passive:true});
    document.addEventListener('click', ()=>this.unlock(), {capture:true});
    document.addEventListener('visibilitychange', ()=> {
      this.pending=null;
      if(document.visibilityState==='visible'&&this.context)this.unlock();
    });
    toggle.onclick=()=> {
      this.unlock();
      this.enabled=!this.enabled;
      this.update();
      toggle.textContent=this.enabled?'SE：ON':'SE：OFF';
      toggle.setAttribute('aria-pressed', String(this.enabled));
      if(this.enabled)this.play('select');
    };
    volume.oninput=()=> {
      this.unlock();
      this.volume=Number(volume.value)/100;
      this.update();
    };
    volume.onchange=()=>this.play('select');
  }
};
