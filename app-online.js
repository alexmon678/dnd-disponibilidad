const SUPABASE_URL = "https://dpujceghxgicemewqzip.supabase.co";
const SUPABASE_KEY = "sb_publishable_MYANBWkTW5omiy9e2HWNhA_Hio6sQ1_";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let players=[], availability={}, currentDate=new Date(), selectedDate=null;
let polls=[], pollOptions=[], pollVotes=[];
const $=id=>document.getElementById(id);
const playerSelect=$("player"), calendarDays=$("calendarDays"), monthTitle=$("monthTitle");
const dialog=$("availabilityDialog"), statusInput=$("availabilityStatus"), noteInput=$("availabilityNote");

async function loadPlayers(){
 const {data,error}=await supabaseClient.from("jugadores_online").select("*").order("name");
 if(error){console.error(error);showMessage("Error cargando jugadores. Comprueba la clave de Supabase.");return;}
 players=data||[];playerSelect.innerHTML='<option value="">Selecciona tu nombre</option>';
 players.forEach(p=>{const o=document.createElement("option");o.value=p.id;o.textContent=p.name;playerSelect.appendChild(o);});renderCalendar();
}
async function loadAvailability(){
 const start=formatDate(new Date(currentDate.getFullYear(),currentDate.getMonth(),1)),end=formatDate(new Date(currentDate.getFullYear(),currentDate.getMonth()+1,0));
 const {data,error}=await supabaseClient.from("disponibilidad_online").select("*").gte("date",start).lte("date",end);
 if(error){console.error(error);showMessage("Error cargando disponibilidad.");return;}
 availability={};(data||[]).forEach(r=>{availability[r.date]??={};availability[r.date][r.player_id]={available:r.available,note:r.note||""};});
 renderCalendar();if(dialog.open&&selectedDate)renderOtherResponses(selectedDate);
}
function renderCalendar(){
 const year=currentDate.getFullYear(),month=currentDate.getMonth();
 monthTitle.textContent=currentDate.toLocaleDateString("es-ES",{month:"long",year:"numeric"});
 calendarDays.innerHTML="";let offset=new Date(year,month,1).getDay();offset=offset===0?6:offset-1;
 for(let i=0;i<offset;i++){const e=document.createElement("div");e.className="day empty";calendarDays.appendChild(e);}
 for(let day=1;day<=new Date(year,month+1,0).getDate();day++){
  const date=formatDate(new Date(year,month,day)),cell=document.createElement("div");cell.className="day";
  const n=document.createElement("div");n.className="day-number";n.textContent=day;cell.appendChild(n);
  const dots=document.createElement("div");dots.className="players";let count=0;
  players.forEach(p=>{const d=availability[date]?.[p.id],dot=document.createElement("span");dot.className="player-dot";
   dot.style.background=d?.available===true?(p.color||"#22c55e"):d?.available===false?"#ef4444":"#6b7280";
   if(d?.available===true)count++;dot.title=p.name+": "+(d?.available===true?"Disponible":d?.available===false?"No disponible":"Sin responder")+(d?.note?"\n"+d.note:"");if(d?.note)dot.classList.add("has-note");dots.appendChild(dot);});
  cell.appendChild(dots);const c=document.createElement("div");c.className="availability-count";c.textContent=`${count}/${players.length} disponibles`;cell.appendChild(c);
  if(players.length&&count===players.length)cell.style.border="2px solid #22c55e";cell.addEventListener("click",()=>openAvailability(date));calendarDays.appendChild(cell);
 }
}
function openAvailability(date){
 if(!playerSelect.value){showMessage("Primero selecciona tu nombre.");return;}
 selectedDate=date;const d=availability[date]?.[playerSelect.value];$("dialogDate").textContent="Disponibilidad: "+date;
 statusInput.value=d?.available===true?"true":d?.available===false?"false":"null";noteInput.value=d?.note||"";renderOtherResponses(date);dialog.showModal();
}
function renderOtherResponses(date){
 const box=$("otherResponses");box.innerHTML="";
 players.forEach(p=>{const d=availability[date]?.[p.id],card=document.createElement("div");card.className="response-card";
 const h=document.createElement("div");h.className="response-header";const dot=document.createElement("span");dot.className="response-dot";dot.style.background=d?.available===true?"#22c55e":d?.available===false?"#ef4444":"#6b7280";
 const name=document.createElement("strong");name.textContent=p.name;const state=document.createElement("span");state.className="response-status";state.textContent=d?.available===true?"Disponible":d?.available===false?"No disponible":"Sin responder";
 h.append(dot,name,state);const note=document.createElement("p");note.className="response-note";note.textContent=d?.note?.trim()||"Sin anotaciones.";card.append(h,note);box.appendChild(card);});
}
$("saveAvailability").addEventListener("click",async()=>{
 if(!playerSelect.value||!selectedDate)return showMessage("Selecciona tu nombre y un día.");
 const available=statusInput.value==="null"?null:statusInput.value==="true",note=noteInput.value.trim();
 const {error}=await supabaseClient.from("disponibilidad_online").upsert({player_id:playerSelect.value,date:selectedDate,available,note},{onConflict:"player_id,date"});
 if(error){console.error(error);return showMessage("Error guardando disponibilidad.");}
 availability[selectedDate]??={};availability[selectedDate][playerSelect.value]={available,note};dialog.close();renderCalendar();showMessage("Disponibilidad guardada.");
});
$("cancelAvailability").addEventListener("click",()=>dialog.close());
$("previousMonth").addEventListener("click",async()=>{currentDate.setDate(1);currentDate.setMonth(currentDate.getMonth()-1);await loadAvailability();});
$("nextMonth").addEventListener("click",async()=>{currentDate.setDate(1);currentDate.setMonth(currentDate.getMonth()+1);await loadAvailability();});
playerSelect.addEventListener("change",()=>{renderCalendar();renderPolls();});

