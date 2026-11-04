'use strict';

// Property facts checked against the linked official websites on 2026-11-04.
// Selection notes are editorial suggestions, not live prices or availability.
const stayAreas = [
  {id:'sirkeci',name:'سيركجي / غولهانة',query:'Sirkeci Istanbul',tag:'اقتراحنا للزيارة الأولى',fit:'للمعالم والتنقل بين أجزاء المدينة',note:'قارن الفنادق القريبة من محطتي سيركجي وغولهانة على T1. نقطة بداية مناسبة للجمع بين المدينة التاريخية وأمينونو.',tradeoff:'افحص موقع مدخل الفندق وصور الشارع؛ قرب المعالم لا يضمن هدوء الغرفة أو سهولة الوصول بالحقائب.'},
  {id:'sultanahmet',name:'السلطان أحمد',query:'Sultanahmet Istanbul',tag:'المعالم أولاً',fit:'لمن يريد قضاء معظم وقته في المدينة القديمة',note:'خيار للمشي إلى المعالم التاريخية؛ اختر موقع الفندق بحسب برنامجك والمسافة الفعلية إلى الترام.',tradeoff:'بعض الشوارع منحدرة؛ راجع المسار مشياً خصوصاً مع الأطفال أو عربات الأطفال.'},
  {id:'karakoy',name:'كاراكوي',query:'Karakoy Istanbul',tag:'المقاهي والبوسفور',fit:'للتنقل بين المدينة القديمة وبيوغلو',note:'يمر T1 بكاراكوي، ويمكن مقارنة السكن بالقرب من الواجهة البحرية أو محطة الترام.',tradeoff:'الدرب صعوداً باتجاه غلطة قد يكون متعباً؛ راجع ضوضاء الشارع وتقييمات الغرف الحديثة.'},
  {id:'taksim',name:'تقسيم / بيوغلو',query:'Taksim Istanbul',tag:'الحركة والمساء',fit:'لمن يجعل الاستقلال وبيوغلو ضمن أولوياته',note:'تقسيم متصلة بمترو M2 وبكاباتاش عبر F1؛ قارن قرب الفندق من المحطة وليس اسمه فقط.',tradeoff:'الذهاب إلى المعالم التاريخية يتطلب تنقلاً، وقد تكون الشوارع الحيوية مزعجة للنوم.'},
  {id:'kadikoy',name:'كاديكوي / مودا',query:'Kadikoy Moda Istanbul',tag:'الجانب الآسيوي',fit:'لمن يرغب في قضاء وقت أطول في كاديكوي ومودا',note:'قارن قرب الفندق من المرفأ أو المترو؛ مناسب إذا كان الجانب الآسيوي جزءاً رئيسياً من رحلتك.',tradeoff:'احتسب وقت عبور البحر أو القطارات إذا كان أغلب برنامجك في السلطان أحمد. لا نفترض أنه الأرخص.'},
  {id:'other',name:'توبكابي / زيتون بورنو',query:'Topkapi Zeytinburnu Istanbul',tag:'قارن إجمالي التكلفة',fit:'لمن يجد عرض غرفة يعوّض زيادة التنقل',note:'قارن كل موقع على حدة: هوليداي إن سيتي قرب T1، بينما إيبيس زيتون بورنو على الساحل.',tradeoff:'هذه مواقع مختلفة وليست منطقة واحدة. أضف وقت المواصلات وتكلفتها قبل اعتبار العرض أوفر.'}
];

