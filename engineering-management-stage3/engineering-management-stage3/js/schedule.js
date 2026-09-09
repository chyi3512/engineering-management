function scheduleItems(){
  const out=[];
  (Array.isArray(data.trades)?data.trades:[]).forEach((t,ti)=>{
    if(!t||typeof t!=='object')return;
    const trade=String(t.name||'未分類');
    (Array.isArray(t.items)?t.items:[]).forEach((it,j)=>{
      if(!Array.isArray(it))return;
      out.push({ti,j,trade,name:String(it[0]||'未命名工程'),notes:Array.isArray(it[1])?it[1]:[],next:String(it[2]||''),start:String(it[3]||''),end:String(it[4]||''),plan:(it[5]&&typeof it[5]==='object')?it[5]:{type:'first'}});
    });
  });
  return out;
}


function dateObj(s){return s?new Date(s+'T00:00:00'):null}

function fmtDate(s){
  if(!s)return '未設定';
  const a=s.split('-'); return a.length===3?(Number(a[1])+'/'+Number(a[2])):s;
}

function scheduleDays(a,b){
  if(!a||!b)return null;
  const x=dateObj(a),y=dateObj(b);
  if(!x||!y||isNaN(x)||isNaN(y)||y<x)return null;
  return Math.floor((y-x)/86400000)+1;
}

function scheduleDuration(start,end){
  const d=scheduleDays(start,end);
  return d?d+' 天':'—';
}

function relationLabel(x,items){
  const p=x.plan||{};
  if(!p.type||p.type==='first')return '第一階段';
  const a=items.find(y=>y.ti===p.ti&&y.j===p.j);
  if(!a)return '第一階段';
  if(p.type==='same')return '與「'+a.name+'」同步';
  if(p.type==='after')return '等「'+a.name+'」完成後';
  if(p.type==='later')return '「'+a.name+'」之後';
  return '第一階段';
}

function timelineBounds(items){
  const dated=items.filter(x=>x.start).map(x=>dateObj(x.start)).concat(items.filter(x=>x.end).map(x=>dateObj(x.end)));
  if(!dated.length)return null;
  let min=new Date(Math.min(...dated.map(x=>x.getTime())));
  let max=new Date(Math.max(...dated.map(x=>x.getTime())));
  min.setDate(min.getDate()-2); max.setDate(max.getDate()+3);
  return {min,max};
}

function timelineDates(min,max){
  const arr=[],d=new Date(min);
  while(d<=max){arr.push(new Date(d));d.setDate(d.getDate()+1);}
  return arr;
}

function timelineHTML(items){
  // 上方「建議施工時間圖」與下方「工程進度表」使用同一批 items。
  // items 的 start/end 直接來自 data.trades[*].items[*][3]/[4]。
  const b=timelineBounds(items);
  if(!b)return '<div class="empty">目前還沒有設定日期，先在下面的工程進度表輸入開始／結束日期。</div>';
  const dates=timelineDates(b.min,b.max), total=dates.length, px=Math.max(18,total*22);
  const trades=[];
  items.forEach(x=>{if(x.start&&!trades.includes(x.trade))trades.push(x.trade)});
  const palette=['#666','#777','#888','#999','#aaa','#555','#777','#777'];
  const rows=trades.map((trade,ri)=>{
    const xs=items.filter(x=>x.trade===trade&&x.start);
    const bars=xs.map(x=>{
      const s=dateObj(x.start),e=dateObj(x.end||x.start);
      const left=Math.max(0,Math.round((s-b.min)/86400000));
      const width=Math.max(1,Math.round((e-s)/86400000)+1);
      return '<div title="'+esc(x.name)+' '+esc(fmtDate(x.start))+'–'+esc(fmtDate(x.end))+'" style="position:absolute;left:'+(left*22)+'px;width:'+(width*22)+'px;top:5px;height:25px;background:'+palette[ri%palette.length]+';border-radius:6px;overflow:hidden;padding:5px 7px;color:#fff;font-size:10px;font-weight:700;white-space:nowrap">'+esc(x.name)+'</div>';
    }).join('');
    return '<div style="display:grid;grid-template-columns:82px 1fr;border-bottom:1px solid #eee;min-height:36px">'+
      '<div style="padding:9px 6px;font-size:11px;font-weight:700;white-space:nowrap"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:'+palette[ri%palette.length]+';margin-right:5px"></span>'+esc(trade)+'</div>'+
      '<div style="position:relative;height:36px;background-image:linear-gradient(to right,#eee 1px,transparent 1px);background-size:'+(100/total)+'% 100%">'+bars+'</div></div>';
  }).join('');
  const heads=dates.map((d,i)=>'<div style="min-width:22px;text-align:center;font-size:9px;color:#777">'+(i===0||d.getDate()===1?((d.getMonth()+1)+'/'+d.getDate()):d.getDate())+'</div>').join('');
  return '<div style="overflow-x:auto" class="schedule-timeline-scroll"><div style="min-width:'+px+'px">'+
    '<div style="display:flex;justify-content:space-between;gap:10px;padding:0 4px 8px;font-size:11px;color:#777"><span>日期來源：下方工程進度表</span><b>'+esc(fmtDate(b.max.toISOString().slice(0,10)))+'</b></div>'+
    '<div style="display:grid;grid-template-columns:82px 1fr;border-bottom:1px solid #ddd"><div></div><div style="display:grid;grid-template-columns:repeat('+total+',1fr)">'+heads+'</div></div>'+
    rows+'</div></div>';
}