document.querySelectorAll(".tab-button").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll(".tab-button").forEach(x=>x.classList.toggle("active",x===b));document.querySelectorAll(".tab-panel").forEach(p=>p.classList.toggle("hidden",p.id!==b.dataset.tab));if(b.dataset.tab==="pollsPanel")loadPolls();}));
$("masterPanelToggle").addEventListener("click",()=>$("masterPanel").classList.toggle("hidden"));
$("createPollForm").addEventListener("submit",async e=>{
 e.preventDefault();const options=$("pollOptions").value.split("\n").map(x=>x.trim()).filter(Boolean);
 if(options.length<2)return pollMessage("Escribe al menos dos opciones.");
 const raw=$("pollClosesAt").value,closes=raw?new Date(raw).toISOString():null;
 const {error}=await supabaseClient.rpc("create_poll_online",{p_password:$("masterPassword").value,p_title:$("pollTitle").value.trim(),p_description:$("pollDescription").value.trim(),p_closes_at:closes,p_options:options});
 if(error){console.error(error);return pollMessage("No se pudo crear: "+error.message);}
 pollMessage("Votación creada.");$("createPollForm").reset();await loadPolls();
});
async function loadPolls(){
 const list=$("pollList");list.textContent="Cargando votaciones...";
 const [p,o,v]=await Promise.all([supabaseClient.from("votaciones_online").select("*").order("created_at",{ascending:false}),supabaseClient.from("opciones_votacion_online").select("*").order("position"),supabaseClient.from("votos_online").select("*")]);
 if(p.error||o.error||v.error){console.error(p.error||o.error||v.error);list.textContent="Error cargando votaciones. Revisa el SQL y las políticas RLS.";return;}
 polls=p.data||[];pollOptions=o.data||[];pollVotes=v.data||[];renderPolls();
}
function renderPolls(){
 const list=$("pollList");list.innerHTML="";
 if(!polls.length){list.textContent="Todavía no hay votaciones.";return;}
 polls.forEach(p=>{
  const opts=pollOptions.filter(o=>o.poll_id===p.id),votes=pollVotes.filter(v=>v.poll_id===p.id),expired=p.closes_at&&new Date(p.closes_at)<=new Date(),closed=p.is_closed||expired;
  const card=document.createElement("article");card.className="poll-card";const head=document.createElement("div");head.className="poll-heading";const title=document.createElement("h3");title.textContent=p.title;const badge=document.createElement("span");badge.className="poll-badge "+(closed?"closed":"open");badge.textContent=closed?"Cerrada":"Abierta";head.append(title,badge);card.appendChild(head);
  if(p.description){const desc=document.createElement("p");desc.textContent=p.description;card.appendChild(desc);}
  if(p.closes_at){const date=document.createElement("p");date.className="muted small";date.textContent="Cierra: "+new Date(p.closes_at).toLocaleString("es-ES");card.appendChild(date);}
  const ownOptions=new Set(votes.filter(v=>String(v.player_id)===String(playerSelect.value)).map(v=>String(v.option_id))),optionsBox=document.createElement("div");optionsBox.className="poll-options";
  opts.forEach(o=>{const optionVotes=votes.filter(v=>String(v.option_id)===String(o.id)),n=optionVotes.length,percent=votes.length?Math.round(n/votes.length*100):0,label=document.createElement("label");label.className="poll-option";
   const radio=document.createElement("input");radio.type="checkbox";radio.name="poll-"+p.id;radio.checked=ownOptions.has(String(o.id));radio.disabled=closed;const text=document.createElement("span");text.className="poll-option-name";text.textContent=o.label;const result=document.createElement("span");result.className="poll-result";result.textContent=`${n} voto(s) · ${percent}%`;const progress=document.createElement("span");progress.className="poll-progress";const bar=document.createElement("span");bar.style.width=percent+"%";progress.appendChild(bar);label.append(radio,text,result,progress);
   const voterNames=optionVotes.map(v=>players.find(pl=>String(pl.id)===String(v.player_id))?.name||"Jugador desconocido");const voters=document.createElement("div");voters.className="poll-voters";voters.textContent=voterNames.length?"Han votado: "+voterNames.join(", "):"Sin votos todavía";label.appendChild(voters);
   radio.addEventListener("change",()=>{if(playerSelect.value)castVote(p.id,o.id,radio.checked);else{radio.checked=false;pollMessage("Primero selecciona tu nombre en el desplegable de arriba para poder votar.");}});optionsBox.appendChild(label);});
  card.appendChild(optionsBox);const footer=document.createElement("p");footer.className="muted small";footer.textContent=`${votes.length} voto(s) en total`;card.appendChild(footer);
  if(!playerSelect.value&&!closed){const hint=document.createElement("p");hint.className="muted small";hint.textContent="Selecciona tu nombre para votar.";card.appendChild(hint);}
  const controls=document.createElement("div");controls.className="poll-admin-controls";const close=document.createElement("button");close.textContent="Cerrar votación";close.disabled=closed;close.addEventListener("click",()=>closePoll(p.id));controls.appendChild(close);const del=document.createElement("button");del.textContent="Borrar votación";del.className="delete-poll-button";del.addEventListener("click",()=>deletePoll(p.id));controls.appendChild(del);card.appendChild(controls);list.appendChild(card);
 });
}
async function castVote(pollId,optionId,selected){
 if(!playerSelect.value)return pollMessage("Selecciona tu nombre para votar.");
 const playerId=playerSelect.value;
 const previous=pollVotes.slice();
 if(selected){if(!pollVotes.some(v=>String(v.poll_id)===String(pollId)&&String(v.option_id)===String(optionId)&&String(v.player_id)===String(playerId)))pollVotes.push({poll_id:pollId,option_id:optionId,player_id:playerId,created_at:new Date().toISOString()});}
 else pollVotes=pollVotes.filter(v=>!(String(v.poll_id)===String(pollId)&&String(v.option_id)===String(optionId)&&String(v.player_id)===String(playerId)));
 renderPolls();pollMessage("Guardando selección...");
 const {error}=await supabaseClient.rpc("set_poll_vote_online",{p_poll_id:pollId,p_option_id:optionId,p_player_id:playerId,p_selected:selected});
 if(error){console.error(error);pollVotes=previous;renderPolls();return pollMessage("No se pudo guardar el voto: "+error.message);}
 pollMessage(selected?"Opción seleccionada.":"Opción desmarcada.");
 const {data,error:refreshError}=await supabaseClient.from("votos_online").select("*");
 if(!refreshError){pollVotes=data||[];renderPolls();}
}
async function deletePoll(id){
 const password=prompt("Contraseña del Máster para borrar esta votación:");
 if(!password)return;
 if(!confirm("¿Borrar esta votación y todos sus votos? Esta acción no se puede deshacer."))return;
 const {error}=await supabaseClient.rpc("delete_poll_online",{p_password:password,p_poll_id:id});
 if(error){console.error(error);return pollMessage("No se pudo borrar: "+error.message);}
 pollMessage("Votación borrada.");await loadPolls();
}
async function closePoll(id){
 const password=prompt("Contraseña del Máster:");
 if(!password)return;const {error}=await supabaseClient.rpc("close_poll_online",{p_password:password,p_poll_id:id});
 if(error){console.error(error);return pollMessage("No se pudo cerrar: "+error.message);}
 pollMessage("Votación cerrada.");await loadPolls();
}
function pollMessage(t){$("pollMessage").textContent=t;}
function showMessage(t){$("message").textContent=t;}
function formatDate(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
supabaseClient.channel("availability-changes").on("postgres_changes",{event:"*",schema:"public",table:"disponibilidad_online"},loadAvailability).subscribe();
supabaseClient.channel("poll-changes").on("postgres_changes",{event:"*",schema:"public",table:"votaciones_online"},loadPolls).on("postgres_changes",{event:"*",schema:"public",table:"opciones_votacion_online"},loadPolls).on("postgres_changes",{event:"*",schema:"public",table:"votos_online"},loadPolls).subscribe();
loadPlayers();loadAvailability();