const hotelOptions = [
  {id:'hampton-sirkeci',name:'هامبتون باي هيلتون سيركجي',english:'Hampton by Hilton Istanbul Sirkeci',area:'sirkeci',tag:'ابدأ المقارنة هنا',why:'خيار سلسلة فندقية في سيركجي لمقارنته مع الفنادق المستقلة في المنطقة.',check:'قارن نوع الغرفة وسعة الأطفال وما يشمله عرض الإفطار.',url:'https://www.hilton.com/en/hotels/istishx-hampton-istanbul-sirkeci/'},
  {id:'sirkeci-mansion',name:'سيركجي مانشن',english:'Sirkeci Mansion',area:'sirkeci',tag:'فندق بوتيك',why:'لمن يفضّل فندقاً أصغر قريباً من غولهانة والمعالم التاريخية.',check:'قارن الغرفة العائلية مع حجز غرفتين وسياسة الإلغاء.',url:'https://www.sirkecimansion.com/'},
  {id:'amira',name:'فندق أميرة إسطنبول',english:'Hotel Amira Istanbul',area:'sultanahmet',tag:'قرب المعالم',why:'فندق بوتيك في السلطان أحمد، مع أنواع غرف ثنائية وثلاثية بحسب الموقع الرسمي.',check:'الموقع الرسمي يذكر أنه غير ملائم لذوي الإعاقة؛ راجع احتياجات الحركة ومسار الوصول.',url:'https://www.hotelamira.com/'},
  {id:'novotel-bosphorus',name:'نوفوتيل إسطنبول بوسفور',english:'Novotel Istanbul Bosphorus',area:'karakoy',tag:'كاراكوي',why:'خيار في كاراكوي لمقارنة موقع الواجهة البحرية مع فنادق المدينة القديمة.',check:'لا تفترض أن كل الغرف بإطلالة؛ راجع فئة الغرفة والإفطار.',url:'https://all.accor.com/hotel/8654/index.en.shtml'},
  {id:'point-taksim',name:'بوينت تقسيم',english:'Point Hotel Taksim',area:'taksim',tag:'تقسيم وبيوغلو',why:'خيار قرب ميدان تقسيم لمن يركز على الاستقلال وبيوغلو.',check:'قارن الغرفة والمسافة الفعلية إلى وسائل النقل وما يشمله العرض.',url:'https://pointhotel.com/taksim/pages/hakkimizda.php?lang=en'},
  {id:'doubletree-moda',name:'دبل تري هيلتون مودا',english:'DoubleTree by Hilton Istanbul - Moda',area:'kadikoy',tag:'الجانب الآسيوي',why:'في كاديكوي وعلى مسافة مشي من مودا ومحطات العبارات، بحسب الفندق.',check:'أضف وقت التنقل إلى المعالم الأوروبية إلى مقارنتك.',url:'https://www.hilton.com/en/hotels/istimdi-doubletree-istanbul-moda/'},
  {id:'holidayinn-city',name:'هوليداي إن إسطنبول سيتي',english:'Holiday Inn Istanbul City',area:'other',tag:'قارن عروض السلاسل',why:'قرب محطة بازارتكه على T1؛ خيار للمقارنة إذا كان العرض مناسباً لميزانيتك.',check:'منطقة توبكابي هنا ليست قصر توبكابي السياحي؛ تحقق من العنوان.',url:'https://www.ihg.com/holidayinn/hotels/gb/en/istanbul/istmc/hoteldetail'},
  {id:'ibis-zeytinburnu',name:'إيبيس إسطنبول زيتون بورنو',english:'ibis Istanbul Zeytinburnu',area:'other',tag:'فندق اقتصادي للمقارنة',why:'فندق اقتصادي من أكور على الساحل في زيتون بورنو؛ قارن عرض الغرفة مع تكلفة التنقل.',check:'لا تختَره على أساس سعر الغرفة وحده إذا كان برنامجك اليومي في المدينة التاريخية.',url:'https://all.accor.com/hotel/5998/index.en.shtml'}
];

function hotelBookingURL(query, ds) {
  const url = new URL('https://www.booking.com/searchresults.html');
  url.searchParams.set('ss',query);
  url.searchParams.set('selected_currency','SAR');
  url.searchParams.set('lang','ar');
  if (ds.valid) {
    url.searchParams.set('checkin',$('departure').value);
    url.searchParams.set('checkout',$('returnDate').value);
  }
  const validParty = ['adults','children','infants','rooms'].every(id => $(id).value !== '' && $(id).checkValidity());
  if (validParty) {
    url.searchParams.set('group_adults',n('adults'));
    url.searchParams.set('group_children',n('children')+n('infants'));
    url.searchParams.set('no_rooms',n('rooms'));
    document.querySelectorAll('#childAges input').forEach(el=>url.searchParams.append('age',el.value));
    for(let i=0;i<n('infants');i++)url.searchParams.append('age','1');
  }
  return url.href;
}

function hotelQuoteContext() {
  return JSON.stringify(['departure','returnDate','adults','children','infants','rooms'].map(id=>$(id).value).concat([...document.querySelectorAll('#childAges input')].map(el=>el.value)));
}