function planGroups(items){
  const first=[],same=[],after=[],later=[];
  items.forEach(x=>{
    const t=(x.plan||{}).type||'first';
    (t==='same'?same:t==='after'?after:t==='later'?later:first).push(x);
  });
  return [{title:'① 進場準備',items:first},{title:'② 同時進場',items:same},{title:'③ 前項完成後',items:after},{title:'④ 後續安排',items:later}].filter(x=>x.items.length);
}

function relationOptions(ti,j){
  const items=scheduleItems();
  let s='<option value="first">第一階段／進場準備</option>';
  items.filter(x=>!(x.ti===ti&&x.j===j)).forEach(x=>{
    s+='<option value="same:'+x.ti+':'+x.j+'">與 '+esc(x.trade)+'｜'+esc(x.name)+' 同時進場</option>';
    s+='<option value="after:'+x.ti+':'+x.j+'">等 '+esc(x.trade)+'｜'+esc(x.name)+' 完成後</option>';
    s+='<option value="later:'+x.ti+':'+x.j+'">在 '+esc(x.trade)+'｜'+esc(x.name)+' 之後安排</option>';
  });
  return s;
}


function weekly2022Date(s){
  if(!s)return null;
  const d=dateObj(s);
  return d && !isNaN(d) ? d : null;
}

function weekly2022Label(d){
  if(!d)return '';
  return (d.getMonth()+1)+'/'+d.getDate();
}

function renderWeeklyStages(items){
  const dated=items.filter(x=>x.start).map(x=>{
    const s=weekly2022Date(x.start);
    const e=weekly2022Date(x.end||x.start)||s;
    return {...x,wstart:s,wend:e};
  }).filter(x=>x.wstart);
  if(!dated.length)return '<div class="empty">目前沒有設定日期，先在工程進度表輸入開始日期。</div>';

  // 每週固定為週一～週日；一個工程跨週時，會在每個相關週次顯示。
  const weekKey=d=>{
    const x=new Date(d);
    const day=(x.getDay()+6)%7;
    x.setDate(x.getDate()-day);
    x.setHours(0,0,0,0);
    return x.getTime();
  };
  const map={};
  dated.forEach(x=>{
    let d=new Date(x.wstart);
    while(d<=x.wend){
      const k=weekKey(d);
      if(!map[k]){
        const start=new Date(k),end=new Date(k);
        end.setDate(end.getDate()+6);
        map[k]={start,end,items:[]};
      }
      if(!map[k].items.some(y=>y.ti===x.ti&&y.j===x.j))map[k].items.push(x);
      d.setDate(d.getDate()+7);
    }
  });

  const weeks=Object.values(map).sort((a,b)=>a.start-b.start);
  const firstWeekKey=weekKey(weeks[0].start);
  const weekNo=d=>Math.floor((weekKey(d)-firstWeekKey)/604800000)+1;
  const dayNames=['一','二','三','四','五','六','日'];

  return weeks.map(w=>{
    const active=[...w.items].sort((a,b)=>a.wstart-b.wstart);
    const byTrade={};
    active.forEach(x=>{
      const key=x.trade||'未分類';
      if(!byTrade[key])byTrade[key]=[];
      byTrade[key].push(x);
    });
    const tradeNames=Object.keys(byTrade);

    // 本週目標：只摘要本週主要工種，避免再增加一堆說明文字。
    const goalTrades=tradeNames.join('、');
    const objective='完成 '+goalTrades+' 的施工／銜接，並確認下一階段進場條件。';

    // 七日時間軸：每一列一個工種，工種多時仍能一眼看出各自的施工區段。
    const gridCols='repeat(7,minmax(0,1fr))';
    const dayHead='<div style="display:grid;grid-template-columns:88px 1fr;border-bottom:1px solid #e8e8e8">'+
      '<div></div><div style="display:grid;grid-template-columns:'+gridCols+'">'+
      dayNames.map((d,i)=>'<div style="text-align:center;padding:5px 0 6px;font-size:11px;color:#999">'+d+'</div>').join('')+
      '</div></div>';

    const timelineRows=tradeNames.map(trade=>{
      const xs=byTrade[trade];
      const bars=xs.map(x=>{
        const ss=x.wstart<w.start?w.start:x.wstart;
        const ee=x.wend>w.end?w.end:x.wend;
        const left=Math.max(0,Math.floor((ss-w.start)/86400000));
        const right=Math.min(6,Math.floor((ee-w.start)/86400000));
        const width=Math.max(1,right-left+1);
        return '<div title="'+esc(x.name)+'" style="position:absolute;left:calc('+left+'/7*100% + 2px);width:calc('+width+'/7*100% - 4px);top:7px;height:18px;background:#222;border-radius:9px"></div>';
      }).join('');
      return '<div style="display:grid;grid-template-columns:88px 1fr;border-bottom:1px solid #eeeeee;min-height:35px">'+
        '<div style="padding:10px 7px;font-size:11px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(trade)+'</div>'+ 
        '<div style="position:relative;background-image:linear-gradient(to right,#ededed 1px,transparent 1px);background-size:calc(100% / 7) 100%">'+bars+'</div>'+ 
      '</div>';
    }).join('');

    // 本週工程：以工種分組，但每個工種只出現一次，避免後期大量工項混成一長串。
    const tradeBlocks=tradeNames.map(trade=>{
      const tradeItems=byTrade[trade];
      return '<div style="margin-bottom:12px">'+
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:0 0 7px;border-bottom:1px solid #e5e5e5">'+
          '<b style="font-size:16px">'+esc(trade)+'</b><span class="muted">'+tradeItems.length+' 項</span>'+ 
        '</div>'+ 
        tradeItems.map(x=>{
          const ss=x.wstart<w.start?w.start:x.wstart;
          const ee=x.wend>w.end?w.end:x.wend;
          return '<div class="row" style="margin:0;padding:9px 0;border-bottom:1px solid #f0f0f0;cursor:pointer" onclick="exampleLibraryItemDetail('+x.ti+','+x.j+')">'+
            '<div style="flex:1;min-width:0"><b>'+esc(x.name)+'</b>'+(data.trades[x.ti]?.items?.[x.j]?.[7]?'<span class="checkpoint">◆ 查驗</span>':'')+
            '<div class="muted" style="margin-top:3px">'+weekly2022Label(ss)+' ～ '+weekly2022Label(ee)+'　｜　'+esc(relationLabel(x,items))+'</div></div><span style="padding-left:8px;color:#999">→</span></div>';
        }).join('')+
      '</div>';
    }).join('');

    return '<div class="card" style="padding:18px 16px;margin-bottom:16px">'+
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">'+
        '<div style="min-width:0"><div style="font-size:26px;font-weight:800;line-height:1.15">第 '+weekNo(w.start)+' 週</div>'+ 
        '<div style="font-size:14px;color:#888;margin-top:5px">'+w.start.getFullYear()+'/'+weekly2022Label(w.start)+' ～ '+w.end.getFullYear()+'/'+weekly2022Label(w.end)+'</div></div>'+ 
        '<span class="tag" style="white-space:nowrap">'+tradeNames.length+' 個工種</span>'+ 
      '</div>'+ 
      '<div style="margin-top:18px;padding:14px 14px;background:#f5f3ee;border:1px solid #e8e2d8;border-radius:12px">'+
        '<div style="font-size:15px;font-weight:700;margin-bottom:6px">🎯 本週目標</div>'+ 
        '<div style="font-size:15px;line-height:1.65">'+esc(objective)+'</div>'+ 
      '</div>'+ 
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:20px;margin-bottom:8px"><b style="font-size:16px">本週施工時程</b><span class="muted">7 天</span></div>'+ 
      '<div style="border-top:1px solid #e5e5e5;border-bottom:1px solid #e5e5e5">'+dayHead+timelineRows+'</div>'+ 
      '<div style="margin-top:18px;color:#888;font-size:14px">本週工程</div>'+ 
      '<div style="margin-top:10px">'+tradeBlocks+'</div>'+ 
    '</div>';
  }).join('');
}


