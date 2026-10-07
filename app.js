const KEY = "85xTournamentV5";
const CONFIG = window.SUPABASE_CONFIG || {};
const ADMIN_EMAIL = String(CONFIG.platformAdminEmail || "yee861029@gmail.com").trim().toLowerCase();
const SUPABASE_READY = Boolean(
  window.supabase &&
  CONFIG.url && CONFIG.anonKey &&
  !CONFIG.url.includes("YOUR_SUPABASE") &&
  !CONFIG.anonKey.includes("YOUR_SUPABASE")
);
const sb = SUPABASE_READY ? window.supabase.createClient(CONFIG.url, CONFIG.anonKey) : null;

const stateDefault = {
  event:{id:"",name:"",date:"",time:"",participantCount:null,courtCount:null,topN:null,created:false},
  players:[],referees:[],matches:[],
  hostLogged:false,
  hostUser:null,
  referee:{court:null,eventId:""},
  selectedPlayerId:Number(localStorage.getItem("85xSelectedPlayer")||0)
};
let state = load();

function load(){
  try { return {...structuredClone(stateDefault), ...JSON.parse(localStorage.getItem(KEY)||"{}")}; }
  catch { return structuredClone(stateDefault); }
}
function save(){
  const persisted={...state,hostLogged:false,hostUser:null};
  localStorage.setItem(KEY,JSON.stringify(persisted));
}
function pname(id){return state.players.find(p=>p.id===id)?.name||"待定"}
function cname(i){return `${String.fromCharCode(65+i)}場`}
function sizeFor(n){return [8,16,32,64,128].find(x=>x>=n)||128}
function toast(msg){const e=document.getElementById("toast");e.textContent=msg;e.classList.add("show");setTimeout(()=>e.classList.remove("show"),1800)}
function openModal(title,html){document.getElementById("modalTitle").textContent=title;document.getElementById("modalBody").innerHTML=html;document.getElementById("modal").classList.remove("hidden")}
function closeModal(){document.getElementById("modal").classList.add("hidden")}
function publicUrl(){return `${location.origin}${location.pathname}?public=${encodeURIComponent(state.event.id)}`}
function refUrl(code){return `${location.origin}${location.pathname}?ref=${encodeURIComponent(code)}`}

function currentMode(){
  const q=new URLSearchParams(location.search);
  if(q.has("public"))return "public";
  if(q.has("ref"))return "ref";
  return "home";
}
function hideAll(){["homeView","hostView","refereeView","publicView"].forEach(id=>document.getElementById(id).classList.add("hidden"))}
function setTopButtons(mode){
  const login=document.getElementById("hostLoginBtn"), back=document.getElementById("backHomeBtn");
  login.classList.toggle("hidden",mode==="host"||mode==="ref");
  back.classList.toggle("hidden",mode==="home");
}

async function restoreAuth(){
  if(!sb){
    state.hostLogged = sessionStorage.getItem("85xHostAuthenticated")==="1";
    return;
  }
  const {data:{session}} = await sb.auth.getSession();
  state.hostUser = session?.user || null;
  state.hostLogged = false;
  if(session?.user) await applyHostAuthorization(session.user);
}

async function applyHostAuthorization(user){
  const email=String(user.email||"").trim().toLowerCase();
  // 平台管理員為固定 bootstrap 帳號；其他主審則由 user_roles 表授權。
  if(email===ADMIN_EMAIL){
    state.hostLogged=true;
    state.hostUser={...user, role:"platform_admin"};
    sessionStorage.setItem("85xHostAuthenticated","1");
    return true;
  }
  if(!sb){return false;}
  try{
    const {data,error}=await sb.from("user_roles").select("role").eq("user_id",user.id).eq("role","host").maybeSingle();
    if(error) throw error;
    if(data?.role==="host"){
      state.hostLogged=true;
      state.hostUser={...user, role:"host"};
      sessionStorage.setItem("85xHostAuthenticated","1");
      return true;
    }
  }catch(err){
    console.error("讀取主審權限失敗",err);
  }
  state.hostLogged=false;
  sessionStorage.removeItem("85xHostAuthenticated");
  return false;
}

function render(){
  hideAll();
  const mode=currentMode();
  if(mode==="public"){document.getElementById("publicView").classList.remove("hidden");setTopButtons("public");renderPublic()}
  else if(mode==="ref"){document.getElementById("refereeView").classList.remove("hidden");setTopButtons("ref");renderRefereeFromQuery()}
  else if(state.hostLogged){document.getElementById("hostView").classList.remove("hidden");setTopButtons("host");renderHost()}
  else{document.getElementById("homeView").classList.remove("hidden");setTopButtons("home")}
}

