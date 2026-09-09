// 分類「編輯」使用事件委派，避免重新渲染工程進度表後 inline onclick 失效。
document.addEventListener('click',function(e){
  const btn=e.target.closest ? e.target.closest('.scheduleGroupEditBtn') : null;
  if(!btn)return;
  e.preventDefault();
  e.stopPropagation();
  const idx=parseInt(btn.getAttribute('data-group-index'),10);
  if(Number.isFinite(idx)) window.editScheduleGroup(idx);
},true);


home(document.querySelector('nav button'));
