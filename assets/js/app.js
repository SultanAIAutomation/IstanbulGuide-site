'use strict';
const $ = id => document.getElementById(id);
const STORAGE_KEY = 'istanbul-trip-v1';
const nf = new Intl.NumberFormat('ar-SA', {maximumFractionDigits: 0});
const decimals = new Intl.NumberFormat('ar-SA', {maximumFractionDigits: 4});
const dateFmt = new Intl.DateTimeFormat('ar-SA', {day:'numeric', month:'short', year:'numeric', calendar:'gregory'});
const formatMoney = n => nf.format(n) + ' ر.س';
const localPriceIds = ['nightRate','hotelExtras','istTransfer','foodAdult','foodChild','transportDaily','cardFee','simPrice','activityDaily','shopping','infantExtras','otherLocal'];
let activeFilter = 'all', currency = 'SAR', storageAvailable = true, fxMeta = null, saveTimer, toastTimer;

function todayISO(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
function parseDate(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return null;const d=new Date(s+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s?d:null;}
function addDays(s,n){const d=parseDate(s);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
function dayDiff(a,b){return Math.round((parseDate(b)-parseDate(a))/86400000);}
function displayDate(s){return dateFmt.format(parseDate(s));}
function n(id){return Number($(id).value);}
function safeLoad(){try{const s=localStorage.getItem(STORAGE_KEY);return s?JSON.parse(s):null;}catch{return null;}}
function save(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{const fields={};document.querySelectorAll('[data-save]').forEach(el=>fields[el.id]=el.type==='checkbox'?el.checked:el.value);localStorage.setItem(STORAGE_KEY,JSON.stringify({fields,fxMeta,theme:document.documentElement.dataset.theme}));$('savedStatus').textContent='✓ حُفظت خطتك على هذا الجهاز';}catch{storageAvailable=false;$('savedStatus').textContent='الحفظ غير متاح؛ احتفظ بنسخة PDF';}},200);}
function notify(msg){$('toast').textContent=msg;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3500);}
function mapURL(q){return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(q);}
function renderPlaces(){
  $('attractions').innerHTML=places.map(p=>`<article class="place" id="place-${p.id}" data-category="${p.category}"><div class="place-top"><span class="place-symbol" aria-hidden="true">${p.symbol}</span><span class="badge">${p.free?'دون تذكرة · الجولة الخارجية':p.indoor?'داخلي / مختلط':'نشاط خارجي'}</span></div><div class="place-body"><label><input id="pick-${p.id}" type="checkbox" data-save> ${p.name}</label><div class="place-meta">${p.area} · ${p.duration}</div><p>${p.description}</p><div class="place-prices" style="grid-template-columns:repeat(3,minmax(0,1fr))"><div><label for="adult-${p.id}">بالغ <span class="local-unit"></span></label><input id="adult-${p.id}" type="number" min="0" max="1000000" step="0.01" value="${p.adult}" data-save></div><div><label for="child-${p.id}">طفل</label><input id="child-${p.id}" type="number" min="0" max="1000000" step="0.01" value="${p.child}" data-save></div><div><label for="infant-${p.id}">رضيع</label><input id="infant-${p.id}" type="number" min="0" max="1000000" step="0.01" value="${p.infant}" data-save></div></div><small>${p.free?'الطعام والنقل والمشتريات منفصلة.':'قيم توضيحية قابلة للتعديل، وليست أسعاراً حية.'}</small><div class="place-footer no-print"><a class="text-link" href="${mapURL(p.map)}" target="_blank" rel="noopener noreferrer">الخريطة ↗</a><a class="text-link" href="${p.url||'https://www.getyourguide.com/s/?q='+encodeURIComponent(p.query||p.map)}" target="_blank" rel="noopener noreferrer">${p.url?'المعلومات / التذاكر':'بحث الجولات'} ↗</a></div></div></article>`).join('');
  $('checks').innerHTML=checkItems.map((t,i)=>`<label class="check-item"><input type="checkbox" id="check-${i}" data-save><span>${t}</span></label>`).join('');
  document.querySelectorAll('.map-link').forEach(a=>{a.href=mapURL(a.dataset.map);a.target='_blank';a.rel='noopener noreferrer';});
}
function renderAges(saved){const count=Math.max(0,Math.min(20,Math.floor(n('children'))||0));const previous={};$('childAges').querySelectorAll('input').forEach(el=>previous[el.id]=el.value);$('childAges').innerHTML=Array.from({length:count},(_,i)=>`<div><label for="age-${i}">عمر الطفل ${nf.format(i+1)}</label><input id="age-${i}" type="number" min="2" max="17" step="1" value="7" data-save></div>`).join('');$('childAges').querySelectorAll('input').forEach(el=>el.value=saved?.[el.id]??previous[el.id]??7);}
function filterPlaces(){let visible=0;places.forEach(p=>{const selected=$('pick-'+p.id).checked;const show=activeFilter==='all'||activeFilter===p.category||(activeFilter==='free'&&p.free)||(activeFilter==='selected'&&selected);$('place-'+p.id).hidden=!show;$('place-'+p.id).classList.toggle('selected',selected);if(show)visible++;});$('placeCount').textContent=nf.format(visible)+' تجربة معروضة · '+nf.format(places.filter(p=>$('pick-'+p.id).checked).length)+' مختارة';}
function dateState(){const a=$('departure').value,b=$('returnDate').value;if(!parseDate(a)||!parseDate(b))return {valid:false,message:'اختر تاريخ الذهاب والعودة.'};if(a<todayISO())return {valid:false,message:'تاريخ الذهاب في الماضي؛ اختر موعداً قادماً.'};const nights=dayDiff(a,b);if(nights<1)return {valid:false,message:'يجب أن تكون العودة بعد الذهاب بليلة واحدة على الأقل.'};if(nights>365)return {valid:false,message:'اختر رحلة لا تتجاوز 365 ليلة.'};return {valid:true,nights,days:nights+1};}
function updateDates(){const ds=dateState();$('dateError').textContent=ds.valid?'':ds.message;$('returnDate').min=parseDate($('departure').value)?addDays($('departure').value,1):todayISO();$('nights').textContent=ds.valid?nf.format(ds.nights):'—';if(!ds.valid){$('seasonText').textContent='صحح التواريخ لعرض الموسم وتوقيت الحجز.';$('flightWindow').textContent=$('hotelWindow').textContent='بانتظار تواريخ صحيحة.';$('bookingAdvice').textContent='';return ds;}
  if($('autoDays').checked)$('expenseDays').value=ds.days;$('expenseDays').readOnly=$('autoDays').checked;
  const seasons=new Set();for(let i=0;i<ds.nights;i++){const m=parseDate(addDays($('departure').value,i)).getUTCMonth()+1;seasons.add([6,7,8].includes(m)?'peak':[11,12,1,2].includes(m)?'low':'mid');}
  const peak=seasons.has('peak'),low=seasons.size===1&&seasons.has('low');$('seasonBadge').textContent=seasons.size>1?'رحلة بين موسمين':peak?'موسم ذروة صيفية':low?'موسم توفير محتمل':'موسم معتدل';$('seasonText').textContent=(peak?'توقع طلباً أعلى صيفاً؛ قارن مبكراً واختر حجوزات مرنة.':low?'فرصة لتوفير خارج الذروة؛ جهّز بدائل داخلية للبرد والمطر.':'طقس وانتقالات موسمية؛ قارن الأسعار قبل تثبيت خطتك.')+' التصنيف عام؛ الأعياد والمناسبات قد تغيّر الطلب.';
  const dep=$('departure').value,days=dayDiff(todayISO(),dep),start=addDays(dep,-56),end=addDays(dep,-42),hotel=addDays(dep,-28);$('flightWindow').textContent=displayDate(start)+' — '+displayDate(end);$('hotelWindow').textContent='حوالي '+displayDate(hotel)+'، مع مراجعة مهلة الإلغاء المجاني.';$('bookingAdvice').textContent=days>56?'بقي '+nf.format(days)+' يوماً. ابدأ بالمراقبة والمقارنة؛ لا يلزم انتظار النافذة إذا وجدت عرضاً مناسباً.':days>=42?'أنت داخل النافذة الإرشادية للطيران. قارن السعر الكامل وشروط التذكرة الآن.':'بقي '+nf.format(days)+' يوماً. النافذة الإرشادية للطيران مضت؛ قارن الخيارات المتاحة دون افتراض انخفاض لاحق.';
  $('summaryDates').textContent=displayDate(dep)+' — '+displayDate($('returnDate').value)+' · '+nf.format(ds.nights)+' ليالٍ';
  const query='Flights MED to '+$('airport').value+' '+dep+' return '+$('returnDate').value+' '+n('adults')+' adults '+n('children')+' children '+n('infants')+' infants'+($('nonstopOnly').checked?' nonstop flights only':'');$('flightDatesSearch').href='https://www.google.com/travel/flights?hl=ar&curr=SAR&q='+encodeURIComponent(query);$('flightSearch').href=$('flightDatesSearch').href;
  const hotelURL=new URL('https://www.booking.com/searchresults.html');hotelURL.search=new URLSearchParams({ss:'Istanbul, Turkey',checkin:dep,checkout:$('returnDate').value,group_adults:Math.max(1,n('adults')),group_children:Math.max(0,n('children'))+Math.max(0,n('infants')),no_rooms:Math.max(1,n('rooms'))}).toString();document.querySelectorAll('#childAges input').forEach(el=>hotelURL.searchParams.append('age',el.value));for(let i=0;i<Math.min(10,n('infants'));i++)hotelURL.searchParams.append('age','1');$('hotelSearch').href=hotelURL.href;return ds;
}
// Pure budget calculation. Monetary inputs other than flight/documents/MED transfers use the chosen local currency.
function collectBudget(ds){const v={};document.querySelectorAll('#trip input[type=number],#budget input[type=number]').forEach(el=>v[el.id]=Number(el.value));v.nights=ds.nights;v.costCurrency=$('costCurrency').value;v.exchangeRate=n('exchangeRate');v.tours=places.reduce((sum,p)=>sum+($('pick-'+p.id).checked?n('adults')*n('adult-'+p.id)+n('children')*n('child-'+p.id)+n('infants')*n('infant-'+p.id):0),0);return v;}
function validationError(ds) {
  const fields=[...document.querySelectorAll('#trip input[type=number],#budget input[type=number]')];
  places.filter(p=>$('pick-'+p.id).checked).forEach(p=>fields.push($('adult-'+p.id),$('child-'+p.id),$('infant-'+p.id)));
  document.querySelectorAll('[aria-invalid=true]').forEach(el=>{el.removeAttribute('aria-invalid');el.removeAttribute('aria-describedby');});
  if(!ds.valid) {
    ['departure','returnDate'].forEach(id=>{$(id).setAttribute('aria-invalid','true');$(id).setAttribute('aria-describedby','dateError');});
    return ds.message;
  }
  const bad=fields.find(el=>el.value.trim()===''||!el.checkValidity()||!Number.isFinite(Number(el.value)));
  if(bad) {
    bad.setAttribute('aria-invalid','true');bad.setAttribute('aria-describedby','budgetError');
    return 'راجع خانة «'+(document.querySelector('label[for="'+bad.id+'"]')?.textContent.trim()||'السعر')+'»؛ أدخل رقماً ضمن الحدود المحددة.';
  }
  if(n('infants')>n('adults')) { $('infants').setAttribute('aria-invalid','true');$('infants').setAttribute('aria-describedby','budgetError');return 'لهذا التقدير يجب ألا يتجاوز عدد الرضّع عدد البالغين؛ راجع سياسة الناقل.'; }
  if($('costCurrency').value==='TRY'&&!(n('exchangeRate')>0&&$('exchangeRate').checkValidity())) { $('exchangeRate').setAttribute('aria-invalid','true');$('exchangeRate').setAttribute('aria-describedby','budgetError');return 'أدخل سعر صرف صحيحاً لحساب البنود المدخلة بالليرة.'; }
  return '';
}
function focusInvalidField() {
  const el=document.querySelector('[aria-invalid=true]');
  if(!el)return;
  const details=el.closest('details');if(details)details.open=true;
  el.focus();el.scrollIntoView({block:'center',behavior:'smooth'});
}

