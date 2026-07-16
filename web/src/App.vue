<script setup>
import { ref, computed, onMounted } from 'vue';
import { LayoutDashboard, Utensils, ShoppingBasket, WalletCards, ReceiptText, Users, BarChart3, Settings, Bell, Search, ChevronDown, ArrowUpRight, ArrowDownRight, Plus, CalendarDays, MoreHorizontal, X, LogOut, CheckCircle2, LoaderCircle, Menu, Sparkles, CircleDollarSign, Trash2, ShieldCheck, LockKeyhole } from 'lucide-vue-next';
import AdminActions from './components/AdminActions.vue';
import SearchSelect from './components/SearchSelect.vue';

const API = import.meta.env.VITE_API_URL || '';
const token = ref(localStorage.getItem('picomess_token') || '');
const user = ref(JSON.parse(localStorage.getItem('picomess_user') || 'null'));
const passwordForm = ref({ currentPassword:'D123', newPassword:'', confirmPassword:'' });
const accountPasswordForm = ref({ currentPassword:'', newPassword:'', confirmPassword:'' });
const memberPasswordForm = ref({ newPassword:'', confirmPassword:'' });
const accountPasswordModal = ref(false), memberPasswordTarget = ref(null), memberPasswordMessId = ref(null), profileMenu = ref(false);
const settingsMesses = ref([]);
const cycles = ref([]), selectedCycleId = ref(null);
const messForm = ref({name:'',address:'',currency:'BDT'});
const cycleForm = ref({messId:null,year:new Date().getFullYear(),month:new Date().getMonth()+1});
const managedMessId = ref(null), managedCycles = ref([]), managedMembers = ref([]);
const editMessForm = ref({id:null,name:'',address:'',currency:'BDT'});
const editCycleForm = ref({id:null,year:new Date().getFullYear(),month:new Date().getMonth()+1});
const managedMemberForm = ref({name:'',email:'',role:'member'});
const allUsers = ref([]), editingUser = ref(null);
const adminMessId = ref(Number(localStorage.getItem('picomess_admin_mess')) || null);
const mealMemberFilter = ref('all');
const reportMemberId = ref('');
const reportMemberSearch = ref('');
const reportMemberPickerOpen = ref(false);
const monthOptions = Array.from({length:12},(_,index)=>({value:index+1,label:new Date(2026,index).toLocaleDateString('en',{month:'long'})}));
const currencyOptions = [{value:'BDT',label:'BDT — Bangladeshi Taka'},{value:'USD',label:'USD — US Dollar'},{value:'INR',label:'INR — Indian Rupee'}];
const roleOptions = [{value:'member',label:'Member'},{value:'manager',label:'Manager'}];
const paymentOptions = ['cash','bkash','nagad','bank','other'].map((value)=>({value,label:value==='bkash'?'bKash':value[0].toUpperCase()+value.slice(1)}));
const categoryOptions = ['utility','rent','servant','maintenance','other'].map((value)=>({value,label:value==='servant'?'House help':value[0].toUpperCase()+value.slice(1)}));
const splitOptions = [{value:'equal',label:'Equally among active members'},{value:'meal_based',label:'Based on meal ratio'}];
const unitOptions = ['kg','liter','pcs','lot'].map((value)=>({value,label:value}));
const messOptions = computed(()=>settingsMesses.value.map((mess)=>({value:mess.id,label:mess.name})));
const memberOptions = computed(()=>visibleMembers.value.map((member)=>({value:member.id,label:member.name})));
const mealFilterOptions = computed(()=>[{value:'all',label:'All users'},...memberOptions.value.map((member)=>({value:String(member.value),label:member.label}))]);
const cycleOptions = computed(()=>cycles.value.map((cycle)=>({value:cycle.id,label:cycleOptionLabel(cycle)})));
const managedCycleOptions = computed(()=>[{value:null,label:'Select an open cycle'},...managedCycles.value.map((cycle)=>({value:cycle.id,label:`${cycleOptionLabel(cycle)}${cycle.status==='closed'?' (locked)':''}`,disabled:cycle.status==='closed'}))]);
const data = ref(null), loading = ref(false), error = ref(''), active = ref('Overview'), modal = ref(''), toast = ref(''), mobileNav = ref(false);
const editingId = ref(null);
const form = ref({});
const nav = [
  { label:'Overview', icon:LayoutDashboard }, { label:'Meals', icon:Utensils }, { label:'Bazar', icon:ShoppingBasket },
  { label:'Deposits', icon:WalletCards }, { label:'Other costs', icon:ReceiptText }, { label:'Members', icon:Users }, { label:'Reports', icon:BarChart3 }
];
const currency = computed(() => data.value?.mess.currency === 'BDT' ? '৳' : data.value?.mess.currency || '৳');
const isManager = computed(() => isSuperAdmin.value || data.value?.mess.role === 'manager');
const isSuperAdmin = computed(() => user.value?.systemRole === 'super_admin');
const canManageMemberPasswords = computed(() => isManager.value || isSuperAdmin.value);
const cycleLocked = computed(() => data.value?.cycle.status === 'closed');
const canEditCycle = computed(() => !cycleLocked.value || isSuperAdmin.value);
const visibleMembers = computed(() => (data.value?.members || []).filter((m) => m.membershipStatus !== 'inactive'));
const currentMember = computed(() => data.value?.members.find((m) => m.email === user.value?.email));
const filteredMeals = computed(() => mealMemberFilter.value==='all' ? (data.value?.meals || []) : (data.value?.meals || []).filter((row) => String(row.memberId)===mealMemberFilter.value));
const selectedReportMember = computed(() => { const members=data.value?.summary?.members || []; return members.find((m)=>String(m.id)===reportMemberId.value)||members[0]||null; });
const filteredReportMembers = computed(() => { const terms=reportMemberSearch.value.toLowerCase().trim().split(/\s+/).filter(Boolean);return [...(data.value?.summary?.members||[])].filter((m)=>terms.every((term)=>m.name.toLowerCase().includes(term))).sort((a,b)=>a.name.localeCompare(b.name)); });
const modalTitle = computed(() => modal.value==='cycle' ? 'Open next cycle' : `${editingId.value ? 'Edit' : ({meal:'Log',bazar:'Add',deposit:'Record',cost:'Add',member:'Invite'}[modal.value])} ${{meal:'daily meals',bazar:'bazar entry',deposit:'deposit',cost:'shared cost',member:'member'}[modal.value] || ''}`);
const bazarGrandTotal = computed(() => (form.value.items || []).reduce((sum,item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0));
const cycleName = computed(() => data.value ? new Date(data.value.cycle.year, data.value.cycle.month-1).toLocaleDateString('en',{month:'long',year:'numeric'}) : '');
const fmt = (v) => `${currency.value}${Math.round(Number(v || 0)).toLocaleString('en-US')}`;
const dateFmt = (d) => new Date(`${d}T00:00:00`).toLocaleDateString('en',{day:'numeric',month:'short'});
const member = (id) => data.value?.members.find(x => x.id === id) || {};

async function request(path, options={}) { let res;try{res=await fetch(`${API}${path}`, { ...options, headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token.value}`, ...options.headers } });}catch(networkError){throw new Error(`Network error: ${networkError.message}`)}const json = await res.json().catch(()=>({})); if(res.status===401&&path!=='/api/auth/login'){logout();throw new Error(json.message||'Your session has expired')}if (!res.ok) throw new Error(json.message || `Request failed: ${res.status} ${res.statusText}`); return json; }
async function login() { loading.value=true; error.value=''; try { const result=await request('/api/auth/login',{method:'POST',body:JSON.stringify(form.value)}); token.value=result.token; user.value=result.user; localStorage.setItem('picomess_token',result.token); localStorage.setItem('picomess_user',JSON.stringify(result.user)); if(!result.user.mustChangePassword) await load(); } catch(e){ error.value=e.message } finally { loading.value=false } }
async function changePassword(){error.value='';if(passwordForm.value.newPassword!==passwordForm.value.confirmPassword){error.value='New passwords do not match';return}loading.value=true;try{const result=await request('/api/auth/change-password',{method:'POST',body:JSON.stringify(passwordForm.value)});token.value=result.token;user.value=result.user;localStorage.setItem('picomess_token',result.token);localStorage.setItem('picomess_user',JSON.stringify(result.user));passwordForm.value={currentPassword:'',newPassword:'',confirmPassword:''};await load();flash('Password changed successfully')}catch(e){error.value=e.message}finally{loading.value=false}}
function openAccountPassword(){profileMenu.value=false;error.value='';accountPasswordForm.value={currentPassword:'',newPassword:'',confirmPassword:''};accountPasswordModal.value=true;}
async function updateAccountPassword(){if(accountPasswordForm.value.newPassword!==accountPasswordForm.value.confirmPassword){error.value='New passwords do not match';return}loading.value=true;error.value='';try{const result=await request('/api/auth/change-password',{method:'POST',body:JSON.stringify(accountPasswordForm.value)});token.value=result.token;user.value=result.user;localStorage.setItem('picomess_token',result.token);localStorage.setItem('picomess_user',JSON.stringify(result.user));accountPasswordModal.value=false;flash('Password updated successfully')}catch(e){error.value=e.message}finally{loading.value=false}}
function openMemberPassword(item,messId=data.value?.mess.id){error.value='';memberPasswordTarget.value=item;memberPasswordMessId.value=messId;memberPasswordForm.value={newPassword:'',confirmPassword:''};}
async function updateMemberPassword(){if(memberPasswordForm.value.newPassword!==memberPasswordForm.value.confirmPassword){error.value='New passwords do not match';return}loading.value=true;error.value='';try{await request(`/api/messes/${memberPasswordMessId.value}/members/${memberPasswordTarget.value.id}/password`,{method:'PUT',body:JSON.stringify({newPassword:memberPasswordForm.value.newPassword})});const name=memberPasswordTarget.value.name;memberPasswordTarget.value=null;memberPasswordMessId.value=null;flash(`${name} must change this password at next sign-in`)}catch(e){error.value=e.message}finally{loading.value=false}}
async function loadAdminWorkspace(){if(!adminMessId.value)return;localStorage.setItem('picomess_admin_mess',String(adminMessId.value));cycles.value=await request(`/api/admin/messes/${adminMessId.value}/cycles`);const cycle=cycles.value.find(x=>x.status==='open')||cycles.value[0];if(!cycle){data.value=null;active.value='Settings';return;}selectedCycleId.value=cycle.id;data.value=await request(`/api/admin/cycles/${cycle.id}/dashboard`);}
async function switchAdminMess(){loading.value=true;error.value='';try{await loadAdminWorkspace();active.value='Overview'}catch(e){error.value=e.message}finally{loading.value=false}}
async function load() { if(!token.value) return; loading.value=true; try { const profile=await request('/api/auth/me');user.value=profile;localStorage.setItem('picomess_user',JSON.stringify(profile));if(profile.systemRole==='super_admin'){settingsMesses.value=await request('/api/messes');if(!adminMessId.value||!settingsMesses.value.some(x=>x.id===adminMessId.value))adminMessId.value=settingsMesses.value[0]?.id||null;await loadAdminWorkspace();return;}const dashboard=await request('/api/dashboard');data.value=dashboard;selectedCycleId.value=dashboard.cycle.id;cycles.value=await request(`/api/messes/${dashboard.mess.id}/cycles`); } catch(e){ if(e.message.includes('sign in')) logout(); else error.value=e.message } finally { loading.value=false } }
async function switchCycle(){if(!selectedCycleId.value||selectedCycleId.value===data.value?.cycle.id)return;loading.value=true;error.value='';try{data.value=await request(isSuperAdmin.value?`/api/admin/cycles/${selectedCycleId.value}/dashboard`:`/api/cycles/${selectedCycleId.value}/dashboard`);mealMemberFilter.value='all';flash(`Showing ${cycleName.value}`)}catch(e){error.value=e.message;selectedCycleId.value=data.value?.cycle.id}finally{loading.value=false}}
function cycleOptionLabel(cycle){const name=new Date(cycle.year,cycle.month-1).toLocaleDateString('en',{month:'long',year:'numeric'});return `${name} · ${cycle.status}`}
function logout(){ token.value='';user.value=null;data.value=null;localStorage.removeItem('picomess_token');localStorage.removeItem('picomess_user'); }
function open(type){ editingId.value=null; modal.value=type; error.value=''; const now=new Date().toISOString().slice(0,10), defaultMember=(type==='meal'&&!isManager.value?currentMember.value:visibleMembers.value[0]) || data.value.members[0]; form.value={ date:now, memberId:defaultMember?.id, breakfast:1,lunch:1,dinner:1,guest:0,method:'cash',category:'utility',splitType:'equal',role:'member',items:[{product:'',quantity:1,unit:'kg',unitPrice:0}] }; }
function openNextCycle(){const date=new Date(data.value.cycle.year,data.value.cycle.month);editingId.value=null;modal.value='cycle';error.value='';form.value={year:date.getFullYear(),month:date.getMonth()+1};}
function openEdit(type,row){editingId.value=row.id;modal.value=type;error.value='';form.value=JSON.parse(JSON.stringify(row));if(type==='bazar'&&!Array.isArray(form.value.items))form.value.items=[];}
function flash(message){toast.value=message;setTimeout(()=>toast.value='',2800)}
function dismissError(){error.value=''}
function selectReportMember(member){reportMemberId.value=String(member.id);reportMemberSearch.value=member.name;reportMemberPickerOpen.value=false;}
function downloadMemberReport(){const member=selectedReportMember.value;if(!member||!data.value)return;const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d'),w=1400,h=1800;canvas.width=w;canvas.height=h;const cycle=data.value.cycle,summary=data.value.summary,totals=summary.totals,rate=summary.cycle.mealRate,drawCard=(x,y,width,height,fill='#fff')=>{ctx.fillStyle=fill;ctx.beginPath();ctx.roundRect(x,y,width,height,28);ctx.fill();},drawText=(text,x,y,size,color='#20212d',weight='400')=>{ctx.fillStyle=color;ctx.font=`${weight} ${size}px Tahoma`;ctx.fillText(String(text),x,y);};ctx.fillStyle='#f6f7fb';ctx.fillRect(0,0,w,h);ctx.fillStyle='#6958ef';ctx.fillRect(0,0,w,390);ctx.fillStyle='#ffffff1c';ctx.beginPath();ctx.arc(1240,60,260,0,Math.PI*2);ctx.fill();drawText('P',92,177,112,'#fff','700');drawText('PicoMess',190,134,44,'#fff','700');drawText('MEMBER SETTLEMENT REPORT',94,240,24,'#ddd8ff','700');drawText(cycleName.value,94,292,52,'#fff','700');drawCard(70,340,w-140,230);drawText(member.name,112,412,42,'#20212d','700');drawText(member.email||'Member account',112,454,24,'#6d7080');drawText('STATUS',1040,408,19,'#8b8d9b','700');drawText(member.status.toUpperCase(),1040,450,27,member.status==='due'?'#c5483d':member.status==='refund'?'#168d67':'#6958ef','700');drawText('Cycle expense',112,525,19,'#8b8d9b','700');drawText(fmt(totals.bazar+totals.otherCost),112,557,31,'#20212d','700');const metrics=[['Total meals',member.meals,'#6958ef'],['Meal rate',fmt(rate),'#6958ef'],['Meal cost',fmt(member.mealCost),'#6958ef'],['Shared expense',fmt(member.otherShare),'#6958ef'],['Total cost',fmt(member.totalCost),'#20212d'],['Paid / deposit',fmt(member.deposit),'#168d67'],['Amount due',member.balance<0?fmt(Math.abs(member.balance)):fmt(0),'#c5483d'],['Refund amount',member.balance>0?fmt(member.balance):fmt(0),'#168d67']];metrics.forEach((item,index)=>{const col=index%2,row=Math.floor(index/2),x=70+col*635,y=630+row*190;drawCard(x,y,595,155);drawText(item[0],x+34,y+52,21,'#8b8d9b','700');drawText(item[1],x+34,y+112,38,item[2],'700');});drawCard(70,1430,w-140,210,'#20212d');drawText('Final balance',112,1502,24,'#d8d5ee','700');drawText(fmt(member.balance),112,1584,62,'#fff','700');drawText(member.balance<0?'Amount to pay':member.balance>0?'Amount to receive':'Settled',940,1502,22,'#d8d5ee','700');drawText(member.status.toUpperCase(),940,1580,42,member.status==='due'?'#ff9b91':member.status==='refund'?'#71e0b1':'#dcd8ff','700');drawText(`Generated by PicoMess · ${new Date().toLocaleDateString()}`,70,1715,19,'#8b8d9b');canvas.toBlob((blob)=>{if(!blob){error.value='Could not generate the report image';return;}const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`picomess-${member.name.replace(/[^a-z0-9]+/gi,'-').toLowerCase()}-${cycle.year}-${String(cycle.month).padStart(2,'0')}-report.png`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},'image/png');}
async function submit(){ loading.value=true; error.value=''; try { let path='', payload={...form.value}; if(modal.value==='meal') path=`/api/cycles/${data.value.cycle.id}/meals`; if(modal.value==='deposit') path=`/api/cycles/${data.value.cycle.id}/deposits`; if(modal.value==='cost') path=`/api/cycles/${data.value.cycle.id}/costs`; if(modal.value==='bazar') path=`/api/cycles/${data.value.cycle.id}/bazar`; if(modal.value==='member') path=`/api/messes/${data.value.mess.id}/members`; if(modal.value==='cycle'){path=`/api/messes/${data.value.mess.id}/cycles`;payload={year:Number(form.value.year),month:Number(form.value.month)}} const kind=modal.value,wasEditing=Boolean(editingId.value);if(wasEditing)path+=`/${editingId.value}`;await request(path,{method:wasEditing?'PUT':'POST',body:JSON.stringify(payload)});modal.value='';editingId.value=null;await load();flash(kind==='member'?'Member added · temporary password D123':kind==='cycle'?'New cycle opened':wasEditing?'Updated successfully':'Saved successfully'); } catch(e){error.value=e.message} finally{loading.value=false} }
async function removeEntry(type,row){if(!confirm(`Delete this ${type} record? This cannot be undone.`))return;const paths={meal:'meals',bazar:'bazar',deposit:'deposits',cost:'costs'};loading.value=true;try{await request(`/api/cycles/${data.value.cycle.id}/${paths[type]}/${row.id}`,{method:'DELETE'});await load();flash('Deleted successfully')}catch(e){error.value=e.message;flash(e.message)}finally{loading.value=false}}
async function confirmMeal(row){if(!confirm(`Confirm ${member(row.memberId).name}'s meal entry? The member will no longer be able to change it.`))return;loading.value=true;error.value='';try{await request(`/api/cycles/${data.value.cycle.id}/meals/${row.id}/confirm`,{method:'PUT'});await load();flash('Meal confirmed')}catch(e){error.value=e.message}finally{loading.value=false}}
async function toggleMember(item){await request(`/api/cycles/${data.value.cycle.id}/members/${item.id}`,{method:'PATCH',body:JSON.stringify({active:!item.active})});await load();}
async function changeRole(item,event){const role=event.target.value;try{await request(`/api/messes/${data.value.mess.id}/members/${item.id}`,{method:'PUT',body:JSON.stringify({role,status:'active'})});await load();flash(`${item.name} is now a ${role}`)}catch(e){error.value=e.message;await load()}}
async function removeMember(item){if(!confirm(`Remove ${item.name} from this mess? Historical records will be kept.`))return;try{await request(`/api/messes/${data.value.mess.id}/members/${item.id}`,{method:'DELETE'});await load();flash('Member removed')}catch(e){error.value=e.message;flash(e.message)}}
async function closeCycle(){if(!confirm('Close this month? Entries will be finalized.'))return;loading.value=true;try{await request(`/api/cycles/${data.value.cycle.id}/close`,{method:'PUT'});await load();flash('Monthly cycle closed')}catch(e){error.value=e.message}finally{loading.value=false}}
async function reopenCycle(){if(!confirm('Reopen this closed cycle? Its figures will be recalculated when it is closed again.'))return;loading.value=true;error.value='';try{await request(`/api/admin/cycles/${data.value.cycle.id}/reopen`,{method:'PUT'});await loadAdminWorkspace();flash('Cycle reopened')}catch(e){error.value=e.message}finally{loading.value=false}}
async function loadManagedMess(){if(!managedMessId.value)return;const mess=settingsMesses.value.find(x=>x.id===managedMessId.value);if(mess)editMessForm.value={id:mess.id,name:mess.name,address:mess.address||'',currency:mess.currency};const [cyclesResult,membersResult]=await Promise.all([request(`/api/admin/messes/${managedMessId.value}/cycles`),request(`/api/admin/messes/${managedMessId.value}/members`)]);managedCycles.value=cyclesResult;managedMembers.value=membersResult;editCycleForm.value={id:null,year:new Date().getFullYear(),month:new Date().getMonth()+1};}
async function loadSettings(){if(!isSuperAdmin.value)return;const [messes,users]=await Promise.all([request('/api/messes'),request('/api/admin/users')]);settingsMesses.value=messes;allUsers.value=users;if(!cycleForm.value.messId&&settingsMesses.value.length)cycleForm.value.messId=settingsMesses.value[0].id;if(!managedMessId.value&&settingsMesses.value.length)managedMessId.value=settingsMesses.value[0].id;await loadManagedMess();}
async function createMess(){loading.value=true;error.value='';try{await request('/api/messes',{method:'POST',body:JSON.stringify(messForm.value)});messForm.value={name:'',address:'',currency:'BDT'};await loadSettings();flash('New mess created')}catch(e){error.value=e.message}finally{loading.value=false}}
async function createCycle(){loading.value=true;error.value='';try{await request(`/api/messes/${cycleForm.value.messId}/cycles`,{method:'POST',body:JSON.stringify({year:Number(cycleForm.value.year),month:Number(cycleForm.value.month)})});await loadSettings();flash('New monthly cycle opened')}catch(e){error.value=e.message}finally{loading.value=false}}
function selectManagedCycle(value){const cycle=managedCycles.value.find(x=>x.id===Number(value));editCycleForm.value=cycle?{id:cycle.id,year:cycle.year,month:cycle.month}:{id:null,year:new Date().getFullYear(),month:new Date().getMonth()+1};}
async function updateMess(){loading.value=true;error.value='';try{await request(`/api/admin/messes/${editMessForm.value.id}`,{method:'PUT',body:JSON.stringify({name:editMessForm.value.name,address:editMessForm.value.address,currency:editMessForm.value.currency})});await loadSettings();flash('Mess updated')}catch(e){error.value=e.message}finally{loading.value=false}}
async function deleteManagedMess(){const name=editMessForm.value.name;if(!confirm(`Delete ${name}? This permanently removes its members, cycles, and records.`))return;loading.value=true;error.value='';try{await request(`/api/admin/messes/${editMessForm.value.id}`,{method:'DELETE'});managedMessId.value=null;managedCycles.value=[];managedMembers.value=[];await loadSettings();flash('Mess deleted')}catch(e){error.value=e.message}finally{loading.value=false}}
async function updateCycle(){if(!editCycleForm.value.id)return;loading.value=true;error.value='';try{await request(`/api/admin/cycles/${editCycleForm.value.id}`,{method:'PUT',body:JSON.stringify({year:Number(editCycleForm.value.year),month:Number(editCycleForm.value.month)})});await loadManagedMess();flash('Cycle updated')}catch(e){error.value=e.message}finally{loading.value=false}}
async function deleteManagedCycle(){if(!editCycleForm.value.id)return;const deletedId=editCycleForm.value.id,label=cycleOptionLabel(editCycleForm.value);if(!confirm(`Delete ${label}? This permanently removes every record in this cycle.`))return;loading.value=true;error.value='';try{await request(`/api/admin/cycles/${deletedId}`,{method:'DELETE'});await loadManagedMess();if(data.value?.cycle.id===deletedId){const replacement=managedCycles.value.find(x=>x.status==='open')||managedCycles.value[0];if(replacement){selectedCycleId.value=replacement.id;data.value=await request(`/api/admin/cycles/${replacement.id}/dashboard`)}else{data.value=null;active.value='Settings';selectedCycleId.value=null;}}flash('Cycle and its records deleted')}catch(e){error.value=e.message}finally{loading.value=false}}
async function addManagedMember(){loading.value=true;error.value='';try{await request(`/api/messes/${managedMessId.value}/members`,{method:'POST',body:JSON.stringify(managedMemberForm.value)});managedMemberForm.value={name:'',email:'',role:'member'};await loadManagedMess();flash('Member added to this mess')}catch(e){error.value=e.message}finally{loading.value=false}}
async function changeManagedMemberRole(item,role){loading.value=true;error.value='';try{await request(`/api/messes/${managedMessId.value}/members/${item.id}`,{method:'PUT',body:JSON.stringify({role,status:item.status})});await loadManagedMess();flash(`${item.name}'s role updated`)}catch(e){error.value=e.message}finally{loading.value=false}}
async function removeManagedMember(item){if(!confirm(`Remove ${item.name} from ${editMessForm.value.name}? Their other mess assignments will remain.`))return;loading.value=true;error.value='';try{await request(`/api/messes/${managedMessId.value}/members/${item.id}`,{method:'DELETE'});await loadManagedMess();flash('Member removed from this mess')}catch(e){error.value=e.message}finally{loading.value=false}}
function openUserEditor(item){error.value='';editingUser.value={...item,phone:item.phone||''};}
async function updateUser(){loading.value=true;error.value='';try{await request(`/api/admin/users/${editingUser.value.id}`,{method:'PUT',body:JSON.stringify({name:editingUser.value.name,email:editingUser.value.email,phone:editingUser.value.phone||null,isActive:Boolean(editingUser.value.isActive)})});editingUser.value=null;await loadSettings();flash('User updated')}catch(e){error.value=e.message}finally{loading.value=false}}
async function go(label){active.value=label;mobileNav.value=false;if(label==='Settings')await loadSettings();}
onMounted(()=>{form.value={email:'',password:''};if(token.value&&!user.value?.mustChangePassword)load()});
</script>

<template>
  <div v-if="!token" class="login-shell">
    <div class="login-art">
      <div class="brand light">
<span class="brand-mark">
<Utensils :size="20"/>
</span>
<span>PicoMess</span>
</div>
      <div class="art-copy">
<span class="eyebrow dark">
<Sparkles :size="14"/> Shared living, simplified</span>
<h1>More meals.<br/>Less math.</h1>
<p>One calm place for groceries, meals, deposits, and the numbers that bring everyone together.</p>
</div>
      <div class="float-card">
<div>
<span>July meal rate</span>
<strong>৳104.80</strong>
</div>
<div class="mini-chart">
<i v-for="h in [35,55,42,72,60,88,68]" :style="{height:h+'%'}">
</i>
</div>
</div>
      <div class="grain">
</div>
    </div>
    <main class="login-form">
<div class="mobile-brand brand">
<span class="brand-mark">
<Utensils :size="20"/>
</span>
<span>PicoMess</span>
</div>
<div class="login-inner">
<span class="eyebrow">Welcome back</span>
<h2>Sign in to your mess</h2>
<p>Keep your shared home running smoothly.</p>
<form @submit.prevent="login">
<label>Email address<input v-model="form.email" type="email" required />
</label>
<label>Password<div class="password">
<input v-model="form.password" type="password" required/>
<button type="button">Forgot?</button>
</div>
</label>
<p v-if="error" class="form-error">{{error}}</p>
<button class="primary full" :disabled="loading">
<LoaderCircle v-if="loading" class="spin" :size="18"/>Sign in <ArrowUpRight v-if="!loading" :size="18"/>
</button>
</form>
<div class="demo-note">
<CheckCircle2 :size="17"/>
<span>Use the account registered in your mess database.</span>
</div>
</div>
<small>© 2026 PicoMess · Crafted for shared homes</small>
</main>
  </div>

  <div v-else-if="user?.mustChangePassword" class="password-change-shell">
    <div class="password-change-card">
      <div class="brand">
<span class="brand-mark">
<Utensils :size="20"/>
</span>
<span>PicoMess</span>
</div>
      <span class="security-icon">
<Settings :size="26"/>
</span>
      <span class="eyebrow">First login security</span>
      <h1>Create your password</h1>
      <p>You signed in with a temporary password. Choose a private password before continuing to your mess.</p>
      <form @submit.prevent="changePassword">
        <label>Temporary password<input v-model="passwordForm.currentPassword" type="password" required/>
</label>
        <label>New password<input v-model="passwordForm.newPassword" type="password" minlength="8" placeholder="At least 8 characters" required/>
</label>
        <label>Confirm new password<input v-model="passwordForm.confirmPassword" type="password" minlength="8" required/>
</label>
        <p v-if="error" class="form-error">{{error}}</p>
        <button class="primary full" :disabled="loading">
<LoaderCircle v-if="loading" class="spin" :size="18"/>Save password and continue</button>
      </form>
      <button class="signout-link" @click="logout">
<LogOut :size="15"/>Sign in with another account</button>
    </div>
  </div>

  <div v-else class="app-shell">
    <aside :class="['sidebar',{open:mobileNav}]">
      <div class="brand">
<span class="brand-mark">
<Utensils :size="20"/>
</span>
<span>PicoMess</span>
<button class="close-nav" @click="mobileNav=false">
<X/>
</button>
</div>
      <div class="mess-picker">
<span class="avatar violet">GV</span>
<div>
<strong v-if="!isSuperAdmin">{{data?.mess.name || 'Loading'}}</strong>
<SearchSelect v-else v-model="adminMessId" :options="messOptions" @change="switchAdminMess"/>
<small>{{isSuperAdmin?'Super-admin workspace':'Manager workspace'}}</small>
</div>
<ChevronDown :size="16"/>
</div>
      <nav>
<span class="nav-title">Workspace</span>
<button v-for="item in nav" :class="{active:active===item.label}" @click="go(item.label)">
<component :is="item.icon" :size="19"/>
<span>{{item.label}}</span>
<i v-if="item.label==='Members'">{{visibleMembers.length}}</i>
</button>
</nav>
      <div class="side-bottom">
<button v-if="isSuperAdmin" :class="{active:active==='Settings'}" @click="go('Settings')">
<Settings :size="19"/>System settings</button>
<button @click="logout">
<LogOut :size="19"/>Sign out</button>
<div class="help-card">
<span>
<Sparkles :size="16"/>
</span>
<strong>Keep it balanced</strong>
<p>Close the cycle once every entry has been checked.</p>
</div>
</div>
    </aside>
    <div v-if="mobileNav" class="overlay nav-overlay" @click="mobileNav=false">
</div>

    <main class="main">
      <header>
<button class="menu-btn" @click="mobileNav=true">
<Menu/>
</button>
<div class="search">
<Search :size="18"/>
<input placeholder="Search anything..."/>
<kbd>⌘ K</kbd>
</div>
<div class="header-actions">
<button class="icon-btn">
<Bell :size="20"/>
<i>
</i>
</button>
<span class="divider">
</span>
<div class="profile-menu-wrap">
<button class="profile profile-trigger" @click="profileMenu=!profileMenu">
<span class="avatar coral">{{user?.avatar}}</span>
<div>
<strong>{{user?.name}}</strong>
<small>{{isSuperAdmin?'Super admin':'Mess member'}}</small>
</div>
<ChevronDown :size="15"/>
</button>
<div v-if="profileMenu" class="profile-menu">
<button @click="openAccountPassword">
<LockKeyhole :size="16"/>Change password</button>
<button @click="logout">
<LogOut :size="16"/>Sign out</button>
</div>
</div>
</div>
</header>

      <section v-if="data || (active==='Settings' && isSuperAdmin)" class="content">
        <div class="page-heading">
<div>
<p class="eyebrow">{{ active==='Overview' ? 'Your monthly pulse' : 'Workspace' }}</p>
<h1>{{active==='Overview' ? `Good ${new Date().getHours()<12?'morning':new Date().getHours()<17?'afternoon': 'evening'}, ${user.name.split(' ')[0]}` : active}}</h1>
<p>{{active==='Overview' ? `Here’s how ${data.mess.name} is doing this month.` : active==='Settings'&&isSuperAdmin ? 'Manage all messes, managers, members, and cycles.' : `Manage ${active.toLowerCase()} for ${cycleName}.`}}</p>
</div>
<div class="heading-actions">
<label v-if="data" class="cycle-chip" title="Select monthly cycle">
<CalendarDays :size="17"/>
<SearchSelect v-model="selectedCycleId" :options="cycleOptions" @change="switchCycle"/>
<ChevronDown :size="15"/>
</label>
<button v-if="active==='Overview' && canEditCycle" class="primary" @click="open('meal')">
<Plus :size="18"/>Add entry</button>
<button v-if="active==='Meals' && canEditCycle" class="primary" @click="open('meal')">
<Plus :size="18"/>Log meals</button>
<button v-if="active==='Bazar' && isManager && canEditCycle" class="primary" @click="open('bazar')">
<Plus :size="18"/>Add bazar</button>
<button v-if="active==='Deposits' && isManager && canEditCycle" class="primary" @click="open('deposit')">
<Plus :size="18"/>Add deposit</button>
<button v-if="active==='Other costs' && isManager && canEditCycle" class="primary" @click="open('cost')">
<Plus :size="18"/>Add cost</button>
<button v-if="active==='Members' && isManager" class="primary" @click="open('member')">
<Plus :size="18"/>Add member</button>
<button v-if="active==='Reports' && isManager && cycleLocked" class="primary" @click="openNextCycle">
<Plus :size="18"/>Open next cycle</button>
</div>
</div>
        <div v-if="!['Overview','Reports','Settings'].includes(active)" :class="['admin-banner',{locked:cycleLocked,readonly:!isManager}]">
<span class="admin-banner-icon">
<LockKeyhole v-if="cycleLocked"/>
<ShieldCheck v-else/>
</span>
<div>
<strong>{{cycleLocked?'Cycle locked':isManager?'Admin controls enabled':'Read-only access'}}</strong>
<small>{{cycleLocked?'This month is closed. Records are preserved and cannot be changed.':isManager?'You can add, edit, and delete records from this page.':'Only mess managers can update or delete these records.'}}</small>
</div>
<span v-if="isManager&&!cycleLocked" class="admin-badge">Manager</span>
</div>

        <template v-if="active==='Overview'">
          <div class="metric-grid">
            <article class="metric purple">
<div class="metric-top">
<span class="metric-icon">
<Utensils/>
</span>
<span class="trend up">
<ArrowUpRight/>12.4%</span>
</div>
<span>Total meals</span>
<strong>{{data.summary.totals.meals}}</strong>
<small>meal units logged</small>
<div class="metric-orb">
</div>
</article>
            <article class="metric">
<div class="metric-top">
<span class="metric-icon peach">
<ShoppingBasket/>
</span>
<span class="trend up">
<ArrowUpRight/>6.2%</span>
</div>
<span>Bazar spend</span>
<strong>{{fmt(data.summary.totals.bazar)}}</strong>
<small>across {{data.bazar.length}} shopping trips</small>
</article>
            <article class="metric">
<div class="metric-top">
<span class="metric-icon mint">
<CircleDollarSign/>
</span>
<span class="trend down">
<ArrowDownRight/>2.8%</span>
</div>
<span>Current meal rate</span>
<strong>{{fmt(data.summary.cycle.mealRate)}}</strong>
<small>per meal unit</small>
</article>
            <article class="metric">
<div class="metric-top">
<span class="metric-icon blue">
<WalletCards/>
</span>
<span class="status-dot">{{data.summary.totals.deposits ? 'On track' : 'Pending'}}</span>
</div>
<span>Total deposits</span>
<strong>{{fmt(data.summary.totals.deposits)}}</strong>
<small>from {{new Set(data.deposits.map(x=>x.memberId)).size}} of {{visibleMembers.length}} members</small>
</article>
          </div>
          <div class="dashboard-grid">
            <article class="card spending-card">
<div class="card-head">
<div>
<h3>Monthly spending</h3>
<p>Bazar and shared costs this cycle</p>
</div>
<button class="ghost">This month<ChevronDown :size="15"/>
</button>
</div>
<div class="spending-total">
<strong>{{fmt(data.summary.totals.bazar+data.summary.totals.otherCost)}}</strong>
<span class="trend up">
<ArrowUpRight/>8.2% vs last month</span>
</div>
<div class="bars">
<div v-for="(h,i) in [42,56,38,64,47,77,61,85,68,91,73,82]" class="bar-slot">
<i :style="{height:h+'%'}" :class="{current:i===11}">
</i>
</div>
</div>
<div class="bar-labels">
<span>Week 1</span>
<span>Week 2</span>
<span>Week 3</span>
<span>Week 4</span>
</div>
</article>
            <article class="card quick-card">
<div class="card-head">
<div>
<h3>Quick entry</h3>
<p>What would you like to record?</p>
</div>
</div>
<div class="quick-grid">
<button @click="open('meal')">
<span class="metric-icon purple-soft">
<Utensils/>
</span>
<div>
<strong>Daily meals</strong>
<small>Log member meals</small>
</div>
<Plus/>
</button>
<button @click="open('bazar')">
<span class="metric-icon peach">
<ShoppingBasket/>
</span>
<div>
<strong>Bazar</strong>
<small>Add shopping items</small>
</div>
<Plus/>
</button>
<button @click="open('deposit')">
<span class="metric-icon mint">
<WalletCards/>
</span>
<div>
<strong>Deposit</strong>
<small>Record a payment</small>
</div>
<Plus/>
</button>
<button @click="open('cost')">
<span class="metric-icon blue">
<ReceiptText/>
</span>
<div>
<strong>Other cost</strong>
<small>Utilities, rent & more</small>
</div>
<Plus/>
</button>
</div>
</article>
          </div>
          <div class="lower-grid">
            <article class="card">
<div class="card-head">
<div>
<h3>Member balance</h3>
<p>Live estimate for {{cycleName}}</p>
</div>
<button class="link-btn" @click="go('Reports')">View report <ArrowUpRight :size="16"/>
</button>
</div>
<div class="member-list">
<div v-for="m in data.summary.members.slice(0,5)" class="member-row">
<span class="avatar" :style="{background:m.color}">{{m.avatar}}</span>
<div class="member-name">
<strong>{{m.name}}</strong>
<small>{{m.meals}} meals · {{fmt(m.totalCost)}} cost</small>
</div>
<span :class="['balance',m.status]">{{m.balance>=0?'+':'−'}}{{fmt(Math.abs(m.balance))}}<small>{{m.status}}</small>
</span>
</div>
</div>
</article>
            <article class="card">
<div class="card-head">
<div>
<h3>Recent bazar</h3>
<p>Latest grocery activity</p>
</div>
<button class="icon-plain">
<MoreHorizontal/>
</button>
</div>
<div class="bazar-list">
<div v-for="b in data.bazar.slice(0,4)" class="bazar-row">
<div class="date-block">
<strong>{{new Date(b.date+'T00:00:00').getDate()}}</strong>
<span>{{new Date(b.date+'T00:00:00').toLocaleDateString('en',{month:'short'})}}</span>
</div>
<div>
<strong>{{b.note}}</strong>
<small>{{member(b.memberId).name}} · {{b.items.length}} items</small>
</div>
<strong>{{fmt(b.total)}}</strong>
</div>
</div>
</article>
          </div>
        </template>

        <article v-else-if="active==='Meals'" class="card table-card management-card">
<div class="card-head">
<div>
<h3>Daily meal register</h3>
<p>Breakfast, lunch, dinner and guest meals for {{cycleName}}</p>
</div>
<label class="meal-filter">Member<SearchSelect v-model="mealMemberFilter" :options="mealFilterOptions"/>
</label>
</div>
<div class="responsive-table">
<table>
<thead>
<tr>
<th>Date</th>
<th>Member</th>
<th>Breakfast</th>
<th>Lunch</th>
<th>Dinner</th>
<th>Guest</th>
<th>Total</th>
<th>Status</th>
<th v-if="isManager" class="actions-column">Admin actions</th>
</tr>
</thead>
<tbody>
<tr v-for="row in filteredMeals">
<td>{{dateFmt(row.date)}}</td>
<td>
<div class="person">
<span class="avatar" :style="{background:member(row.memberId).color}">{{member(row.memberId).avatar}}</span>{{member(row.memberId).name}}</div>
</td>
<td>{{row.breakfast}}</td>
<td>{{row.lunch}}</td>
<td>{{row.dinner}}</td>
<td>{{row.guest}}</td>
<td>
<strong>{{row.breakfast+row.lunch+row.dinner+row.guest}}</strong>
</td>
<td>
<span :class="row.isConfirmed?'paid':'method'">{{row.isConfirmed?'Confirmed':'Pending'}}</span>
</td>
<td v-if="isManager" class="actions-column">
<AdminActions :disabled="!canEditCycle" :confirmable="!row.isConfirmed" @confirm="confirmMeal(row)" @edit="openEdit('meal',row)" @remove="removeEntry('meal',row)"/>
</td>
</tr>
</tbody>
</table>
</div>
</article>
        <article v-else-if="active==='Bazar'" class="card table-card management-card">
<div class="responsive-table">
<table>
<thead>
<tr>
<th>Date</th>
<th>Shopper</th>
<th>Description</th>
<th>Items</th>
<th>Amount</th>
<th v-if="isManager" class="actions-column">Admin actions</th>
</tr>
</thead>
<tbody>
<tr v-for="row in data.bazar">
<td>{{dateFmt(row.date)}}</td>
<td>{{member(row.memberId).name}}</td>
<td>
<strong>{{row.note}}</strong>
</td>
<td>{{row.items.map(x=>x.product).join(', ')}}</td>
<td>
<strong>{{fmt(row.total)}}</strong>
</td>
<td v-if="isManager" class="actions-column">
<AdminActions :disabled="!canEditCycle" @edit="openEdit('bazar',row)" @remove="removeEntry('bazar',row)"/>
</td>
</tr>
</tbody>
</table>
</div>
</article>
        <article v-else-if="active==='Deposits'" class="card table-card management-card">
<div class="responsive-table">
<table>
<thead>
<tr>
<th>Date</th>
<th>Member</th>
<th>Method</th>
<th>Amount</th>
<th>Status</th>
<th v-if="isManager" class="actions-column">Admin actions</th>
</tr>
</thead>
<tbody>
<tr v-for="row in data.deposits">
<td>{{dateFmt(row.date)}}</td>
<td>{{member(row.memberId).name}}</td>
<td>
<span class="method">{{row.method}}</span>
</td>
<td>
<strong>{{fmt(row.amount)}}</strong>
</td>
<td>
<span class="paid">Received</span>
</td>
<td v-if="isManager" class="actions-column">
<AdminActions :disabled="!canEditCycle" @edit="openEdit('deposit',row)" @remove="removeEntry('deposit',row)"/>
</td>
</tr>
</tbody>
</table>
</div>
</article>
        <article v-else-if="active==='Other costs'" class="card table-card management-card">
<div class="responsive-table">
<table>
<thead>
<tr>
<th>Date</th>
<th>Cost</th>
<th>Category</th>
<th>Split</th>
<th>Amount</th>
<th v-if="isManager" class="actions-column">Admin actions</th>
</tr>
</thead>
<tbody>
<tr v-for="row in data.costs">
<td>{{dateFmt(row.date)}}</td>
<td>
<strong>{{row.title}}</strong>
</td>
<td>{{row.category}}</td>
<td>{{row.splitType==='equal'?'Equal split':'By meals'}}</td>
<td>
<strong>{{fmt(row.amount)}}</strong>
</td>
<td v-if="isManager" class="actions-column">
<AdminActions :disabled="!canEditCycle" @edit="openEdit('cost',row)" @remove="removeEntry('cost',row)"/>
</td>
</tr>
</tbody>
</table>
</div>
</article>
        <article v-else-if="active==='Members'" class="card">
<div class="card-head">
<div>
<h3>Members & permissions</h3>
<p>Change roles, passwords, and monthly participation.</p>
</div>
</div>
<div class="member-cards">
<div v-for="m in visibleMembers" class="member-card">
<span class="avatar large" :style="{background:m.color}">{{m.avatar}}</span>
<div>
<strong>{{m.name}}</strong>
<small>{{m.email}}</small>
<span class="role-label">{{m.role}}</span>
</div>
<label class="participation">
<span>Active this month</span>
<button type="button" :disabled="!isManager||!canEditCycle" :class="['toggle',{on:m.active}]" @click="toggleMember(m)">
<i>
</i>
</button>
</label>
<button v-if="canManageMemberPasswords" class="member-password labeled" @click="openMemberPassword(m)" title="Set temporary password">
<LockKeyhole :size="16"/>
<span>Set password</span>
</button>
<button v-if="isManager" class="member-remove labeled" @click="removeMember(m)" title="Remove member">
<Trash2/>
<span>Remove</span>
</button>
</div>
</div>
</article>
        <div v-else-if="active==='Settings' && isSuperAdmin" class="settings-layout">
<div class="superadmin-banner">
<span>
<ShieldCheck/>
</span>
<div>
<p class="eyebrow">System access</p>
<h2>Super admin controls</h2>
<small>Only global super administrators can create messes and monthly cycles.</small>
</div>
<strong>SUPER ADMIN</strong>
</div>
<article class="card settings-card">
<div class="settings-icon">
<Users/>
</div>
<div class="card-head">
<div>
<h3>Create a new mess</h3>
<p>The creator is automatically assigned as its first manager.</p>
</div>
</div>
<form @submit.prevent="createMess">
<label>Mess name<input v-model="messForm.name" placeholder="e.g. Green Villa" required/>
</label>
<label>Address<input v-model="messForm.address" placeholder="Area, city"/>
</label>
<label>Currency<SearchSelect v-model="messForm.currency" :options="currencyOptions" /></label>
<button class="primary" :disabled="loading">
<Plus/>Create mess</button>
</form>
</article>
<article class="card settings-card">
<div class="settings-icon cycle">
<CalendarDays/>
</div>
<div class="card-head">
<div>
<h3>Open a monthly cycle</h3>
<p>Select a mess and the calendar month to activate.</p>
</div>
</div>
<form @submit.prevent="createCycle">
<label>Mess<SearchSelect v-model="cycleForm.messId" :options="messOptions" placeholder="Search messes" /></label>
<div class="field-grid">
<label>Year<input v-model.number="cycleForm.year" type="number" min="2020" max="2100" required/>
</label>
<label>Month<SearchSelect v-model="cycleForm.month" :options="monthOptions" /></label>
</div>
<button class="primary" :disabled="loading||!cycleForm.messId">
<Plus/>Open cycle</button>
</form>
</article>
<article class="card settings-card settings-editor">
<div class="settings-icon">
<Settings/>
</div>
<div class="card-head">
<div>
<h3>Edit mess and cycle</h3>
<p>Update mess details and the calendar date of an open cycle.</p>
</div>
</div>
<label>Mess<SearchSelect v-model="managedMessId" :options="messOptions" @change="loadManagedMess" placeholder="Search messes" /></label>
<form @submit.prevent="updateMess">
<label>Mess name<input v-model="editMessForm.name" required/>
</label>
<label>Address<input v-model="editMessForm.address"/>
</label>
<label>Currency<SearchSelect v-model="editMessForm.currency" :options="currencyOptions" /></label>
<div class="mess-edit-actions">
<button class="primary" :disabled="loading||!editMessForm.id">
<Settings :size="17"/>Save mess changes</button>
<button type="button" class="danger-button" :disabled="loading||!editMessForm.id" @click="deleteManagedMess">
<Trash2 :size="17"/>Delete mess</button>
</div>
</form>
<div class="settings-divider">
</div>
<form @submit.prevent="updateCycle">
<label>Open cycle<SearchSelect :model-value="editCycleForm.id" :options="managedCycleOptions" @change="selectManagedCycle" placeholder="Search cycles" /></label>
<div class="field-grid">
<label>Year<input v-model.number="editCycleForm.year" type="number" min="2020" max="2100" required/>
</label>
<label>Month<SearchSelect v-model="editCycleForm.month" :options="monthOptions" /></label>
</div>
<div class="mess-edit-actions">
<button class="primary" :disabled="loading||!editCycleForm.id">
<CalendarDays :size="17"/>Save cycle changes</button>
<button type="button" class="danger-button" :disabled="loading||!editCycleForm.id" @click="deleteManagedCycle">
<Trash2 :size="17"/>Delete cycle</button>
</div>
</form>
</article>
<article class="card settings-card settings-members">
<div class="settings-icon">
<Users/>
</div>
<div class="card-head">
<div>
<h3>Managers and members</h3>
<p>Assign one person to multiple messes, and choose whether they manage or participate in each one.</p>
</div>
</div>
<form @submit.prevent="addManagedMember">
<label>Full name<input v-model="managedMemberForm.name" placeholder="Member name" required/>
</label>
<label>Email<input v-model="managedMemberForm.email" type="email" placeholder="member@example.com" required/>
</label>
<label>Access for {{editMessForm.name||'this mess'}}<SearchSelect v-model="managedMemberForm.role" :options="roleOptions" /></label>
<button class="primary" :disabled="loading||!managedMessId">
<Plus :size="17"/>Add to mess</button>
</form>
<div class="settings-divider">
</div>
<div class="managed-member-list">
<div v-for="member in managedMembers" :key="member.id" class="managed-member-row">
<div>
<strong>{{member.name}}</strong>
<small>{{member.email}}</small>
</div>
<SearchSelect :model-value="member.role" :options="roleOptions" @change="changeManagedMemberRole(member,$event)" />
<button type="button" class="member-password" @click="openMemberPassword(member,managedMessId)">
<LockKeyhole :size="15"/>
<span>Set password</span>
</button>
<button type="button" class="danger-button compact" @click="removeManagedMember(member)">
<Trash2 :size="15"/>
<span>Remove</span>
</button>
<span :class="['member-status',member.status]">{{member.status}}</span>
</div>
<p v-if="!managedMembers.length" class="empty-members">No members assigned to this mess yet.</p>
</div>
</article>
<article class="card settings-card user-directory">
<div class="settings-icon">
<Users/>
</div>
<div class="card-head">
<div>
<h3>All members</h3>
<p>Every PicoMess account, including users not currently assigned to a mess.</p>
</div>
</div>
<div class="user-directory-list">
<div v-for="account in allUsers" :key="account.id" class="user-directory-row">
<div>
<strong>{{account.name}}</strong>
<small>{{account.email}}</small>
<small>{{account.assignments||'No mess assignment'}}</small>
</div>
<span :class="['member-status',{inactive:!account.isActive}]">{{account.isActive?'active':'inactive'}}</span>
<button type="button" class="member-password" @click="openUserEditor(account)">
<Settings :size="15"/>
<span>Edit</span>
</button>
</div>
<p v-if="!allUsers.length" class="empty-members">No accounts found.</p>
</div>
</article>
<p v-if="error" class="form-error settings-error">{{error}}</p>
</div>
        <div v-else-if="active==='Reports'" class="report-layout">
<article class="card report-hero">
<span class="eyebrow">Live statement</span>
<h2>{{cycleName}} settlement</h2>
<p>Calculated from meals, groceries, shared expenses and deposits.</p>
<div>
<span>
<small>Meal rate</small>
<strong>{{fmt(data.summary.cycle.mealRate)}}</strong>
</span>
<span>
<small>Total outflow</small>
<strong>{{fmt(data.summary.totals.bazar+data.summary.totals.otherCost)}}</strong>
</span>
<span>
<small>Cycle status</small>
<strong class="capitalize">{{data.cycle.status}}</strong>
</span>
</div>
<button v-if="data.cycle.status!=='closed'" class="primary light-btn" @click="closeCycle">Close monthly cycle</button>
<button v-else-if="isSuperAdmin" class="primary light-btn" @click="reopenCycle">Reopen cycle</button>
<button v-else class="primary light-btn" disabled>Cycle closed</button>
</article>
<article class="card">
<div class="card-head">
<div>
<h3>Settlement breakdown</h3>
<p>Positive balances are refunds; negative balances are due.</p>
</div>
</div>
<div class="member-list">
<div v-for="m in data.summary.members" class="member-row">
<span class="avatar" :style="{background:m.color}">{{m.avatar}}</span>
<div class="member-name">
<strong>{{m.name}}</strong>
<small>{{fmt(m.deposit)}} deposited · {{fmt(m.totalCost)}} cost</small>
</div>
<span :class="['balance',m.status]">{{m.balance>=0?'+':'−'}}{{fmt(Math.abs(m.balance))}}<small>{{m.status}}</small>
</span>
</div>
</div>
</article>
</div>
        <article v-if="active==='Reports'&&selectedReportMember" class="card member-report-card">
<div class="card-head">
<div>
<h3>Member-wise report</h3>
<p>Download a polished PNG statement for one member in {{cycleName}}.</p>
</div>
<div class="report-member-controls">
<label class="report-member-select report-member-combobox">Member<input v-model="reportMemberSearch" placeholder="Search and select member" @focus="reportMemberPickerOpen=true" @input="reportMemberPickerOpen=true"/>
<div v-if="reportMemberPickerOpen" class="report-member-options">
<button v-for="m in filteredReportMembers" :key="m.id" type="button" @mousedown.prevent="selectReportMember(m)">
<strong>{{m.name}}</strong>
<small>{{m.email}}</small>
</button>
<span v-if="!filteredReportMembers.length">No matching members</span>
</div>
</label>
</div>
</div>
<div class="member-report-grid">
<div>
<span>Total meals</span>
<strong>{{selectedReportMember.meals}}</strong>
</div>
<div>
<span>Meal rate</span>
<strong>{{fmt(data.summary.cycle.mealRate)}}</strong>
</div>
<div>
<span>Meal cost</span>
<strong>{{fmt(selectedReportMember.mealCost)}}</strong>
</div>
<div>
<span>Shared expense</span>
<strong>{{fmt(selectedReportMember.otherShare)}}</strong>
</div>
<div>
<span>Total cost</span>
<strong>{{fmt(selectedReportMember.totalCost)}}</strong>
</div>
<div>
<span>Paid / deposit</span>
<strong>{{fmt(selectedReportMember.deposit)}}</strong>
</div>
<div>
<span>Amount due</span>
<strong class="due">{{selectedReportMember.balance<0?fmt(Math.abs(selectedReportMember.balance)):fmt(0)}}</strong>
</div>
<div>
<span>Refund amount</span>
<strong class="refund">{{selectedReportMember.balance>0?fmt(selectedReportMember.balance):fmt(0)}}</strong>
</div>
</div>
<div class="report-download">
<div>
<span>Cycle expense</span>
<strong>{{fmt(data.summary.totals.bazar+data.summary.totals.otherCost)}}</strong>
</div>
<button class="primary" @click="downloadMemberReport">
<ArrowDownRight :size="17"/>Download Report</button>
</div>
</article>
      </section>
      <div v-else class="page-loader">
<LoaderCircle class="spin"/>
<span>Preparing your dashboard…</span>
</div>
    </main>

    <div v-if="editingUser" class="overlay modal-overlay" @mousedown.self="editingUser=null">
      <form class="modal password-modal" @submit.prevent="updateUser">
<div class="modal-head">
<div>
<span class="eyebrow">Member directory</span>
<h2>Edit {{editingUser.name}}</h2>
</div>
<button type="button" @click="editingUser=null">
<X/>
</button>
</div>
<label>Full name<input v-model="editingUser.name" required/>
</label>
<label>Email<input v-model="editingUser.email" type="email" required/>
</label>
<label>Phone<input v-model="editingUser.phone" type="tel" placeholder="Optional"/>
</label>
<label class="account-status">
<input v-model="editingUser.isActive" type="checkbox"/>Account is active</label>
<p v-if="error" class="form-error">{{error}}</p>
<div class="modal-actions">
<button type="button" class="ghost" @click="editingUser=null">Cancel</button>
<button class="primary" :disabled="loading">
<LoaderCircle v-if="loading" class="spin" :size="17"/>Save member</button>
</div>
</form>
    </div>

    <div v-if="accountPasswordModal" class="overlay modal-overlay" @mousedown.self="accountPasswordModal=false">
      <form class="modal password-modal" @submit.prevent="updateAccountPassword">
<div class="modal-head">
<div>
<span class="eyebrow">Account security</span>
<h2>Change password</h2>
</div>
<button type="button" @click="accountPasswordModal=false">
<X/>
</button>
</div>
<p>Use your current password to choose a new one.</p>
<label>Current password<input v-model="accountPasswordForm.currentPassword" type="password" required/>
</label>
<label>New password<input v-model="accountPasswordForm.newPassword" type="password" minlength="8" placeholder="At least 8 characters" required/>
</label>
<label>Confirm new password<input v-model="accountPasswordForm.confirmPassword" type="password" minlength="8" required/>
</label>
<p v-if="error" class="form-error">{{error}}</p>
<div class="modal-actions">
<button type="button" class="ghost" @click="accountPasswordModal=false">Cancel</button>
<button class="primary" :disabled="loading">
<LoaderCircle v-if="loading" class="spin" :size="17"/>Update password</button>
</div>
</form>
    </div>

    <div v-if="memberPasswordTarget" class="overlay modal-overlay" @mousedown.self="memberPasswordTarget=null">
      <form class="modal password-modal" @submit.prevent="updateMemberPassword">
<div class="modal-head">
<div>
<span class="eyebrow">Member access</span>
<h2>Set {{memberPasswordTarget.name}}'s password</h2>
</div>
<button type="button" @click="memberPasswordTarget=null">
<X/>
</button>
</div>
<p>This creates a temporary password. The member must change it at their next sign-in.</p>
<label>Temporary password<input v-model="memberPasswordForm.newPassword" type="password" minlength="8" placeholder="At least 8 characters" required/>
</label>
<label>Confirm temporary password<input v-model="memberPasswordForm.confirmPassword" type="password" minlength="8" required/>
</label>
<p v-if="error" class="form-error">{{error}}</p>
<div class="modal-actions">
<button type="button" class="ghost" @click="memberPasswordTarget=null">Cancel</button>
<button class="primary" :disabled="loading">
<LoaderCircle v-if="loading" class="spin" :size="17"/>Set temporary password</button>
</div>
</form>
    </div>

    <div v-if="modal" class="overlay modal-overlay" @mousedown.self="modal=''">
      <form class="modal" @submit.prevent="submit">
<div class="modal-head">
<div>
<span class="eyebrow">{{editingId ? 'Update record' : 'New record'}}</span>
<h2>{{modalTitle}}</h2>
</div>
<button type="button" @click="modal=''"> <X/> </button>
</div>
        <div v-if="modal!=='member'&&modal!=='cycle'" class="field-grid">
<label v-if="['meal','bazar','deposit'].includes(modal)">Member<template v-if="modal!=='meal'||isManager">
<SearchSelect v-model="form.memberId" :options="memberOptions" placeholder="Search members" />
</template>
<input v-else :value="currentMember?.name||user?.name" disabled/>
</label>
<label>Date<input v-model="form.date" type="date" required/>
</label>
</div>
        <template v-if="modal==='cycle'">
<p>Choose the month after the closed cycle. Only one cycle can be open for this mess.</p>
<div class="field-grid">
<label>Year<input v-model.number="form.year" type="number" min="2020" max="2100" required/>
</label>
<label>Month<SearchSelect v-model="form.month" :options="monthOptions" /></label>
</div>
</template>
        <div v-if="modal==='meal'" class="meal-inputs">
<label>Breakfast<input v-model.number="form.breakfast" type="number" step="0.5" min="0"/>
</label>
<label>Lunch<input v-model.number="form.lunch" type="number" step="0.5" min="0"/>
</label>
<label>Dinner<input v-model.number="form.dinner" type="number" step="0.5" min="0"/>
</label>
<label>Guest<input v-model.number="form.guest" type="number" step="0.5" min="0"/>
</label>
</div>
        <template v-if="modal==='bazar'">
<label>Note<input v-model="form.note" placeholder="e.g. Weekly groceries"/>
</label>
<div class="items">
<div class="item-head">
<span>Product</span>
<span>Qty</span>
<span>Unit</span>
<span>Unit price</span>
<span>Subtotal</span>
<span>
</span>
</div>
<div v-for="(item,i) in form.items" class="item-row">
<input v-model="item.product" placeholder="Product" required/>
<input v-model.number="item.quantity" type="number" min="0.001" step="any" inputmode="decimal" placeholder="Qty" required/>
<SearchSelect v-model="item.unit" :options="unitOptions" />
<input v-model.number="item.unitPrice" type="number" min="0" step="any" inputmode="decimal" placeholder="Unit price" required/>
<strong class="line-subtotal">{{fmt((Number(item.quantity)||0)*(Number(item.unitPrice)||0))}}</strong>
<button type="button" @click="form.items.splice(i,1)" title="Remove item">
<X :size="16"/>
</button>
</div>
<div class="items-footer">
<button type="button" class="add-line" @click="form.items.push({product:'',quantity:1,unit:'kg',unitPrice:0})">
<Plus :size="16"/>Add another item</button>
<div>
<span>Grand total</span>
<strong>{{fmt(bazarGrandTotal)}}</strong>
</div>
</div>
</div>
</template>
        <template v-if="modal==='deposit'">
<label>Amount<input v-model.number="form.amount" type="number" min="1" placeholder="0.00" required/>
</label>
<label>Payment method<SearchSelect v-model="form.method" :options="paymentOptions" /></label>
</template>
        <template v-if="modal==='cost'">
<label>Title<input v-model="form.title" placeholder="e.g. Electricity bill" required/>
</label>
<div class="field-grid">
<label>Category<SearchSelect v-model="form.category" :options="categoryOptions" /></label>
<label>Amount<input v-model.number="form.amount" type="number" min="1" required/>
</label>
</div>
<label>Split rule<SearchSelect v-model="form.splitType" :options="splitOptions" /></label>
</template>
        <template v-if="modal==='member'">
<label>Full name<input v-model="form.name" placeholder="Member name" required/>
</label>
<label>Email<input v-model="form.email" type="email" placeholder="member@example.com" required/>
</label>
<label v-if="isSuperAdmin">Role<SearchSelect v-model="form.role" :options="roleOptions" /></label>
</template>
        <p v-if="error" class="form-error">{{error}}</p>
<div class="modal-actions">
<button type="button" class="ghost" @click="modal=''">Cancel</button>
<button class="primary" :disabled="loading">
<LoaderCircle v-if="loading" class="spin" :size="17"/>{{modal==='cycle'?'Open cycle':editingId ? 'Update entry' : 'Save entry'}}</button>
</div>
      </form>
    </div>
    <Transition name="toast">
<div v-if="toast" class="toast">
<CheckCircle2/>{{toast}}</div>
</Transition>
    <Transition name="toast">
<div v-if="error&&token&&!user?.mustChangePassword" class="toast error-toast">
<X :size="18"/>
<span>{{error}}</span>
<button type="button" @click="dismissError" aria-label="Dismiss error">
<X :size="16"/>
</button>
</div>
</Transition>
  </div>
</template>