function hotelQuoteCurrent(id) {
  return $('hotelquote-context-'+id).value===hotelQuoteContext();
}

function renderHotels() {
  $('stayAreas').innerHTML = stayAreas.map(area=>`<article class="area-card ${area.id==='sirkeci'?'area-recommended':''}"><span class="badge">${area.tag}</span><h3>${area.name}</h3><strong>${area.fit}</strong><p>${area.note}</p><p class="area-tradeoff">${area.tradeoff}</p><button class="text-link" type="button" data-stay-area="${area.id}">شاهد فنادق المنطقة ↓</button></article>`).join('');
  $('hotelGrid').innerHTML = hotelOptions.map(hotel=>`<article class="hotel-card" id="hotel-${hotel.id}"><div class="hotel-card-top"><span class="badge">${hotel.tag}</span><span class="muted">${stayAreas.find(area=>area.id===hotel.area).name}</span></div><h3>${hotel.name}</h3><p class="hotel-english" lang="en" dir="ltr">${hotel.english}</p><p>${hotel.why}</p><small>${hotel.check}</small><div class="booking-links no-print"><a class="button primary" data-hotel-booking="${hotel.id}" target="_blank" rel="noopener noreferrer">Booking ↗</a><a class="button" data-hotel-google="${hotel.id}" target="_blank" rel="noopener noreferrer">مقارنة المواقع ↗</a><a class="text-link" href="${hotel.url}" target="_blank" rel="noopener noreferrer">الموقع الرسمي ↗</a></div><div class="hotel-quote no-print"><label for="hotelquote-${hotel.id}">السعر الذي وجدته للغرفة / الليلة شامل الضرائب (ر.س)</label><input id="hotelquote-${hotel.id}" type="number" min="0.01" max="1000000" step="0.01" placeholder="أدخل عرضك للمقارنة" data-save><input id="hotelquote-context-${hotel.id}" type="hidden" value="" data-save><p class="field-hint" id="hotelquote-total-${hotel.id}"></p><button class="button full" type="button" data-choose-hotel="${hotel.id}">استخدم هذا العرض في ميزانيتي</button></div></article>`).join('');
}