function exampleLibraryItemDetail(ti,j){
  const t=data.trades[ti], it=t&&t.items[j];
  if(!t||!it)return exampleSchedule();
  if(!Array.isArray(it[6])){
    it[6]=(it[1]||[]).map(x=>({text:x,done:false}));
    save();
  }else{
    it[6]=it[6].map(x=>typeof x==='string'?{text:x,done:false}:x).filter(x=>x&&x.text);
  }
  const checks=it[6], done=checks.filter(x=>x.done).length;
  const items=scheduleItems();
  main.innerHTML=
    '<button class="back" onclick="exampleSchedule()">← 返回工程庫</button>'+
    '<div class="card">'+
      '<span class="tag">'+esc(t.name)+'</span>'+
      '<h2 style="margin:9px 0 5px">'+esc(it[0])+(it[7]?'<span class="checkpoint">◆ 主要查驗節點</span>':'')+'</h2>'+
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:6px">'+
        '<div class="muted" style="font-size:14px">'+(it[3]&&it[4]?esc(fmtDate(it[3])+' ～ '+fmtDate(it[4])):(it[3]?esc(fmtDate(it[3])+' 起'):'日期尚未設定'))+'</div>'+
        '<button class="light" style="font-size:12px;padding:8px 11px;white-space:nowrap" onclick="editScheduleDates('+ti+','+j+')">調整時間</button>'+
      '</div>'+
    '</div>'+
    '<div class="section"><b>前置條件</b><span class="muted">'+done+'/'+checks.length+'</span></div>'+
    '<div class="card">'+
      (checks.length?checks.map((c,i)=>
        '<label class="row" style="cursor:pointer">'+
          '<input type="checkbox" '+(c.done?'checked':'')+' onchange="toggleLibraryCheck('+ti+','+j+','+i+',this.checked)" style="width:20px;height:20px;margin:0;flex:none">'+
          '<span style="flex:1;'+(c.done?'text-decoration:line-through;color:#999':'')+'">'+esc(c.text)+'</span>'+
        '</label>'
      ).join(''):'<div class="empty">尚未設定前置條件</div>')+
      '<button class="light" style="width:100%;margin-top:10px" onclick="editLibraryChecks('+ti+','+j+')">編輯前置條件</button>'+
    '</div>'+
    '<div class="section"><b>施工安排</b></div>'+
    '<div class="card">'+
      '<div class="row"><div style="flex:1"><div class="muted">進場關係</div><b>'+esc(relationLabel({plan:it[5]||{}},items))+'</b></div></div>'+
      '<div class="row"><div style="flex:1"><div class="muted">工程進度表的下一個事項</div><b>→ '+esc(progressNextFor2022(ti,j)||'後續未設定')+'</b></div></div>'+ (it[7]?'<div class="warn"><b>◆ 主要查驗節點</b><br>做到這裡要停下來確認，完成查驗後再進入下一事項。</div>':'')+
      '<button class="light" style="width:100%;margin-top:10px" onclick="editSchedulePlan('+ti+','+j+')">編輯施工安排</button>'+
    '</div>'+
    '<div class="hint">這裡是工程庫的標準內容。之後新增工程時，可以從工程庫套用，再在該工程裡個別調整。</div>';
}