function clearSummary(message){['grandTotal','sumFlight','sumHotel','sumExpenses','sumTours','sumDocs','sumFxFees','sumSubtotal','sumReserve','perPerson','perDay','mobileTotal'].forEach(id=>$(id).textContent='—');$('summaryInvalid').textContent=message;$('budgetStatus').textContent='أكمل المدخلات لعرض الميزانية.';$('formulaSummary').textContent='';$('totalTry').textContent='بانتظار مدخلات صحيحة';['barFlight','barHotel','barExpenses','barTours'].forEach(id=>$(id).style.width='0%');}
function updateSummary(ds){if(n('capacity')>0&&n('adults')>=1&&$('autoRooms').checked)$('rooms').value=Math.ceil((n('adults')+Math.max(0,n('children')))/n('capacity'));$('rooms').readOnly=$('autoRooms').checked;const error=validationError(ds);$('budgetError').textContent=error;$('summaryInvalid').textContent='';if(error){clearSummary(error);return;}const v=collectBudget(ds),r=calculateBudget(v);$('grandTotal').textContent=nf.format(r.total);$('mobileTotal').textContent=formatMoney(r.total);const vals={sumFlight:r.flight,sumHotel:r.hotel,sumExpenses:r.expenses,sumTours:r.tours,sumDocs:v.documentsCost,sumFxFees:r.fxFees,sumSubtotal:r.subtotal,sumReserve:r.reserve,perPerson:r.perPerson,perDay:r.daily};Object.entries(vals).forEach(([id,val])=>$(id).textContent=formatMoney(val));$('reserveLabel').textContent='احتياطي '+nf.format(v.reserve)+'%';$('totalTry').textContent=n('exchangeRate')>0?'≈ '+nf.format(r.total*n('exchangeRate'))+' ليرة تركية · مع الاحتياطي':'بالاحتياطي والرسوم · أدخل الصرف لعرض الليرة';const base=r.flight+r.hotel+r.expenses+r.tours;[['barFlight',r.flight],['barHotel',r.hotel],['barExpenses',r.expenses],['barTours',r.tours]].forEach(([id,val])=>$(id).style.width=(base?100*val/base:0)+'%');const target=n('targetBudget');$('budgetStatus').textContent=target>0?(target>=r.total?'ضمن ميزانيتك · يتبقى '+formatMoney(target-r.total):'أعلى من ميزانيتك بـ '+formatMoney(r.total-target)):'أدخل ميزانية مستهدفة لمقارنة التقدير.';$('formulaSummary').textContent=nf.format(r.people)+' مسافرين · '+nf.format(v.rooms)+' غرف × '+nf.format(ds.nights)+' ليالٍ · '+nf.format(v.expenseDays)+' أيام مصروف. متوسط الفرد يشمل الرضّع ولا يمثل تكلفة تذكرة كل فرد.';
}
function updateUnits(){document.querySelectorAll('.local-unit').forEach(el=>el.textContent=$('costCurrency').value==='TRY'?'ل.ت':'ر.س');$('currencyNote').textContent='العملة المختارة للإقامة والمصروفات والمزارات: '+($('costCurrency').value==='TRY'?'الليرة التركية.':'الريال السعودي.')+' تغيير العملة يحوّل القيم الحالية بسعر الصرف المتاح.';}
function updateFxUI(){const rate=n('exchangeRate'),valid=rate>0&&$('exchangeRate').checkValidity();$('fxDisplay').textContent=valid?'1 ر.س = '+decimals.format(rate)+' ل.ت':'أدخل السعر أو حدّثه';if(fxMeta?.source==='api'&&valid){const age=Date.now()-fxMeta.updated*1000;$('fxBadge').textContent=age>48*3600000?'سعر قديم':'تحديث يومي';$('fxTimestamp').textContent='بيانات المصدر: '+new Intl.DateTimeFormat('ar-SA',{dateStyle:'short',timeStyle:'short',timeZone:'Asia/Riyadh',calendar:'gregory'}).format(new Date(fxMeta.updated*1000))+' بتوقيت الرياض.';}else{$('fxBadge').textContent=valid?'إدخال يدوي':'غير متاح';$('fxTimestamp').textContent=valid?'سعر أدخلته يدوياً؛ تحقق من سعر البنك قبل الدفع.':'يمكنك إدخال سعر يدوي؛ الحاسبة بالريال تعمل بدونه.';}convertCurrency('SAR');}
function convertCurrency(from){const rate=n('exchangeRate');if(!(rate>0)){$('convertTRY').value='';return;}const source=from==='SAR'?$('convertSAR'):$('convertTRY'),target=from==='SAR'?$('convertTRY'):$('convertSAR');if(source.value===''||!source.checkValidity()){target.value='';return;}target.value=(Number(source.value)*(from==='SAR'?rate:1/rate)).toFixed(2);}
async function refreshFx(){const btn=$('refreshFx');btn.disabled=true;btn.textContent='جارٍ جلب السعر…';const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),10000);try{const res=await fetch('https://open.er-api.com/v6/latest/SAR',{signal:controller.signal});if(!res.ok)throw new Error('HTTP');const d=await res.json();if(d.result!=='success'||d.base_code!=='SAR'||!(d.rates?.TRY>0)||!Number.isFinite(d.time_last_update_unix))throw new Error('data');$('exchangeRate').value=d.rates.TRY;fxMeta={source:'api',updated:d.time_last_update_unix,fetched:Date.now()};updateFxUI();update();notify('تم جلب أحدث سعر يومي متاح.');}catch{updateFxUI();$('fxTimestamp').textContent+=' تعذر الاتصال الآن؛ احتُفظ بالسعر السابق إن وجد. يمكنك إدخاله يدوياً.';notify('تعذر جلب الصرف؛ أدخل السعر يدوياً أو تابع بالريال.');}finally{clearTimeout(timeout);btn.disabled=false;btn.textContent='↻ تحديث سعر الصرف اليومي';}}
let planRenderKey = '';
function renderPlan(ds) {
  const selected = places.filter(p => $('pick-' + p.id).checked);
  const budgetError = validationError(ds);
  const key = JSON.stringify([ds, $('departure').value, $('planLength').value, $('pace').value, currency,
    n('exchangeRate'), n('adults'), n('children'), n('infants'),
    budgetError, selected.map(p => [p.id,n('adult-'+p.id),n('child-'+p.id),n('infant-'+p.id)])]);
  if (key === planRenderKey) return;
  planRenderKey = key;
  if (!ds.valid) { $('timeline').innerHTML=''; $('planWarning').textContent='اختر تواريخ صحيحة لعرض البرنامج.'; return; }
  const requested = $('planLength').value === 'auto' ? Math.min(ds.days,14) : Number($('planLength').value);
  const days = Math.min(requested,ds.days), fullTrip = days === ds.days;
  const {itinerary,unscheduled} = schedulePlaces(selected,days,$('pace').value,fullTrip);
  const validBudget = !budgetError;
  const rate = currency === 'TRY' ? 1/n('exchangeRate') : 1;
  const placeCost = p => (n('adults')*n('adult-'+p.id)+n('children')*n('child-'+p.id)+n('infants')*n('infant-'+p.id))*rate;
  $('planWarning').textContent = 'برنامج '+nf.format(days)+' أيام · '+($('pace').value==='relaxed'?'وتيرة مريحة':'وتيرة نشطة')+' · '+nf.format(selected.length-unscheduled.length)+' من '+nf.format(selected.length)+' تجارب موزعة.'+
    (!fullTrip?' يعرض البرنامج جزءاً من الرحلة فقط. ':' ')+
    (!selected.length?'اختر مزاراتك أعلاه ليُبنى البرنامج منها.':'المدد تقريبية ولا تشمل الانتظار والتنقل.');
  $('timeline').innerHTML = itinerary.map(day => {
    const date = addDays($('departure').value,day.index);
    const arrival = day.index === 0, returning = fullTrip && day.index === days-1;
    const title = arrival?'الوصول والاستقرار':returning?'العودة بطمأنينة':day.area||'وقت حرّ على مهل';
    const copy = arrival?'الانتقال إلى الفندق ومشي قصير قرب السكن. تجنب الحجوزات غير المستردة في يوم الوصول.':
      returning?'تجهيز الحقائب ومغادرة الفندق بوقت يناسب الرحلة والازدحام وسياسة الناقل.':
      day.places.length?(day.lightDay?'يوم أخف في منطقة واحدة؛ ':'مسار في منطقة واحدة؛ ')+'استراحة أو غداء 45 دقيقة على الأقل؛ تجنب التنقلات الطويلة المتتالية.':'مساحة للراحة أو التسوق. اختر مزارات إضافية لإضافتها إلى البرنامج.';
    return `<article class="day"><span class="day-num">${nf.format(day.index+1)}</span><div><time datetime="${date}">${displayDate(date)}</time><h3>${title}</h3><p>${copy}</p>${day.places.length?`<ul class="day-list">${day.places.map(p=>`<li><strong>${escapeHTML(p.name)}</strong><small>${escapeHTML(p.duration)} · ${validBudget?formatMoney(placeCost(p))+' للمجموعة':'أكمل بيانات الميزانية لحساب التكلفة'}</small><a class="text-link no-print" href="${mapURL(p.map)}" target="_blank" rel="noopener noreferrer">الموقع على الخريطة ↗</a></li>`).join('')}</ul><p class="day-cost">نحو ${nf.format(day.hours)} ساعات زيارة${validBudget?' · تذاكر اليوم: '+formatMoney(day.places.reduce((sum,p)=>sum+placeCost(p),0)):''}</p>`:''}</div></article>`;
  }).join('') + (unscheduled.length?`<div class="unscheduled" role="status"><strong>${nf.format(unscheduled.length)} تجارب لم تتسع لها الأيام المعروضة</strong><p>${unscheduled.map(p=>escapeHTML(p.name)).join('، ')}</p><p>مدّد البرنامج أو الرحلة، أو اختر وتيرة نشطة، أو قلّل المختارات. تبقى تذاكر هذه التجارب ضمن الميزانية حتى تلغي اختيارها.</p></div>`:'');
}

