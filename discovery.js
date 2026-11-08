/* Shared, deterministic discovery view: pre-rendered HTML and the interactive workspace use the same content. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./core.js'):root.AtlasCore);if(typeof module==='object'&&module.exports)module.exports=api;else root.AIUpdatesDiscovery=api;})(typeof globalThis!=='undefined'?globalThis:this,function(C){
  'use strict';
  const E=C.escapeHTML;
  const topics=[['all','For you'],['research','Research'],['safety','AI safety'],['tools','Tools & models'],['concepts','Concepts']];
  const selections=[
    ['safety','terms','MLD-1149','When the specification becomes the loophole.','An expanded guide to specification gaming: how a system can satisfy the written objective while missing the intended outcome.','specification','Expanded guide'],
    ['tools','technologies','TECH-0216','A closer look at PyTorch.','From the first tensor to an experiment you can trust. Explore its strengths, tradeoffs, and connected concepts.','tools','Technology profile'],
    ['concepts','terms','MLD-0469','Right behavior. Wrong reason.','Goal misgeneralization explains why a capable model can behave well in training and pursue a different objective elsewhere.','path','Expanded guide'],
    ['concepts','terms','MLD-0470','When a measure becomes the target.','Goodhart’s law, with worked examples and practical ways to evaluate whether your metric still measures what matters.','target','Expanded guide'],
    ['tools','terms','MLD-1002','Put the model to the test.','Start with the original red-teaming reference, then follow its connections to adversarial testing and model evaluation.','testing','Concept reference'],
    ['research','terms','MLD-0718','What is a model doing inside?','Explore the mechanistic interpretability reference and the concepts and technologies connected to it.','network','Concept reference']
  ];
  function art(kind,large=false){
    const shapes={
      reward:'<path d="M70 220H172L236 138H338L408 62" stroke="#27664E"/><path d="M172 220L236 282H406" stroke="#B76D32" stroke-dasharray="8 10"/><circle cx="70" cy="220" r="18"/><circle cx="236" cy="138" r="18"/><circle cx="408" cy="62" r="18"/><circle cx="406" cy="282" r="18" fill="#B76D32"/><path d="m393 62 12-12 12 12M393 282h26"/>',
      specification:'<rect x="100" y="62" width="200" height="220" rx="16"/><path d="M140 118h120M140 160h80M140 202h54"/><path d="m272 245 49-49 29 29-49 49h-29z" fill="#B76D32"/>',
      tools:'<rect x="106" y="74" width="266" height="196" rx="18"/><path d="m166 136-30 35 30 35M312 136l30 35-30 35M260 123l-40 96"/><path d="M180 270v24M298 270v24M152 294h174"/>',
      path:'<path d="M80 170h112l68-80h134M192 170l68 80h134"/><circle cx="80" cy="170" r="20"/><path d="m374 70 22 20-22 20"/><circle cx="394" cy="250" r="25" fill="#B76D32"/>',
      target:'<circle cx="240" cy="170" r="116"/><circle cx="240" cy="170" r="76"/><circle cx="240" cy="170" r="32" fill="#B76D32"/><path d="m240 170 142-99M358 62l28 6-4 29"/>',
      testing:'<path d="m240 48 112 47v81c0 70-112 122-112 122S128 246 128 176V95z"/><path d="m192 174 33 34 68-77" stroke="#B76D32"/>',
      network:'<path d="M108 94 240 64l132 60-132 58-132-88v146l132 52 132-94V124M240 64v228M108 240l264-116M108 94l264 104"/><circle cx="240" cy="182" r="24" fill="#B76D32"/>'
    };
    return `<svg class="editorial-art ${large?'art-large':''} art-${kind}" viewBox="0 0 480 340" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><rect width="480" height="340" fill="${kind==='reward'?'#E9EDE5':kind==='tools'?'#E4EAE4':kind==='path'?'#EFE1D2':'#EDEDE6'}"/><g opacity=".35" stroke="#A8B4A6" stroke-width="1"><path d="M0 85h480M0 170h480M0 255h480M120 0v340M240 0v340M360 0v340"/></g><g stroke="#27664E" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="#F6F6F2">${shapes[kind]||shapes.network}</g><circle cx="440" cy="300" r="4" fill="#B76D32"/><path d="M28 28h26M28 28v26M452 28h-26M452 28v26M28 312h26M28 312v-26" stroke="#27664E" opacity=".55"/></svg>`;
  }
  function target(r,kind,offline){if(offline)return '#/'+(kind==='terms'?'dictionary':'technologies')+'?record='+encodeURIComponent(r.id);if(kind==='terms')return C.termPath(r);return C.technologyPath(r);}
  function render(data,options={}){
    const topic=topics.some(t=>t[0]===options.topic)?options.topic:'all';
    const terms=new Map(data.terms.map(r=>[r.id,r])),tech=new Map(data.technologies.map(r=>[r.id,r]));
    const feature=terms.get('MLD-1039');
    const featureLink=target(feature,'terms',options.offline);
    const cards=selections.filter(x=>topic==='all'||x[0]===topic||(topic==='safety'&&x[2]==='MLD-0469')).map(([group,kind,id,title,description,image,label])=>{
      const r=(kind==='terms'?terms:tech).get(id);if(!r)return '';
      return `<article class="discovery-card"><a class="story-art" href="${E(target(r,kind,options.offline))}" tabindex="-1" aria-hidden="true">${art(image)}</a><div class="story-body"><div class="story-kicker">${E(label)} <span>· ${E(group==='tools'?'Tools & models':group==='safety'?'AI safety':group)}</span></div><h3><a href="${E(target(r,kind,options.offline))}">${E(title)}</a></h3><p>${E(description)}</p><div class="story-footer"><span>${E(kind==='terms'?r.term:r.name)}</span><a href="${E(target(r,kind,options.offline))}" aria-label="Read ${E(r.term||r.name)}">Read <span aria-hidden="true">↗</span></a></div></div></article>`;
    }).join('');
    return `<div class="discover-heading"><div><p class="eyebrow"><span class="tiny-square"></span>IN CONTEXT. WITH SOURCES.</p><h1>Discover</h1></div><a class="edition-link" href="${options.offline?'#/sources':'whats-new.html'}">The daily edition <span aria-hidden="true">↗</span></a></div>
      <nav class="discovery-topics" aria-label="Discover topics">${topics.map(([key,label])=>`<a href="#/overview${key==='all'?'':'?topic='+key}" ${topic===key?'aria-current="page"':''}>${label}</a>`).join('')}</nav>
      <div class="discover-layout"><div class="discover-main"><article class="featured-story"><div class="featured-copy"><p class="story-kicker">THE EXPLAINER <span>· AI SAFETY</span></p><h2><a href="${E(featureLink)}">Why AI can get the reward—and miss the point.</a></h2><p>A high score isn’t always a good outcome. Understand reward hacking, the gap between a metric and an intention, and what to test before trusting the result.</p><div class="feature-meta"><span class="source-dot">↗</span><span>Expanded guide · primary references</span></div><a class="feature-cta" href="${E(featureLink)}">Follow the explanation <span aria-hidden="true">↗</span></a></div><a class="featured-art" href="${E(featureLink)}" tabindex="-1" aria-hidden="true">${art('reward',true)}<span class="art-caption">SIGNAL ≠ INTENT</span></a></article>
      <div class="feed-heading"><h2>${topic==='all'?'Worth understanding':E(topics.find(t=>t[0]===topic)[1])}</h2><span>From the curated collection</span></div><div class="discovery-grid">${cards}</div>
      <div class="reading-link"><div><p class="eyebrow">THE READING DESK</p><h2>Go straight to the research.</h2><p>30 indexed papers, with source links and review status.</p></div><a class="btn" href="#/papers">Open the library ↗</a></div></div>
      <aside class="discover-rail" aria-label="Explore AI Updates"><section class="daily-brief"><div class="rail-label"><span class="live-dot"></span>THE DAILY BRIEF</div><h2 id="daily-panel-title">What's New Today</h2><p id="daily-preview-status" role="status" aria-live="polite">${options.offline?'Daily editions require the served website.':'Open the edition archive for publication status.'}</p><a href="${options.offline?'#/sources':'whats-new.html'}">Open the archive <span aria-hidden="true">↗</span></a><small>Actual dates. Linked sources. Visible limitations.</small></section>
      <section class="rail-section"><h2>Your AI field guide</h2><p>Build a little more understanding.</p><div class="rail-counts">${[[data.technologies.length,'Technology profiles','technologies'],[data.terms.length,'Concepts explained','dictionary'],[data.alerts.length,'Safety report records','safety'],[data.playbooks.length,'Practical playbooks','playbooks']].map(([n,label,v])=>`<a href="#/${v}"><span>${label}</span><strong>${n.toLocaleString('en-US')} <span aria-hidden="true">↗</span></strong></a>`).join('')}</div></section>
      <section class="practice-callout"><span class="practice-symbol" aria-hidden="true">⇄</span><h2>Make it stick.</h2><p>Turn the dictionary into a quick Quiz or a round of Match.</p><a href="#/games">Take a practice break ↗</a></section>
      <section class="rail-section" id="community" aria-labelledby="community-title"><p class="eyebrow">THE COMMUNITY</p><h2 id="community-title">Continue the conversation.</h2><p>Discuss AI research, models, tools, concepts and AI safety beyond the articles.</p><p><a href="https://discord.gg/mvRJjgdM4R" rel="noopener noreferrer">Join the AI Updates Discord discussion ↗</a></p></section>
      <section class="rail-note"><span class="eyebrow">A NOTE ON THE FEED</span><p>This is a curated learning and research collection. Featured guides are evergreen, not breaking news. New editions appear after editorial review.</p><a href="${options.offline?'#/sources':'about.html'}">How we work ↗</a></section></aside></div>`;
  }
  return {render,art,topics};
});