function updateHotels(ds) {
  const area = $('hotelArea').value;
  const quoted = [];
  let visible = 0;
  hotelOptions.forEach((hotel,index)=>{
    const card=$('hotel-'+hotel.id),input=$('hotelquote-'+hotel.id);
    const show=area==='all'||hotel.area===area;
    card.hidden=!show;
    if(show)visible++;
    document.querySelector('[data-hotel-booking="'+hotel.id+'"]').href=hotelBookingURL(hotel.english+' Istanbul',ds);
    const google=new URL('https://www.google.com/travel/hotels');
    google.searchParams.set('hl','ar');google.searchParams.set('curr','SAR');
    google.searchParams.set('q',hotel.english+' Istanbul'+(ds.valid?' '+$('departure').value+' '+$('returnDate').value:'')+' '+n('adults')+' adults '+n('children')+' children');
    document.querySelector('[data-hotel-google="'+hotel.id+'"]').href=google.href;
    const hasQuote=input.value!==''&&input.checkValidity()&&hotelQuoteCurrent(hotel.id);
    card.style.order=String(index);
    const canTotal=hasQuote&&ds.valid&&$('rooms').value!==''&&$('rooms').checkValidity();
    $('hotelquote-total-'+hotel.id).textContent=canTotal?'إقامة المجموعة: '+formatMoney(Number(input.value)*ds.nights*n('rooms'))+' · '+nf.format(ds.nights)+' ليالٍ × '+nf.format(n('rooms'))+' غرف':input.value!==''&&!hotelQuoteCurrent(hotel.id)?'هذا سعر لبيانات رحلة سابقة؛ راجع العرض وأعد إدخال السعر لتواريخك ومسافريك الحاليين.':hasQuote?'صحح تواريخ الرحلة وعدد الغرف لعرض الإجمالي.':'سعر تدخله أنت بعد مراجعة موقع الحجز.';
    card.classList.toggle('hotel-chosen',$('selectedHotel').value===hotel.id);
    if(show&&canTotal)quoted.push({hotel,total:Number(input.value)*ds.nights*n('rooms')});
  });
  if($('hotelSort').value==='price') {
    const price=hotel=>{const input=$('hotelquote-'+hotel.id);return input.value!==''&&input.checkValidity()&&hotelQuoteCurrent(hotel.id)?Number(input.value):Infinity;};
    [...hotelOptions].sort((a,b)=>price(a)-price(b)).forEach((hotel,index)=>$('hotel-'+hotel.id).style.order=String(index));
  }
  $('hotelCount').textContent=nf.format(visible)+' فنادق للمقارنة · معلومات من مواقع الفنادق الرسمية، راجعت في 4 نوفمبر 2026.';
  const lowest=quoted.sort((a,b)=>a.total-b.total)[0];
  $('hotelBestQuote').textContent=lowest?'أقل سعر من عروضك المدخلة ضمن المنطقة المعروضة: '+lowest.hotel.name+' · '+formatMoney(lowest.total)+' للإقامة. قارن نفس شروط الإفطار والإلغاء وسعة الغرفة قبل الاختيار.':'للعثور على الأنسب سعراً: افتح المقارنة والموقع الرسمي، ثم أدخل عروضاً بنفس نوع الغرفة والإفطار والإلغاء. سيظهر أقل عرض أدخلته هنا.';
  const region=stayAreas.find(item=>item.id===area);
  $('hotelRegionSearch').href=hotelBookingURL(region?region.query:'Istanbul Turkey',ds);
  $('hotelSearchContext').textContent=ds.valid?displayDate($('departure').value)+' — '+displayDate($('returnDate').value)+' · '+nf.format(n('adults')+n('children')+n('infants'))+' مسافرين · '+nf.format(n('rooms'))+' غرف. راجع البيانات في موقع الحجز.':'صحح التواريخ قبل المقارنة؛ لن نرسل تواريخ غير صحيحة إلى موقع الحجز.';
  const selected=hotelOptions.find(hotel=>hotel.id===$('selectedHotel').value);
  $('chosenHotelBudget').textContent=selected?'الفندق في خطتك: '+selected.name+' · تكلفة الإقامة محسوبة من خانة سعر الليلة الحالية.':'';
}

function initHotels() {
  document.addEventListener('input',event=>{
    if(event.target.type!=='number'||!event.target.id.startsWith('hotelquote-'))return;
    const id=event.target.id.slice('hotelquote-'.length);
    if(!$('hotelquote-context-'+id))return;
    $('hotelquote-context-'+id).value=hotelQuoteContext();update();
  });
  $('stayAreas').addEventListener('click',event=>{
    const button=event.target.closest('[data-stay-area]');if(!button)return;
    $('hotelArea').value=button.dataset.stayArea;update();
    $('hotelResults').scrollIntoView({behavior:'smooth',block:'start'});
  });
  $('hotelGrid').addEventListener('click',event=>{
    const button=event.target.closest('[data-choose-hotel]');if(!button)return;
    const id=button.dataset.chooseHotel,input=$('hotelquote-'+id);
    if(!input.value||!input.checkValidity()){notify('أدخل سعر الليلة بالريال من عرض الحجز أولاً.');input.focus();return;}
    if(!hotelQuoteCurrent(id)){notify('بيانات الرحلة تغيرت؛ راجع عرض الفندق ثم أعد إدخال سعره.');input.focus();return;}
    if(!dateState().valid){notify('صحح تواريخ الرحلة أولاً.');$('departure').focus();return;}
    const rate=currency==='TRY'?n('exchangeRate'):1;
    if(!(rate>0&&Number.isFinite(rate))||(currency==='TRY'&&!$('exchangeRate').checkValidity())){notify('أدخل سعر صرف صحيحاً قبل نقل العرض إلى ميزانيتك بالليرة.');return;}
    const converted=Number(input.value)*rate;
    if(converted>Number($('nightRate').max)){notify('قيمة العرض بعد التحويل تتجاوز الحد المسموح لسعر الليلة.');return;}
    $('nightRate').value=converted.toFixed(2);$('selectedHotel').value=id;
    update();notify('أُضيف سعر الفندق إلى الميزانية؛ يمكنك تعديله في خانة سعر الليلة.');
  });
}