function editScheduleDates(ti,j){
  const it=data.trades[ti].items[j];
  if(!it)return;
  openModal('<h2>調整工程時間</h2>'+
    '<div class="card" style="padding:12px"><b>'+esc(it[0])+'</b><div class="muted" style="margin-top:5px">只修改這個施工項目的開始／結束日期，不會改動其他工項。</div></div>'+
    '<label>開始日期</label><input id="dateStart" type="date" value="'+esc(it[3]||'')+'">'+
    '<label>結束日期</label><input id="dateEnd" type="date" value="'+esc(it[4]||'')+'">'+
    '<div class="hint">修改後會立即反映在工程進度表與上方時間範圍。</div>'+
    '<div class="actions"><button class="light" onclick="closeModal()">取消</button><button onclick="saveScheduleDates('+ti+','+j+')">儲存時間</button></div>');
}

function saveScheduleDates(ti,j){
  const it=data.trades[ti].items[j];
  if(!it)return;
  const start=document.getElementById('dateStart').value;
  const end=document.getElementById('dateEnd').value;
  if(start&&end&&end<start){alert('結束日期不能早於開始日期');return;}
  it[3]=start;
  it[4]=end;
  save();
  closeModal();
  // 日期也是工程進度表的唯一時間資料；儲存後直接回到進度表，讓上方時間圖重新繪製。
  exampleSchedule();
}


function toggleLibraryCheck(ti,j,i,checked){
  const it=data.trades[ti].items[j];
  if(!Array.isArray(it[6]))it[6]=(it[1]||[]).map(x=>({text:x,done:false}));
  if(it[6][i])it[6][i].done=!!checked;
  save();
  exampleLibraryItemDetail(ti,j);
}

function editLibraryChecks(ti,j){
  const it=data.trades[ti].items[j];
  const checks=Array.isArray(it[6])?it[6]:((it[1]||[]).map(x=>({text:x,done:false})));
  openModal('<h2>編輯前置條件</h2><div class="hint">一行一項。這些是工程庫的標準確認項目。</div><textarea id="libraryChecksEdit">'+esc(checks.map(x=>x.text||x).join('\n'))+'</textarea><div class="actions"><button class="light" onclick="closeModal()">取消</button><button onclick="saveLibraryChecks('+ti+','+j+')">儲存</button></div>');
}

function saveLibraryChecks(ti,j){
  const it=data.trades[ti].items[j];
  const old=Array.isArray(it[6])?it[6]:[];
  const lines=document.getElementById('libraryChecksEdit').value.split('\n').map(x=>x.trim()).filter(Boolean);
  it[1]=lines;
  it[6]=lines.map(text=>{
    const oldItem=old.find(x=>(x.text||x)===text);
    return {text,done:oldItem?!!oldItem.done:false};
  });
  save();closeModal();exampleLibraryItemDetail(ti,j);
}



function normalizeScheduleGroupName(name){
  return String(name||'').trim().replace(/^\d+\.\s*/,'').trim() || '未分類';
}

function getScheduleGroups(){
  // 分類是獨立資料：保留使用者建立的分類，同時自動補回目前工程正在使用的分類。
  // 不會因為分類目前沒有項目就自動刪除。
  const groups=[];
  const seen=new Set();
  const existing=Array.isArray(data.scheduleGroups)?data.scheduleGroups:[];

  const addGroup=(rawName, meta)=>{
    const name=normalizeScheduleGroupName(rawName);
    if(!name||seen.has(name))return;
    seen.add(name);
    const n=Number(meta?.number);
    groups.push({
      name,
      key:name,
      number:Number.isFinite(n)&&n>0?Math.floor(n):groups.length+1,
      showNumber:meta?.showNumber===true,
      _originalIndex:groups.length
    });
  };

  // 1. 先保留已經存在的自訂分類（包含沒有工程項目的新分類）。
  existing.forEach((g)=>addGroup(g?.name,g));

  // 2. 再補回目前工程項目實際使用的分類。
  scheduleItems().forEach(x=>addGroup(scheduleGroupName(x),{}));

  // 3. 如果工程項目的分類欄還沒設定，則使用原本的工種名稱，確保「清潔」等目前工種不會消失。
  (Array.isArray(data.trades)?data.trades:[]).forEach(t=>{
    if(!t)return;
    addGroup(t.name,{});
  });

  groups.sort((a,b)=>{
    const an=Number.isFinite(Number(a.number))?Number(a.number):999999;
    const bn=Number.isFinite(Number(b.number))?Number(b.number):999999;
    return an-bn || a._originalIndex-b._originalIndex;
  });
  groups.forEach((g,i)=>{g.number=i+1;delete g._originalIndex;});
  return groups;
}