function update(){if(n('capacity')>0&&n('adults')>=1&&$('autoRooms').checked)$('rooms').value=Math.ceil((n('adults')+Math.max(0,n('children')))/n('capacity'));const ds=updateDates();updateSummary(ds);if(!ds.valid){$('summaryDates').textContent='بانتظار تواريخ صحيحة';$('flightDatesSearch').href=$('flightSearch').href='https://www.google.com/travel/flights?hl=ar&curr=SAR';$('hotelSearch').href='https://www.booking.com/';}renderPlan(ds);updateHotels(ds);filterPlaces();updateUnits();save();}
function changeCurrency(){const next=$('costCurrency').value;if(next===currency)return;const rate=n('exchangeRate');if(!(rate>0&&$('exchangeRate').checkValidity())){$('costCurrency').value=currency;notify('أدخل سعر صرف صحيحاً قبل تغيير عملة البنود.');return;}const multiplier=next==='TRY'?rate:1/rate;const ids=[...localPriceIds,...places.flatMap(p=>['adult-'+p.id,'child-'+p.id,'infant-'+p.id])];if(ids.some(id=>$(id).value===''||!$(id).checkValidity())){$('costCurrency').value=currency;notify('صحح مبالغ الإقامة والمصروفات والمزارات قبل تحويل العملة.');return;}ids.forEach(id=>$(id).value=(n(id)*multiplier).toFixed(2));currency=next;update();}
function applyTheme(theme){document.documentElement.dataset.theme=theme;$('themeToggle').setAttribute('aria-label',theme==='dark'?'تفعيل الوضع الفاتح':'تفعيل الوضع الداكن');$('themeToggle').setAttribute('aria-pressed',String(theme==='dark'));}
function printPlan() {
  const ds=dateState(),err=validationError(ds);
  if(err){notify('صحح المدخلات قبل الطباعة: '+err);focusInvalidField();return;}
  const hidden=places.filter(p=>$('pick-'+p.id).checked).map(p=>[$('place-'+p.id),$('place-'+p.id).hidden]);
  const hotelCard=$('hotel-'+$('selectedHotel').value);if(hotelCard)hidden.push([hotelCard,hotelCard.hidden]);
  const disclosures=[...document.querySelectorAll('details')].map(el=>[el,el.open]);
  hidden.forEach(([el])=>el.hidden=false);disclosures.forEach(([el])=>el.open=true);
  $('printedAt').textContent='أُعدّت الخطة: '+new Intl.DateTimeFormat('ar-SA',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Riyadh',calendar:'gregory'}).format(new Date())+' · بتوقيت الرياض';
  const restore=()=>{hidden.forEach(([el,wasHidden])=>el.hidden=wasHidden);disclosures.forEach(([el,open])=>el.open=open);};
  window.addEventListener('afterprint',restore,{once:true});
  try { window.print(); } finally { restore(); }
}

function init(){renderHotels();renderPlaces();const saved=safeLoad();$('departure').min=todayISO();$('departure').value=addDays(todayISO(),60);$('returnDate').value=addDays(todayISO(),67);defaultFields=captureSnapshot().fields;if(saved?.fields){Object.entries(saved.fields).forEach(([id,value])=>{const el=$(id);if(el?.matches('[data-save]')){if(el.type==='checkbox')el.checked=!!value;else el.value=String(value);}});fxMeta=saved.fxMeta?.source==='api'&&Number.isFinite(saved.fxMeta.updated)&&Number.isFinite(saved.fxMeta.fetched)?saved.fxMeta:null;}renderAges(saved?.fields);currency=$('costCurrency').value;applyTheme((saved?.theme==='dark'?'dark':saved?.theme==='light'?'light':null)||((window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light'));updateFxUI();update();initLibrary();initHotels();
  document.addEventListener('input',e=>{if(e.target.matches('input[data-save]:not([type=checkbox])')){if(e.target.id==='children')renderAges();if(e.target.id==='exchangeRate'){fxMeta={source:'manual'};updateFxUI();}update();}});
  document.addEventListener('change',e=>{const id=e.target.id;if(id==='costCurrency'){changeCurrency();return;}if(id==='hotelClass'){const value={economy:200,family:350,luxury:700}[e.target.value];$('nightRate').value=(value*(currency==='TRY'?n('exchangeRate'):1)).toFixed(2);}if(e.target.matches('select[data-save],input[type=checkbox][data-save]'))update();});
  document.querySelectorAll('[data-filter]').forEach(btn=>btn.addEventListener('click',()=>{activeFilter=btn.dataset.filter;document.querySelectorAll('[data-filter]').forEach(b=>{b.classList.toggle('active',b===btn);b.setAttribute('aria-pressed',String(b===btn));});filterPlaces();}));
  $('themeToggle').addEventListener('click',()=>{applyTheme(document.documentElement.dataset.theme==='dark'?'light':'dark');save();});$('refreshFx').addEventListener('click',refreshFx);$('convertSAR').addEventListener('input',()=>convertCurrency('SAR'));$('convertTRY').addEventListener('input',()=>convertCurrency('TRY'));$('printBudget').addEventListener('click',printPlan);$('printTop').addEventListener('click',printPlan);
  $('reset').addEventListener('click',()=>{if(!confirm('إعادة جميع القيم والأنشطة والقائمة إلى البداية؟'))return;clearTimeout(saveTimer);try{localStorage.removeItem(STORAGE_KEY);}catch{}location.reload();});
  const links=[...document.querySelectorAll('.nav a')];if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>{entries.forEach(entry=>{if(entry.isIntersecting){links.forEach(a=>a.classList.toggle('active',a.hash==='#'+entry.target.id));}});},{rootMargin:'-100px 0px -55% 0px',threshold:0});['trip','hotels','budget','places','itinerary','guide','plans'].forEach(id=>observer.observe($(id)));}
  if(!fxMeta||fxMeta.source==='api'&&Date.now()-(fxMeta.fetched||0)>24*3600000)refreshFx();
}
init();
