const ExcelJS=require('exceljs');
const sharp=require('sharp');
const COLORS=['#17613F','#C6A64A','#277DA1','#9A5D9E','#E67E36','#D44B55','#55A88A'];
function cleanSvgText(svg){return svg.replace(new RegExp('<text[^>]*>[\\s\\S]*?<\\/text>','g'),'');}
function chartLegend(ws,entries,total,cell){const top=entries;const col=cell.col+12;ws.getCell(cell.row+2,col+1).value='CATEGORÍA / CANDIDATURA';ws.getCell(cell.row+2,col+2).value='N.º';ws.getCell(cell.row+2,col+3).value='%';top.forEach(([name,n],i)=>{const r=cell.row+3+i;ws.getCell(r,col+1).value=String(name);ws.getCell(r,col+2).value=n;ws.getCell(r,col+3).value=total?n/total:0;ws.getCell(r,col+3).numFmt='0.0%';});ws.getColumn(col+1).width=38;ws.getColumn(col+2).width=14;ws.getColumn(col+3).width=14;}
function xml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;')}
async function chart(wb,ws,entries,total,titleText,cell){const top=entries.length>8?[...entries.slice(0,7),['Otros',entries.slice(7).reduce((sum,x)=>sum+x[1],0)]]:entries;if(!top.length)return;const width=900,height=110+top.length*52;let svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+width+'" height="'+height+'" viewBox="0 0 '+width+' '+height+'"><rect width="100%" height="100%" rx="16" fill="#F7FAF8"/><text x="28" y="43" font-size="25" font-weight="bold" fill="#153C2A" font-family="Arial">'+xml(titleText)+'</text><text x="28" y="68" font-size="15" fill="#64746A" font-family="Arial">Base: '+total+' registros · Porcentajes descriptivos</text>';top.forEach(([label,n],i)=>{const y=100+i*52,pct=total?n/total:0,color=COLORS[i%COLORS.length];svg+='<text x="28" y="'+(y+12)+'" font-size="16" fill="#243C30" font-family="Arial">'+xml(String(label).slice(0,44))+'</text><rect x="365" y="'+(y-4)+'" width="405" height="22" rx="5" fill="#E3EAE5"/><rect x="365" y="'+(y-4)+'" width="'+Math.max(1,405*pct)+'" height="22" rx="5" fill="'+color+'"/><text x="790" y="'+(y+13)+'" font-size="17" font-weight="bold" fill="'+color+'" font-family="Arial">'+(pct*100).toFixed(1)+'%</text>'});svg+='</svg>';const png=await sharp(Buffer.from(cleanSvgText(svg))).png().toBuffer();const id=wb.addImage({buffer:png,extension:'png'});ws.addImage(id,{tl:{col:cell.col,row:cell.row},ext:{width:width*0.72,height:height*0.72}});chartLegend(ws,entries,total,cell)}