function scheduleGroupName(x){
  const raw=data.trades?.[x.ti]?.items?.[x.j];
  return Array.isArray(raw)&&String(raw[9]||'').trim()
    ? normalizeScheduleGroupName(raw[9])
    : normalizeScheduleGroupName(x.trade||'未分類');
}

function saveScheduleGroups(groups){
  // 分類本身獨立保存；不會因為目前沒有工程項目而被刪除。
  const clean=[];
  const seen=new Set();
  (groups||[]).forEach(g=>{
    const name=normalizeScheduleGroupName(g?.name);
    if(!name||seen.has(name))return;
    seen.add(name);
    clean.push({
      name,
      key:name,
      number:clean.length+1,
      showNumber:g?.showNumber===true
    });
  });
  data.scheduleGroups=clean;
  save();
}


function editScheduleGroup(index){
  const groups=getScheduleGroups(), g=groups[index];
  if(!g)return;
  openModal(
    '<h2>編輯分類</h2>'+
    '<label>分類名稱</label>'+
    '<input id="scheduleGroupNameEdit" value="'+esc(g.name)+'" placeholder="例如：木作">'+
    '<label>工種編號</label>'+
    '<input id="scheduleGroupNumberEdit" type="number" min="1" step="1" value="'+esc(String(g.number||''))+'" placeholder="例如：23">'+
    '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin:8px 0 14px">'+
      '<input id="scheduleGroupShowNumberEdit" type="checkbox" '+(g.showNumber?'checked':'')+' style="width:18px;height:18px;margin:0">'+
      '<span>顯示工種編號</span>'+
    '</label>'+
    '<div class="hint">編號就是分類順序。輸入 2 就會移到第 2 項，其他分類自動順延。</div>'+
    '<div class="actions"><button class="light" onclick="closeModal()">取消</button><button onclick="saveScheduleGroupEdit('+index+')">儲存</button></div>'
  );
}

function saveScheduleGroupEdit(index){
  const groups=getScheduleGroups(), g=groups[index];
  if(!g)return;
  const nameEl=document.getElementById('scheduleGroupNameEdit');
  const numEl=document.getElementById('scheduleGroupNumberEdit');
  const showEl=document.getElementById('scheduleGroupShowNumberEdit');
  const next=normalizeScheduleGroupName(nameEl?.value||'');
  if(!next){alert('請輸入分類名稱');return;}
  if(groups.some((x,i)=>i!==index&&normalizeScheduleGroupName(x.name)===next)){alert('已有相同分類名稱。');return;}
  const numRaw=String(numEl?.value||'').trim();
  const num=numRaw===''?g.number:Number(numRaw);
  if(!Number.isFinite(num)||num<1){alert('工種編號請輸入 1 以上的整數');return;}
  const old=g.name;
  const target=Math.max(1,Math.min(groups.length,Math.floor(num)));
  g.name=next;
  g.key=next;
  g.showNumber=!!showEl?.checked;
  const moved=groups.splice(index,1)[0];
  groups.splice(target-1,0,moved);
  groups.forEach((x,i)=>x.number=i+1);
  // 同步目前工程項目所使用的分類名稱，但不修改工種庫名稱。
  (Array.isArray(data.trades)?data.trades:[]).forEach(t=>{
    (Array.isArray(t.items)?t.items:[]).forEach(it=>{
      if(Array.isArray(it)&&normalizeScheduleGroupName(it[9]||'')===old)it[9]=next;
    });
  });
  saveScheduleGroups(groups);
  closeModal();
  exampleSchedule();
}

function moveScheduleGroup(index,delta){
  const groups=getScheduleGroups(), ni=index+delta;
  if(index<0||ni<0||ni>=groups.length)return;
  const tmp=groups[index];groups[index]=groups[ni];groups[ni]=tmp;
  groups.forEach((g,i)=>g.number=i+1);
  saveScheduleGroups(groups);exampleSchedule();
}

function addScheduleItemToGroup(groupIndex){
  const groups=getScheduleGroups();
  const g=groups[groupIndex];
  if(!g)return;
  openModal('<h2>新增「'+esc(g.name)+'」工程細項</h2>'+    '<label>工程項目名稱</label><input id="newScheduleItemName" placeholder="例如：現場清潔">'+    '<div class="grid"><div><label>開始日期</label><input id="newScheduleItemStart" type="date"></div><div><label>結束日期</label><input id="newScheduleItemEnd" type="date"></div></div>'+    '<label>注意事項（可選，每項用「、」分隔）</label><input id="newScheduleItemNotes" placeholder="例如：垃圾清運、地面保護">'+    '<div class="actions"><button class="light" onclick="closeModal()">取消</button><button onclick="saveNewScheduleItem('+groupIndex+')">新增</button></div>');
  setTimeout(()=>document.getElementById('newScheduleItemName')?.focus(),50);
}