function loginHost(){
  const setupNotice = SUPABASE_READY
    ? `<div class="notice">將使用 Google 登入。登入後系統會檢查你的主審資格。</div>`
    : `<div class="notice">目前尚未設定 Supabase。請先在 <strong>supabase-config.js</strong> 填入 Project URL 與 anon/publishable key，再啟用 Google 登入。</div>`;
  openModal("👑 主審登入",`<div class="modal-form">
    <button id="googleLoginBtn" class="primary" ${SUPABASE_READY?"":"disabled"}>使用 Google 登入</button>
    ${setupNotice}
    <div class="notice">平台管理員：<strong>${ADMIN_EMAIL}</strong></div>
  </div>`);
}

async function doGoogleLogin(){
  if(!sb){toast("尚未設定 Supabase");return}
  const redirectTo=location.origin+location.pathname;
  const {error}=await sb.auth.signInWithOAuth({provider:"google",options:{redirectTo,queryParams:{access_type:"offline",prompt:"select_account"}}});
  if(error){console.error(error);toast("Google 登入失敗："+error.message)}
}

async function finishOAuth(){
  if(!sb)return;
  const {data:{session}}=await sb.auth.getSession();
  if(!session?.user)return;
  const allowed=await applyHostAuthorization(session.user);
  if(allowed){closeModal();render();toast(state.hostUser.role==="platform_admin"?"平台管理員登入成功":"主審登入成功")}
  else{
    await sb.auth.signOut();
    openModal("⛔ 沒有主審權限",`<div class="modal-form"><div class="notice">Google 帳號 <strong>${session.user.email||""}</strong> 已登入，但目前沒有 85°X 主審資格。</div><div class="notice">若要授權，請由平台管理員在主審管理功能中加入此 Google 帳號。</div><button id="closeAuthDenied" class="secondary">返回首頁</button></div>`);
  }
}

function logout(){
  state.hostLogged=false;state.hostUser=null;sessionStorage.removeItem("85xHostAuthenticated");
  if(sb) sb.auth.signOut().catch(console.error);
  render();
}

function createEvent(){
  const name=document.getElementById("eventNameInput").value.trim();
  const date=document.getElementById("eventDateInput").value;
  const time=document.getElementById("eventTimeInput").value;
  const count=Number(document.getElementById("participantCount").value);
  const courts=Number(document.getElementById("courtCount").value);
  const topN=Number(document.getElementById("topN").value);
  if(!name||!date||!time||!count||!courts||!topN){toast("請完整填寫比賽設定");return}
  const id="evt-"+Date.now().toString(36);
  state.event={id,name,date,time,participantCount:count,courtCount:courts,topN,created:true};
  state.players=Array.from({length:count},(_,i)=>({id:i+1,name:`玩家${i+1}`}));
  state.referees=Array.from({length:courts},(_,i)=>({name:`裁判${String.fromCharCode(65+i)}`,court:cname(i),code:`${String.fromCharCode(65+i)}${Math.random().toString(36).slice(2,6).toUpperCase()}`,connected:false}));
  state.matches=Array.from({length:Math.min(courts,Math.floor(count/2))},(_,i)=>({id:i+1,court:i,p1:i*2+1,p2:i*2+2,score1:0,score2:0,history:[],winner:null,status:"playing"}));
  save();renderHost();toast("公開賽事已建立")
}

