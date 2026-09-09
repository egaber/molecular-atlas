/* Schematic geometry only. No fitted kinetics, synthetic patient data or efficacy calculations. */
(() => {
  'use strict';
  const T = window.THREE;
  if (!T) { window.AtlasScene = null; return; }
  const V = (x=0,y=0,z=0) => new T.Vector3(x,y,z);
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  const mix = (a,b,t) => a+(b-a)*t;
  const ease = t => t*t*(3-2*t);
  class AtlasScene {
    constructor(canvas, labelHost) {
      this.canvas=canvas; this.labelHost=labelHost;
      this.renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'low-power'});
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.75));
      this.renderer.outputEncoding=T.sRGBEncoding;
      this.renderer.toneMapping=T.NoToneMapping;
      this.scene=new T.Scene();
      this.camera=new T.PerspectiveCamera(40,1,.1,100);
      this.camera.position.set(0,1.6,12);
      this.controls=new T.OrbitControls(this.camera,canvas);
      this.controls.enableDamping=false; this.controls.enablePan=false;
      this.controls.minDistance=5; this.controls.maxDistance=25;
      this.controls.maxPolarAngle=Math.PI*.9;
      this.controls.addEventListener('change',()=>this.render());
      this.controls.addEventListener('start',()=>{this.userCamera=true;});
      this.ambient=new T.AmbientLight(0xffffff,.8); this.scene.add(this.ambient);
      this.key=new T.DirectionalLight(0xffffff,.75); this.key.position.set(3,6,8); this.scene.add(this.key);
      this.fill=new T.DirectionalLight(0xffffff,.3); this.fill.position.set(-5,0,-3); this.scene.add(this.fill);
      this.root=new T.Group(); this.scene.add(this.root);
      this.labels=[]; this.animations=[]; this.layers={}; this.step=0; this.phase=0;
      this.materials=[]; this.labelsVisible=true; this.colors={};
      this.setColors();
      this.resizeObserver=new ResizeObserver(()=>this.resize());
      this.resizeObserver.observe(canvas.parentElement);
      canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();document.getElementById('fallback').hidden=false;});
      canvas.addEventListener('webglcontextrestored',()=>{document.getElementById('fallback').hidden=true;this.render();});
      this.resize();
    }
    setColors(){
      const s=getComputedStyle(document.documentElement);
      const keys={tumor:'accent',nk:'success',antibody:'link',ligand:'warning',bone:'border-strong',text:'text',muted:'text-soft',surface:'surface',danger:'danger',bg:'surface-soft'};
      for(const [key,token] of Object.entries(keys)) this.colors[key]=s.getPropertyValue(`--cp-${token}`).trim();
      this.scene.background=new T.Color(this.colors.bg);
    }
    mat(key,opacity=1,wireframe=false){
      const m=new T.MeshPhongMaterial({color:new T.Color(this.colors[key]||this.colors.text).convertSRGBToLinear(),shininess:28,transparent:opacity<1,opacity,wireframe,depthWrite:opacity>=.8,side:T.DoubleSide});
      this.materials.push(m); return m;
    }
    sphere(parent,x,y,z,r,key,opacity=1,scale){
      const m=new T.Mesh(new T.SphereGeometry(r,24,18),this.mat(key,opacity));
      m.position.set(x,y,z); if(scale)m.scale.set(...scale); parent.add(m); return m;
    }
    link(parent,a,b,r,key,opacity=1){
      const av=Array.isArray(a)?V(...a):a, bv=Array.isArray(b)?V(...b):b;
      const delta=bv.clone().sub(av);const m=new T.Mesh(new T.CylinderGeometry(r,r,Math.max(delta.length(),.001),10),this.mat(key,opacity));
      m.position.copy(av).add(bv).multiplyScalar(.5);m.quaternion.setFromUnitVectors(V(0,1,0),delta.normalize());parent.add(m);return m;
    }
    ring(parent,pos,r,key,rotation=[Math.PI/2,0,0],tube=.035){
      const m=new T.Mesh(new T.TorusGeometry(r,tube,8,72),this.mat(key,.65));m.position.set(...pos);m.rotation.set(...rotation);parent.add(m);return m;
    }
    box(parent,pos,size,key,opacity=1){
      const m=new T.Mesh(new T.BoxGeometry(...size),this.mat(key,opacity));m.position.set(...pos);parent.add(m);return m;
    }
    arrow(parent,a,b,key,dashed=false){
      const av=V(...a),bv=V(...b),delta=bv.clone().sub(av),length=delta.length();
      if(dashed){for(let t=0;t<.9;t+=.13)this.link(parent,av.clone().lerp(bv,t),av.clone().lerp(bv,t+.065),.022,key,.7);}
      else this.link(parent,av,bv,.027,key,.75);
      const cone=new T.Mesh(new T.ConeGeometry(.105,.22,12),this.mat(key));
      cone.position.copy(bv);cone.quaternion.setFromUnitVectors(V(0,1,0),delta.normalize());parent.add(cone);return length;
    }
    label(parent,text,pos,sub='',options={}){
      const anchor=new T.Object3D();anchor.position.set(...pos);parent.add(anchor);
      const el=document.createElement('div');el.className='object-label';
      const strong=document.createElement('strong');strong.textContent=text;el.append(strong);
      if(sub){const small=document.createElement('small');small.textContent=sub;el.append(small);}
      this.labelHost.append(el);this.labels.push({anchor,el,...options});return el;
    }
    cell(parent,pos,r,key,{nucleus=true,markers=false,opacity=.5,granules=false}={}){
      const g=new T.Group();g.position.set(...pos);parent.add(g);
      this.sphere(g,0,0,0,r,key,opacity);
      const wire=new T.Mesh(new T.SphereGeometry(r*1.005,18,12),this.mat(key,.12,true));g.add(wire);
      if(nucleus)this.sphere(g,-r*.18,r*.05,-r*.1,r*.46,key,.92,[1,.88,.85]);
      if(markers){
        for(let i=0;i<30;i++){
          const y=1-(i+.5)*2/30,rho=Math.sqrt(1-y*y),phi=i*2.39996;
          const p=V(Math.cos(phi)*rho,y,Math.sin(phi)*rho).multiplyScalar(r);
          this.link(g,p,p.clone().multiplyScalar(1.14),.025,'antibody');
          this.sphere(g,p.x*1.16,p.y*1.16,p.z*1.16,.055,'antibody');
        }
      }
      if(granules){for(let i=0;i<14;i++){const a=i*2.4;this.sphere(g,Math.sin(a)*r*.62,Math.cos(a)*r*.65,Math.sin(a*1.7)*r*.45,.075,'ligand');}}
      return g;
    }
    antibody(parent,pos,angle=0,scale=1){
      const g=new T.Group();g.position.set(...pos);g.rotation.z=angle;g.scale.setScalar(scale);parent.add(g);
      this.link(g,[0,0,0],[0,.44,0],.065,'antibody');
      for(const side of [-1,1]){
        this.link(g,[0,.4,0],[side*.29,.86,0],.055,'antibody');
        this.sphere(g,side*.29,.86,0,.07,'antibody');
      }return g;
    }
    dna(parent,pos,scale=1){
      const g=new T.Group();g.position.set(...pos);g.scale.setScalar(scale);parent.add(g);
      let oldA,oldB;
      for(let i=0;i<34;i++){
        const y=(i-16.5)*.095,a=i*.5;
        const pa=V(Math.cos(a)*.39,y,Math.sin(a)*.39),pb=V(-pa.x,y,-pa.z);
        this.sphere(g,pa.x,pa.y,pa.z,.05,'antibody');this.sphere(g,pb.x,pb.y,pb.z,.05,'tumor');
        this.link(g,pa,pb,.02,'bone',.7);
        if(oldA){this.link(g,oldA,pa,.029,'antibody');this.link(g,oldB,pb,.029,'tumor');}oldA=pa;oldB=pb;
      }return g;
    }
    clear(){
      this.root.traverse(o=>{if(o.geometry)o.geometry.dispose();});
      for(const m of this.materials)m.dispose();this.materials=[];
      this.scene.remove(this.root);this.root=new T.Group();this.scene.add(this.root);
      this.labelHost.replaceChildren();this.labels=[];this.animations=[];this.layers={};
    }
    setChapter(chapter){
      this.chapter=chapter;this.clear();this.setColors();this.step=0;this.phase=0;
      switch(chapter.scene){
        case 'body':this.body();break;
        case 'cohort':this.cohort(false);break;
        case 'ensemble':this.ensemble();break;
        case 'schedule':this.schedule();break;
        case 'donor':this.donor();break;
        case 'manufacture':this.manufacture();break;
        case 'tissue':this.tissue();break;
        case 'synapse':this.synapse(false);break;
        case 'receptors':this.synapse(true);break;
        case 'nucleus':this.nucleus();break;
        case 'cytokines':this.ensemble(true);break;
        case 'blood':this.blood();break;
        case 'assay':this.assay();break;
        case 'outcomes':this.cohort(true);break;
        case 'survival':this.survival();break;
        case 'safety':this.safety();break;
        case 'future':this.future();break;
        default:this.evidence();
      }
      this.resetCamera();this.update(0,0);
    }
    resetCamera(){
      this.userCamera=false;
      const body=this.chapter?.scene==='body',wide=['cohort','outcomes','schedule'].includes(this.chapter?.scene);
      const halfHeight=body?3.75:3.05,halfWidth=body?3.35:wide?4.15:3.95;
      const tangent=Math.tan(this.camera.fov*Math.PI/360);
      const distance=Math.max(halfHeight/tangent,halfWidth/(tangent*this.camera.aspect));
      this.camera.position.set(0,body?.35:1.2,distance);
      this.controls.target.set(0,0,0);this.controls.update();this.render();
    }
    rotate(amount){this.userCamera=true;const offset=this.camera.position.clone().sub(this.controls.target);offset.applyAxisAngle(V(0,1,0),amount);this.camera.position.copy(this.controls.target).add(offset);this.controls.update();}
    zoom(factor){this.userCamera=true;const off=this.camera.position.clone().sub(this.controls.target);off.setLength(clamp(off.length()*factor,5,25));this.camera.position.copy(this.controls.target).add(off);this.controls.update();}
    setLayer(name,visible){if(this.layers[name])this.layers[name].visible=visible;this.render();}
    update(step,phase){this.step=step;this.phase=phase;for(const fn of this.animations)fn(step,phase);this.render();}
    resize(){const r=this.canvas.parentElement.getBoundingClientRect();if(!r.width||!r.height)return;this.renderer.setSize(r.width,r.height,false);this.camera.aspect=r.width/r.height;this.camera.updateProjectionMatrix();if(this.chapter&&!this.userCamera)this.resetCamera();else this.render();}
    render(){
      if(!this.renderer)return;this.renderer.render(this.scene,this.camera);
      const rect=this.canvas.getBoundingClientRect(),occupied=[];
      for(const l of this.labels){
        let visible=this.labelsVisible;for(let p=l.anchor;p;p=p.parent)if(!p.visible)visible=false;
        if(l.steps&&!l.steps.includes(this.step))visible=false;
        const p=l.anchor.getWorldPosition(V()).project(this.camera);
        if(p.z>1||p.z< -1)visible=false;
        l.el.hidden=!visible;if(!visible)continue;
        let x=(p.x*.5+.5)*rect.width,y=(-p.y*.5+.5)*rect.height;
        const w=l.el.offsetWidth,h=l.el.offsetHeight;
        x=clamp(x,w/2+8,rect.width-w/2-8);y=clamp(y,52,rect.height-88);
        for(let n=0;n<8;n++){
          const collides=occupied.some(b=>Math.abs(x-b.x)<(w+b.w)/2+3&&Math.abs(y-b.y)<(h+b.h)/2+3);
          if(!collides)break;y=clamp(y+(n%2===0?1:-1)*(h+5)*(Math.floor(n/2)+1),52,rect.height-88);
        }
        occupied.push({x,y,w,h});l.el.style.left=x+'px';l.el.style.top=y+'px';
      }
    }
    body(){
      const g=this.root;
      this.sphere(g,0,2.75,0,.52,'bone',.27,[.88,1.05,.85]);
      this.sphere(g,0,.95,0,1,'bone',.12,[1.12,1.5,.5]);
      this.sphere(g,0,-.65,0,.9,'bone',.13,[1,.67,.55]);
      for(const s of [-1,1]){
        this.link(g,[s*.95,1.8,0],[s*1.55,.4,0],.19,'bone',.3);this.link(g,[s*1.55,.4,0],[s*1.55,-.65,.1],.14,'bone',.3);
        this.link(g,[s*.46,-.9,0],[s*.6,-2.1,0],.24,'bone',.28);this.link(g,[s*.6,-2.1,0],[s*.64,-3.2,.05],.17,'bone',.28);
        this.sphere(g,s*.65,.4,.03,.3,'bone',.45,[.6,1,.6]);
        this.sphere(g,s*.65,.78,.06,.15,'ligand',.9,[1,.5,.6]);
        for(let i=0;i<5;i++){
          const rib=this.ring(g,[0,1.55-i*.22,0],.69+i*.035,'bone',[Math.PI/2,0,0],.025);rib.scale.set(1,.65,1);
        }
      }
      for(let i=0;i<17;i++)this.sphere(g,0,1.96-i*.19,-.18,.085,'bone',.7,[1,.7,1]);
      for(const side of [-1,1]){
        this.link(g,[side*.18,1.95,-.1],[side*.18,-.95,-.1],.014,'ligand',.7);
        for(let i=0;i<11;i++)this.sphere(g,side*.18,1.9-i*.26,-.1,.033,'ligand');
      }
      const lesion=this.cell(g,[.75,.92,.36],.32,'tumor',{opacity:.8});
      this.sphere(g,-.43,-1.6,.18,.15,'tumor');this.sphere(g,.13,1.6,.38,.1,'tumor');
      this.label(g,'Example soft-tissue site',[1.62,1.15,0],'not a patient reconstruction');
      this.label(g,'Bone & marrow',[-1.38,-1.4,.3],'distinct disease compartments');
      this.label(g,'Sympathetic chain',[-1.42,2.1,0],'orientation only');
      const marrow=new T.Group();marrow.position.set(2.25,-1.35,.2);g.add(marrow);
      this.link(marrow,[0,-.7,0],[0,.7,0],.36,'bone',.2);
      for(let i=0;i<14;i++)this.sphere(marrow,Math.sin(i*2.4)*.19,(i/13-.5)*1.12,Math.cos(i*2.4)*.18,.07,i%4===0?'tumor':'nk',.9);
      this.label(marrow,'Marrow inset',[.1,-1,0],'schematic enlargement');
      this.animations.push((s,p)=>{marrow.visible=s>=2;lesion.scale.setScalar(1+.05*Math.sin(p*Math.PI*2));});
    }
    cohort(outcomes){
      const g=this.root;
      window.ATLAS.patients.forEach((p,i)=>{
        const x=(i-2)*1.5;
        this.cell(g,[x,.35,0],.46,outcomes?'tumor':'nk',{opacity:.62});
        this.label(g,p.id,[x,1.32,0],outcomes?p.response:`Age ${p.age} at treatment`);
        for(let c=0;c<p.cycles;c++)this.sphere(g,x+(c%2? .12:-.12),-.5-Math.floor(c/2)*.19,0,.058,'antibody');
        this.label(g,`${p.cycles} course${p.cycles===1?'':'s'}`,[x,-1.95,0],outcomes?`Curie ${p.curie} → ${p.best}${i===0?'*':''}`:p.risk+' initial risk');
      });
      this.label(g,outcomes?'3 complete · 1 partial · 1 minor':'Five participants—not 26',[0,2.1,0],outcomes?'Symbols represent people, not tumor volume':'Dots below each participant = course count');
      this.animations.push((s,p)=>{g.rotation.y=(s===0?.05:.02)*Math.sin(p*Math.PI*2);});
    }
    ensemble(cytokines=false){
      if(cytokines){this.cytokineDetail();return;}
      const g=this.root;
      this.cell(g,[0,-.2,0],1.08,'tumor',{markers:false,opacity:.46});
      this.label(g,'Neuroblastoma',[0,-1.7,0],'GD2 + potential stress ligands');
      const nkLayer=new T.Group();g.add(nkLayer);this.layers.nk=nkLayer;
      this.cell(nkLayer,[-2.65,-.45,0],.85,'nk',{granules:true});
      this.cell(nkLayer,[2.65,-.45,0],.85,'nk',{granules:true});
      this.label(nkLayer,'NK: CD16 / ADCC',[-2.7,-1.8,0]);this.label(nkLayer,'NK: NKG2D',[2.7,-1.8,0]);
      const abLayer=new T.Group();g.add(abLayer);this.layers.antibody=abLayer;
      this.antibody(abLayer,[-1.78,-.15,.3],-Math.PI/2,.8);this.link(abLayer,[-1.02,-.15,.3],[-.9,-.15,.3],.06,'antibody');
      const ligLayer=new T.Group();g.add(ligLayer);this.layers.ligands=ligLayer;
      for(let i=0;i<5;i++){const y=(i-2)*.25;this.link(ligLayer,[.94,y,.25],[1.18,y,.25],.035,'ligand');this.sphere(ligLayer,1.23,y,.25,.085,'ligand');}
      this.link(ligLayer,[1.42,-.15,.25],[1.78,-.15,.25],.06,'nk');this.label(ligLayer,'NKG2DL',[1.4,.85,0],'different from GD2');
      const phLayer=new T.Group();g.add(phLayer);this.layers.phagocyte=phLayer;
      const ph=this.cell(phLayer,[0,2.12,-.1],.67,'bone',{nucleus:false,opacity:.55});
      for(let i=0;i<3;i++)this.sphere(ph,(i-1)*.18,0,0,.18,'bone',1);
      this.label(phLayer,'Phagocyte: ADCP',[0,3.08,0]);this.antibody(abLayer,[0,1.38,.2],Math.PI,.67);
      this.label(g,'IL-2',[-2.7,1.38,0],'NK + other lymphocytes');this.arrow(g,[-2.65,1.05,0],[-2.65,.55,0],'antibody');
      this.label(g,'GM-CSF',[2.6,2.17,0],'myeloid support');this.arrow(g,[1.9,2.1,0],[.86,2.1,0],'antibody');
      const granules=[];for(let i=0;i<6;i++)granules.push(this.sphere(nkLayer,-1.5,-.6+i*.085,.3,.035,'ligand'));
      const chemo=new T.Group();g.add(chemo);
      this.box(chemo,[-2.6,-2.45,0],[.28,.38,.14],'tumor',.8);
      this.label(chemo,'Chemotherapy → DNA damage',[-2,-2.8,0],'proposed stress-ligand route');
      this.arrow(chemo,[-2.4,-2.2,0],[-.6,-1.05,0],'tumor',true);
      const spir=new T.Group();g.add(spir);
      this.sphere(spir,2.6,-2.45,0,.16,'ligand',1,[1.5,.6,.6]);
      this.label(spir,'Spironolactone → RXRγ',[2,-2.8,0],'proposed ligand regulation');
      this.arrow(spir,[2.4,-2.2,0],[.65,-1.05,0],'ligand',true);
      this.animations.push((s,p)=>{
        chemo.visible=spir.visible=s===3;
        granules.forEach((m,i)=>{m.visible=s===1;m.position.x=mix(-1.75,-.94,(p+i/7)%1);});
      });
    }
    cytokineDetail(){
      const g=this.root;
      const nk=this.cell(g,[-2.7,.6,0],.7,'nk',{granules:true});this.layers.nk=nk;
      this.label(g,'IL-2 → lymphocyte support',[-2.55,1.9,0],'not itself target recognition');
      const il2=this.sphere(g,-2.7,2.4,.3,.09,'antibody');
      this.label(g,'GM-CSF → myeloid support',[1.4,2.5,0],'phagocyte arm of Figure 6');
      const ph=new T.Group();ph.position.set(1.1,.3,0);g.add(ph);this.layers.phagocyte=ph;
      const cytoplasm=new T.Mesh(new T.CircleGeometry(1.1,64),this.mat('bone',.09));
      cytoplasm.position.z=-.4;ph.add(cytoplasm);
      // Cross-section of a phagocyte membrane, with an open cup toward the target.
      const cup=new T.Mesh(new T.TorusGeometry(1.1,.085,12,80,Math.PI*1.53),this.mat('bone',.85));
      cup.rotation.z=1.235*Math.PI;ph.add(cup);
      this.sphere(ph,.4,-.28,-.35,.30,'bone',.8);
      this.label(ph,'Phagocyte membrane',[1.15,1.0,0]);
      const cargo=new T.Group();g.add(cargo);
      this.cell(cargo,[0,0,0],.27,'tumor',{nucleus:false,opacity:.8});
      // Fab tips touch the cargo surface. Fc is at x=.552, outside the target.
      const coat=this.antibody(cargo,[.552,0,0],Math.PI/2,.35);
      coat.name='adcp-antibody';cargo.name='adcp-cargo';
      // One Fc receptor remains bound to Fc and anchored in the wrapping membrane.
      const receptor=this.link(cargo,[.552,0,0],[.81,0,0],.034,'nk');
      receptor.name='adcp-fc-receptor';
      const closure=new T.Mesh(new T.TorusGeometry(1.1,.085,12,32,Math.PI*.47),this.mat('bone',.85));
      closure.rotation.z=.765*Math.PI;closure.name='adcp-outer-closure';ph.add(closure);
      const vesicle=new T.Mesh(new T.TorusGeometry(.63,.035,8,64),this.mat('bone',.85));
      vesicle.position.set(.18,0,0);vesicle.name='adcp-phagosome';cargo.add(vesicle);
      // Four reusable segments form an open cup around (never through) the cargo.
      const arms=Array.from({length:4},()=>this.link(g,[0,0,0],[0,1,0],.045,'bone',.85));
      const positionSegment=(mesh,a,b)=>{
        const av=V(...a),bv=V(...b),delta=bv.clone().sub(av);
        mesh.position.copy(av).add(bv).multiplyScalar(.5);mesh.scale.y=delta.length();
        mesh.quaternion.setFromUnitVectors(V(0,1,0),delta.normalize());
      };
      this.label(g,'Fc ↔ phagocyte Fc receptor',[-.9,1.22,0],'binding maintained during enclosure');
      this.label(g,'Antibody-coated target material',[-1,-1.5,0],'schematic cross-section');
      const stageLabel=this.label(g,'',[1.2,-1.6,0]);
      this.animations.push((s,p)=>{
        il2.visible=s===0;il2.position.y=mix(2.4,1.4,p);
        const q=s===2?ease(clamp(p/.65,0,1)):0;
        cargo.position.set(mix(-1.0,1.0,q),.3,0);
        // Cargo stops moving before any closed membrane is introduced. The phagosome
        // encloses the target, Fab/Fc and receptor, and remains attached to the cargo.
        const enclosed=s===2&&p>=.9;
        closure.visible=s===2&&p>=.96;vesicle.visible=enclosed;
        const x=cargo.position.x;
        positionSegment(arms[0],[.286,1.04,0],[x+.18,.93,0]);
        positionSegment(arms[1],[x+.18,.93,0],[x+.81,.3,0]);
        positionSegment(arms[2],[.286,-.44,0],[x+.18,-.33,0]);
        positionSegment(arms[3],[x+.18,-.33,0],[x+.81,.3,0]);
        arms.forEach(m=>m.visible=!enclosed);
        stageLabel.firstElementChild.textContent=enclosed?'Enclosed phagosome':s===2&&p>.15?'Membrane cup remains open':'Fc recognition before engulfment';
      });
    }
    schedule(){
      const g=this.root,x=d=>-3.5+(d+6)/27*7;
      this.arrow(g,[-3.65,-1.9,0],[3.7,-1.9,0],'bone');
      for(const d of [-6,-2,0,7,14,21]){this.link(g,[x(d),-1.8,0],[x(d),-2,0],.02,'bone');this.label(g,String(d),[x(d),-2.3,0]);}
      const rows=[['Chemo + antibody',-6,-2,1.7,'tumor'],['Spironolactone',-1,19,.65,'ligand'],['GM-CSF',0,19,-.45,'antibody']];
      for(const [name,a,b,y,key] of rows){this.link(g,[x(a),y,0],[x(b),y,0],.10,key,.9);this.label(g,name,[-2.4,y+.42,0]);}
      for(const d of [-1,1,3,5,7,9])this.sphere(g,x(d),-1.18,0,.075,'nk');
      this.label(g,'IL-2: −1, +1, +3, +5, +7, +9',[1.1,-1.38,0]);
      this.link(g,[x(0),-1.75,.12],[x(0),1.95,.12],.024,'nk');this.label(g,'Day 0 · NK infusion',[x(0),2.55,0]);
      this.label(g,'Recovery-dependent duration',[2.2,.95,0],'bar ends are not stop dates');
      const marker=this.sphere(g,x(-6),2.1,0,.12,'nk');
      this.animations.push((s,p)=>{const day=[mix(-6,-2,p),-1,0,mix(1,21,p)][s];marker.position.x=x(day);});
    }
    donor(){
      const g=this.root;
      this.cell(g,[-2.3,.2,0],1,'nk',{granules:true});this.cell(g,[2.3,.2,0],1,'tumor',{});
      this.label(g,'Donor NK',[-2.3,1.8,0],'parent shares one HLA haplotype');
      this.label(g,'Target cell',[2.3,1.8,0],'HLA class I + activating ligands');
      this.link(g,[-1.3,.35,0],[-.85,.35,0],.075,'bone');this.sphere(g,-.75,.35,0,.16,'bone');
      const ligand=new T.Group();g.add(ligand);this.link(ligand,[1.3,.35,0],[.86,.35,0],.075,'bone');
      const matched=this.sphere(ligand,.73,.35,0,.18,'bone');
      const noncognate=this.box(ligand,[.73,.35,0],[.29,.29,.29],'bone');
      const brake=this.link(g,[-.6,.35,0],[.55,.35,0],.027,'bone',.55);
      this.label(g,'Inhibitory KIR',[-.9,-.5,.2]);this.label(g,'HLA ligand',[.95,-.5,.2]);
      this.arrow(g,[1.2,-1.15,0],[-1.2,-1.15,0],'ligand',true);
      this.label(g,'Other activating signals still matter',[0,-2,0]);
      const stateLabel=this.label(g,'',[0,1.15,0]);
      this.animations.push((s)=>{
        matched.visible=s!==2;noncognate.visible=s===2;brake.visible=s!==2;
        stateLabel.firstElementChild.textContent=s===2?'Noncognate HLA example: this KIR brake not engaged':'Compatible inhibitory KIR–HLA example';
      });
    }
    manufacture(){
      const g=this.root;
      for(let i=0;i<3;i++){
        this.box(g,[(i-1)*2.8,0,-.4],[1.9,2.1,.4],'bone',.12);
        this.label(g,['PBMC collection','CD3 depletion','CD56 enrichment'][i],[(i-1)*2.8,1.7,0]);
      }
      this.arrow(g,[-1.75,0,0],[-1.05,0,0],'bone');this.arrow(g,[1.05,0,0],[1.75,0,0],'bone');
      const particles=[];
      for(let i=0;i<42;i++){
        const type=i%3;const m=this.sphere(g,0,0,0,type===2?.09:.11,['nk','antibody','bone'][type]);
        particles.push({m,type,y:Math.sin(i*2.4)*.73,z:Math.cos(i*2.4)*.44,offset:i/42});
      }
      this.label(g,'Green: NK · blue: T · gray: other PBMCs',[0,-1.6,0],'illustrative particles, not measured yields');
      this.label(g,'Release: purity ≥90% · viability ≥70%',[0,-2.25,0],'residual T cells and sterility also checked');
      this.animations.push((s,p)=>{
        for(const d of particles){
          let x=-2.8+Math.sin(d.offset*16)*.65;
          if(s===1)x=d.type===1?-.2:mix(-2.8,.1,ease(p));
          if(s>=2)x=d.type===0?mix(.1,2.8,ease(p)):d.type===1?-1.5:.1;
          d.m.position.set(x+d.offset*.35,d.y+(s>=1&&d.type===1?-1:0),d.z);
        }
      });
    }
    tissue(){
      const g=this.root;
      this.link(g,[-3.5,1.7,-.7],[3.5,1.7,-.7],.32,'antibody',.15);
      for(let i=0;i<9;i++){
        const x=(i%3-1)*1.3,y=-.3-Math.floor(i/3)*.7,z=(i%2?-.35:.35);
        this.cell(g,[x,y,z],.43,'tumor',{opacity:.53,markers:i%2===0});
      }
      for(let i=0;i<5;i++)this.link(g,[-3+i*1.4,-2.1,-.7],[-2.3+i*1.1,1.0,-.5],.025,'bone',.25);
      const nk=this.cell(g,[-3,1.7,-.6],.4,'nk',{granules:true,opacity:.6});
      this.label(g,'Circulation',[0,2.5,-.6],'infusion delivers cells to blood');
      this.label(g,'Tumor + surrounding tissue',[.1,-2.7,0],'not a patient-specific microenvironment');
      this.label(g,'Tissue access is not guaranteed',[-2.8,.2,0]);
      this.animations.push((s,p)=>{
        if(s===0)nk.position.set(mix(-3,3,p),1.7,-.6);
        else if(s===1)nk.position.set(-2,mix(1.7,-.25,ease(p)),-.3);
        else nk.position.set(mix(-2.5,-1.9,ease(p)),-.3,.3);
      });
    }
    synapse(receptors){
      const g=this.root;
      this.cell(g,[-2.12,0,0],1.35,'tumor',{opacity:.36});
      this.cell(g,[2.12,0,0],1.35,'nk',{opacity:.36,granules:true});
      this.label(g,'Target membrane',[-2.25,1.95,0]);this.label(g,'NK-cell membrane',[2.2,1.95,0]);
      const ab=new T.Group();g.add(ab);
      // Fab tips point left toward GD2; Fc points right toward NK CD16.
      const antibody=this.antibody(ab,[.40,.45,.5],Math.PI/2,.86);
      for(const y of [.20,.70]){
        this.link(ab,[-.97,y,.5],[-.48,y,.5],.035,'antibody');
        this.sphere(ab,-.44,y,.5,.075,'antibody');
      }
      this.link(ab,[.93,.45,.5],[.46,.45,.5],.06,'nk');
      this.label(ab,'GD2',[-1.4,-1.25,.65],'glycolipid on target');
      this.label(ab,'Fab ← antibody → Fc',[0,2.65,0],'antibody remains extracellular');
      this.label(ab,'CD16',[1.45,-1.25,.65],'Fc receptor on NK');
      const stress=new T.Group();g.add(stress);
      this.link(stress,[-.99,-.63,.45],[-.26,-.63,.45],.055,'ligand');this.sphere(stress,-.18,-.63,.45,.12,'ligand');
      this.link(stress,[.99,-.63,.45],[.26,-.63,.45],.055,'nk');
      this.sphere(stress,.18,-.55,.45,.11,'nk');this.sphere(stress,.18,-.72,.45,.11,'nk');
      this.label(stress,'NKG2DL',[-.85,-1.65,.5],'MICA/B, ULBPs');this.label(stress,'NKG2D',[.92,-1.65,.5],'activating receptor');
      const inhibitory=new T.Group();g.add(inhibitory);
      this.link(inhibitory,[-1.35,-1.15,0],[-.5,-1.15,0],.04,'bone');this.link(inhibitory,[1.35,-1.15,0],[.5,-1.15,0],.04,'bone');
      this.label(inhibitory,'HLA class I ↔ inhibitory KIR',[0,-2.45,0],'one brake among multiple signals');
      const grains=[];for(let i=0;i<9;i++)grains.push(this.sphere(g,.62,(i-4)*.06,.8,.032,'ligand'));
      this.animations.push((s,p)=>{
        ab.visible=!receptors;stress.visible=receptors;inhibitory.visible=receptors&&s>=2;
        // Both antibody Fab tips and Fc remain in the extracellular intercellular gap.
        antibody.position.x=.40;
        antibody.position.y=!receptors&&s===0?2.0:!receptors&&s===1?mix(2.0,.45,ease(p)):.45;
        grains.forEach((m,i)=>{m.visible=!receptors&&s===3;m.position.x=mix(.66,-.86,clamp((p+i*.07)%1,0,1));});
      });
    }
    nucleus(){
      const g=this.root;
      this.label(g,'ABSTRACT PATHWAY · NOT CELLULAR LOCATIONS',[0,2.6,0],'nodes and arrows are conceptual relationships');
      const nodes=[[-2.9,.5,'Spironolactone','ligand'],[-.95,.5,'RXRγ-dependent','ligand'],[1.05,.5,'ATM → Chk2','antibody'],[2.95,.5,'Ligand expression','ligand']];
      for(const [x,y,name,key] of nodes){this.sphere(g,x,y,.3,.25,key);this.label(g,name,[x,y+.7,.3]);}
      for(let i=0;i<nodes.length-1;i++)this.arrow(g,[nodes[i][0]+.3,nodes[i][1],.3],[nodes[i+1][0]-.3,nodes[i+1][1],.3],'ligand',true);
      const dna=this.dna(g,[0,-1.25,-.2],.5);dna.rotation.z=Math.PI/2;
      this.label(g,'Gene regulation is one proposed connection',[0,-2.35,0],'DNA icon—not a physical transport route or binding pose');
      const messenger=this.sphere(g,-2.9,.5,.5,.08,'ligand');
      this.animations.push((s,p)=>{
        const a=nodes[Math.min(s,2)],b=nodes[Math.min(s+1,3)];messenger.position.set(mix(a[0],b[0],ease(p)),mix(a[1],b[1],ease(p)),.5);
        messenger.visible=s<3;
      });
    }
    blood(){
      const g=this.root;
      this.ring(g,[0,0,0],2.2,'bone',[0,0,0]);
      const cells=[];for(let i=0;i<27;i++){
        const a=i*2.39996,r=1.9*Math.sqrt((i+.5)/27),x=Math.cos(a)*r,y=Math.sin(a)*r;
        const m=this.sphere(g,x,y,Math.sin(i)*.23,.14,i%5===0?'nk':'bone',.8);cells.push(m);
      }
      this.label(g,'NK cells / PBMCs',[0,2.95,0],'a proportion—not an absolute count');
      this.label(g,'NK phenotype',[-3,.65,0],'CD45+ CD56+ CD3−');
      this.label(g,'Other PBMCs',[3,.65,0],'denominator also changes');
      const denominatorLabel=this.label(g,'',[0,-2.8,0]);
      this.animations.push((s,p)=>{
        cells.forEach(m=>{m.scale.setScalar(1);m.material.opacity=.8;});
        denominatorLabel.firstElementChild.textContent=s===2?'Possible explanations: NK ↑ · other PBMC ↓ · both':'Sampled: D0, D7, D14, D21, cycle end';
        // Do not animate loss of other PBMCs as the measured cause of this patient trend.
      });
    }
    assay(){
      const g=this.root;
      this.ring(g,[0,-.4,0],2.6,'bone',[Math.PI/2,0,0],.08);this.ring(g,[0,-.65,0],2.6,'bone',[Math.PI/2,0,0],.05);
      const base=new T.Mesh(new T.CylinderGeometry(2.6,2.6,.08,64),this.mat('bone',.10));base.position.y=-.65;g.add(base);
      this.cell(g,[0,.1,.1],.55,'tumor',{opacity:.6,markers:true});
      const effectors=[];for(let i=0;i<10;i++){
        const a=i/10*Math.PI*2,r=1.7;const m=this.cell(g,[Math.cos(a)*r,-.25,Math.sin(a)*r],.21,i%3===0?'bone':'nk',{opacity:.7,nucleus:false});effectors.push({m,a});
      }
      this.antibody(g,[.75,.25,.35],Math.PI/2,.45);
      for(let i=0;i<7;i++)this.sphere(g,Math.cos(i)*2.1,-.35,Math.sin(i)*2.1,.065,'antibody');
      this.label(g,'IMR-32-GFP targets',[0,1.75,0],'not a patient-derived tumor');
      this.label(g,'PBMC effectors',[-2.6,.95,0],'mixed cell population');
      this.label(g,'Anti-GD2: 14.G2a',[2.55,.95,0],'not the clinical antibody product');
      this.label(g,'50:1 PBMC : target · 4 hours',[0,-1.85,1],'drawing cell count is illustrative');
      this.animations.push((s,p)=>{for(const d of effectors){const r=s>=1?mix(1.7,1.05,ease(p)):1.7;d.m.position.x=Math.cos(d.a)*r;d.m.position.z=Math.sin(d.a)*r;}});
    }
    survival(){
      const g=this.root;const y=value=>-1.9+value/100*3.8;
      for(const [x,estimate,lo,hi,name] of [[-1.75,60,23,88,'One-year PFS'],[1.75,100,57,100,'One-year OS']]){
        this.link(g,[x,y(0),0],[x,y(estimate),0],.12,'tumor');
        this.link(g,[x+.36,y(lo),0],[x+.36,y(hi),0],.025,'bone');
        for(const v of [lo,hi])this.link(g,[x+.2,y(v),0],[x+.52,y(v),0],.03,'bone');
        this.label(g,name,[x,2.9,0],`${estimate}% · 95% CI ${lo}–${hi}%`);
        this.sphere(g,x,y(estimate),0,.13,'tumor');
      }
      this.label(g,'Published one-year estimates, not a new KM curve',[0,-2.7,0],'five participants · no individual prediction');
    }
    safety(){
      const g=this.root;
      for(const [i,name,key] of [[0,'Red cells','tumor'],[1,'Platelets','ligand'],[2,'Neutrophils','bone']]){
        const x=(i-1)*2.55;
        if(i===0){for(let j=0;j<5;j++){const m=this.sphere(g,x+Math.sin(j*2.4)*.42,Math.cos(j*2.4)*.6,Math.sin(j)*.3,.24,key,1,[1,.3,1]);m.rotation.x=.65;}}
        if(i===1){for(let j=0;j<9;j++)this.sphere(g,x+Math.sin(j*2.4)*.55,Math.cos(j*2.4)*.75,Math.sin(j)*.2,.085,key);}
        if(i===2){const cell=this.cell(g,[x,0,0],.6,key,{nucleus:false});for(let j=0;j<3;j++)this.sphere(cell,(j-1)*.22,Math.sin(j)*.12,0,.18,key);}
        this.label(g,name,[x,1.55,0],['oxygen transport','clotting support','infection defense'][i]);
        this.label(g,'26 / 26 courses',[x,-1.3,0],'grade 3 count suppression');
      }
      this.label(g,'Fever + neutropenia needs clinical assessment',[0,-2.45,0],'not automatically sterile cytokine inflammation');
    }
    future(){
      const g=this.root;
      this.cell(g,[-2.6,0,0],.8,'tumor',{opacity:.5});this.label(g,'Initial disease control',[-2.6,1.65,0],'observed in a small cohort');
      for(const [i,name] of ['Consolidation?','Maintenance?','New combinations?'].entries()){
        const y=(1-i)*1.45;this.sphere(g,2,y,0,.3,'bone',.4);this.arrow(g,[-1.6,0,0],[1.5,y,0],'ligand',true);this.label(g,name,[2.25,y+.5,0]);
      }
      this.label(g,'Dashed paths are research questions',[0,-2.6,0],'no tested post-quadruple sequence in this cohort');
    }
    evidence(){
      const g=this.root;
      const names=['Observed','General biology','Preclinical rationale','Unresolved'];
      for(let i=0;i<4;i++){
        const x=(i-1.5)*1.8;this.box(g,[x,0,-.2],[1.35,1.8,.12],i===0?'nk':i===3?'tumor':'bone',.4);
        for(let j=0;j<5;j++)this.link(g,[x-.45,.5-j*.24,0],[x+.45,.5-j*.24,0],.014,'text',.6);
        this.label(g,names[i],[x,1.65,0]);
      }
      this.label(g,'Trace each statement back to its evidence',[0,-1.8,0],'AI critique is not clinician approval');
    }
  }
  window.AtlasScene=AtlasScene;
})();