function saveNewScheduleItem(groupIndex){
  const groups=getScheduleGroups();
  const g=groups[groupIndex];
  if(!g)return;
  const name=(document.getElementById('newScheduleItemName')?.value||'').trim();
  const start=document.getElementById('newScheduleItemStart')?.value||'';
  const end=document.getElementById('newScheduleItemEnd')?.value||'';
  const notes=(document.getElementById('newScheduleItemNotes')?.value||'').split('、').map(x=>x.trim()).filter(Boolean);
  if(!name){alert('請輸入工程項目名稱');return;}
  if(start&&end&&end<start){alert('結束日期不能早於開始日期');return;}

  // 優先放進同名的既有工種；若只有自訂分類，則建立一個對應工種容器。
  let ti=data.trades.findIndex(t=>normalizeScheduleGroupName(t?.name)===g.name);
  if(ti<0){
    data.trades.push({name:g.name,items:[],source:'custom'});
    ti=data.trades.length-1;
  }
  const t=data.trades[ti];
  const nextOrder=t.items.reduce((m,it)=>Math.max(m,Number(it?.[8])||0),0)+1;
  const item=[name,notes,'',start,end,'','',false,nextOrder,g.name];
  t.items.push(item);
  save();
  closeModal();
  exampleSchedule();
}


function addScheduleGroup(){
  const groups=getScheduleGroups();
  const name=prompt('新增工程分類名稱：','新分類');
  if(name===null)return;
  const n=normalizeScheduleGroupName(name);
  if(!n)return;
  if(groups.some(g=>normalizeScheduleGroupName(g.name)===n)){alert('已有相同分類名稱。');return;}
  groups.push({name:n,key:n,number:groups.length+1,showNumber:false});
  saveScheduleGroups(groups);
  exampleSchedule();
}

function cleanupScheduleGroups(){
  // 整理：把工程項目中的舊編號前綴去掉、同名分類合併；
  // 只保留「目前有工程項目」或「使用者明確建立」的分類。
  const oldGroups=Array.isArray(data.scheduleGroups)?data.scheduleGroups:[];
  const usedNames=[];
  (Array.isArray(data.trades)?data.trades:[]).forEach(t=>{
    (Array.isArray(t?.items)?t.items:[]).forEach(it=>{
      if(Array.isArray(it)&&String(it[9]||'').trim()){
        const n=normalizeScheduleGroupName(it[9]);
        if(n&&!usedNames.includes(n))usedNames.push(n);
        it[9]=n;
      }
    });
  });
  const clean=[];
  const seen=new Set();
  oldGroups.forEach(g=>{
    const n=normalizeScheduleGroupName(g?.name);
    if(!n||seen.has(n))return;
    seen.add(n);
    clean.push({name:n,key:n,showNumber:g?.showNumber===true});
  });
  // 工程項目中實際使用的分類一定補回來，例如清潔。
  usedNames.forEach(n=>{
    if(!seen.has(n)){
      seen.add(n);
      clean.push({name:n,key:n,showNumber:false});
    }
  });
  clean.forEach((g,i)=>g.number=i+1);
  data.scheduleGroups=clean;
  save();
  exampleSchedule();
  alert('分類整理完成。重複分類已合併，工程項目目前使用的分類也已保留。');
}

function deleteScheduleGroup(index){
  const groups=getScheduleGroups(), g=groups[index];
  if(!g)return;
  const hasItems=scheduleItems().some(x=>scheduleGroupName(x)===g.name);
  if(hasItems){alert('這個分類還有工程項目，請先把項目移到其他分類，再刪除。');return;}
  if(!confirm('確定刪除「'+g.name+'」分類？'))return;
  groups.splice(index,1);
  groups.forEach((x,i)=>x.number=i+1);
  saveScheduleGroups(groups);exampleSchedule();
}
// 工程進度表每一列的「編輯」：直接編輯該工程項目的內容

function editScheduleItem(ti,j){
  if(!data.trades?.[ti]?.items?.[j])return;
  return editTradeItem(ti,j);
}


function updateScheduleItemGroup(ti,j,value){
  const it=data.trades?.[ti]?.items?.[j];
  if(!Array.isArray(it))return;
  it[9]=String(value||'').trim();
  save();exampleSchedule();
}

function toggleTradeSchedule(id){
  const box=document.getElementById(id), icon=document.getElementById(id+'_icon');
  if(!box)return;
  const closed=box.style.display==='none';
  box.style.display=closed?'block':'none';
  if(icon)icon.textContent=closed?'▼':'▶';
}

function collapseAllTradeSchedules(){
  document.querySelectorAll('[id^="tradeSchedule_"]').forEach(box=>{
    box.style.display='none';
    const icon=document.getElementById(box.id+'_icon');
    if(icon)icon.textContent='▶';
  });
}

