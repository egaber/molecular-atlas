(() => {
  'use strict';
  const $=id=>document.getElementById(id), A=window.ATLAS;
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const state={chapter:0,step:0,phase:0,playing:false,raf:0,last:0,page:3,ref:null,tab:'explain',patient:0};
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  $('motion').checked=!reduced.matches;
  function updateSiteTheme(){
    const dark=document.documentElement.dataset.theme==='dark';
    $('theme').textContent=dark?'Light UI':'Dark UI';
    $('theme').setAttribute('aria-label',`Switch to ${dark?'light':'dark'} theme`);
    document.querySelectorAll('[data-site-link]').forEach(link=>{
      const url=new URL(link.getAttribute('href'),location.href);
      url.searchParams.set('clawpilotTheme',document.documentElement.dataset.theme);
      link.href=url.href;
    });
  }
  updateSiteTheme();
  let scene;
  try{if(!window.AtlasScene)throw new Error('3D engine unavailable');scene=new window.AtlasScene($('scene'),$('labels'));}
  catch(error){$('fallback').hidden=false;console.warn('3D fallback:',error.message);}
  const sourceButton=(key,label)=>`<button data-ref="${esc(key)}" class="source-jump">${esc(label||A.references[key].title)} ↗</button>`;
  function chapterList(){
    const query=$('chapterSearch').value.toLowerCase().trim();let group='';let matches=0;
    $('chapterList').innerHTML=A.chapters.map((c,i)=>{
      if(query&&!`${c.title} ${c.short} ${c.lead} ${c.id}`.toLowerCase().includes(query))return '';
      matches++;let header='';if(group!==c.group){group=c.group;header=`<div class="nav-group">${esc(group)}</div>`;}
      return header+`<button class="nav-chapter" data-chapter="${i}" ${i===state.chapter?'aria-current="step"':''}><span class="num">${String(i+1).padStart(2,'0')}</span><span><strong>${esc(c.title)}</strong><small>${esc(c.short)}</small></span></button>`;
    }).join('');$('noChapters').hidden=matches>0;
  }
  function stop(){state.playing=false;cancelAnimationFrame(state.raf);$('play').textContent='▶ Play step';$('play').setAttribute('aria-pressed','false');}
  function renderPhase(){scene?.update(state.step,state.phase);$('phase').value=String(Math.round(state.phase*1000));}
  function tick(time){
    if(!state.playing)return;
    const dt=Math.min((time-state.last)/1000,.08);state.last=time;state.phase=Math.min(1,state.phase+dt/9);
    renderPhase();if(state.phase>=1){stop();return;}state.raf=requestAnimationFrame(tick);
  }
  function play(){
    if(state.playing){stop();return;}if(!$('motion').checked||!scene?.animations.length)return;
    if(state.phase>=1)state.phase=0;state.playing=true;state.last=performance.now();$('play').textContent='Ⅱ Pause';$('play').setAttribute('aria-pressed','true');state.raf=requestAnimationFrame(tick);
  }
  function setStep(index,follow=true){
    stop();const chapter=A.chapters[state.chapter];state.step=Math.max(0,Math.min(3,index));state.phase=0;
    const [title,text,key]=chapter.steps[state.step];
    $('steps').innerHTML=chapter.steps.map((s,i)=>`<button class="step-button" data-step="${i}" ${i===state.step?'aria-current="step"':''}><span>0${i+1}</span>${esc(s[0])}</button>`).join('');
    $('stepNumber').textContent=`STEP ${state.step+1} OF 4`;$('stepTitle').textContent=title;$('stepText').textContent=text;
    $('stepSource').textContent=`Read ${A.references[key].title} · p. ${A.references[key].page} ↗`;$('stepSource').dataset.ref=key;
    renderPhase();
    $('play').disabled=!$('motion').checked||!scene?.animations.length;
    $('animationNote').textContent=scene?.animations.length?'Illustrative movement only; not a kinetic, dosing or efficacy model.':'Static evidence illustration. Rotate or zoom the view; no invented biological motion or clinical trajectory.';
    if(follow&&$('syncSource').checked)focusReference(key,false);
    $('announcement').textContent=`${chapter.title}, step ${state.step+1}: ${title}`;
  }
  function setChapter(index,{updateHash=true,scroll=false,follow=true}={}){
    state.chapter=Math.max(0,Math.min(A.chapters.length-1,index));const c=A.chapters[state.chapter];
    $('scale').textContent=c.scale;$('sceneTitle').textContent=c.short;$('evidenceBadge').textContent=c.evidence;
    $('chapterPosition').textContent=`${c.group} / CHAPTER ${String(state.chapter+1).padStart(2,'0')} OF ${A.chapters.length}`;
    $('lessonTitle').textContent=c.title;$('lead').textContent=c.lead;$('caveat').textContent=c.caveat;
    $('details').innerHTML=c.details.map(d=>`<details><summary>${esc(d[0])}</summary><p>${esc(d[1])}</p></details>`).join('');
    if(c.id==='nucleus')$('details').insertAdjacentHTML('beforeend','<p class="data-note">Independent primary-source check: <a href="https://doi.org/10.1084/jem.20122292" target="_blank" rel="noopener noreferrer">Leung et al. 2013, reference 15 ↗</a>. Read as preclinical evidence, not patient pathway confirmation.</p>');
    if(c.id==='sources')$('details').insertAdjacentHTML('beforeend',`<div class="reference-links">${sourceButton('funding')}${sourceButton('disclosures')}${sourceButton('bibliographyStart')}${sourceButton('bibliography')}</div>`);
    $('question').textContent=c.question[0];$('answer').textContent=c.question[1];$('answer').hidden=true;$('revealAnswer').hidden=false;
    document.querySelector('.knowledge-check').open=false;
    $('previous').disabled=state.chapter===0;$('next').disabled=state.chapter===A.chapters.length-1;
    $('layerControls').hidden=c.scene!=='ensemble';
    document.querySelectorAll('[data-layer]').forEach(el=>el.checked=true);
    scene?.setChapter(c);chapterList();setStep(0,follow);
    if(updateHash){try{history.replaceState(null,'',`#${c.id}`);}catch{/* File-origin history restrictions do not prevent teaching. */}}
    if(scroll)$('main').scrollTo({top:0,behavior:reduced.matches?'auto':'smooth'});
  }
  function showSource(visible){
    $('sourcePanel').hidden=!visible;$('layout').classList.toggle('source-hidden',!visible);
    $('sourceToggle').textContent=visible?'Hide source guide':'Show source guide';$('sourceToggle').setAttribute('aria-expanded',String(visible));
    requestAnimationFrame(()=>scene?.resize());
  }
  function loadPage(page,reference=null){
    state.page=Math.max(1,Math.min(10,Number(page)));state.ref=reference;
    $('pageSelect').value=String(state.page);$('pagePrev').disabled=state.page===1;$('pageNext').disabled=state.page===10;
    $('sourceLocation').textContent=reference?`${reference.title} · reported on article page ${state.page}`:`Reading guide for article page ${state.page} of 10`;
    $('pageTranscript').textContent=window.SOURCE_GUIDES?.[state.page-1]||'Accessible guide unavailable. Open the publisher page or read Study data.';
  }
  function focusReference(key,explicit=true){
    const ref=A.references[key];if(!ref)return;
    if(explicit)showSource(true);loadPage(ref.page,ref);
    if(explicit&&window.innerWidth<=720)$('sourcePanel').scrollIntoView({behavior:reduced.matches?'auto':'smooth',block:'start'});
  }
  function setTab(name){
    state.tab=name;document.querySelectorAll('[data-tab]').forEach(el=>{
      const active=el.dataset.tab===name;el.setAttribute('aria-selected',String(active));el.tabIndex=active?0:-1;
      $('panel-'+el.dataset.tab).hidden=!active;
    });
  }
  function dataView(){
    $('panel-data').innerHTML=`<h2>The observed study—not the animation</h2><p class="data-intro">Exact table values and reported estimates. Response denominators are people; adverse-event denominators are courses. No raw curve digitization or generated patient trajectories.</p>
      <div class="metric-grid"><div class="metric"><strong>5</strong><span>participants<br>26 treatment courses</span></div><div class="metric"><strong>3 + 1 + 1</strong><span>complete + partial + minor<br>best reported responses</span></div><div class="metric"><strong>26 / 26</strong><span>courses with grade 3<br>anemia, low platelets and neutropenia</span></div></div>
      <section class="data-section"><h3>Patient-level outcomes</h3><div class="table-scroll"><table><caption>Table 4, p. 5. Course doses are millions of NK cells/kg; numbers are mean (range).</caption><thead><tr><th>Patient</th><th>Courses</th><th>Best response</th><th>Curie baseline → best</th><th>NK dose</th></tr></thead><tbody>${A.patients.map((p,i)=>`<tr><td><button data-patient="${i}">${p.id}</button></td><td>${p.cycles}</td><td>${esc(p.response)}</td><td>${p.curie} → ${p.best}${i===0?'*':''}</td><td>${esc(p.dose)}</td></tr>`).join('')}</tbody></table></div><p class="data-note">*P1: zero estimated from surgical pathology; no post-treatment MIBG. CR+PR = 4/5 (80%, calculated), not 5/5. All five were MYCN-non-amplified at initial diagnosis.</p><div class="reference-links">${sourceButton('baseline')}${sourceButton('results')}${sourceButton('curie')}</div><div class="patient-buttons" aria-label="Select patient">${A.patients.map((p,i)=>`<button data-patient="${i}" aria-pressed="${i===0}">${p.id} · ${p.age} y</button>`).join('')}</div><article id="patientDetail" class="patient-detail"></article></section>
      <section class="data-section"><h3>What changed on the bone scan?</h3><p class="data-note">Gray = baseline; rose = best reported modified Curie score. These horizontal bars share a 0–21 display scale. They are not tumor volumes or time courses.</p>${A.patients.map((p,i)=>`<div class="score-row"><strong>${p.id}</strong><div><div class="score-track"><div class="score-bar" style="width:${p.curie/21*100}%" title="Baseline ${p.curie}"></div></div><div class="score-track"><div class="score-bar best" style="width:${p.best/21*100}%" title="Best ${p.best}${i===0?' estimated':''}"></div></div></div><span>${p.curie} → ${p.best}${i===0?'*':''}</span></div>`).join('')}${sourceButton('curie','Inspect the original longitudinal Figure 3')}</section>
      <section class="data-section"><h3>Survival at one year</h3><div class="table-scroll"><table><thead><tr><th>Endpoint</th><th>Reported estimate</th><th>Reported 95% CI</th></tr></thead><tbody><tr><td>PFS</td><td>60%</td><td>23–88%</td></tr><tr><td>OS</td><td>100%</td><td>57–100%</td></tr></tbody></table></div><p class="data-note">Kaplan–Meier estimates as published. P1’s death at 14 months is compatible with 100% one-year OS. No recalculated or projected survival curve is supplied.</p>${sourceButton('survival')}${sourceButton('swimmer')}</section>
      <section class="data-section"><h3>All adverse events in Table 5</h3><p class="data-note">Denominator: 26 courses in five people. Percentages and event labels follow Table 5. A separate severity column preserves the additional information explicitly reported in the page 6 narrative.</p><div class="table-scroll"><table><thead><tr><th>Event</th><th>Courses</th><th>Reported %</th><th>Severity context</th></tr></thead><tbody>${A.adverse.map((r,i)=>`<tr><td>${esc(r[0])}</td><td>${r[1]} / 26</td><td>${r[2]}</td><td>${r[0].includes('grade 3')?'Grade 3 specified in Table 5':i===3?'Table lists CRS; narrative allows cytokine fever or grade 1 CRS':i===4?'None observed':'Grade 3 in narrative; Table 5 row omits grade'}</td></tr>`).join('')}</tbody></table></div><aside class="caution"><strong>Unresolved neutropenia figures</strong><p>Abstract: median 24.2 days. Results: mean 24.7 days. Table 5: average 23.4 days. Reported range: 13–42 days. These are not silently reconciled.</p></aside><p class="data-note">The narrative permits cytokine-related fever or grade 1 CRS, whereas Table 5 labels CRS in every course. Fever during neutropenia still requires infection assessment. General adverse events use CTCAE v5; CRS/ICANS use ASTCT grading.</p>${sourceButton('toxicity')}${sourceButton('safetyNarrative','Read narrative severity grades')}</section>
      <section class="data-section"><h3>Protocol and laboratory source checks</h3><p class="data-note">The clinical antibody is dinutuximab beta. The in-vitro reagent is clone 14.G2a. The assay ratio is 50 PBMCs per IMR-32 target for four hours. NK frequency in Figure 5A is a proportion, not donor-specific tracking.</p><div class="reference-links">${sourceButton('schedule')}${sourceButton('flow')}${sourceButton('kinetics')}${sourceButton('assay')}${sourceButton('endpoint')}</div></section>`;
    patientView(0);
  }
  function patientView(index){
    state.patient=index;const p=A.patients[index];
    $('patientDetail').innerHTML=`<h3>${p.id} · ${esc(p.response)}</h3><p><strong>Initial diagnosis:</strong> ${p.sex}, age ${p.diagnosisAge}; stage ${p.stage}; ${p.risk.toLowerCase()} risk; MYCN-non-amplified at diagnosis.</p><p><strong>At immunotherapy:</strong> age ${p.age}; ${p.relapses} prior relapse${p.relapses>1?'s':''}; ${p.interval} months from diagnosis; ${p.latest} months from latest relapse. Sites: ${esc(p.sites)}.</p><p><strong>Prior treatment:</strong> ${esc(p.prior)}</p><p><strong>Donor:</strong> ${esc(p.donor)}</p><p><strong>Stopped because:</strong> ${esc(p.stop)}. Residual disease: ${esc(p.residual)}.</p><p><strong>Follow-up:</strong> ${esc(p.follow)}</p><p><strong>Interpretive note:</strong> ${esc(p.note)}</p>${sourceButton('results','Verify the original outcomes table')}`;
    document.querySelectorAll('.patient-buttons button').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.patient)===index)));
  }
  function glossaryView(){const q=$('glossarySearch').value.toLowerCase();const rows=A.glossary.filter(row=>row.join(' ').toLowerCase().includes(q));$('glossary').innerHTML=rows.length?rows.map(r=>`<dt>${esc(r[0])}</dt><dd>${esc(r[1])}</dd>`).join(''):'<dt>No matching term</dt><dd>Try a shorter word or abbreviation.</dd>';}
  function reviewView(){
    $('panel-review').innerHTML=`<h2>Medical accuracy and evidence boundaries</h2><div class="review-status"><strong id="reviewStatus">Independent AI critique completed · 9 September 2026</strong><p>Review findings were corrected and rechecked. The independent follow-up identified no remaining blocking educational-accuracy issues within the reviewed scope. Open discrepancies in the paper remain visible below.</p><p>This is an educational quality check, not a real medical partner approval board. No pediatric oncologist, pharmacist, statistician or regulator has signed off through this interface.</p></div><p class="data-intro">These source issues and interpretation hazards are kept visible rather than hidden behind a generic disclaimer.</p>${A.audit.map(a=>`<article class="audit-item"><h3>${esc(a[0])}</h3><p>${esc(a[1])}</p>${sourceButton(a[2],'Inspect source guide')}</article>`).join('')}<section class="data-section"><h3>Additional sources actually checked</h3><p class="data-note"><a href="https://doi.org/10.1084/jem.20122292" target="_blank" rel="noopener noreferrer">Leung et al., J Exp Med 2013 · reference 15</a>: primary preclinical paper, read via Europe PMC full text. Mechanistic dependence is not a validated human binding structure.</p><p class="data-note"><a href="https://clinicaltrials.gov/study/NCT05754684" target="_blank" rel="noopener noreferrer">NCT05754684</a>: retrieved 9 September 2026; last posted update shown as 15 September 2025. Listed recruitment status may be stale and is not a guarantee of availability. The registry differs from the cohort report in options and endpoint wording.</p><p class="data-note">All 46 references are listed in the published article. Listing them does not mean all have been independently revalidated.</p>${sourceButton('bibliography')}</section>`;
    $('panel-review').insertAdjacentHTML('beforeend',`<section class="data-section"><h3>All 46 references: a critical reading map</h3><p class="data-note">Evidence descriptions below are based on titles and the source article’s discussion, not independent full-text verification except for reference 15. References 1–8 begin on page 9; 9–46 are on page 10.</p><p class="data-note">The registry’s current response definition includes stable disease; the published cohort uses marrow clearance, Curie reduction, or RECIST partial/complete response. Do not substitute the registry definition for the five reported response categories.</p><div class="reference-links">${sourceButton('bibliographyStart')}${sourceButton('bibliography')}</div><div class="table-scroll"><table><thead><tr><th>Ref.</th><th>Purpose and evidence type</th><th>Verification</th></tr></thead><tbody>${A.citationMap.map(r=>`<tr><td>${esc(r[0])}</td><td><strong>${esc(r[1])}</strong><br>${esc(r[2])}</td><td>${esc(r[3])}</td></tr>`).join('')}</tbody></table></div></section>`);
  }
  $('pageSelect').innerHTML=Array.from({length:10},(_,i)=>`<option value="${i+1}">Page ${i+1}</option>`).join('');
  const indexEntries=[['flow','Fig 1',5],['swimmer','Fig 2',13],['curie','Fig 3',13],['survival','Fig 4',14],['kinetics','Fig 5A',11],['assay','Fig 5B',12],['mechanism','Fig 6',2],['schedule','Table 1',3],['baseline','Table 2',1],['donors','Table 3',4],['results','Table 4',13],['toxicity','Table 5',15]];
  $('sourceIndex').innerHTML=indexEntries.map(([key,name,chapter])=>`<button data-index="${key}" data-index-chapter="${chapter}" title="${esc(A.references[key].title)} · p. ${A.references[key].page}">${name} · p${A.references[key].page}</button>`).join('');
  document.addEventListener('click',event=>{
    const b=event.target.closest('button');if(!b)return;
    if(b.dataset.chapter!==undefined){setTab('explain');setChapter(Number(b.dataset.chapter),{scroll:true});}
    if(b.dataset.step!==undefined)setStep(Number(b.dataset.step));
    if(b.dataset.ref)focusReference(b.dataset.ref);
    if(b.dataset.tab)setTab(b.dataset.tab);
    if(b.dataset.patient!==undefined)patientView(Number(b.dataset.patient));
    if(b.dataset.index){setTab('explain');setChapter(Number(b.dataset.indexChapter),{follow:false,scroll:true});focusReference(b.dataset.index);}
  });
  $('chapterSearch').addEventListener('input',chapterList);$('glossarySearch').addEventListener('input',glossaryView);
  $('previous').onclick=()=>setChapter(state.chapter-1,{scroll:true});$('next').onclick=()=>setChapter(state.chapter+1,{scroll:true});
  $('openOverview').onclick=()=>{setTab('explain');setChapter(2,{scroll:true});};
  $('revealAnswer').onclick=()=>{$('answer').hidden=false;$('revealAnswer').hidden=true;};
  $('play').onclick=play;$('restart').onclick=()=>{stop();state.phase=0;renderPhase();};
  $('phase').addEventListener('input',()=>{stop();state.phase=Number($('phase').value)/1000;renderPhase();});
  $('motion').onchange=()=>{if(!$('motion').checked)stop();$('play').disabled=!$('motion').checked||!scene?.animations.length;};
  $('play').disabled=!$('motion').checked;
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
  reduced.addEventListener('change',event=>{if(event.matches){$('motion').checked=false;$('play').disabled=true;stop();}});
  $('rotateLeft').onclick=()=>scene?.rotate(-.28);$('rotateRight').onclick=()=>scene?.rotate(.28);$('zoomIn').onclick=()=>scene?.zoom(.85);$('zoomOut').onclick=()=>scene?.zoom(1.18);$('resetCamera').onclick=()=>scene?.resetCamera();
  $('scene').addEventListener('keydown',event=>{
    if(event.key==='ArrowLeft'){scene?.rotate(-.2);event.preventDefault();}
    if(event.key==='ArrowRight'){scene?.rotate(.2);event.preventDefault();}
    if(event.key==='+'||event.key==='='){scene?.zoom(.88);event.preventDefault();}
    if(event.key==='-'){scene?.zoom(1.12);event.preventDefault();}
    if(event.key===' '){play();event.preventDefault();}
  });
  $('labelsToggle').onclick=()=>{if(!scene)return;scene.labelsVisible=!scene.labelsVisible;$('labelsToggle').textContent=scene.labelsVisible?'Labels on':'Labels off';$('labelsToggle').setAttribute('aria-pressed',String(scene.labelsVisible));scene.render();};
  document.querySelectorAll('[data-layer]').forEach(el=>el.onchange=()=>scene?.setLayer(el.dataset.layer,el.checked));
  $('theme').onclick=()=>{document.documentElement.dataset.theme=document.documentElement.dataset.theme==='dark'?'light':'dark';updateSiteTheme();if(scene){scene.setChapter(A.chapters[state.chapter]);renderPhase();document.querySelectorAll('[data-layer]').forEach(el=>scene.setLayer(el.dataset.layer,el.checked));}};
  $('sourceToggle').onclick=()=>showSource($('sourcePanel').hidden);
  $('syncSource').onchange=()=>{if($('syncSource').checked)focusReference(A.chapters[state.chapter].steps[state.step][2],false);};
  $('pagePrev').onclick=()=>{$('syncSource').checked=false;loadPage(state.page-1);};$('pageNext').onclick=()=>{$('syncSource').checked=false;loadPage(state.page+1);};
  $('pageSelect').onchange=()=>{$('syncSource').checked=false;loadPage($('pageSelect').value);};
  document.querySelector('.tabs').addEventListener('keydown',event=>{
    const tabs=[...document.querySelectorAll('[data-tab]')],i=tabs.indexOf(document.activeElement);if(i<0)return;
    let next=i;if(event.key==='ArrowRight')next=(i+1)%tabs.length;else if(event.key==='ArrowLeft')next=(i+tabs.length-1)%tabs.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=tabs.length-1;else return;
    event.preventDefault();setTab(tabs[next].dataset.tab);tabs[next].focus();
  });
  window.addEventListener('hashchange',()=>{const i=A.chapters.findIndex(c=>c.id===location.hash.slice(1));if(i>=0)setChapter(i,{updateHash:false});});
  $('citation').textContent=A.citation;
  dataView();glossaryView();reviewView();
  const initial=A.chapters.findIndex(c=>c.id===location.hash.slice(1));setChapter(initial<0?0:initial,{updateHash:false});
  window.atlasDebug={state,get scene(){return scene;},setChapter,setStep,focusReference};
})();