'use strict';
(() => {
  let generated=null,generatedStale=false,lastSelection=null;
  const get=id=>document.getElementById(id),nf=new Intl.NumberFormat('ar-SA-u-nu-latn',{maximumFractionDigits:2});
  const clone=value=>JSON.parse(JSON.stringify(value));
  function el(tag,text,parent,className){const node=document.createElement(tag);if(text!=null){const value=String(text);let at=0;for(const match of value.matchAll(/\b\d{4}-\d{2}-\d{2}(?:T[\d:.]+Z)?|\b\d+(?:,\s*\d+)+/g)){node.append(document.createTextNode(value.slice(at,match.index)));const date=document.createElement('bdi');date.dir='ltr';date.textContent=match[0];node.append(date);at=match.index+match[0].length;}node.append(document.createTextNode(value.slice(at)));}if(className)node.className=className;if(parent)parent.append(node);return node;}
  const money=value=>Number.isFinite(value)?nf.format(value):'غير مدخل';
  const tripKey=trip=>JSON.stringify([trip.departure,trip.returnDate,trip.adults,trip.children,trip.infants,trip.childAges,trip.rooms]);
  function dateText(date){return new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn',{weekday:'long',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'))+' '+date;}
  function tripText(trip){return trip.departure+' إلى '+trip.returnDate+' | '+dayDiff(trip.departure,trip.returnDate)+' ليالٍ | '+trip.adults+' بالغ، '+trip.children+' طفل، '+trip.infants+' رضيع | الأعمار: '+(trip.childAges?.join(', ')||'لا أطفال')+' | '+trip.rooms+' غرف';}
  function manual(){
    const ds=dateState(),error=validationError(ds);if(error)throw Error('الحاسبة: '+error);
    const v=collectBudget(ds),b=calculateBudget(v),rate=currency==='TRY'?1/n('exchangeRate'):1;
    const food=(v.adults*v.foodAdult+v.children*v.foodChild)*v.expenseDays*rate;
    const transport=((v.adults+v.children)*v.transportDaily*v.expenseDays+v.istTransfer)*rate+v.medTransfer;
    const pending=get('manualFlightPending').checked&&get('groupFlightFare').value==='';
    const trip={departure:get('departure').value,returnDate:get('returnDate').value,adults:v.adults,children:v.children,infants:v.infants,childAges:[...get('childAges').querySelectorAll('input')].map(input=>Number(input.value)),rooms:v.rooms};
    const warnings=[];if(appliedHotelQuoteStale())warnings.push(oldHotelQuoteWarning);
    if(!get('manualBudgetEdited').checked)warnings.push('تحتوي الحاسبة على قيم افتراضية للتخطيط؛ ليست عروض أسعار مؤكدة.');
    if(pending)warnings.push('طيران المجموعة غير مدخل؛ المبلغ المتاح لا يمثل إجمالياً كاملاً.');
    const selected=places.filter(p=>get('pick-'+p.id).checked),requested=get('planLength').value==='auto'?Math.min(ds.days,14):Number(get('planLength').value),days=Math.min(requested,ds.days);
    let route=[];
    if(appliedItinerary&&(appliedItinerary.context!==appliedItineraryContext(selected)||appliedItinerary.days[0].date!==trip.departure||appliedItinerary.days.at(-1).date!==trip.returnDate))warnings.push('لم يُطبع الجدول المطبق لأنه يخص سياق رحلة آخر؛ أعد توليده وتطبيقه بعد المراجعة.');
    else if(!selected.length)warnings.push('لا زيارات مختارة في الحاسبة؛ لم يُضف برنامج بديل.');
    else {
      const itinerary=appliedItinerary?appliedItinerary.days.slice(0,days).map((day,index)=>({index,date:day.date,places:day.ids.map(id=>selected.find(p=>p.id===id)),hours:day.visit_min/60,lightDay:day.light_day})):schedulePlaces(selected,days,get('pace').value,days===ds.days,trip.departure).itinerary;
      route=itinerary.map(day=>({date:day.date||addDays(trip.departure,day.index),edge:day.index===0?'وصول':day.index===ds.days-1?'عودة':null,light:day.lightDay,visit:day.hours*60,transit:null,rest:45,stops:day.places.map(p=>({id:p.id,name:p.name,accepted:!!appliedItinerary,verified:p.scheduleRule?.verified===true,url:p.scheduleRule?.official_url||p.url,checked:p.scheduleRule?.last_verified||null}))}));
      if(days<ds.days)warnings.push('البرنامج المعروض يغطي '+days+' أيام فقط من الرحلة؛ لا يشمل كل التواريخ.');
      const shown=new Set(route.flatMap(day=>day.stops.map(stop=>stop.id)));
      if(selected.some(p=>!shown.has(p.id)))warnings.push('غير مجدول في هذا الجزء: '+selected.filter(p=>!shown.has(p.id)).map(p=>p.name).join('، ')+'. تكاليف الحاسبة تشمل جميع المختارات حتى غير المجدولة.');
    }
    return {id:'manual',name:'الحاسبة اليدوية',trip,target:v.targetBudget,fx:v.exchangeRate,reserve:v.reserve,fee:v.fxFee,assumptions:'الوتيرة: '+get('pace').selectedOptions[0].textContent+' | أيام المصروف: '+v.expenseDays+' | العملة المدخلة: '+v.costCurrency+' | الغرفة / الليلة: '+money(v.nightRate)+' | طعام البالغ / الطفل يومياً: '+money(v.foodAdult)+' / '+money(v.foodChild)+' | نقل الفرد يومياً: '+money(v.transportDaily),
      complete:!pending,staleHotel:appliedHotelQuoteStale(),known:b.total,total:pending?null:b.total,costs:{flights:pending?null:b.flight,stay:b.hotel,food,transport,extras:b.expenses-food-transport+v.documentsCost+(v.planExtrasSAR||0),attractions:b.tours,fx_fee:b.fxFees,reserve:b.reserve},warnings,route,suggestions:[],sources:[],status:'أسعار ومدخلات الحاسبة؛ لا بحث حي عن الطيران أو مراجعة آلية لهذه النسخة.'};
  }
  function agentSummary(result){
    const latest=new Map();for(const record of result.agents_report||[])latest.set(record.agent,record);
    const names={flights:'الطيران',critic:'المراجع',hotels:'الإقامة',route:'المسار',budget:'الميزانية',orchestrator:'المنسق'},states={error:'تعذر البحث',unavailable:'غير متاح',rejected:'مستبعد',pass:'اجتاز',warnings:'ملاحظات',ok:'بيانات مخزنة',no_data:'لا بيانات'};
    return [...latest.values()].filter(record=>['flights','critic'].includes(record.agent)||['error','unavailable','rejected'].includes(record.status)).map(record=>(names[record.agent]||record.agent)+': '+(states[record.status]||record.status)+' - '+String(record.detail).replace(/LLM/g,'المراجع الآلي')).join(' | ');
  }
  function fromGenerated(plan,result){
    const trip=clone(result.input_summary),budget=plan.budget,warnings=[...plan.warnings];
    if(generatedStale)warnings.unshift('نتائج قديمة بالنسبة لمدخلات المولّد الحالية؛ هذه نسخة تقديرية من بيانات الطلب الأصلي، ولم تُعد تسعيرها.');
    if(!budget.complete)warnings.unshift('طيران المجموعة غير مدخل؛ المبلغ المتاح يستثني الطيران ولا يمثل إجمالياً كاملاً.');
    if(plan.hotel?.evidence?.verified!==true)warnings.push('الإقامة تقدير تحريري غير متحقق، وليست عرض حجز مؤكداً.');
    if(plan.unscheduled?.length)warnings.push('لم تُجدول ولم تُحسب تذاكر: '+plan.unscheduled.map(stop=>stop.name_ar).join('، ')+'. راجع حدود اليوم وأيام الإغلاق.');
    const sourceDays=plan.route.days;
    const valid=sourceDays.length===dayDiff(trip.departure,trip.returnDate)+1&&sourceDays.every((day,i)=>day.date===addDays(trip.departure,i));
    if(!valid)warnings.push('لم يُطبع البرنامج لأنه لا يطابق تواريخ سياق هذه الخطة.');
    const accepted=new Set((plan.suggestions?.items||[]).filter(item=>item.accepted).map(item=>item.id));
    const route=valid?sourceDays.map((day,i)=>({date:day.date,edge:i===0?'وصول':i===sourceDays.length-1?'عودة':null,light:day.light_day,visit:day.visit_min,transit:day.transit_min,rest:(day.breaks||[]).filter(b=>b.kind==='rest_or_lunch').reduce((sum,b)=>sum+b.duration_min,0)||45,walk:day.walk_km,stops:day.stops.map(stop=>({id:stop.id,name:stop.name_ar,accepted:accepted.has(stop.id),verified:stop.verified,url:stop.official_url,checked:stop.last_verified}))})):[];
    const sources=[{name:'الإقامة: '+plan.hotel.name_ar,url:plan.hotel.url,verified:plan.hotel.evidence?.verified,checked:plan.hotel.evidence?.last_verified},...(result.holidays?.calendar||[]).map(event=>({name:event.name_ar,url:event.source_url,verified:event.verified,checked:event.retrieved_at}))];
    const assumptions=result.budget_assumptions||{},pace=trip.pace==='active'?'نشطة':'مريحة';
    return {id:plan.id,name:plan.name,trip,target:budget.target.SAR,fx:budget.exchange_rate,reserve:budget.reserve_percent,fee:budget.fx_fee_percent,assumptions:'الإقامة: '+plan.hotel.name_ar+' | الغرفة / الليلة: '+money(plan.hotel.nightly_sar)+' SAR | الوتيرة: '+pace+' | طعام / نقل الفرد يومياً: '+money(assumptions.foodDaily)+' / '+money(assumptions.transportDaily)+' | تحويلات / إضافات المجموعة: '+money(assumptions.transfers)+' / '+money(assumptions.extras),
      complete:budget.complete,stale:generatedStale,total:budget.complete?budget.total.SAR:null,known:budget.known_total.SAR,costs:Object.fromEntries(Object.entries(budget.components).map(([key,m])=>[key,m.SAR])),warnings:[...warnings,...(result.holidays?.warnings||[]).map(w=>w.text)],route,suggestions:clone((plan.suggestions?.items||[]).filter(item=>!item.accepted)),sources,status:agentSummary(result),retrieved:result.generated_at};
  }
  function sources(){return [...(generated?.plans||[]).map(plan=>({id:plan.id,name:plan.name})),{id:'manual',name:'الحاسبة اليدوية'}];}
  function models(ids){return ids.map(id=>{if(id==='manual')return manual();const plan=generated?.plans.find(p=>p.id===id);if(!plan)throw Error('اختر مصدر الطباعة.');return fromGenerated(plan,generated);});}
  function table(parent,headers,rows,caption){
    const table=el('table',null,parent);if(caption)el('caption',caption,table);const head=el('tr',null,el('thead',null,table));headers.forEach(text=>el('th',text,head).scope='col');
    const body=el('tbody',null,table);for(const row of rows){const tr=el('tr',null,body);row.forEach((value,i)=>{const cell=el(i?'td':'th',null,tr);if(!i)cell.scope='row';el('bdi',value,cell);});}return table;
  }
  function warnings(parent,items){const all=[...new Set(items.filter(Boolean))];if(!all.length)return;const box=el('section',null,parent,'doc-warnings');el('h2','نواقص وتحذيرات قبل الاعتماد',box);const list=el('ul',null,box);all.forEach(text=>el('li',text,list));}
  const dayKey=day=>JSON.stringify(day);
  function days(parent,route,title){
    if(!route.length)return;el('h2',title,parent);
    for(let i=0;i<route.length;i++){
      const day=route[i],card=el('article',null,parent,'doc-day');
      if(!day.edge&&!day.stops.length){const rest=[day];while(i+1<route.length&&!route[i+1].edge&&!route[i+1].stops.length&&dayDiff(rest.at(-1).date,route[i+1].date)===1)rest.push(route[++i]);el('h3','راحة / وقت حر'+(rest.length>1?' - '+rest.length+' أيام':''),card);const dates=el('p',null,card);rest.forEach((item,j)=>{if(j)dates.append(' | ');el('bdi',dateText(item.date),dates);});el('p','لا زيارات مجدولة؛ الاقتراحات غير المقبولة منفصلة عن البرنامج والميزانية.',card);continue;}
      const heading=el('h3',null,card);el('bdi',dateText(day.date),heading);heading.append(' - '+(day.edge|| (day.light?'يوم أخف':'زيارات اليوم')));
      for(const stop of day.stops)el('p',stop.name+(stop.accepted?' - زيارة / اقتراح مقبول':' - زيارة مجدولة')+(stop.verified?'':' · غير متحقق'),card);
      el('p','الزيارة '+money(day.visit)+' د | التنقل '+(day.transit==null?'غير محسوب في الجدول اليدوي':money(day.transit)+' د')+' | الاستراحة '+money(day.rest)+' د'+(day.walk!=null?' | المشي '+money(day.walk)+' كم':''),card,'doc-metrics');
    }
  }
  function pendingSuggestions(parent,plans){
    const unique=new Map();for(const plan of plans)for(const item of plan.suggestions){const key=JSON.stringify([item.id,item.date]);if(!unique.has(key))unique.set(key,{item,names:[]});unique.get(key).names.push(plan.name);}
    if(!unique.size)return;el('h2','اقتراحات غير مقبولة - خارج البرنامج والتكلفة',parent);el('p','هذه الخيارات لم تُضف إلى الميزانية؛ يتطلب قبولها مراجعة الزيارة والسعر أولاً.',parent);
    table(parent,['التاريخ','الاقتراح','الخطط'],[...unique.values()].sort((a,b)=>a.item.date.localeCompare(b.item.date)).map(({item,names})=>[item.date,item.name_ar+' · غير مقبول'+(item.verified?'':' · غير متحقق'),names.join('، ')]));
  }
  function sourceSection(parent,plans){
    const all=new Map();for(const plan of plans){for(const item of [...plan.sources,...plan.route.flatMap(day=>day.stops),...plan.suggestions.map(item=>({name:item.name_ar,url:item.official_url,verified:item.verified,checked:item.last_verified}))]){
      try{const url=new URL(item.url);if(url.protocol!=='https:'||url.username||url.password)continue;const key=url.href+'|'+item.name;if(!all.has(key))all.set(key,{...item,url:url.href});}catch{}
    }}
    el('h2','المصادر وحالة التحقق',parent);el('p','الأسعار والمدد والتنقل والمشي تقديرات تحتاج مراجعة؛ لا تشمل الانتظار والزحام. قواعد الدليل ليست تأكيداً رسمياً لساعات الزيارة. راجع المصدر قبل الحجز والزيارة.',parent);
    if(plans.some(p=>p.retrieved))el('p','تاريخ النتيجة: '+[...new Set(plans.map(p=>p.retrieved).filter(Boolean))].join(' | '),parent,'doc-meta');
    const list=el('ul',null,parent,'doc-sources');for(const item of all.values()){const li=el('li',null,list);const a=el('a',item.name,li);a.href=item.url;li.append(' · '+(item.verified?'حالة الدليل: متحقق وفق السجل':'غير متحقق')+(item.checked?' · تحقق / جلب: '+item.checked:''));}
    const statuses=new Map();for(const plan of plans){if(!statuses.has(plan.status))statuses.set(plan.status,[]);statuses.get(plan.status).push(plan.name);}
    for(const [status,names] of statuses)el('p',names.join('، ')+': '+status,parent,'doc-meta');
  }
  function build(ids,mode){
    const plans=models(ids);if(!plans.length)throw Error('اختر مصدراً واحداً على الأقل.');if(mode==='selected'&&plans.length!==1)throw Error('اختر خطة واحدة للرحلة.');
    const root=document.createElement('main');root.id='printDocument';root.dir='rtl';root.lang='ar';
    el('p','رحلة إسطنبول | نسخة '+(mode==='comparison'?'للمقارنة':'الرحلة المختارة'),root,'doc-kicker');el('h1',mode==='comparison'?'مقارنة الخطط':plans[0].name,root);
    const summary=el('section',null,root,'doc-summary');el('h2','بيانات الرحلة - راجع الأعمار والغرف',summary);el('p',tripText(plans[0].trip),summary);
    el('p','لم تُنقل أسعار أو تُوحّد افتراضات بين المصادر. المبالغ بالريال السعودي SAR.',summary);
    const different=plans.filter(p=>tripKey(p.trip)!==tripKey(plans[0].trip));for(const plan of different)el('p','اختلاف بيانات '+plan.name+': '+tripText(plan.trip),summary,'doc-alert');
    const costs=[['الإقامة','stay'],['الطعام','food'],['النقل','transport'],['إضافات / مصروفات أخرى','extras'],['تذاكر المزارات','attractions'],['طيران المجموعة','flights'],['رسوم الصرف','fx_fee'],['الاحتياطي','reserve']];
    const rows=costs.map(([label,key])=>[label,...plans.map(plan=>money(plan.costs[key]))]);
    rows.push(['الإجمالي الكامل',...plans.map(plan=>plan.complete?money(plan.total):'غير مكتمل - الطيران ناقص')],['المبلغ المتاح',...plans.map(plan=>money(plan.known))],['حالة الميزانية',...plans.map(plan=>(plan.complete?'تقدير يشمل الطيران':'تقدير غير مكتمل؛ يستثني الطيران')+(plan.staleHotel?'؛ عرض الإقامة قديم':plan.stale?'؛ النتائج قديمة':''))],['هدف الميزانية',...plans.map(plan=>money(plan.target))],['سعر الصرف TRY / SAR',...plans.map(plan=>money(plan.fx))],['الاحتياطي / رسوم الصرف',...plans.map(plan=>plan.reserve+'% / '+plan.fee+'%')]);
    table(root,['البند',...plans.map(plan=>plan.name)],rows,'الميزانية والافتراضات - دون نقل أسعار بين المصادر');
    if(new Set(plans.map(p=>p.target)).size>1)el('p','تختلف أهداف الميزانية بين المصادر؛ لم يُغيّر أي هدف.',root,'doc-alert');
    for(const plan of plans)el('p',plan.name+': '+plan.assumptions,root,'doc-meta');
    const groupedWarnings=new Map();for(const plan of plans)for(const warning of new Set(plan.warnings)){if(!groupedWarnings.has(warning))groupedWarnings.set(warning,[]);groupedWarnings.get(warning).push(plan.name);}
    warnings(root,[...groupedWarnings].map(([text,names])=>names.join('، ')+': '+text));
    if(mode==='selected')days(root,plans[0].route,'البرنامج الخاص بالمصدر المختار');
    else {
      const base=plans[0].route,identical=plans.every(plan=>JSON.stringify(plan.route)===JSON.stringify(base));
      days(root,base,identical?'البرنامج المشترك - يظهر مرة واحدة':'البرنامج المرجعي: '+plans[0].name);
      for(const plan of plans.slice(1)){
        if(!plan.route.length){el('p',plan.name+': لا برنامج صالح مطبوع لهذا المصدر؛ راجع التحذيرات.',root,'doc-meta');continue;}
        const differentDays=plan.route.filter(day=>!base.some(other=>dayKey(other)===dayKey(day)));
        const missing=base.filter(day=>!plan.route.some(other=>other.date===day.date));
        if(!differentDays.length&&!missing.length)continue;
        el('h2','فروق البرنامج: '+plan.name,root);
        const rows=[...differentDays.map(day=>{const original=base.find(other=>other.date===day.date),sameStops=original&&JSON.stringify(original.stops)===JSON.stringify(day.stops);return [day.date,sameStops?'نفس الزيارات؛ اختلاف تفاصيل اليوم':day.stops.map(stop=>stop.name+(stop.accepted?' (مقبول)':'')).join('، ')||day.edge||'راحة / وقت حر','زيارة '+money(day.visit)+' | تنقل '+(day.transit==null?'غير محسوب':money(day.transit))+' | استراحة '+money(day.rest)];}),...missing.map(day=>[day.date,'لا برنامج مطبوع لهذا التاريخ في هذا المصدر','—'])];
        const compact=[];for(const row of rows){const previous=compact.at(-1);if(previous&&previous[1]===row[1]&&previous[2]===row[2]&&dayDiff(previous[0].split(' | ').at(-1),row[0])===1)previous[0]+=' | '+row[0];else compact.push([...row]);}
        table(root,['التاريخ','الزيارة / الفرق','المدد بالدقائق'],compact);
      }
    }
    pendingSuggestions(root,plans);sourceSection(root,plans);el('p','نسخة أُعدت '+new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Riyadh'}).format(new Date())+' بتوقيت الرياض. راجع التوافر والأسعار قبل الدفع.',root,'doc-meta');
    return root;
  }
  function selectedIds(){return get('printMode').value==='selected'?[get('printSource').value].filter(Boolean):[...get('printChoices').querySelectorAll('input:checked')].map(input=>input.value);}
  function review(){
    const selected=get('printMode').value==='selected';get('printSourceBox').hidden=!selected;get('printChoices').hidden=selected;const target=get('printReview');target.replaceChildren();
    try{const plans=models(selectedIds());if(!plans.length)throw Error('اختر مصدر الطباعة؛ لا يتم اختيار الحاسبة بدلاً من الخطة تلقائياً.');for(const plan of plans){el('h3',plan.name,target);el('p',tripText(plan.trip),target);el('p','الهدف المالي: '+money(plan.target)+' SAR | '+(plan.complete?'ميزانية تقديرية تشمل الطيران':'غير مكتملة؛ الطيران ناقص')+' | المبلغ المتاح: '+money(plan.known)+' SAR',target);for(const warning of plan.warnings)el('p',warning,target,'doc-alert');}get('confirmPrint').disabled=false;}catch(error){el('p',error.message,target);get('confirmPrint').disabled=true;}
  }
  function ensure(){
    if(get('printDialog'))return;const dialog=el('dialog',null,document.body);dialog.id='printDialog';dialog.dir='rtl';
    el('h2','مراجعة نسخة PDF',dialog);el('p','راجع التواريخ وأعمار الأطفال والغرف والهدف. لن نصححها بافتراضات، ويمكن حفظ نسخة تقديرية مع تحذيراتها.',dialog);
    const modeLabel=el('label','نوع النسخة',dialog);modeLabel.htmlFor='printMode';const mode=el('select',null,dialog);mode.id='printMode';for(const [value,label] of [['comparison','مقارنة الخطط'],['selected','الخطة المختارة للرحلة']])el('option',label,mode).value=value;
    const sourceBox=el('div',null,dialog);sourceBox.id='printSourceBox';const label=el('label','اختر الخطة أو الحاسبة صراحة',sourceBox);label.htmlFor='printSource';el('select',null,sourceBox).id='printSource';el('fieldset',null,dialog).id='printChoices';el('div',null,dialog).id='printReview';
    el('p','ترقيم الصفحات يظهر إذا دعمه المتصفح؛ فعّل رؤوس وتذييلات الطباعة من نافذة المتصفح إن لم يظهر.',dialog,'field-hint');
    const confirm=el('button','راجعت البيانات - طباعة / حفظ PDF',dialog,'button primary');confirm.id='confirmPrint';confirm.type='button';
    const cancel=el('button','إلغاء',dialog,'button');cancel.type='button';cancel.addEventListener('click',()=>{if(dialog.close)dialog.close();else dialog.open=false;});
    dialog.addEventListener('change',review);confirm.addEventListener('click',()=>{try{const ids=selectedIds(),mode=get('printMode').value,root=build(ids,mode);lastSelection={ids,mode};get('printDocument')?.remove();document.body.append(root);if(dialog.close)dialog.close();else dialog.open=false;window.print();}catch(error){notify(error.message);}});
    window.addEventListener('beforeprint',()=>{get('printDocument')?.remove();if(lastSelection){try{document.body.append(build(lastSelection.ids,lastSelection.mode));return;}catch{}}
      const root=el('main',null,document.body);root.id='printDocument';el('h1','اختر نسخة PDF من زر الطباعة داخل التطبيق',root);el('p','استخدم مقارنة الخطط أو اختر الخطة أو الحاسبة وراجع بياناتها قبل حفظ الملف.',root);
    });
    window.addEventListener('afterprint',()=>{lastSelection=null;get('printDocument')?.remove();});
  }
  function open(){ensure();const options=sources();get('printSource').replaceChildren();el('option','اختر المصدر…',get('printSource')).value='';for(const option of options)el('option',option.name,get('printSource')).value=option.id;
    get('printChoices').replaceChildren();el('legend','مصادر المقارنة',get('printChoices'));for(const option of options){const label=el('label',null,get('printChoices'));const input=el('input',null,label);input.type='checkbox';input.value=option.id;input.checked=option.id!=='manual';label.append(' '+option.name);}
    get('printMode').value=generated?.plans.length>1?'comparison':'selected';review();const dialog=get('printDialog');if(dialog.showModal)dialog.showModal();else dialog.open=true;
  }
  window.IstanbulPrint={open,build,models,setGenerated(result,stale){generated=result;generatedStale=stale;get('printDocument')?.remove();}};
  ensure();
})();