function updateScheduleOrder(ti,j,value){
  const it=data.trades?.[ti]?.items?.[j];
  if(!Array.isArray(it))return;
  const n=Number(value);
  it[8]=Number.isFinite(n)&&n>0?n:'';
  save();exampleSchedule();
}

function updateScheduleDateInline(ti,j,field,value){
  const it=data.trades?.[ti]?.items?.[j];
  if(!Array.isArray(it))return;
  if(field==='start')it[3]=value||'';
  if(field==='end')it[4]=value||'';
  if(it[3]&&it[4]&&it[4]<it[3]){alert('結束日期不能早於開始日期');return;}
  save();exampleSchedule();
}


function ensureScheduleGroups(){
  const groups=getScheduleGroups();
  const current=Array.isArray(data.scheduleGroups)?data.scheduleGroups:[];
  const old=current.map(g=>normalizeScheduleGroupName(g?.name)).filter(Boolean);
  const now=groups.map(g=>g.name);
  if(old.length!==now.length || old.some((n,i)=>n!==now[i])){
    saveScheduleGroups(groups);
  }
  return groups;
}


function exampleScheduleUnsafe(e){
  nav(e);
  const items=scheduleItems();
  const validItems=items.filter(x=>x && (!x.start || !isNaN(dateObj(x.start))) && (!x.end || !isNaN(dateObj(x.end))));
  const dated=validItems.filter(x=>x.start).sort((a,b)=>String(a.start).localeCompare(String(b.start)));
  const firstDate=dated.length?fmtDate(dated[0].start):'尚未排定';
  const lastDated=validItems.filter(x=>x.start||x.end).sort((a,b)=>String(b.end||b.start||'').localeCompare(String(a.end||a.start||'')));
  const lastDate=lastDated.length?fmtDate(lastDated[0].end||lastDated[0].start):'尚未排定';

  let timeline='';
  try{ timeline=timelineHTML(validItems); }
  catch(err){ console.error('施工時間圖錯誤',err); timeline='<div class="empty">施工時間圖暫時無法顯示，但下面的工程進度資料仍可正常使用。</div>'; }

  let weekly='';
  try{ weekly=renderWeeklyStages(validItems); }
  catch(err){ console.error('每週階段錯誤',err); weekly='<div class="empty">每週階段圖暫時無法顯示，工程進度表仍可正常使用。</div>'; }

  // 工程進度表：依「可自訂工程分類」分組；分類名稱與順序可由使用者調整。
  const groups=ensureScheduleGroups();
  const grouped={};
  groups.forEach(g=>grouped[g.name]=[]);
  validItems.forEach(x=>{
    const key=scheduleGroupName(x);
    if(!grouped[key])grouped[key]=[];
    grouped[key].push(x);
  });
  // 顯示全部分類：即使目前沒有工程項目，也要保留分類區塊。
  // 分類本身存在 ≠ 必須有工程項目。
  const groupNames=groups.map(g=>g.name);
  Object.keys(grouped).forEach(n=>{if(!groupNames.includes(n))groupNames.push(n);});
  const tradeRows=groupNames.map((groupName,idx)=>{
    const list=grouped[groupName];
    list.sort((a,b)=>{
      const ao=Number(data.trades?.[a.ti]?.items?.[a.j]?.[8]);
      const bo=Number(data.trades?.[b.ti]?.items?.[b.j]?.[8]);
      const av=Number.isFinite(ao)&&ao>0?ao:999999;
      const bv=Number.isFinite(bo)&&bo>0?bo:999999;
      return av-bv||String(a.start||'9999').localeCompare(String(b.start||'9999'));
    });
    const groupIndex=groups.findIndex(g=>g.name===groupName);
    const body=list.length ? list.map(x=>{
      const raw=data.trades?.[x.ti]?.items?.[x.j];
      const checkpoint=Array.isArray(raw)&&raw[7];
      const order=Array.isArray(raw)&&raw[8]!==undefined&&raw[8]!==''?raw[8]:'';
      return '<tr>'+
  
        '<td style="padding:8px;border-bottom:1px solid #eee;white-space:nowrap"><input type="date" value="'+esc(x.start||'')+'" onclick="event.stopPropagation()" onchange="updateScheduleDateInline('+x.ti+','+x.j+',\'start\',this.value)" style="margin:0;padding:8px;width:145px"></td>'+
        '<td style="padding:8px;border-bottom:1px solid #eee;white-space:nowrap"><input type="date" value="'+esc(x.end||'')+'" onclick="event.stopPropagation()" onchange="updateScheduleDateInline('+x.ti+','+x.j+',\'end\',this.value)" style="margin:0;padding:8px;width:145px"></td>'+
        '<td onclick="exampleLibraryItemDetail('+x.ti+','+x.j+')" style="padding:12px;border-bottom:1px solid #eee"><b>'+esc(x.name)+'</b>'+(checkpoint?'<span class="checkpoint">◆ 查驗</span>':'')+'</td>'+
        '<td style="padding:8px;border-bottom:1px solid #eee;white-space:nowrap"><select onclick="event.stopPropagation()" onchange="updateScheduleItemGroup('+x.ti+','+x.j+',this.value)" style="margin:0;padding:7px;min-width:100px">'+
          groups.map(g=>'<option value="'+esc(g.name)+'" '+(scheduleGroupName(x)===g.name?'selected':'')+'>'+esc(g.name)+'</option>').join('')+
        '</select></td>'+
        '<td style="padding:12px;border-bottom:1px solid #eee;text-align:center">'+esc(scheduleDuration(x.start,x.end))+'</td>'+
        '<td style="padding:12px;border-bottom:1px solid #eee"><button type="button" class="editbtn" onclick="event.preventDefault();event.stopPropagation();window.editScheduleItem('+x.ti+','+x.j+');return false;">編輯</button> <button class="light" onclick="event.stopPropagation();deleteScheduleItem('+x.ti+','+x.j+')" style="color:#b42318">刪除</button></td>'+
        '</tr>';
    }).join('') : '<tr><td colspan="6" style="padding:18px;text-align:center;color:#888;border-bottom:1px solid #eee">目前沒有工程項目</td></tr>';
    const id='tradeSchedule_'+idx;
    return '<div class="card" style="padding:0;overflow:hidden;margin-bottom:12px">'+
      '<div style="padding:14px 16px;border-bottom:1px solid #eee;display:flex;align-items:center;justify-content:space-between;gap:8px">'+
        '<button type="button" onclick="toggleTradeSchedule(\''+id+'\')" style="flex:1;border:0;background:transparent;padding:0;display:flex;align-items:center;gap:10px;cursor:pointer;text-align:left;color:#171717">'+
          '<b style="font-size:18px">'+((groups[groupIndex]&&groups[groupIndex].showNumber)?String(groups[groupIndex].number)+'. ':'')+esc(groupName)+'</b><span class="tag">'+list.length+' 項</span><span id="'+id+'_icon">▼</span>'+
        '</button>'+
        '<div style="display:flex;gap:4px">'+
          '<button class="light" title="往上" onclick="event.stopPropagation();moveScheduleGroup('+groupIndex+',-1)">↑</button>'+
          '<button class="light" title="往下" onclick="event.stopPropagation();moveScheduleGroup('+groupIndex+',1)">↓</button>'+
          '<button type="button" class="light" onclick="event.stopPropagation();addScheduleItemToGroup('+groupIndex+')">＋ 新增</button>'+
          '<button type="button" class="light scheduleGroupEditBtn" data-group-index="'+groupIndex+'" style="position:relative;z-index:100;pointer-events:auto;cursor:pointer">編輯</button>'+
          '<button type="button" class="light" style="position:relative;z-index:20;pointer-events:auto;color:#b42318" onclick="deleteScheduleGroup('+groupIndex+')">刪除</button>'+
        '</div>'+
      '</div>'+
      '<div id="'+id+'" style="overflow-x:auto"><table style="width:100%;min-width:860px;border-collapse:collapse;font-size:13px"><thead><tr>'+
      '<th style="text-align:left;padding:10px;border-bottom:1px solid #ddd">開始</th><th style="text-align:left;padding:10px;border-bottom:1px solid #ddd">結束</th><th style="text-align:left;padding:10px;border-bottom:1px solid #ddd">工程項目</th><th style="text-align:left;padding:10px;border-bottom:1px solid #ddd">分類</th><th style="text-align:center;padding:10px;border-bottom:1px solid #ddd">工期</th><th style="padding:10px;border-bottom:1px solid #ddd">操作</th>'+
      '</tr></thead><tbody>'+body+'</tbody></table></div>'+
      '</div>';
  }).join('');
  
  main.innerHTML=
    '<div class="section"><div><b>施工安排指南</b><div class="muted">實際日期以工程進度表為準，上方時間圖會跟著日期同步。</div></div><div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end"><button class="light" onclick="cleanupScheduleGroups()">整理分類</button><button onclick="newScheduleItem()">＋ 新增</button></div></div>'+ 
    '<div class="card"><div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start"><div><div class="muted">工程時間範圍</div><h2 style="margin:4px 0">'+esc(firstDate)+' ～ '+esc(lastDate)+'</h2></div><span class="tag">'+validItems.length+' 個工程項目</span></div><div class="muted">日期直接讀取目前工程進度表，不會另外建立一份資料。</div></div>'+ 
    '<div class="section"><b>建議施工時間圖</b><span class="muted">與下方日期連動</span></div>'+ 
    '<div class="card" style="padding:10px">'+timeline+'</div>'+ 
    '<div class="section"><b>各階段重點</b><span class="muted">每週</span></div>'+weekly+
    '<div class="section"><div><b>工程進度表</b><div class="muted">依自訂分類分組；分類名稱、編號顯示與分類順序都可以自己調整。</div></div><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="light" onclick="addScheduleGroup()">＋ 分類</button><button class="light" onclick="cleanupScheduleGroups()">整理分類</button><button class="light" onclick="collapseAllTradeSchedules()">全部收合</button></div></div>'+ 
    (tradeRows||'<div class="empty">目前沒有工程項目。</div>');
}


function exampleSchedule(e){
  // 唯一的工程範例入口：使用上方已完成的分工種版本。
  // e 可以是按鈕元素，也可以省略；nav() 已做防呆。
  return exampleScheduleUnsafe(e);
}