function renderHost(){
  document.getElementById("eventNameInput").value=state.event.name||"";
  document.getElementById("eventDateInput").value=state.event.date||"";
  document.getElementById("eventTimeInput").value=state.event.time||"";
  document.getElementById("participantCount").value=state.event.participantCount||"";
  document.getElementById("courtCount").value=state.event.courtCount||"";
  document.getElementById("topN").value=state.event.topN||"";
  const roleLabel=state.hostUser?.role==="platform_admin"?"👑 平台管理員":"👑 主審";
  const email=state.hostUser?.email||"已授權帳號";
  const authBox=document.querySelector("#hostView .card");
  if(authBox){
    const title=authBox.querySelector(".card-title");
    if(title) title.dataset.auth=roleLabel;
  }
  document.getElementById("formatSummary").innerHTML=state.event.created?`實際 ${state.event.participantCount} 人 → ${sizeFor(state.event.participantCount)} 人架構。${state.event.participantCount>sizeFor(state.event.participantCount)/2?"系統預留第0輪。":""}`:"建立後系統會產生專屬「公開賽事 URL」。";
  document.getElementById("publicEventBox").innerHTML=state.event.created?`
    <div><strong>${state.event.name}</strong><div class="muted">參賽 ${state.event.participantCount} 人・${state.event.courtCount} 場・取前 ${state.event.topN} 名</div></div>
    <div class="copy-row" style="margin-top:10px"><input id="publicUrlInput" readonly value="${publicUrl()}"><button id="copyPublicUrl" class="primary">複製</button></div>
    <div class="notice">把這個 URL 給參賽者；只有透過這個公開賽事 URL 才會進入參賽者頁面。</div>`:"尚未建立公開賽事。";
  document.getElementById("refereeTable").innerHTML=state.referees.length?state.referees.map(r=>`
    <div class="referee-row">
      <div><strong>${r.name}</strong><div class="muted">${r.court}・${r.connected?"🟢 已加入":"🔴 尚未加入"}</div></div>
      <div><div class="copy-row"><input readonly value="${refUrl(r.code)}"><button class="secondary copyRef" data-url="${refUrl(r.code)}">複製</button></div><div class="muted">加入碼：${r.code}</div></div>
      <div class="qr-thumb" title="QR Code 預覽"></div>
    </div>`).join(""):"<div class='empty'>建立賽事後，系統會產生每個場地的裁判 QR Code。</div>";
  document.getElementById("controlTower").innerHTML=state.referees.length?state.referees.map((r,i)=>{const m=state.matches.find(x=>x.court===i&&x.status!=="finished");return `<div class="court-card"><h3>${r.court}</h3><div class="muted">${r.name}・${r.connected?"🟢 已連線":"🔴 尚未加入"}</div>${m?`<div class="match-mini"><strong>${pname(m.p1)} VS ${pname(m.p2)}</strong><div class="match-score">${m.score1} : ${m.score2}</div></div>`:"<div class='notice'>目前無進行中的比賽</div>"}</div>`}).join(""):"<div class='empty'>建立賽事後顯示各場地狀態。</div>";
  document.getElementById("placementPanel").innerHTML=state.event.created?`目前設定：取前 <strong>${state.event.topN}</strong> 名。<br>完整賽制引擎會依實際參賽人數自動安排第0輪、晉級與名次戰。`:"建立賽事後顯示。";
  document.querySelectorAll(".copyRef").forEach(b=>b.addEventListener("click",()=>copyText(b.dataset.url)));
  const cp=document.getElementById("copyPublicUrl");if(cp)cp.addEventListener("click",()=>copyText(document.getElementById("publicUrlInput").value));
}
async function copyText(text){try{await navigator.clipboard.writeText(text);toast("已複製 URL")}catch{toast("請手動複製 URL")}}

function renderPublic(){
  if(!state.event.created){document.getElementById("publicEventName").textContent="找不到公開賽事";document.getElementById("publicStatus").textContent="這個公開 URL 尚未建立或已失效。";return}
  document.getElementById("publicEventName").textContent=state.event.name;
  document.getElementById("publicEventMeta").textContent=`📅 ${state.event.date}　⏰ ${state.event.time}　🏆 取前 ${state.event.topN} 名`;
  document.getElementById("publicStatus").textContent="此頁為參賽者公開頁，不需要登入；比賽結果由裁判與主審操作後更新。";
  document.getElementById("publicCourts").innerHTML=state.referees.map((r,i)=>{const m=state.matches.find(x=>x.court===i&&x.status!=="finished");return `<div class="court-card"><h3>${r.court}</h3><div class="muted">${r.connected?"🟢 比賽進行中":"⚪ 等待裁判"}</div>${m?`<div class="match-mini"><strong>${pname(m.p1)} VS ${pname(m.p2)}</strong><div class="match-score">${m.score1} : ${m.score2}</div></div>`:"<div class='notice'>目前無進行中的比賽</div>"}</div>`}).join("");
  const s=document.getElementById("playerSelect");s.innerHTML='<option value="">請選擇玩家</option>'+state.players.map(p=>`<option value="${p.id}">${p.name}</option>`).join("");s.value=state.selectedPlayerId||"";
  document.getElementById("selectedPlayerLabel").textContent=state.selectedPlayerId?pname(state.selectedPlayerId):"尚未選擇";
  const m=state.matches.find(x=>x.status!=="finished"&&(x.p1===state.selectedPlayerId||x.p2===state.selectedPlayerId));
  document.getElementById("playerNext").textContent=m?`🟡 下一場：${pname(m.p1)} VS ${pname(m.p2)}　📍 ${cname(m.court)}`:state.selectedPlayerId?"目前沒有進行中的你的比賽。":"選擇玩家後，系統會標示該玩家的比賽路線。";
  renderPublicBracket();
}
function renderPublicBracket(){
  const b=document.getElementById("publicBracket");
  if(!state.matches.length){b.innerHTML="<div class='notice'>目前尚未產生可公開的對戰。</div>";return}
  b.innerHTML=`<div class="bracket-grid"><div class="round"><h3>目前對戰</h3>${state.matches.map(m=>`<div class="bracket-match"><div class="${m.p1===state.selectedPlayerId?"selected ":""}${m.winner===m.p1?"winner":""}">${pname(m.p1)} ${m.winner===m.p1?"✓":""}</div><div class="${m.p2===state.selectedPlayerId?"selected ":""}${m.winner===m.p2?"winner":""}">${pname(m.p2)} ${m.winner===m.p2?"✓":""}</div></div>`).join("")}</div></div>`;
}

