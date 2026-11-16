'use strict';
(() => {
  const get=id=>document.getElementById(id);
  const agents={orchestrator:'المنسّق',flights:'الطيران',hotels:'السكن',attractions:'المزارات',route:'المسار',budget:'الميزانية',critic:'المراجع'};
  const states={started:'جارٍ العمل',complete:'اكتمل',estimate:'تقدير',ok:'بيانات مخزنة',no_data:'لا توجد بيانات',error:'تعذر',pass:'اجتاز',warnings:'ملاحظات',unavailable:'غير متاح',revision:'إعادة مراجعة',rejected:'مستبعد'};
  const labels={flights:'الطيران',stay:'الإقامة',food:'الطعام',transport:'النقل والتحويلات',attractions:'تذاكر المزارات المجدولة',extras:'إضافات',fx_fee:'رسوم الصرف',reserve:'الاحتياطي'};
  const nf=new Intl.NumberFormat('ar-SA',{maximumFractionDigits:2});
  let lastResult=null, resultContext=null, pendingContext=null;
  function formContext(){return JSON.stringify([...get('generateForm').querySelectorAll('input,select')].map(el=>[el.id||el.value,el.type==='checkbox'?el.checked:el.value]).concat([['exchangeRate',get('exchangeRate').value]]));}
  function isStale(){return lastResult!==null&&resultContext!==formContext();}
  function updateResultValidity(){
    window.IstanbulPrint?.setGenerated(lastResult,isStale());
    const stale=isStale(),notice=get('generatedStaleNotice');
    if(notice){notice.hidden=!stale;notice.textContent=stale?'تغيرت بيانات الرحلة؛ النتائج أدناه تخص الطلب السابق. أعد التوليد قبل تطبيقها أو تعديلها.':'';}
    get('generatedResults').querySelectorAll('button,input').forEach(el=>{if(el.id!=='useCalculatorFare')el.disabled=stale||el.dataset.accepted==='true';});
    get('exportGenerated').disabled=stale;updateFareTransfer();
  }
  function updatePartySummary(){
    const children=Number(get('genChildren').value),infants=Number(get('genInfants').value),adults=Number(get('genTravelers').value)-children-infants;
    get('generatorPartySummary').textContent=adults+' بالغ · '+children+' طفل · '+infants+' رضيع · أعمار الأطفال: '+(get('genChildAges').value||'لا توجد أعمار مدخلة')+' · الغرف: '+get('genRooms').value+'؛ تأكد من سعة الغرفة مع الفندق.';
    updateTripMismatch();
  }
  function generatorTrip(){
    const ids=['genDeparture','genReturn','genTravelers','genChildren','genInfants','genRooms'];
    if(ids.some(id=>get(id).value===''||!get(id).checkValidity()))throw Error('trip');
    const departure=get('genDeparture').value,returnDate=get('genReturn').value;
    if(!parseDate(departure)||!parseDate(returnDate)||departure<todayISO()||dayDiff(departure,returnDate)<1||dayDiff(departure,returnDate)>365)throw Error('trip');
    const children=Number(get('genChildren').value),infants=Number(get('genInfants').value),adults=Number(get('genTravelers').value)-children-infants;
    const text=get('genChildAges').value.trim().replace(/[\u0660-\u0669]/g,ch=>String(ch.charCodeAt(0)-0x660));
    const childAges=text?text.split(/[,\u060c]+/).map(s=>s.trim()===''?NaN:Number(s.trim())):[];
    const pace=get('genPace').value;
    if(adults<1||infants>adults||childAges.length!==children||childAges.some(age=>!Number.isInteger(age)||age<2||age>17)||!['relaxed','active'].includes(pace))throw Error('trip');
    return {departure,returnDate,adults,children,infants,childAges,rooms:Number(get('genRooms').value),pace};
  }
  function calculatorTrip(){return {departure:get('departure').value,returnDate:get('returnDate').value,adults:Number(get('adults').value),children:Number(get('children').value),infants:Number(get('infants').value),childAges:[...get('childAges').querySelectorAll('input')].map(el=>Number(el.value)),rooms:Number(get('rooms').value),pace:get('pace').value};}
  function updateTripMismatch(){
    let matches=false;try{matches=JSON.stringify(generatorTrip())===JSON.stringify(calculatorTrip());}catch{}
    const notice=get('generatorTripMismatch');notice.hidden=matches;
    notice.textContent=matches?'':'بيانات المولّد تختلف عن الحاسبة وبحث الفنادق، أو تحتاج تصحيحاً. لن تتغير الحاسبة تلقائياً؛ راجع البيانات ثم استخدم زر المزامنة أدناه. الأسعار السابقة ستبقى للمراجعة والعروض المرتبطة بالرحلة السابقة تحتاج إعادة تأكيد.';
  }
  function syncGeneratorTrip(){
    let trip;try{trip=generatorTrip();}catch{notify('صحح تواريخ المولّد والمسافرين وأعمار الأطفال والغرف قبل المزامنة.');return;}
    for(const id of ['departure','returnDate','adults','children','infants','rooms','pace'])get(id).value=trip[id];
    renderAges(Object.fromEntries(trip.childAges.map((age,i)=>['age-'+i,age])));
    get('autoRooms').checked=false;get('manualBudgetEdited').checked=true;
    update();updatePartySummary();updateFareTransfer();
    notify('نُقلت بيانات الرحلة إلى الحاسبة وبحث الفنادق؛ احتُفظ بالأسعار، راجع العروض السابقة وأعد تأكيدها.');
  }
  function matchingManualTrip(){
    if(!lastResult)return false;const input=lastResult.input_summary;
    if(get('departure').value!==input.departure||get('returnDate').value!==input.returnDate)return false;
    if(['adults','children','infants'].some(id=>Number(get(id).value)!==input[id]))return false;
    return JSON.stringify((input.childAges||[]).slice().sort((a,b)=>a-b))===JSON.stringify([...get('childAges').querySelectorAll('input')].map(el=>Number(el.value)).sort((a,b)=>a-b));
  }
  function updateFareTransfer(){
    const button=get('useCalculatorFare');if(!button)return;const value=get('groupFlightFare').value,valid=value!==''&&get('groupFlightFare').checkValidity(),matches=matchingManualTrip();
    button.disabled=isStale()||!valid||!matches;
    get('fareTransferHint').textContent=!matches?'لن يُنقل السعر حتى تتطابق تواريخ الرحلة وفئات المسافرين وأعمار الأطفال مع الحاسبة.':!valid?'أدخل سعر المجموعة الكامل في الحاسبة أولاً.':'سعر الحاسبة '+nf.format(Number(value))+' ر.س؛ انقله فقط إذا كان يشمل جميع المسافرين والأمتعة المطلوبة لنفس الرحلة.';
  }
  function formatDate(value){const stamp=String(value),date=new Date(stamp.length===10?stamp+'T12:00:00Z':stamp);if(!Number.isFinite(date.getTime()))return 'تاريخ غير متاح';return new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn',{timeZone:'Asia/Riyadh',year:'numeric',month:'short',day:'numeric',...(stamp.includes('T')?{hour:'2-digit',minute:'2-digit'}:{})}).format(date)+(stamp.includes('T')?' بتوقيت الرياض':'');}
  function localized(value){return String(value).replace(/Editorial (?:accommodation estimate; not a live quote|estimate; not a live quote)/g,'تقدير تحريري للسكن؛ ليس عرض سعر حي').replace(/Travelpayouts Data API/g,'بيانات الطيران المخزنة (Travelpayouts)').replace(/Ramazan Bayram[ıi]/g,'عيد الفطر');}
  function node(tag,text,parent,className){const el=document.createElement(tag);if(text!==undefined){const value=localized(text),rx=/\b\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?/g;let at=0;for(const match of value.matchAll(rx)){el.append(document.createTextNode(value.slice(at,match.index)));const bdi=document.createElement('bdi');bdi.dir='ltr';bdi.textContent=formatDate(match[0]);el.append(bdi);at=match.index+match[0].length;}el.append(document.createTextNode(value.slice(at)));}if(className)el.className=className;if(parent)parent.append(el);return el;}
  function source(meta){if(!meta)return 'مصدر غير متاح · غير متحقق';const freshness={cached:'مخزن',estimate:'تقدير',derived:'حساب حتمي / تقدير', 'user-entered':'إدخال المستخدم'};return [meta.source,freshness[meta.freshness]||'غير متحقق',meta.fetched_at?'جُلب: '+meta.fetched_at:'لم يُجلب سعر حي',meta.last_verified?'آخر تحقق: '+meta.last_verified:'آخر تحقق: غير متحقق'].join(' · ');}
  function amount(m){return m?.SAR===null||!Number.isFinite(m?.SAR)?'غير مكتمل':nf.format(m.SAR)+' ر.س / '+nf.format(m.TRY)+' ل.ت';}
  const hosts=new Set(['www.google.com','www.saudia.com','www.turkishairlines.com','www.flypgs.com','www.booking.com','vakithesaplama.diyanet.gov.tr','aladhan.com','muze.gov.tr','visit.istanbul','www.millisaraylar.gov.tr','yerebatan.com','miniaturk.com.tr','www.rmk-museum.org.tr','istanbulakvaryum.com','sehirhatlari.istanbul']);
  function link(parent,label,url){try{const parsed=new URL(url);if(parsed.protocol!=='https:'||!hosts.has(parsed.hostname)||parsed.username||parsed.password)return;const a=node('a',label,parent,'text-link');a.href=parsed.href;a.target='_blank';a.rel='noopener noreferrer';}catch{}}
  function routeNote(day,box){node('p',(day.light_day?'يوم أخف · ':'')+'استراحة أو غداء 45 دقيقة على الأقل · حد المشي اليومي '+(day.walking_limit_km??'غير محدد')+' كم؛ تقدير يحتاج تأكيداً ميدانياً.',box,'field-hint');}
  function refreshScore(plan,result){const stops=plan.route.days.flatMap(d=>d.stops),count=(result.input_summary.selected?.length||stops.length+plan.unscheduled.length)+(plan.suggestions?.items.filter(i=>i.accepted).length||0),coverage=count?stops.length/count:0,transit=plan.route.days.reduce((n,d)=>n+d.transit_min,0),uncertain=stops.filter(s=>!s.verified).length/Math.max(1,stops.length);plan.value_score=Math.round(1000000*coverage/Math.max(1,plan.budget.known_total.SAR)/(1+transit/300)*(1-uncertain*.25))/100;}
  function setGroupFare(value){if(!lastResult||isStale())return;for(const plan of lastResult.plans){plan.budget=recalculateGeneratedBudget(plan.budget,{groupFlightFare:value});plan.warnings=plan.warnings.filter(w=>!w.includes('الإجمالي غير مكتمل'));if(!plan.budget.complete)plan.warnings.push('الإجمالي غير مكتمل؛ أدخل طيران المجموعة.');refreshScore(plan,lastResult);}render(lastResult);}
  function acceptSuggestion(planId,id){if(!lastResult||isStale())return;const plan=lastResult.plans.find(p=>p.id===planId),item=plan?.suggestions?.items.find(s=>s.id===id);if(!item||item.accepted)return;const day=plan.route.days.find(d=>d.date===item.date);if(!day||day.stops.length)return;item.accepted=true;day.stops.push({...item});day.light_day=true;day.visit_min=item.duration_min;day.transit_min=item.transit_min;day.walk_km=item.walk_km;const people=lastResult.input_summary.adults+lastResult.input_summary.children;plan.budget=recalculateGeneratedBudget(plan.budget,{addedTicketSAR:Math.round(item.ticket_try/plan.budget.exchange_rate*100)/100*people});refreshScore(plan,lastResult);render(lastResult);}
  function render(result){
    if(!result||result.version!==1||!Array.isArray(result.plans)||!result.plans.length||result.plans.length>3||!Array.isArray(result.agents_report)||!result.flights)throw Error('invalid_result');
    if(result!==lastResult)resultContext=pendingContext||formContext();
    const root=document.createElement('div');
    const staleNotice=node('p',undefined,root,'info');staleNotice.id='generatedStaleNotice';staleNotice.setAttribute('role','status');
    const compact=node('section',undefined,root,'plan-overview');node('h3','ملخص الخطط',compact);
    const choices=node('div',undefined,compact,'plan-choices');const cheapest=Math.min(...result.plans.map(p=>p.budget.known_total.SAR));
    node('p','قارن المتاح أولاً؛ التقديرات لا تثبت توافر غرفة أو سعر حجز. اختلاف فئة السكن لا يضمن اختلاف البرنامج.',compact,'field-hint');
    for(const plan of result.plans){const b=plan.budget,card=node('section',undefined,choices,'plan-choice');node('h4',plan.name,card);node('p',(b.complete?'مكتمل حسابياً: ':'المتاح قبل الطيران: ')+amount(b.known_total),card,'info');const difference=b.known_total.SAR-b.target.SAR;node('p',(difference>0?'أعلى من الهدف بـ ':difference<0?'المتبقي من الهدف: ':'يساوي الهدف: ')+nf.format(Math.abs(Math.round(difference*100)/100))+' ر.س'+(!b.complete?'؛ ستزيد التكلفة عند إضافة الطيران':''),card);node('p','فرق المتاح عن الأقل تكلفة: '+nf.format(Math.round((b.known_total.SAR-cheapest)*100)/100)+' ر.س · الإقامة '+amount(b.components.stay),card,'field-hint');node('p',plan.hotel.name_ar+' · '+result.input_summary.rooms+' غرف · '+plan.route.days.filter(d=>d.stops.length).length+' أيام بزيارات من '+plan.route.days.length+' · '+plan.unscheduled.length+' اختيارات غير مجدولة',card,'field-hint');}
    const fareBox=node('div',undefined,root,'no-print');const fareLabel=node('label','طيران المجموعة كاملة لكل '+(result.input_summary.adults+result.input_summary.children+result.input_summary.infants)+' مسافرين ذهاباً وعودة (ر.س)',fareBox);fareLabel.htmlFor='resultGroupFare';const fare=node('input',undefined,fareBox);fare.id='resultGroupFare';fare.type='number';fare.min='0';fare.max='1000000';fare.step='0.01';fare.value=result.plans[0].budget.components.flights.evidence.freshness==='user-entered'?(result.plans[0].budget.components.flights.SAR??''):'';node('small','مدخل من المستخدم؛ يُعاد حساب كل الخطط محلياً دون طلب جديد.',fareBox);fare.addEventListener('change',()=>{if(fare.checkValidity())setGroupFare(fare.value===''?null:Number(fare.value));});
    const transfer=node('button','استخدم سعر طيران المجموعة من الحاسبة',fareBox,'button');transfer.type='button';transfer.id='useCalculatorFare';transfer.addEventListener('click',()=>{updateFareTransfer();if(!transfer.disabled)setGroupFare(Number(get('groupFlightFare').value));});const transferHint=node('small',undefined,fareBox);transferHint.id='fareTransferHint';
    node('p','النتيجة بتاريخ '+result.generated_at+' · '+source(result.numeric_evidence),root,'field-hint');
    node('p','المسافرون: '+result.input_summary.adults+' بالغ، '+result.input_summary.children+' طفل، '+result.input_summary.infants+' رضيع · الغرف: '+result.input_summary.rooms+' · المصدر: مدخلات المستخدم وقت الطلب. التواريخ أدناه من طلبك.',root,'field-hint');
    if(result.input_summary.childAges?.length)node('p','أعمار الأطفال: '+result.input_summary.childAges.join('، ')+' · لا نفترض خصم أطفال.',root,'field-hint');
    if(result.holidays){for(const warning of result.holidays.warnings)node('p',warning.text,root,'info');const details=node('details',undefined,root);node('summary','تقويم رمضان والعيد ومصادر التحقق',details);for(const event of result.holidays.calendar){node('p',event.name_ar+' · '+event.start+' — '+event.end+' · '+(event.verified?'متحقق من التقويم المنشور':'غير متحقق')+' · جُلب '+event.retrieved_at+' · '+event.note_ar,details,'field-hint');link(details,'مصدر التقويم ↗',event.source_url);}}
    for(const plan of result.plans){
      const article=node('article',undefined,root,'generated-plan');node('h3',plan.name,article);
      const apply=node('button','طبّق هذه الخطة على الحاسبة',article,'button no-print');apply.type='button';apply.dataset.applyPlan=plan.id;apply.addEventListener('click',()=>{if(!isStale())applyGeneratedPlanToCalculator(plan,result);});
      node('p','الإجمالي: '+amount(plan.budget.total),article,'generated-total');node('small',source(plan.budget.total.evidence),article);
      if(!plan.budget.complete)node('p','المجموع المتاح فقط: '+amount(plan.budget.known_total)+' · '+source(plan.budget.known_total.evidence),article,'info');
      node('p','الهدف: '+amount(plan.budget.target)+' · '+source(plan.budget.target.evidence),article,'field-hint');
      if(plan.budget.difference)node('p','الفرق عن الهدف: '+amount(plan.budget.difference)+' · '+source(plan.budget.difference.evidence),article,'field-hint');
      node('p','درجة القيمة '+nf.format(plan.value_score)+(plan.budget.complete?'':' (أولية)')+' · حساب حتمي من التغطية والتكلفة والتنقل وعدم التحقق · '+result.generated_at,article,'field-hint');
      const table=node('table',undefined,article,'generated-costs');node('caption','تفصيل التكاليف ومصادرها',table);const head=node('tr',undefined,node('thead',undefined,table));for(const title of ['البند','SAR / TRY','المصدر والحداثة']){const th=node('th',title,head);th.scope='col';}
      const tbody=node('tbody',undefined,table);for(const [key,m] of Object.entries(plan.budget.components)){const row=node('tr',undefined,tbody);const th=node('th',labels[key]||key,row);th.scope='row';node('td',amount(m),row);node('td',source(m.evidence),row);}
      node('p','الصرف: '+nf.format(plan.budget.exchange_rate)+' ليرة لكل ريال · '+source(plan.budget.fx),article,'field-hint');
      node('p','رسوم الصرف '+nf.format(plan.budget.fx_fee_percent)+'% والاحتياطي '+nf.format(plan.budget.reserve_percent)+'% · مدخلات المستخدم وقت الطلب؛ محسوبة حتمياً.',article,'field-hint');
      node('h4','السكن: '+plan.hotel.name_ar,article);node('p','نطاق الغرفة / الليلة: '+plan.hotel.band_sar.map(n=>nf.format(n)).join(' – ')+' ر.س / '+plan.hotel.band_sar.map(n=>nf.format(Math.round(n*plan.budget.exchange_rate*100)/100)).join(' – ')+' ل.ت · '+source(plan.hotel.evidence),article,'field-hint');
      node('p','المتوسط المستخدم '+nf.format(plan.hotel.nightly_sar)+' ر.س · تقدير تحريري غير متحقق، فئة '+({economy:'اقتصادية',balanced:'متوسطة',comfortable:'مريحة'}[plan.hotel.class]||'')+' · '+({low:'موسم منخفض',mid:'موسم متوسط',peak:'موسم ذروة'}[plan.hotel.season]||'')+' · السعة والضرائب غير مؤكدة.',article,'field-hint');link(article,'التحقق من أسعار السكن ↗',plan.hotel.url);
      node('p','ملاءمة الأسرة: توافر غرفة عائلية وقابلية المشي في المنطقة '+(plan.hotel.family_suitable?.verified?'متحققان حسب المصدر':'غير متحققين؛ أكد مع الفندق')+' · '+(plan.hotel.occupancy_note||''),article,'field-hint');if(plan.hotel.google_url)link(article,'Google Hotels: أكد الأعمار والإشغال ↗',plan.hotel.google_url);
      node('h4','البرنامج اليومي',article);
      for(const day of plan.route.days){const box=node('div',undefined,article,'generated-day');node('h4',day.date,box);routeNote(day,box);node('p',day.stops.length?day.stops.map(s=>s.name_ar).join(' ← '):'وصول / عودة أو وقت حر للراحة',box);node('small','الزيارة '+day.visit_min+' دقيقة · التنقل '+day.transit_min+' دقيقة · المشي '+day.walk_km+' كم · تقدير حتمي من إحداثيات ومدد غير متحققة في الدليل، لا يشمل الزحام أو الانتظار · '+result.generated_at,box);for(const stop of day.stops){node('p',stop.name_ar+' · '+stop.duration_min+' دقيقة · تذكرة فرد تقديرية '+nf.format(stop.ticket_try)+' ل.ت / '+nf.format(Math.round(stop.ticket_try/plan.budget.exchange_rate*100)/100)+' ر.س · المصدر: الدليل التحريري × الصرف أعلاه · '+(stop.verified?'متحقق':'غير متحقق')+' · آخر تحقق: '+(stop.last_verified||'غير متاح'),box,'field-hint');node('small',stop.child_suitability?.verified?'ملاءمة الأطفال متحققة حسب المصدر':'ملاءمة الأطفال: غير متحققة',box);link(box,'المصدر الرسمي: '+stop.name_ar+' ↗',stop.official_url);}}
      if(plan.unscheduled.length)node('p','لم تُجدول ولم تُحسب تذاكر: '+plan.unscheduled.map(s=>s.name_ar).join('، '),article,'info');
      if(plan.suggestions){const suggestions=node('section',undefined,article,'suggestions');node('h4','اقتراحات للأيام الخفيفة — اختيارية',suggestions);node('p',plan.suggestions.note,suggestions,'field-hint');if(plan.suggestions.coverage_warning)node('p',plan.suggestions.coverage_warning,suggestions,'info');node('p','أيام راحة محفوظة: '+plan.suggestions.reserved_rest_days.join('، '),suggestions,'field-hint');const weekdays=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'],areas={old:'المدينة القديمة',karakoy:'كاراكوي',golden:'القرن الذهبي',bosphorus:'البوسفور',asian:'الجانب الآسيوي',florya:'فلوريا'};for(const item of plan.suggestions.items){const box=node('div',undefined,suggestions,'suggestion');node('p',item.date+' · '+item.name_ar+' · '+(areas[item.area]||'منطقة من الدليل')+' · '+item.duration_min+' دقيقة · تذكرة تقديرية '+item.ticket_try+' ل.ت للفرد · الإغلاق الأسبوعي: '+(item.closed_days.length?item.closed_days.map(d=>weekdays[d]).join('، '):'لا إغلاق أسبوعي مسجل؛ يحتاج تحققاً'),box);node('small',(item.verified?'متحقق من المصدر':'غير متحقق')+' · ملاءمة الأطفال: '+(item.child_suitability?.verified?'متحققة من المصدر':'غير متحققة')+' · آخر تحقق: '+(item.last_verified||'غير متاح'),box);link(box,'المصدر ↗',item.official_url);for(const warning of item.holiday_warnings)node('p',warning,box,'info');const accept=node('button',item.accepted?'تم قبول الاقتراح وإضافة تذكرته':'أقبل هذا الاقتراح',box,'button no-print');accept.type='button';accept.disabled=item.accepted;accept.dataset.accepted=String(!!item.accepted);accept.dataset.acceptSuggestion=item.id;accept.addEventListener('click',()=>acceptSuggestion(plan.id,item.id));}}
      node('h4','لماذا هذه الخطة؟',article);const why=node('ul',undefined,article);for(const reason of plan.why)node('li',reason,why);
      const warnings=node('ul',undefined,article,'generated-warnings');for(const warning of plan.warnings)node('li',warning,warnings);
    }
    const flights=node('section',undefined,root,'generated-plan');node('h3','بيانات الطيران: '+({ok:'متاحة مخزنة',no_data:'لا توجد بيانات',error:'تعذر البحث'}[result.flights.status]||'غير متاحة'),flights);
    if(result.flights.label)node('p',result.flights.label,flights,'info');if(result.flights.pricing_note)node('p',result.flights.pricing_note,flights,'field-hint');if(result.flights.fallback?.group_total_sar!==null&&result.flights.fallback?.group_total_sar!==undefined)node('p','تكلفة المجموعة التي أدخلتها: '+nf.format(result.flights.fallback.group_total_sar)+' ر.س · إدخال مستخدم وليس سعراً من المزود.',flights,'field-hint');
    node('p','الخيارات وتقويم الأرخص أدناه للبالغ، وقد تختلف تواريخ البدائل؛ راجعها قبل الحجز. السعر مخزن وليس عرضاً حياً.',flights);
    for(const item of result.flights.options){node('p',(item.label||'سعر مخزن')+' · MED → '+item.airport+' · '+item.departure+' إلى '+item.returnDate+' · '+nf.format(item.price_sar)+' ر.س للفرد / '+nf.format(Math.round(item.price_sar*result.plans[0].budget.exchange_rate*100)/100)+' ل.ت للفرد · تقدير المجموعة '+nf.format(item.group_price_sar)+' ر.س = السعر الكامل × '+item.passengers+' مسافرين دون خصم أطفال · فرق الذهاب '+(item.date_difference?.departure_days??0)+' يوم، والعودة '+(item.date_difference?.return_days??0)+' يوم · المصدر '+item.source+' · مخزن · جُلب '+item.fetched_at,flights,'field-hint');for(const l of item.links||[])link(flights,l.label+' ↗',l.url);}
    if(result.flights.calendar.length){const details=node('details',undefined,flights);node('summary','تقويم أرخص النتائج المخزنة ضمن المرونة',details);for(const item of result.flights.calendar)node('p',item.departure+' / '+item.returnDate+' · '+item.airport+' · '+nf.format(item.price_sar)+' ر.س · Travelpayouts مخزن، غير متحقق · جُلب '+item.fetched_at,details,'field-hint');}
    for(const l of result.flights.links)link(flights,l.label+' ↗',l.url);
    const report=node('section',undefined,root,'advanced');node('h4','تقرير الوكلاء',report);for(const agent of new Set(result.agents_report.map(r=>r.agent))){const records=result.agents_report.filter(r=>r.agent===agent),latest=records.at(-1),details=node('details',undefined,report,'agent-report');node('summary',(agents[agent]||agent)+' · '+(states[latest.status]||latest.status),details);for(const r of records){node('p',(states[r.status]||r.status)+' — '+r.detail,details);if(r.diagnostics?.length){const technical=node('details',undefined,details);node('summary','التشخيص التقني للمزود',technical);node('pre',JSON.stringify(r.diagnostics,null,2),technical);}}}
    node('p','مكالمات المراجع: '+result.llm_calls+' · المصدر: عداد الخدمة وقت الطلب '+result.generated_at,report,'field-hint');
    if(result.affiliate_disclosure)node('p',result.affiliate_disclosure,root,'info');
    get('generatedResults').replaceChildren(root);lastResult=result;get('exportGenerated').hidden=false;updateResultValidity();
  }
  function progress(record){const row=get('agent-'+record.agent);if(row)row.textContent=(agents[record.agent]||record.agent)+' · '+(states[record.status]||record.status)+' — '+record.detail;}
  async function stream(response){
    if(!response.headers.get('Content-Type')?.includes('text/event-stream')){render(await response.json());return;}
    const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',size=0,doneResult=false;
    try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>2000000)throw Error('large_response');buffer+=decoder.decode(value,{stream:true});let end;while((end=buffer.indexOf('\n\n'))!==-1){const frame=buffer.slice(0,end);buffer=buffer.slice(end+2);const type=frame.match(/^event: (.+)$/m)?.[1],payload=frame.match(/^data: (.+)$/m)?.[1];if(!payload)continue;const data=JSON.parse(payload);if(type==='progress')progress(data);if(type==='result'){render(data);doneResult=true;}if(type==='error')throw Error('backend_error');}}if(!doneResult)throw Error('incomplete_stream');}finally{await reader.cancel().catch(()=>{});}
  }
  async function generate(event){
    event.preventDefault();const form=get('generateForm');if(!form.reportValidity())return;
    const notice=get('generatorNotice');notice.textContent='جارٍ البحث والتحقق…';get('generatePlan').disabled=true;get('generatedResults').replaceChildren();get('exportGenerated').hidden=true;lastResult=null;resultContext=null;pendingContext=formContext();
    document.querySelector('.generator-progress').hidden=false;
    window.IstanbulPrint?.setGenerated(null,false);
    for(const agent of Object.keys(agents))get('agent-'+agent).textContent=agents[agent]+' · بانتظار';
    let timer;const controller=new AbortController();
    try{
      const url=new URL(window.ISTANBUL_PLANNER_URL);if(url.protocol!=='https:' || url.pathname!=='/plan' || url.username || url.password)throw Error('configuration');
      const value=id=>Number(get(id).value), children=value('genChildren'),infants=value('genInfants'),adults=value('genTravelers')-children-infants;
      if(adults<1 || infants>adults)throw Error('travelers');
      const agesText=get('genChildAges').value.trim().replace(/[\u0660-\u0669]/g,ch=>String(ch.charCodeAt(0)-0x660));
      const childAges=agesText?agesText.split(/[,\u060c]+/).map(s=>Number(s.trim())):[];
      if(childAges.length!==children||childAges.some(age=>!Number.isInteger(age)||age<2||age>17))throw Error('travelers');
      const fields={departure:get('genDeparture').value,returnDate:get('genReturn').value,adults,children,childAges,infants,rooms:value('genRooms'),pace:get('genPace').value,targetBudget:value('genBudget'),exchangeRate:value('exchangeRate'),fxSource:typeof fxMeta!=='undefined'&&fxMeta?.source==='api'?'cached':'user-entered',fxFetchedAt:typeof fxMeta!=='undefined'&&fxMeta?.source==='api'?new Date(fxMeta.updated*1000).toISOString():null,nonstopOnly:get('genNonstop').checked,flexible:get('genFlexible').checked,manualFlightTotal:get('genFlight').value===''?null:value('genFlight'),selected:[...form.querySelectorAll('[data-gen-place]:checked')].map(el=>el.value),foodDaily:value('genFood'),transportDaily:value('genTransport'),transfers:value('genTransfers'),extras:value('genExtras'),fxFee:value('genFxFee'),reserve:value('genReserve')};
      if(!(fields.exchangeRate>0))throw Error('fx');
      timer=setTimeout(()=>controller.abort(),50000);
      const response=await fetch(url.href,{method:'POST',headers:{'Content-Type':'application/json','Accept':'text/event-stream'},body:JSON.stringify(fields),signal:controller.signal,credentials:'omit'});
      if(!response.ok)throw Error('http_'+response.status);await stream(response);notice.textContent='اكتمل التوليد. راجع المصادر والتحذيرات قبل تثبيت الحجز.';
    }catch(error){notice.textContent=error.message==='travelers'?'راجع عدد الأطفال والرضع؛ يجب وجود بالغ، والرضع لا يتجاوزون البالغين. الحاسبة اليدوية متاحة أدناه.':error.message==='fx'?'أدخل سعر صرف صحيحاً في لوحة الريال والليرة أو حدّثه. الحاسبة اليدوية متاحة أدناه.':'تعذر توليد الخطة أو لم تُضبط الخدمة بعد. تابع بالحاسبة اليدوية أدناه؛ خططك المحفوظة متاحة.';}finally{clearTimeout(timer);controller.abort();pendingContext=null;get('generatePlan').disabled=false;}
  }
  const choices=get('genInterests');
  if(typeof places!=='undefined')for(const place of places){const label=node('label',undefined,choices,'inline-check');const checkbox=node('input',undefined,label);checkbox.type='checkbox';checkbox.value=place.id;checkbox.setAttribute('data-gen-place','');checkbox.checked=['sultan','topkapi','galata'].includes(place.id);label.append(document.createTextNode(' '+place.name));}
  get('useFamilyTrip').addEventListener('click',()=>{get('genDeparture').value='2027-03-10';get('genReturn').value='2027-03-21';get('genTravelers').value='4';get('genChildren').value='2';get('genChildAges').value='12, 9';get('genInfants').value='0';get('genPace').value='relaxed';get('genReturn').min='2027-03-11';updatePartySummary();updateResultValidity();});
  get('genTravelers').value=['adults','children','infants'].reduce((sum,id)=>sum+Number(get(id).value),0);
  get('genChildren').value=get('children').value;get('genInfants').value=get('infants').value;get('genRooms').value=get('rooms').value;
  get('genChildAges').value=[...get('childAges').querySelectorAll('input')].map(el=>el.value).join(', ');
  get('genDeparture').value=get('departure').value;get('genReturn').value=get('returnDate').value;get('genDeparture').min=get('departure').min;
  get('genPace').value=get('pace').value;
  get('syncGeneratorTrip').addEventListener('click',syncGeneratorTrip);
  get('genDeparture').addEventListener('change',()=>get('genReturn').min=get('genDeparture').value);
  for(const type of ['input','change'])document.addEventListener(type,event=>{if(event.target.closest('#generateForm')||event.target.id==='exchangeRate'){updatePartySummary();updateResultValidity();}else if(event.target.closest('#trip')||event.target.id==='groupFlightFare')updateFareTransfer();});
  updatePartySummary();
  get('generateForm').addEventListener('submit',generate);
  get('generateForm').addEventListener('invalid',event=>{const details=event.target.closest('details');if(details)details.open=true;},true);
  get('exportGenerated').addEventListener('click',()=>{if(!lastResult||isStale())return;const url=URL.createObjectURL(new Blob([JSON.stringify(lastResult,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='istanbul-agent-plans.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  // Testable API; no secrets or raw HTML rendering.
  window.IstanbulPlanner={render,generate,source,formatDate,setGroupFare,acceptSuggestion,updateTripMismatch,updateResultValidity};
})();