async function graphic(wb,ws,entries,total,heading,at,kind){
 const positive=entries.filter(([k,n])=>n>0);const data=positive.length>8?[...positive.slice(0,7),['Otros',positive.slice(7).reduce((sum,x)=>sum+x[1],0)]]:positive;if(!data.length||!total){chartLegend(ws,entries,total,at);return;}
 const W=860,H=460,cx=240,cy=242,R=150;let parts=['<svg xmlns="http://www.w3.org/2000/svg" width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'"><rect width="100%" height="100%" rx="18" fill="#F8FAF8"/><text x="28" y="40" font-family="Arial" font-size="25" font-weight="bold" fill="#183B2B">'+xml(heading)+'</text><text x="28" y="65" font-family="Arial" font-size="15" fill="#64746A">Total: '+total+' · Datos recibidos</text>'];
 if(kind==='pie'){let angle=-Math.PI/2;for(let i=0;i<data.length;i++){const [label,n]=data[i],fraction=n/total,step=fraction*Math.PI*2,next=angle+step;const x1=cx+R*Math.cos(angle),y1=cy+R*Math.sin(angle),x2=cx+R*Math.cos(next),y2=cy+R*Math.sin(next);if(fraction>=0.999999)parts.push('<circle cx="'+cx+'" cy="'+cy+'" r="'+R+'" fill="'+COLORS[i%COLORS.length]+'"/>');else parts.push('<path d="M '+cx+' '+cy+' L '+x1+' '+y1+' A '+R+' '+R+' 0 '+(step>Math.PI?1:0)+' 1 '+x2+' '+y2+' Z" fill="'+COLORS[i%COLORS.length]+'" stroke="#fff" stroke-width="3"/>');angle=next;}data.forEach(([label,n],i)=>{const y=120+i*37;parts.push('<rect x="440" y="'+(y-13)+'" width="17" height="17" rx="3" fill="'+COLORS[i%COLORS.length]+'"/><text x="467" y="'+y+'" font-family="Arial" font-size="16" fill="#243C30">'+xml(String(label).slice(0,27))+' · '+(100*n/total).toFixed(1)+'%</text>')});}
 else{const max=Math.max(...data.map(x=>x[1])),left=80,base=380,chartH=265,step=720/data.length,bw=Math.min(62,step*0.65);parts.push('<line x1="65" y1="'+base+'" x2="820" y2="'+base+'" stroke="#B9C8BF" stroke-width="2"/>');data.forEach(([label,n],i)=>{const h=n/max*chartH,x=left+i*step,y=base-h;parts.push('<rect x="'+x+'" y="'+y+'" width="'+bw+'" height="'+h+'" rx="5" fill="'+COLORS[i%COLORS.length]+'"/><text x="'+(x+bw/2)+'" y="'+(y-10)+'" text-anchor="middle" font-family="Arial" font-size="16" font-weight="bold" fill="#183B2B">'+(100*n/total).toFixed(1)+'%</text><text x="'+(x+bw/2)+'" y="403" text-anchor="middle" font-family="Arial" font-size="13" fill="#243C30">'+xml(String(label).slice(0,12))+'</text>')});}
 parts.push('</svg>');const png=await sharp(Buffer.from(cleanSvgText(parts.join('')))).png().toBuffer();ws.addImage(wb.addImage({buffer:png,extension:'png'}),{tl:{col:at.col,row:at.row},ext:{width:688,height:368}});chartLegend(ws,entries,total,at);
}


function clean(v){return String(v??'').trim();}
function norm(v){return clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').toUpperCase();}
function percentage(n,d){return d?n/d:0;}
function extraSheet(wb,name,headers,widths){const ws=wb.addWorksheet(name);title(ws,name,headers.length);head(ws,headers);ws.columns=widths.map(w=>({width:w}));return ws;}
function finishSheet(ws){ws.eachRow((row,i)=>{if(i<4)return;row.eachCell(c=>{c.border={bottom:{style:'hair',color:{argb:'DDE7DF'}}};if(i%2===0)c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'F5F8F5'}};c.alignment={vertical:'middle',wrapText:true};});});ws.views=[{state:'frozen',ySplit:3}];}
function augment(wb,rows){
 const total=rows.length;
 const quality=extraSheet(wb,'Auditoría de calidad',['Control','Registros','% del total','Criterio'],[37,17,19,92]);
 const idCounts=new Map();for(const r of rows){const id=clean(r.id);if(id)idCounts.set(id,(idCounts.get(id)||0)+1);}
 const dup=rows.filter(r=>clean(r.id)&&idCounts.get(clean(r.id))>1).length;
 const checks=[
 ['ID repetido',dup,'Registros que comparten identificador; no se eliminan automáticamente'],
 ['Sin identificador',rows.filter(r=>!clean(r.id)).length,'Falta el identificador único de la encuesta'],
 ['Sin encuestador',rows.filter(r=>!clean(r.encuestador)).length,'No consta el responsable de campo'],
 ['Sin parroquia',rows.filter(r=>!clean(r.parroquia)).length,'No consta la parroquia de sufragio'],
 ['Sin circunscripción',rows.filter(r=>!clean(r.circunscripcion)).length,'No consta la circunscripción'],
 ['Sin fecha',rows.filter(r=>!clean(r.fecha)).length,'No consta la fecha de registro'],
 ['Sin respuestas electorales',rows.filter(r=>dimensions.every(k=>!clean(r[k]))).length,'Ninguna de las siete secciones tiene respuesta'],
 ['Territorio incompatible',rows.filter(r=>{const p=norm(r.parroquia),c=norm(r.circunscripcion);return p&&c&&((p==='GUAYZIMI'&&c!=='URBANA')||(p!=='GUAYZIMI'&&c!=='RURAL'));}).length,'Guayzimi es urbana; las demás parroquias registradas son rurales'],
 ['Voto urbano con sección rural',rows.filter(r=>norm(r.circunscripcion)==='URBANA'&&(clean(r.concejales_rurales)||dimensions.slice(4).some(k=>clean(r[k])))).length,'Revisar respuestas a dignidades rurales en circunscripción urbana'],
 ['Voto rural con sección urbana',rows.filter(r=>norm(r.circunscripcion)==='RURAL'&&clean(r.concejales_urbanos)).length,'Revisar respuestas a concejales urbanos en circunscripción rural']
 ];
 checks.forEach(([name,n,detail])=>quality.addRow([name,n,percentage(n,total),detail]));for(let i=4;i<4+checks.length;i++)quality.getCell(i,3).numFmt='0.0%';finishSheet(quality);
 const sample=extraSheet(wb,'Control de muestra',['Parroquia','Ejecutadas','Meta planificada','Pendientes','Cumplimiento','Observación'],[30,18,20,18,20,63]);
 const parishes=[...new Set(rows.map(r=>clean(r.parroquia)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
 parishes.forEach(p=>{const n=rows.filter(r=>clean(r.parroquia)===p).length;const rr=sample.rowCount+1;sample.addRow([p,n,null,{formula:'IF(C'+rr+'="","",MAX(0,C'+rr+'-B'+rr+'))'},{formula:'IFERROR(IF(C'+rr+'="","",B'+rr+'/C'+rr+'),"")'},'Ingresar meta aprobada en columna C']);sample.getCell(rr,5).numFmt='0.0%';sample.getCell(rr,3).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF2C6'}};});
 finishSheet(sample);
 const cross=extraSheet(wb,'Cruces territoriales',['Dignidad','Parroquia','Circunscripción','Candidatura / respuesta','Menciones','Base válida','% válido','% de encuestas del sector'],[28,26,21,43,15,17,17,24]);
 const territorial=extraSheet(wb,'Comparativo U-R',['Dignidad','Circunscripción','Candidatura / respuesta','Menciones','Base válida','% válido'],[30,23,48,16,18,18]);
 for(const key of dimensions){
  const groups=new Map();
  for(const r of rows){const p=clean(r.parroquia)||'Sin registrar',c=clean(r.circunscripcion)||'Sin registrar',g=p+'\\u0001'+c;if(!groups.has(g))groups.set(g,[]);groups.get(g).push(r);}
  for(const [g,subset] of groups){const [p,c]=g.split('\\u0001'),valid=subset.filter(r=>clean(r[key])),counts=tally(valid,key);for(const [candidate,n] of counts){const rr=cross.rowCount+1;cross.addRow([labels[key],p,c,candidate,n,valid.length,percentage(n,valid.length),percentage(n,subset.length)]);cross.getCell(rr,7).numFmt='0.0%';cross.getCell(rr,8).numFmt='0.0%';}}
  for(const c of ['urbana','rural','Sin registrar']){const subset=rows.filter(r=>(clean(r.circunscripcion)||'Sin registrar').toLowerCase()===c.toLowerCase());const valid=subset.filter(r=>clean(r[key]));for(const [candidate,n] of tally(valid,key)){const rr=territorial.rowCount+1;territorial.addRow([labels[key],c,candidate,n,valid.length,percentage(n,valid.length)]);territorial.getCell(rr,6).numFmt='0.0%';}}
 }
 finishSheet(cross);finishSheet(territorial);
 const base=extraSheet(wb,'Bases y no respuesta',['Dignidad','Encuestas totales','Con respuesta','Sin respuesta','% respuesta','Ninguno','Indecisos / no opina','Nota'],[30,20,20,20,19,16,22,85]);
 for(const key of dimensions){const valid=rows.filter(r=>clean(r[key])),none=valid.filter(r=>norm(r[key])==='NINGUNO').length,undecided=valid.filter(r=>/INDECIS|NO OPINA|NO SABE|NS-NR|NO RESPONDE/.test(norm(r[key]))).length;const rr=base.rowCount+1;base.addRow([labels[key],total,valid.length,total-valid.length,percentage(valid.length,total),none,undecided,'Base válida = respuestas no vacías. Ninguno e indecisos permanecen visibles en el denominador descriptivo.']);base.getCell(rr,5).numFmt='0.0%';}
 finishSheet(base);
 const notes=wb.getWorksheet('Metodología');
 notes.addRow(['Auditoría','Los controles identifican registros para revisión; no alteran ni eliminan respuestas originales.']);
 notes.addRow(['Cruces','Porcentajes por dignidad dentro de cada parroquia y circunscripción, con base válida visible.']);
 notes.addRow(['Muestra','Las metas planificadas deben ingresarse manualmente; no se inventan cuotas.']);
 notes.addRow(['No respuesta','Ninguno e indecisos son respuestas observadas y se muestran por separado.']);
 notes.addRow(['Alcance','Resultados descriptivos de encuestas registradas; no equivalen a pronóstico electoral.']);
}

const GREEN='165A3D',DARK='142B23',GOLD='C6A64A',WHITE='FFFFFF',PALE='EAF4ED';
const dimensions=['prefecto','alcalde','concejales_urbanos','concejales_rurales','vocales_nuevo_paraiso','vocales_zurmi','vocales_namkays'];
const labels={prefecto:'Prefectura',alcalde:'Alcaldía',concejales_urbanos:'Concejales urbanos',concejales_rurales:'Concejales rurales',vocales_nuevo_paraiso:'Vocales Nuevo Paraíso',vocales_zurmi:'Vocales Zurmi',vocales_namkays:'Vocales Namkays'};
function title(ws,name,cols){ws.mergeCells(1,1,1,cols);const c=ws.getCell(1,1);c.value='CEO SUR CONSULTORES | '+name;c.font={name:'Aptos Display',size:17,bold:true,color:{argb:WHITE}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:DARK}};c.alignment={vertical:'middle'};ws.getRow(1).height=36;ws.views=[{state:'frozen',ySplit:3}];}
function head(ws,arr,row=3){const r=ws.getRow(row);r.values=arr;r.height=28;r.eachCell(c=>{c.font={bold:true,color:{argb:WHITE}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:GREEN}};c.alignment={vertical:'middle',wrapText:true}});ws.autoFilter={from:{row,column:1},to:{row,column:arr.length}};}
function style(ws,cols){ws.columns=cols.map(([header,width])=>({header:undefined,width}));ws.eachRow((r,i)=>{if(i>3){r.eachCell(c=>{c.border={bottom:{style:'hair',color:{argb:'DDE7DF'}}};if(i%2===0)c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'F5F8F5'}}})}});}
function tally(rows,key){const m=new Map();for(const r of rows){const v=String(r[key]??'').trim()||'Sin registrar';m.set(v,(m.get(v)||0)+1)}return [...m].sort((a,b)=>b[1]-a[1]);}

// Catálogo de candidaturas confirmadas: incluye opciones con cero menciones.
// Los registros recibidos también se incorporan para no omitir nombres nuevos.
const candidateCatalog={
 prefecto:['KARLA REÁTEGUI','MODESTO VEGA','CLEVER JIMÉNEZ','TATIANA CÓRDOVA'],
 alcalde:['DARWIN TAPIA','NEY ARROBO','EDUARDO VILLALTA','THALIA SALTOS'],
 concejales_urbanos:['LUZ JUELAS','EULER BELESACA','GLORIA QUEZADA'],
 concejales_rurales:['LILIANA AGUILAR','LUIS JIMENES','NELSON IKIAM'],
 vocales_zurmi:['JULENI JIMÉNEZ','JORGE SALINAS','DIREYDI JARAMILLO','NELSON JIMÉNEZ'],
 vocales_namkays:['MÁXIMO NANKAMAI','NANCY CHINGUÑI','EDWIN NANTIPA','DELIA JUDITH CHIRIAP'],
 vocales_nuevo_paraiso:['JOSÉ MANUEL CALVA CALVA','MARLENE MARILÚ GONZÁLEZ RAMÓN','LUIS POLIVIO GUAILLAS GUALAN']
};
function fullTally(rows,key){
 const counts=new Map();
 const catalog=candidateCatalog[key]||[];
 const canon=name=>norm(name).replace(/[^A-Z0-9Ñ ]/g,'').replace(/\\s+/g,' ').trim();
 for(const name of catalog)counts.set(canon(name),[name.toUpperCase(),0]);
 for(const [name,n] of tally(rows,key)){
  const id=canon(name);
  let target=id;
  if(!counts.has(target)&&id.split(' ').length>=2){
   const matches=[...counts.keys()].filter(k=>{
    const a=id.split(' '),b=k.split(' ');
    return a.length>=2&&b.length>=2&&(a.every(t=>b.includes(t))||b.every(t=>a.includes(t)));
   });
   if(matches.length===1)target=matches[0];
  }
  if(counts.has(target))counts.get(target)[1]+=n;
  else counts.set(target,[String(name).trim().toUpperCase(),n]);
 }
 return [...counts.values()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'es'));
}
function summary(wb,name,rows,key){const ws=wb.addWorksheet(name);title(ws,name,5);head(ws,['Categoría','Encuestas','% del total','Semáforo','Barra porcentual']);const total=rows.length;const list=tally(rows,key);list.forEach(([v,n],i)=>{const r=i+4;ws.addRow([v,n,null,null,null]);ws.getCell(r,3).value={formula:'IFERROR(B'+r+'/'+total+',0)',result:total?n/total:0};ws.getCell(r,3).numFmt='0.0%';ws.getCell(r,4).value={formula:'IF(C'+r+'>=0.5,"VERDE",IF(C'+r+'>=0.2,"AMARILLO","ROJO"))'};ws.getCell(r,5).value=total?n/total:0;ws.getCell(r,5).numFmt='0.0%';});if(list.length)ws.addConditionalFormatting({ref:'C4:C'+(list.length+3),rules:[{type:'colorScale',cfvo:[{type:'min'},{type:'percentile',value:50},{type:'max'}],color:['F4B8B8','F5E8A3','A6D8B1']}]});if(list.length)ws.addConditionalFormatting({ref:'E4:E'+(list.length+3),rules:[{type:'dataBar',cfvo:[{type:'num',value:0},{type:'num',value:1}],color:'17613F',showValue:true}]});style(ws,[['',35],['',18],['',18],['',20],['',34]]);return ws;}
async function build(rows){const wb=new ExcelJS.Workbook();wb.creator='CEO SUR CONSULTORES';wb.title='Nangaritza 2027 | Informe electoral';wb.created=new Date();
const dash=wb.addWorksheet('Panel ejecutivo');title(dash,'PANEL EJECUTIVO',5);dash.getCell('A3').value='Indicador';dash.getCell('B3').value='Resultado';head(dash,['Indicador','Resultado','Interpretación','Estado','Detalle']);const total=rows.length,unique=new Set(rows.map(r=>r.encuestador).filter(Boolean)).size;const indicators=[['Encuestas sincronizadas',total,'Registros recibidos en el servidor'],['Encuestadores identificados',unique,'Nombres distintos registrados'],['Parroquias cubiertas',new Set(rows.map(r=>r.parroquia).filter(Boolean)).size,'Parroquias con al menos una encuesta'],['Registros urbanos',rows.filter(r=>String(r.circunscripcion).toLowerCase()==='urbana').length,'Según circunscripción declarada'],['Registros rurales',rows.filter(r=>String(r.circunscripcion).toLowerCase()==='rural').length,'Según circunscripción declarada']];for(const x of indicators)dash.addRow([x[0],x[1],x[2]]);dash.getCell('A11').value='NOTA METODOLÓGICA';dash.getCell('A12').value='Los porcentajes electorales se calculan por respuesta válida para cada dignidad. La semaforización es descriptiva, no una predicción electoral.';dash.mergeCells('A12:E12');dash.getCell('A12').alignment={wrapText:true};dash.getRow(12).height=45;style(dash,[['',34],['',19],['',47],['',18],['',30]]);await chart(wb,dash,tally(rows,'parroquia'),total,'COBERTURA POR PARROQUIA',{col:6,row:3});await chart(wb,dash,tally(rows,'encuestador'),total,'PRODUCTIVIDAD POR ENCUESTADOR',{col:6,row:20});
// Resumen de campo concentrado en panel ejecutivo.
for(const key of dimensions){const valid=rows.filter(r=>typeof r[key]==='string'&&r[key].trim());const ws=wb.addWorksheet(labels[key].slice(0,31));title(ws,labels[key].toUpperCase(),6);head(ws,['Candidatura / Respuesta','Menciones','% válido','Semáforo','Barra porcentual','Base válida']);const entries=fullTally(valid,key);entries.forEach(([name,n],i)=>{const rr=i+4;ws.addRow([name,n,{formula:'IFERROR(B'+rr+'/'+valid.length+',0)',result:valid.length?n/valid.length:0},{formula:'IF(C'+rr+'>=0.5,"VERDE",IF(C'+rr+'>=0.2,"AMARILLO","ROJO"))'},valid.length?n/valid.length:0,valid.length]);ws.getCell(rr,3).numFmt='0.0%';ws.getCell(rr,5).numFmt='0.0%'});if(entries.length)ws.addConditionalFormatting({ref:'C4:C'+(entries.length+3),rules:[{type:'colorScale',cfvo:[{type:'min'},{type:'percentile',value:50},{type:'max'}],color:['F4B8B8','F5E8A3','A6D8B1']}]});if(entries.length)ws.addConditionalFormatting({ref:'E4:E'+(entries.length+3),rules:[{type:'dataBar',cfvo:[{type:'num',value:0},{type:'num',value:1}],color:'17613F',showValue:true}]});style(ws,[['',44],['',16],['',17],['',18],['',33],['',16]]);await chart(wb,ws,entries,valid.length,'RESULTADOS · '+labels[key].toUpperCase(),{col:7,row:3});}
const keys=['numero_general','id','fecha','encuestador','parroquia','circunscripcion','parroquia_realizacion','Ubicación',...dimensions,...new Set(rows.flatMap(r=>Object.keys(r)).filter(k=>!['numero_general','id','fecha','encuestador','parroquia','circunscripcion','parroquia_realizacion','ubicacion_mapa','latitud','longitud','precision_metros',...dimensions].includes(k)))];
const raw=wb.addWorksheet('Base consolidada');title(raw,'BASE CONSOLIDADA',keys.length);head(raw,keys);
rows.forEach((r,i)=>{const values=keys.map(k=>{if(k==='Ubicación')return '';const v=r[k];return v==null?'':typeof v==='object'?JSON.stringify(v):String(v)});const row=raw.addRow(values);const lat=Number(r.latitud),lon=Number(r.longitud);const valid=String(r.latitud??'').trim()!==''&&String(r.longitud??'').trim()!==''&&Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180;const url=valid?'https://www.google.com/maps?q='+encodeURIComponent(lat+','+lon):/^https:\/\/www\.google\.com\/maps\?q=/.test(String(r.ubicacion_mapa||''))?String(r.ubicacion_mapa):'';const cell=row.getCell(keys.indexOf('Ubicación')+1);if(url){cell.value={text:'📍 Ver ubicación',hyperlink:url};cell.font={color:{argb:'FF17613F'},underline:true};}else{cell.value='Sin GPS';cell.font={color:{argb:'FFAD3434'}};}});
style(raw,keys.map(k=>['',k==='Ubicación'?25:Math.min(45,Math.max(16,k.length+3))]));raw.views=[{state:'frozen',ySplit:3,xSplit:4}];
const notes=wb.addWorksheet('Metodología');title(notes,'CRITERIOS DE LECTURA',3);[['Indicador','Criterio'],['Base válida','Encuestas con respuesta no vacía en la dignidad correspondiente'],['Porcentaje','Menciones / base válida de esa dignidad'],['Semáforo','Verde >=50%; amarillo >=20% y <50%; rojo <20%; clasificación descriptiva'],['Barra porcentual','Barras de datos nativas de Excel con porcentajes visibles'],['Cobertura','Registros recibidos en el servidor; no incluye pendientes sin sincronizar'],['Calidad','Revisar duplicados, respuestas incompletas y sesgos antes de emitir conclusiones']].forEach((x,i)=>notes.getRow(i+3).values=x);style(notes,[['',27],['',95],['',20]]);
// Excel esencial sin hojas redundantes.
return wb.xlsx.writeBuffer();}
module.exports={build};