function renderRefereeFromQuery(){
  const code=new URLSearchParams(location.search).get("ref");
  const r=state.referees.find(x=>x.code===code);
  if(!r){document.getElementById("refereeCourtTitle").textContent="無效的裁判 QR Code";document.getElementById("matchPanel").innerHTML="<div class='notice'>請向主審重新取得 QR Code。</div>";return}
  state.referee.court=state.referees.indexOf(r);state.referee.eventId=state.event.id;r.connected=true;save();
  document.getElementById("refereeCourtTitle").textContent=`${r.court} 裁判`;
  document.getElementById("refereeRoleText").textContent=`${state.event.name}・${r.court}`;
  document.getElementById("refereeStatus").textContent="🟢 已連線";
  renderRefereeMatch();
}
function renderRefereeMatch(){
  const court=state.referee.court,m=state.matches.find(x=>x.court===court&&x.status!=="finished"),panel=document.getElementById("matchPanel");
  if(court===null){panel.innerHTML="<div class='notice'>尚未加入場地。</div>";return}
  if(!m){panel.innerHTML="<div class='notice'>目前此場地沒有進行中的比賽。</div>";return}
  const side=(pid,score)=>`<div class="player-side"><div class="player-name">${pname(pid)}</div><div class="score">${score}</div><div class="score-buttons">${[["轉停",1],["爆裂",2],["擊飛",2],["極限",3]].map(([n,p])=>`<button class="score-btn" data-mid="${m.id}" data-pid="${pid}" data-points="${p}" data-type="${n}">${n} +${p}<small>點擊記錄得分</small></button>`).join("")}</div></div>`;
  panel.innerHTML=`<div class="match-main"><div class="match-head"><div class="muted">${cname(court)}・比賽 #${m.id}</div><h3>${pname(m.p1)} VS ${pname(m.p2)}</h3></div><div class="scoreboard">${side(m.p1,m.score1)}${side(m.p2,m.score2)}</div>${m.history.length?`<div class="match-history"><strong>得分紀錄</strong>${m.history.map(h=>`<div class="history-item">${h.player}・${h.type} +${h.points}</div>`).join("")}</div>`:""}<div class="notice">規則：先達 <strong>4 分</strong>者獲勝。</div></div>`;
  panel.querySelectorAll(".score-btn").forEach(b=>b.addEventListener("click",()=>addScore(+b.dataset.mid,+b.dataset.pid,+b.dataset.points,b.dataset.type)));
}
function addScore(mid,pid,pts,type){
  const m=state.matches.find(x=>x.id===mid);if(!m||m.status==="finished")return;
  if(pid===m.p1)m.score1+=pts;else m.score2+=pts;
  m.history.push({player:pname(pid),playerId:pid,points:pts,type,at:new Date().toLocaleTimeString()});
  if((pid===m.p1?m.score1:m.score2)>=4){m.status="finished";m.winner=pid;toast(`🏆 ${pname(pid)} 獲勝！`)}
  save();render();
}

// 事件綁定

document.getElementById("hostLoginBtn").addEventListener("click",loginHost);
document.getElementById("backHomeBtn").addEventListener("click",()=>{history.pushState({},"",location.pathname);state.hostLogged=false;state.hostUser=null;sessionStorage.removeItem("85xHostAuthenticated");render()});
document.getElementById("closeModal").addEventListener("click",closeModal);
document.getElementById("modal").addEventListener("click",e=>{if(e.target.id==="modal")closeModal()});
document.getElementById("modalBody").addEventListener("click",e=>{
  if(e.target.id==="googleLoginBtn")doGoogleLogin();
  if(e.target.id==="closeAuthDenied")closeModal();
});
document.getElementById("createEventBtn").addEventListener("click",createEvent);
document.getElementById("logoutHost").addEventListener("click",logout);
document.getElementById("refLogout").addEventListener("click",()=>{history.pushState({},"",location.pathname);state.referee={court:null,eventId:""};render()});
document.getElementById("playerSelect").addEventListener("change",e=>{if(!e.target.value)return;state.selectedPlayerId=+e.target.value;localStorage.setItem("85xSelectedPlayer",state.selectedPlayerId);renderPublic()});
document.getElementById("changePlayer").addEventListener("click",()=>document.getElementById("playerSelect").focus());
window.addEventListener("popstate",render);

(async()=>{
  await restoreAuth();
  await finishOAuth();
  render();
})();
