'use strict';
// 効果音の生成と音量設定
const SoundManager= {
  context:null,
  master:null,
  enabled:true,
  volume:0.75,
  pending:null,
  primedContext:null,
  recreateOnGesture:false,
  paperBuffer:null,
  tone(frequency,time,duration,type='sine',volume=0.24,slide=null) {
    const ctx=this.context;
    if(!ctx||!this.master)return;
    const oscillator=ctx.createOscillator(),gain=ctx.createGain();
    oscillator.type=type;
    oscillator.frequency.setValueAtTime(frequency,time);
    if(slide)oscillator.frequency.exponentialRampToValueAtTime(slide,time+duration);
    gain.gain.setValueAtTime(0,time);
    gain.gain.linearRampToValueAtTime(volume,time+.012);
    gain.gain.exponentialRampToValueAtTime(.001,time+duration);
    oscillator.connect(gain);gain.connect(this.master);
    oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
    oscillator.start(time);oscillator.stop(time+duration+.025);
  },
  paper(time,duration=.17,strength=.5) {
    const ctx=this.context;
    if(!ctx||!this.master)return;
    // Keep a tonal fallback for older audio implementations without noise buffers.
    if(typeof ctx.createBuffer!=='function'||typeof ctx.createBufferSource!=='function'||typeof ctx.createBiquadFilter!=='function'){
      this.tone(720,time,duration,'sine',.06,280);return;
    }
    if(!this.paperBuffer){
      this.paperBuffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*.4),ctx.sampleRate);
      const samples=this.paperBuffer.getChannelData(0);
      for(let i=0;i<samples.length;i++)samples[i]=Math.random()*2-1;
    }
    const source=ctx.createBufferSource(),high=ctx.createBiquadFilter(),low=ctx.createBiquadFilter(),gain=ctx.createGain();
    source.buffer=this.paperBuffer;source.playbackRate.value=.9+Math.random()*.2;
    high.type='highpass';high.frequency.value=750;
    low.type='lowpass';low.frequency.setValueAtTime(6500,time);low.frequency.exponentialRampToValueAtTime(2400,time+duration);
    gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(strength,time+.018);
    gain.gain.linearRampToValueAtTime(strength*.22,time+duration*.42);
    gain.gain.linearRampToValueAtTime(strength*.65,time+duration*.59);
    gain.gain.exponentialRampToValueAtTime(.001,time+duration);
    source.connect(high);high.connect(low);low.connect(gain);gain.connect(this.master);
    source.onended=()=>{source.disconnect();high.disconnect();low.disconnect();gain.disconnect();};
    source.start(time,Math.random()*.08,duration);source.stop(time+duration+.02);
  },
  unlock() {
    if(typeof window==='undefined')return;
    try {
      if(this.recreateOnGesture){
        const previous=this.context;
        this.context=null;this.master=null;this.primedContext=null;this.pending=null;
        this.recreateOnGesture=false;
        if(previous&&previous.state!=='closed'){
          try{const closing=previous.close();if(closing?.catch)closing.catch(()=>{});}catch(_){}
        }
      }
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
        source.connect(ctx.destination);
        source.onended=()=>source.disconnect();
        source.start(0);
        // Some mobile browsers need a non-zero output node in the initiating gesture.
        try {
          const oscillator=ctx.createOscillator(),gain=ctx.createGain();
          oscillator.frequency.value=440;gain.gain.value=.0001;
          oscillator.connect(gain);gain.connect(ctx.destination);
          oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
          oscillator.start(0);oscillator.stop(.025);
        } catch(_) {}
        this.primedContext=ctx;
      }
      if(ctx.state!=='running') {
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
      if(pending&&pending.context===ctx&&Date.now()-pending.at<3000)this.play(pending.event,pending.options);
  },
  update() {
    if(this.master)this.master.gain.setTargetAtTime(this.enabled?this.volume:0, this.context.currentTime, 0.015);
  },
  play(event,options={}) {
    const ctx=this.context;
    if(!this.enabled||!this.volume||!ctx)return;
    if(ctx.state!=='running') {
      // Retain only the latest sound briefly; never replay a backlog after returning.
      const includeStart=event==='dealSequence'&&this.pending?.event==='start';
      this.pending={event,options:{...options,includeStart:options.includeStart||includeStart},at:Date.now(),context:ctx};
      this.unlock();
      return;
    }
    try {
      const t=ctx.currentTime+.01;
      const notes=(sequence,step=.09,duration=.25)=>sequence.forEach((hz,index)=>this.tone(hz,t+index*step,duration,'sine',.24));
      if(event==='dealSequence'){
        if(options.includeStart)notes([262,392,523],.1,.3);
        const count=Math.max(0,Number(options.count)||0),interval=Math.max(.04,Number(options.interval)||.07);
        for(let i=0;i<count;i++)this.paper(t+i*interval,.19,.2);
      }
      else if(event==='draw'||event==='deal')this.paper(t,.14,.22);
      else if(event==='discard')this.paper(t,.16,.18);
      else if(event==='select')this.tone(920,t,.035,'sine',.05,1100);
      else if(event==='tsumo')notes([523,659,784,1046],.13,.55);
      else if(event==='ron')notes([880,1175],.07,.22);
      else if(event==='win')notes([523,659,784,1046],.13,.55);
      else if(event==='drawEnd')notes([392,523,392],.14,.4);
      else if(event==='start')notes([262,392,523],.1,.3);
    }
    catch(_) {}
  },
  bind() {
    const toggle=document.getElementById('sound-toggle'),
    volume=document.getElementById('sound-volume');
    try {
      const saved=localStorage.getItem('pojan-sound-volume');
      if(saved!==null&&Number.isFinite(Number(saved)))this.volume=Math.min(1,Math.max(0,Number(saved)));
    }catch(_) {}
    volume.value=String(Math.round(this.volume*100));
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
      if(document.visibilityState==='hidden')this.recreateOnGesture=true;
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
      try{localStorage.setItem('pojan-sound-volume',String(this.volume));}catch(_){}
      this.update();
    };
    volume.onchange=()=>this.play('select');
  }
};
