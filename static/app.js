let token=localStorage.token||'',user=null,selected={},foodCache={};
const $=id=>document.getElementById(id);

function friendlyError(status, detail){
  const d=String(detail||'').trim();
  if(status===401) return 'Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.';
  if(status===403) return 'Bạn không có quyền thực hiện thao tác này.';
  if(status===404) return 'Không tìm thấy dữ liệu yêu cầu.';
  if(status>=500) return 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.';
  if(d==='Not authenticated') return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  return d||'Có lỗi xảy ra. Vui lòng thử lại.';
}

async function api(url,opt={}){
  opt={...opt,headers:{...(opt.headers||{})}};
  if(opt.body && typeof opt.body!=='string' && !(opt.body instanceof FormData)) opt.body=JSON.stringify(opt.body);
  if(!(opt.body instanceof FormData)) opt.headers['Content-Type']='application/json';
  if(token) opt.headers.Authorization='Bearer '+token;
  let r;
  try{r=await fetch(url,opt)}catch(e){throw Error('Không thể kết nối máy chủ. Hãy kiểm tra server và thử lại.');}
  let d=null;
  const ct=r.headers.get('content-type')||'';
  try{d=ct.includes('application/json')?await r.json():await r.text()}catch(_){d=null}
  if(r.status===401){
    localStorage.removeItem('token'); token=''; user=null;
    const app=$('app');
    if(app) app.hidden=true;
    closeCheckout?.();
    location.href='/login?expired=1';
    throw Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
  }
  if(!r.ok){
    const detail=typeof d==='object'&&d?d.detail:(typeof d==='string'?d:'');
    const err=Error(friendlyError(r.status,detail)); err.status=r.status; throw err;
  }
  return d;
}

function showAuthNotice(message){
  // Auth UI is now a separate page; keep this helper for compatibility.
  const box=$('authNotice');
  if(!box) return;
  box.textContent=message; box.hidden=false;
}

async function start(){
  if(!token){ location.href='/login'; return false; }
  try{
    user=await api('/api/auth/me');
    $('app').hidden=false;
    $('who').textContent=user.full_name+' · '+user.role;
    $('sideName').textContent=user.full_name;$('sideRole').textContent=user.role;$('welcomeName').textContent=user.full_name;
    const initials=user.full_name.split(' ').map(x=>x[0]).slice(-2).join('').toUpperCase();
    $('avatar').textContent=initials;$('topAvatar').textContent=initials;
    $('manageBtn').hidden=!['admin','staff'].includes(user.role);$('forecastBtn').hidden=!['admin','staff'].includes(user.role);
    $('usersTab').hidden=user.role!=='admin';$('dashboardTab').hidden=!['admin','staff'].includes(user.role);
    await loadCategories();await loadFoods();await loadOrders();await loadNotifications();
    return true;
  }catch(e){
    // Chi khi xac thuc that bai (401) moi dua ve trang dang nhap.
    // Loi tai du lieu/endpoint khac khong duoc lam mat phien dang nhap.
    if(e && e.status===401){
      localStorage.removeItem('token'); token=''; user=null;
      location.href='/login?expired=1';
      return false;
    }
    const app=$('app'); if(app) app.hidden=false;
    toast(e?.message||'Khong tai duoc mot so du lieu. Ban van dang dang nhap.');
    return true;
  }
}
function logout(){localStorage.removeItem('token');token='';user=null;selected={};location.href='/login';}

function tab(id){document.querySelectorAll('.tab').forEach(x=>x.hidden=true);$(id).hidden=false;document.querySelectorAll('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.tab===id));const labels={menu:'Tổng quan',orders:'Đơn hàng',ai:'Trợ lý AI',dashboard:'Phân tích',manage:'Quản lý',notifications:'Thông báo'};$('pageLabel').textContent=labels[id]||'Canteen AI';document.body.classList.remove('sidebar-open');if(id==='orders')loadOrders();if(id==='dashboard')loadDashboard();if(id==='notifications')loadNotifications();if(id==='manage')manageTab('foods')}
async function loadCategories(){let a=await api('/api/categories');$('catFilter').innerHTML='<option value="">Tất cả danh mục</option>'+a.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}
async function loadFoods(){try{let q=new URLSearchParams({search:$('search')?.value||'',in_stock:'false'});if($('catFilter')?.value)q.set('category_id',$('catFilter').value);if($('maxPrice')?.value)q.set('max_price',$('maxPrice').value);let a=await api('/api/foods?'+q);foodCache={};a.forEach(f=>foodCache[f.id]=f);$('foods').innerHTML=a.map(f=>{const emoji=foodEmoji(f.name);return `<article class="food"><div class="food-visual"><span>${emoji}</span><span class="stock ${f.stock<10?'low':''}">${f.stock<10?'Sắp hết':'Còn '+f.stock}</span></div><div class="food-body"><div class="foodhead"><h3>${esc(f.name)}</h3></div><p>${esc(f.description||'Món ăn tươi ngon được phục vụ tại căng tin trường.')}</p><div class="food-price"><b>${money(f.price)}</b><small class="muted">${f.stock} phần</small></div><div class="qty-control"><button data-csp-event="click" data-csp-action="change-qty" data-id="${f.id}" data-delta="-1">−</button><input type="number" min="0" max="${f.stock}" value="${selected[f.id]||0}" data-csp-event="change" data-csp-action="cart-qty" data-id="${f.id}" data-stock="${f.stock}"><button data-csp-event="click" data-csp-action="change-qty" data-id="${f.id}" data-delta="1">+</button></div></div></article>`}).join('')||'<div class="content-card"><p>Không có món phù hợp.</p></div>';updateCart()}catch(e){}}
function changeQty(id,delta){const f=foodCache[id];if(!f)return;selected[id]=Math.max(0,Math.min(f.stock,(selected[id]||0)+delta));loadFoods()}
function updateCart(){let count=0,total=0;for(const [id,q] of Object.entries(selected)){const f=foodCache[id];count+=Number(q)||0;if(f)total+=f.price*(Number(q)||0)}$('cartTotal').textContent=`${count} món · ${money(total)}`}
function order(){
  if(!token||!user) return showAuthNotice('Bạn cần đăng nhập để đặt món.');
  const items=Object.entries(selected).filter(([,q])=>Number(q)>0);
  if(!items.length) return toast('Hãy chọn ít nhất một món trước nhé.');
  const invalid=items.find(([id,q])=>!foodCache[id] || Number(q)>Number(foodCache[id].stock));
  if(invalid) return toast('Một món trong giỏ đã thay đổi tồn kho. Vui lòng kiểm tra lại.');
  $('checkoutSummary').innerHTML=items.map(([id,q])=>{const f=foodCache[id];return `<div class="checkout-row"><span>${esc(f.name)} × ${q}</span><b>${money(f.price*q)}</b></div>`}).join('')+`<div class="checkout-row checkout-total"><span>Tổng cộng</span><b>${money(items.reduce((s,[id,q])=>s+(foodCache[id]?.price||0)*q,0))}</b></div>`;
  $('checkoutModal').hidden=false;
  $('checkoutModal').classList.add('is-open');
  setTimeout(()=>$('paymentMethod')?.focus(),0);
}
function closeCheckout(event){
  if(event) event.preventDefault();
  const modal=$('checkoutModal');
  if(!modal) return;
  modal.classList.remove('is-open');
  modal.hidden=true;
}
async function submitOrder(event){
  if(event) event.preventDefault();
  if(!token||!user) return showAuthNotice('Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.');
  const items=Object.entries(selected).filter(([,q])=>Number(q)>0).map(([id,q])=>({food_id:+id,quantity:Number(q)}));
  if(!items.length) return toast('Giỏ hàng đang trống.');
  const btn=document.querySelector('#checkoutModal .primary-btn');
  if(btn) btn.disabled=true;
  try{
    const d=await api('/api/orders',{method:'POST',body:{items,payment_method:$('paymentMethod').value,note:$('orderNote').value.trim()}});
    closeCheckout(); selected={}; $('orderNote').value='';
    await Promise.all([loadFoods(),loadOrders(),loadNotifications()]);
    tab('orders');
    toast('Đặt món thành công · Đơn #'+d.id);
  }catch(e){toast(e.message)}
  finally{if(btn)btn.disabled=false}
}

window.addEventListener('keydown',e=>{if(e.key==='Escape' && !$('checkoutModal')?.hidden) closeCheckout();});
window.addEventListener('click',e=>{const modal=$('checkoutModal');if(modal && !modal.hidden && e.target===modal) closeCheckout();});

async function loadOrders(){try{let sf=$('statusFilter')?.value||'';let a=await api('/api/orders?status_filter='+encodeURIComponent(sf));$('orderList').innerHTML=a.map(o=>`<div class="order"><div><b>Đơn #${o.id}</b><small>${new Date(o.created_at).toLocaleString('vi-VN')} · ${o.payment_method} · ${o.payment_status}</small></div><span class="pill">${o.status}</span><strong>${money(o.total)}</strong><div class="orderitems">${o.items.map(i=>`${i.name} × ${i.quantity}`).join(' · ')}</div>${['admin','staff'].includes(user.role)?`<div class="orderactions"><select data-csp-event="change" data-csp-action="change-status" data-id="${o.id}"><option value="">Cập nhật trạng thái</option>${['pending','confirmed','preparing','ready','completed','cancelled'].map(s=>`<option ${s===o.status?'selected':''}>${s}</option>`).join('')}</select><button data-csp-event="click" data-csp-action="pay-order" data-id="${o.id}">Thanh toán</button></div>`:''}</div>`).join('')||'<p>Chưa có đơn hàng.</p>'}catch(e){$('orderList').innerHTML='<p>'+esc(e.message)+'</p>';toast(e.message)}}
async function changeStatus(id,status){if(!status)return;try{await api('/api/orders/'+id+'/status',{method:'PATCH',body:JSON.stringify({status})});toast('Đã cập nhật trạng thái đơn hàng');loadOrders();loadFoods();loadNotifications()}catch(e){toast(e.message)}}
function pay(id){openActionModal({title:'Cập nhật thanh toán',eyebrow:'PAYMENT',icon:'💳',message:'Chọn trạng thái và phương thức thanh toán cho đơn hàng.',submit:'Lưu thanh toán',fields:`<label>Trạng thái thanh toán</label><select id="payStatus" class="modal-input"><option value="paid">Đã thanh toán</option><option value="unpaid">Chưa thanh toán</option><option value="refunded">Đã hoàn tiền</option></select><label>Phương thức</label><select id="payMethod" class="modal-input"><option value="cash">Tiền mặt</option><option value="transfer">Chuyển khoản</option></select>`,submitFn:async()=>{await api('/api/orders/'+id+'/payment',{method:'POST',body:JSON.stringify({status:$('payStatus').value,method:$('payMethod').value})});closeActionModal();toast('Đã cập nhật thanh toán');loadOrders();loadNotifications()}})}
async function aiRecommend(){await runAI('/api/ai/recommend',null)}
async function aiForecast(){await runAI('/api/ai/forecast',null)}
async function aiChat(){let q=$('question').value.trim();if(!q){toast('Vui lòng nhập câu hỏi cho AI');$('question').focus();return}await runAI('/api/ai/chat',{question:q})}
async function runAI(url,body){$('answer').textContent='AI đang phân tích...';try{$('answer').textContent=(await api(url,{method:'POST',body:body?JSON.stringify(body):JSON.stringify({})})).answer}catch(e){$('answer').textContent=e.message}}
async function loadDashboard(){try{let d=await api('/api/dashboard');$('stats').innerHTML=[['today_orders','Đơn hôm nay'],['today_revenue','Doanh thu hôm nay'],['total_orders','Tổng đơn'],['revenue','Tổng doanh thu'],['low_stock','Món sắp hết'],['low_ingredients','Nguyên liệu sắp hết']].map(x=>`<div><b>${x[0].includes('revenue')?money(d[x[0]]):d[x[0]]}</b><span>${x[1]}</span></div>`).join('');$('statusStats').innerHTML=Object.entries(d.order_statuses).map(([k,v])=>`<div><b>${v}</b><span>${k}</span></div>`).join('');$('topFoods').innerHTML=d.top_foods.map(x=>`<div class="barrow"><span>${x.name}</span><b>${x.quantity}</b></div>`).join('')||'Chưa có dữ liệu';let r=await api('/api/reports/sales?days=7');$('salesReport').innerHTML=r.map(x=>`<div class="barrow"><span>${x.date}</span><b>${x.orders} đơn · ${money(x.revenue)}</b></div>`).join('')}catch(e){$('stats').textContent=e.message}}
function manageTab(type,btn){
  let c=$('manageContent');
  document.querySelectorAll('.manage-tab').forEach(x=>x.classList.remove('active')); if(btn)btn.classList.add('active');
  if(type==='foods') c.innerHTML=`<div class="management-head"><div><span class="eyebrow dark">FOOD MANAGEMENT</span><h2>Quản lý món ăn</h2><p>Thêm món, cập nhật giá bán, tồn kho và trạng thái phục vụ trong căng tin.</p></div><button class="primary-btn" data-csp-event="click" data-csp-action="open-food-new">＋ Thêm món</button></div><div class="management-toolbar"><div class="search-box">⌕<input id="foodManageSearch" placeholder="Tìm tên món..." data-csp-event="input" data-csp-action="load-manage-foods"></div><div class="management-stats"><span id="foodCount">0 món</span><span id="foodLowCount">0 sắp hết</span></div></div><div id="manageFoods" class="management-grid"></div>`;
  if(type==='categories') c.innerHTML=`<div class="management-head"><div><span class="eyebrow dark">CATEGORY MANAGEMENT</span><h2>Danh mục món ăn</h2><p>Phân loại món ăn để khách hàng tìm kiếm nhanh và giúp nhân viên quản lý thực đơn dễ dàng.</p></div><button class="primary-btn" data-csp-event="click" data-csp-action="open-category-new">＋ Thêm danh mục</button></div><div class="category-toolbar"><div class="search-box">⌕<input id="categorySearch" placeholder="Tìm tên danh mục..." data-csp-event="input" data-csp-action="load-manage-categories"></div><div class="category-summary"><span id="categoryCount">0 danh mục</span><span id="categoryFoodCount">0 món ăn</span></div></div><div id="manageCategories" class="category-grid"></div>`;
  if(type==='ingredients') c.innerHTML=`<div class="management-head"><div><span class="eyebrow dark">INVENTORY MANAGEMENT</span><h2>Kho nguyên liệu</h2><p>Theo dõi tồn kho, mức tối thiểu và thực hiện nhập — xuất nguyên liệu cho căng tin.</p></div><button class="primary-btn" data-csp-event="click" data-csp-action="open-ingredient-new">＋ Thêm nguyên liệu</button></div><div class="management-toolbar"><div class="search-box">⌕<input id="ingredientSearch" placeholder="Tìm nguyên liệu..." data-csp-event="input" data-csp-action="load-ingredients"></div><div class="management-stats"><span id="ingredientCount">0 nguyên liệu</span><span id="ingredientLowCount">0 sắp hết</span></div></div><div id="ingredientsList" class="management-grid"></div>`;
  if(type==='menus') c.innerHTML=`<div class="management-head"><div><span class="eyebrow dark">DAILY MENU</span><h2>Thực đơn theo ngày</h2><p>Tạo thực đơn, theo dõi món đang phục vụ và tổ chức món ăn theo từng ngày.</p></div><button class="primary-btn" data-csp-event="click" data-csp-action="open-menu-new">＋ Tạo thực đơn</button></div><div class="management-toolbar"><div class="search-box">⌕<input id="menuSearch" placeholder="Tìm tên thực đơn..." data-csp-event="input" data-csp-action="load-menus"></div><div class="management-stats"><span id="menuCount">0 thực đơn</span></div></div><div id="menusList" class="management-grid"></div>`;
  if(type==='users') c.innerHTML=`<div class="management-head"><div><span class="eyebrow dark">USER MANAGEMENT</span><h2>Quản lý người dùng</h2><p>Kiểm tra vai trò và trạng thái tài khoản đang sử dụng hệ thống.</p></div><div class="management-note">🔐 Chỉ quản trị viên có quyền thay đổi trạng thái</div></div><div class="management-toolbar"><div class="search-box">⌕<input id="userSearch" placeholder="Tìm tên hoặc email..." data-csp-event="input" data-csp-action="load-users"></div><div class="management-stats"><span id="userCount">0 người dùng</span></div></div><div id="usersList" class="management-grid"></div>`;
  if(type==='foods')loadManageFoods(); if(type==='categories')loadManageCategories(); if(type==='ingredients')loadIngredients(); if(type==='menus')loadMenus(); if(type==='users')loadUsers();
}

let categoryCache=[];let categoryModalMode='add';let categoryModalId=null;
async function loadManageFoods(){try{let cats=await api('/api/categories');let q=($('foodManageSearch')?.value||'').trim();let a=await api('/api/foods?search='+encodeURIComponent(q));if($('foodCount'))$('foodCount').textContent=`${a.length} món`;if($('foodLowCount'))$('foodLowCount').textContent=`${a.filter(f=>f.stock<10).length} sắp hết`;$('manageFoods').innerHTML=a.map(f=>`<article class="manage-card food-manage-card"><div class="manage-card-icon">${foodEmoji(f.name)}</div><div class="manage-card-main"><div class="manage-card-top"><span class="manage-code">MÓN #${String(f.id).padStart(3,'0')}</span><span class="status-badge ${f.stock<10?'warning':'success'}">${f.stock<10?'Sắp hết':'Đang bán'}</span></div><h3>${esc(f.name)}</h3><p>${esc(f.description||'Chưa có mô tả cho món ăn.')}</p><div class="manage-meta"><span>💰 ${money(f.price)}</span><span>📦 ${f.stock} phần</span><span>🏷️ ${esc(cats.find(c=>c.id===f.category_id)?.name||'Chưa phân loại')}</span></div><div class="manage-actions"><button class="ghost-btn small-btn" data-csp-event="click" data-csp-action="edit-food" data-id="${f.id}">✎ Sửa</button><button class="danger-btn" data-csp-event="click" data-csp-action="hide-food" data-id="${f.id}" data-name="${esc(f.name)}">🗑 Ẩn món</button></div></div></article>`).join('')||'<div class="empty-state"><div>🍽️</div><h3>Chưa có món ăn</h3><p>Hãy thêm món ăn đầu tiên cho căng tin.</p></div>'}catch(e){$('manageFoods').innerHTML=`<div class="empty-state"><h3>Không tải được dữ liệu</h3><p>${esc(e.message)}</p></div>`}}
async function openFoodModal(id=null){let cats=await api('/api/categories');let foods=await api('/api/foods');let f=id?foods.find(x=>x.id===id):null;openActionModal({type:'food',title:id?'Chỉnh sửa món ăn':'Thêm món ăn mới',eyebrow:'FOOD MANAGEMENT',icon:'🍽️',message:id?'Cập nhật thông tin món ăn và tồn kho.':'Nhập thông tin món ăn để hiển thị trên thực đơn.',submit:id?'Lưu thay đổi':'Thêm món',fields:`<div class="modal-form-grid"><div><label>Tên món</label><input id="af_name" class="modal-input" value="${esc(f?.name||'')}" placeholder="Ví dụ: Cơm gà sốt tiêu"></div><div><label>Danh mục</label><select id="af_cat" class="modal-input"><option value="">Không chọn</option>${cats.map(c=>`<option value="${c.id}" ${f?.category_id===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div><div><label>Giá bán (VNĐ)</label><input id="af_price" class="modal-input" type="number" min="0" value="${f?.price??''}" placeholder="25000"></div><div><label>Tồn kho (phần)</label><input id="af_stock" class="modal-input" type="number" min="0" value="${f?.stock??0}"></div></div><label>Mô tả món ăn</label><textarea id="af_desc" class="modal-textarea" placeholder="Mô tả ngắn về món ăn">${esc(f?.description||'')}</textarea>`,submitFn:async()=>{let data={name:$('af_name').value.trim(),description:$('af_desc').value.trim(),price:+$('af_price').value,stock:+$('af_stock').value,category_id:$('af_cat').value?+$('af_cat').value:null};if(!data.name||data.price<0||data.stock<0)throw Error('Vui lòng nhập thông tin món ăn hợp lệ');await api(id?'/api/foods/'+id:'/api/foods',{method:id?'PUT':'POST',body:JSON.stringify(data)});closeActionModal();toast(id?'Đã cập nhật món ăn':'Đã thêm món ăn');loadFoods();loadManageFoods()}})}
async function openHideFood(id,name){openActionModal({title:'Ẩn món ăn?',eyebrow:'XÁC NHẬN THAO TÁC',icon:'🗑️',message:`Bạn có chắc muốn ẩn món <strong>${esc(name)}</strong>? Món sẽ không còn hiển thị cho khách hàng.`,submit:'Ẩn món',danger:true,submitFn:async()=>{await api('/api/foods/'+id,{method:'DELETE'});closeActionModal();toast('Đã ẩn món ăn');loadFoods();loadManageFoods()}})}

async function loadManageCategories(){let a=await api('/api/categories');categoryCache=a;let foods=[];try{foods=await api('/api/foods')}catch(e){}let q=($('categorySearch')?.value||'').trim().toLowerCase();let filtered=a.filter(c=>!q||c.name.toLowerCase().includes(q)||(c.description||'').toLowerCase().includes(q));if($('categoryCount'))$('categoryCount').textContent=`${a.length} danh mục`;if($('categoryFoodCount'))$('categoryFoodCount').textContent=`${foods.length} món ăn`;if(!$('manageCategories'))return;$('manageCategories').innerHTML=filtered.map((c,i)=>{let count=foods.filter(f=>f.category_id===c.id).length;let icon=['🍚','🥤','🍜','🍱','🍰','🥗','🍔','🍎'][i%8];return `<article class="category-card"><div class="category-icon">${icon}</div><div class="category-card-body"><div class="category-card-top"><span class="category-index">DANH MỤC ${String(i+1).padStart(2,'0')}</span><span class="category-count">${count} món</span></div><h3>${esc(c.name)}</h3><p>${esc(c.description||'Chưa có mô tả cho danh mục này.')}</p><div class="category-card-actions"><button class="ghost-btn small-btn" data-csp-event="click" data-csp-action="edit-category" data-id="${c.id}">✎ Sửa</button><button class="danger-btn" data-csp-event="click" data-csp-action="open-delete-category" data-id="${c.id}">🗑 Xóa</button></div></div></article>`}).join('')||'<div class="empty-state"><div>🗂️</div><h3>Chưa có danh mục phù hợp</h3><p>Hãy thêm danh mục mới hoặc thử từ khóa khác.</p></div>'}
function openCategoryModal(id=null){categoryModalMode=id?'edit':'add';categoryModalId=id;let c=id?categoryCache.find(x=>x.id===id):null;$('categoryModalTitle').textContent=id?'Chỉnh sửa danh mục':'Thêm danh mục mới';$('categoryNameInput').value=c?.name||'';$('categoryDescInput').value=c?.description||'';$('categoryModalSubmit').textContent=id?'Lưu thay đổi':'Thêm danh mục';$('categoryModal').hidden=false;setTimeout(()=>$('categoryNameInput').focus(),30)}
function closeCategoryModal(){$('categoryModal').hidden=true}
async function saveCategory(){let name=$('categoryNameInput').value.trim(),description=$('categoryDescInput').value.trim();if(!name){showToast('Vui lòng nhập tên danh mục');return}try{await api(categoryModalMode==='edit'?'/api/categories/'+categoryModalId:'/api/categories',{method:categoryModalMode==='edit'?'PUT':'POST',body:JSON.stringify({name,description})});closeCategoryModal();showToast(categoryModalMode==='edit'?'Đã cập nhật danh mục':'Đã thêm danh mục');loadCategories();loadManageCategories()}catch(e){showToast(e.message)}}
function openDeleteCategory(id){let c=categoryCache.find(x=>x.id===id);if(!c)return;categoryModalId=id;$('deleteCategoryName').textContent=c.name;$('deleteCategoryModal').hidden=false}
function closeDeleteCategory(){$('deleteCategoryModal').hidden=true}
async function deleteCategory(){try{await api('/api/categories/'+categoryModalId,{method:'DELETE'});closeDeleteCategory();showToast('Đã xóa danh mục');loadCategories();loadManageCategories()}catch(e){closeDeleteCategory();showToast(e.message)}}
async function loadIngredients(){let a=await api('/api/ingredients');let q=($('ingredientSearch')?.value||'').trim().toLowerCase();let filtered=a.filter(i=>i.name.toLowerCase().includes(q));if($('ingredientCount'))$('ingredientCount').textContent=`${a.length} nguyên liệu`;if($('ingredientLowCount'))$('ingredientLowCount').textContent=`${a.filter(i=>i.quantity<=i.min_quantity).length} sắp hết`;$('ingredientsList').innerHTML=filtered.map(i=>{let low=i.quantity<=i.min_quantity;let pct=i.min_quantity?Math.min(100,Math.round(i.quantity/(i.min_quantity*3)*100)):100;return `<article class="manage-card ingredient-card"><div class="manage-card-icon">${low?'⚠️':'📦'}</div><div class="manage-card-main"><div class="manage-card-top"><span class="manage-code">NGUYÊN LIỆU #${String(i.id).padStart(3,'0')}</span><span class="status-badge ${low?'warning':'success'}">${low?'Sắp hết':'Ổn định'}</span></div><h3>${esc(i.name)}</h3><div class="inventory-number"><b>${i.quantity}</b><span>${esc(i.unit)}</span></div><div class="inventory-bar"><span style="width:${pct}%"></span></div><div class="manage-meta"><span>Ngưỡng tối thiểu: ${i.min_quantity} ${esc(i.unit)}</span><span>Giá/đơn vị: ${money(i.cost_per_unit)}</span></div><div class="manage-actions"><button class="ghost-btn small-btn" data-csp-event="click" data-csp-action="edit-ingredient" data-id="${i.id}">✎ Sửa</button><button class="stock-in-btn" data-csp-event="click" data-csp-action="movement-in" data-id="${i.id}">＋ Nhập kho</button><button class="stock-out-btn" data-csp-event="click" data-csp-action="movement-out" data-id="${i.id}">− Xuất kho</button></div></div></article>`}).join('')||'<div class="empty-state"><div>📦</div><h3>Kho chưa có nguyên liệu</h3><p>Thêm nguyên liệu để bắt đầu theo dõi tồn kho.</p></div>'}
async function openIngredientModal(id=null){let a=await api('/api/ingredients');let i=id?a.find(x=>x.id===id):null;openActionModal({title:id?'Chỉnh sửa nguyên liệu':'Thêm nguyên liệu mới',eyebrow:'INVENTORY MANAGEMENT',icon:'📦',message:id?'Cập nhật thông tin và mức tồn kho.':'Nhập thông tin nguyên liệu sử dụng trong căng tin.',submit:id?'Lưu thay đổi':'Thêm nguyên liệu',fields:`<div class="modal-form-grid"><div><label>Tên nguyên liệu</label><input id="ai_name" class="modal-input" value="${esc(i?.name||'')}"></div><div><label>Đơn vị tính</label><input id="ai_unit" class="modal-input" value="${esc(i?.unit||'kg')}"></div><div><label>Số lượng tồn</label><input id="ai_q" class="modal-input" type="number" min="0" value="${i?.quantity??0}"></div><div><label>Mức tối thiểu</label><input id="ai_min" class="modal-input" type="number" min="0" value="${i?.min_quantity??0}"></div></div><label>Giá nhập / đơn vị</label><input id="ai_cost" class="modal-input" type="number" min="0" value="${i?.cost_per_unit??0}">`,submitFn:async()=>{let data={name:$('ai_name').value.trim(),unit:$('ai_unit').value.trim(),quantity:+$('ai_q').value,min_quantity:+$('ai_min').value,cost_per_unit:+$('ai_cost').value};if(!data.name||!data.unit||data.quantity<0||data.min_quantity<0)throw Error('Vui lòng nhập thông tin hợp lệ');await api(id?'/api/ingredients/'+id:'/api/ingredients',{method:id?'PUT':'POST',body:JSON.stringify(data)});closeActionModal();toast(id?'Đã cập nhật nguyên liệu':'Đã thêm nguyên liệu');loadIngredients()}})}
function openMovementModal(id,type){let label=type==='in'?'Nhập kho':'Xuất kho';openActionModal({title:label+' nguyên liệu',eyebrow:'INVENTORY MOVEMENT',icon:type==='in'?'📥':'📤',message:'Nhập số lượng cần cập nhật. Hệ thống sẽ kiểm tra tồn kho trước khi ghi nhận.',submit:label,fields:`<label>Số lượng</label><input id="moveQty" class="modal-input" type="number" min="0.1" step="0.1" placeholder="Nhập số lượng"><label>Ghi chú</label><textarea id="moveNote" class="modal-textarea" placeholder="Ví dụ: Nhập hàng buổi sáng..."></textarea>`,submitFn:async()=>{let q=Number($('moveQty').value);if(!(q>0))throw Error('Số lượng phải lớn hơn 0');await api('/api/inventory/movement',{method:'POST',body:JSON.stringify({ingredient_id:id,movement_type:type,quantity:q,note:$('moveNote').value.trim()||'Cập nhật từ giao diện'})});closeActionModal();toast(type==='in'?'Đã nhập kho':'Đã xuất kho');loadIngredients();loadDashboard()}})}
async function loadMenus(){let a=await api('/api/menus');let q=($('menuSearch')?.value||'').trim().toLowerCase();let filtered=a.filter(m=>!q||m.title.toLowerCase().includes(q));if($('menuCount'))$('menuCount').textContent=`${a.length} thực đơn`;$('menusList').innerHTML=filtered.map(m=>`<article class="manage-card menu-card"><div class="menu-date"><b>${new Date(m.menu_date+'T00:00:00').getDate()}</b><span>${new Date(m.menu_date+'T00:00:00').toLocaleDateString('vi-VN',{month:'short'})}</span></div><div class="manage-card-main"><div class="manage-card-top"><span class="manage-code">THỰC ĐƠN #${String(m.id).padStart(3,'0')}</span><span class="status-badge success">Đang áp dụng</span></div><h3>${esc(m.title)}</h3><p>${m.items.length?m.items.map(i=>esc(i.name)).join(' · '):'Chưa có món trong thực đơn.'}</p><div class="manage-meta"><span>📅 ${new Date(m.menu_date+'T00:00:00').toLocaleDateString('vi-VN')}</span><span>🍽️ ${m.items.length} món</span></div><div class="manage-actions"><button class="ghost-btn small-btn" data-csp-event="click" data-csp-action="menu-items" data-id="${m.id}">🍽 Quản lý món</button></div></div></article>`).join('')||'<div class="empty-state"><div>📅</div><h3>Chưa có thực đơn</h3><p>Tạo thực đơn để bắt đầu tổ chức món theo ngày.</p></div>'}
async function openMenuModal(){openActionModal({title:'Tạo thực đơn mới',eyebrow:'DAILY MENU',icon:'📅',message:'Tạo thực đơn theo ngày để nhân viên dễ dàng tổ chức món phục vụ.',submit:'Tạo thực đơn',fields:`<label>Ngày áp dụng</label><input id="am_date" class="modal-input" type="date" value="${new Date().toISOString().slice(0,10)}"><label>Tên thực đơn</label><input id="am_title" class="modal-input" placeholder="Ví dụ: Thực đơn thứ Hai">`,submitFn:async()=>{let date=$('am_date').value,title=$('am_title').value.trim();if(!date||!title)throw Error('Vui lòng nhập đầy đủ ngày và tên thực đơn');await api('/api/menus',{method:'POST',body:JSON.stringify({menu_date:date,title})});closeActionModal();toast('Đã tạo thực đơn');loadMenus()}})}
async function openMenuItemsModal(menuId){let menus=await api('/api/menus');let m=menus.find(x=>x.id===menuId);let foods=await api('/api/foods');openActionModal({title:'Quản lý món trong thực đơn',eyebrow:'MENU ITEMS',icon:'🍽️',message:`${esc(m?.title||'Thực đơn')} · ${esc(m?.menu_date||'')}`,submit:'Thêm món',fields:`<label>Chọn món ăn</label><select id="menuFood" class="modal-input"><option value="">Chọn món...</option>${foods.map(f=>`<option value="${f.id}">${esc(f.name)} — ${money(f.price)}</option>`).join('')}</select><div class="menu-items-current">${(m?.items||[]).map(i=>`<div><span>${esc(i.name)}</span><button type="button" class="danger-text-btn" data-csp-event="click" data-csp-action="remove-menu-item" data-id="${i.id}" data-menu-id="${menuId}">Xóa</button></div>`).join('')||'<small>Chưa có món trong thực đơn.</small>'}</div>`,submitFn:async()=>{let fid=$('menuFood').value;if(!fid)throw Error('Hãy chọn một món');await api('/api/menus/'+menuId+'/items/'+fid,{method:'POST'});closeActionModal();toast('Đã thêm món vào thực đơn');loadMenus()}})}
async function removeMenuItem(itemId,menuId){try{await api('/api/menus/items/'+itemId,{method:'DELETE'});toast('Đã xóa món khỏi thực đơn');closeActionModal();loadMenus()}catch(e){toast(e.message)}}
async function loadUsers(){let a=await api('/api/users');let q=($('userSearch')?.value||'').trim().toLowerCase();let f=a.filter(x=>!q||x.full_name.toLowerCase().includes(q)||x.email.toLowerCase().includes(q));if($('userCount'))$('userCount').textContent=`${a.length} người dùng`;$('usersList').innerHTML=f.map(x=>`<article class="manage-card user-card"><div class="user-avatar-large">${esc((x.full_name||'U').slice(0,1).toUpperCase())}</div><div class="manage-card-main"><div class="manage-card-top"><span class="manage-code">USER #${String(x.id).padStart(3,'0')}</span><span class="status-badge ${x.status==='active'?'success':'danger'}">${x.status==='active'?'Đang hoạt động':'Đã khóa'}</span></div><h3>${esc(x.full_name)}</h3><p>${esc(x.email)}</p><div class="manage-meta"><span>👤 Vai trò: ${esc(x.role)}</span><span>📅 ${x.created_at?new Date(x.created_at).toLocaleDateString('vi-VN'):''}</span></div><div class="manage-actions"><button class="${x.status==='active'?'danger-btn':'stock-in-btn'}" data-csp-event="click" data-csp-action="toggle-user" data-id="${x.id}" data-status="${x.status==='active'?'blocked':'active'}" data-name="${esc(x.full_name)}">${x.status==='active'?'🔒 Khóa tài khoản':'🔓 Mở khóa'}</button></div></div></article>`).join('')||'<div class="empty-state"><div>👥</div><h3>Không tìm thấy người dùng</h3><p>Thử tìm bằng tên hoặc email khác.</p></div>'}
async function toggleUserConfirm(id,status,name){openActionModal({title:status==='blocked'?'Khóa tài khoản?':'Mở khóa tài khoản?',eyebrow:'USER MANAGEMENT',icon:status==='blocked'?'🔒':'🔓',message:`Bạn có chắc muốn ${status==='blocked'?'khóa':'mở khóa'} tài khoản <strong>${esc(name)}</strong>?`,submit:status==='blocked'?'Khóa tài khoản':'Mở khóa',danger:status==='blocked',submitFn:async()=>{await api('/api/users/'+id+'/status',{method:'PATCH',body:JSON.stringify({status})});closeActionModal();toast(status==='blocked'?'Đã khóa tài khoản':'Đã mở khóa tài khoản');loadUsers()}})}
function openActionModal(cfg){window.__action=cfg;$('actionTitle').textContent=cfg.title||'Xác nhận';$('actionEyebrow').textContent=cfg.eyebrow||'THAO TÁC';$('actionIcon').textContent=cfg.icon||'✦';$('actionMessage').innerHTML=cfg.message||'';$('actionFields').innerHTML=cfg.fields||'';$('actionSubmit').textContent=cfg.submit||'Xác nhận';$('actionSubmit').className=cfg.danger?'danger-btn danger-large':'primary-btn';$('actionModal').hidden=false;setTimeout(()=>{let x=$('actionFields').querySelector('input,select,textarea');if(x)x.focus()},30)}
function closeActionModal(){$('actionModal').hidden=true;window.__action=null}
async function submitActionModal(){let cfg=window.__action;if(!cfg?.submitFn)return;let b=$('actionSubmit');b.disabled=true;try{await cfg.submitFn()}catch(e){toast(e.message||'Có lỗi xảy ra')}finally{b.disabled=false}}

async function loadNotifications() {
    const list = $('notificationList');
    if (!list) return;

    try {
        const rows = await api('/api/notifications');

        if (!Array.isArray(rows)) {
            throw new Error('Dữ liệu thông báo không hợp lệ');
        }

        const unread = rows.filter(n => !n.is_read).length;

        for (const id of ['badge', 'topBadge']) {
            const badge = $(id);
            if (!badge) continue;

            badge.textContent = unread ? String(unread) : '';
            badge.hidden = unread === 0;
        }

        if (rows.length === 0) {
            list.innerHTML = '<p class="muted">Bạn chưa có thông báo.</p>';
            return;
        }

        list.innerHTML = rows.map(n => {
            const id = Number(n.id);
            const canMarkRead =
                !n.is_read && Number.isSafeInteger(id) && id > 0;

            const dateText = n.created_at
                ? new Date(n.created_at).toLocaleString('vi-VN')
                : '';

            const action = canMarkRead
                ? `<button type="button" class="text-btn"
                    data-csp-event="click"
                    data-csp-action="read-notification"
                    data-id="${id}">Đánh dấu đã đọc</button>`
                : (n.is_read ? '<span class="pill">Đã đọc</span>' : '');

            return `<article class="order notification-item">
                <div>
                    <strong>${esc(n.title || 'Thông báo')}</strong>
                    <p>${esc(n.message || '')}</p>
                    <small>${esc(dateText)}</small>
                </div>
                ${action}
            </article>`;
        }).join('');
    } catch (e) {
        list.innerHTML = '<p class="muted">Không thể tải thông báo.</p>';
        toast(e.message || 'Không thể tải thông báo');
    }
}
async function readNotification(id) {
    const numericId = Number(id);

    if (!Number.isSafeInteger(numericId) || numericId <= 0) {
        toast('Thông báo không hợp lệ');
        return;
    }

    try {
        await api('/api/notifications/' + numericId + '/read', {
            method: 'PATCH'
        });
        await loadNotifications();
    } catch (e) {
        toast(e.message || 'Không thể đánh dấu đã đọc');
    }
}
function toast(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>t.classList.remove('show'),3000)}
function foodEmoji(name){const n=String(name).toLowerCase();if(n.includes('phở'))return '🍜';if(n.includes('cơm'))return '🍛';if(n.includes('mì'))return '🍝';if(n.includes('cam'))return '🍊';if(n.includes('bánh'))return '🥐';if(n.includes('sữa'))return '🥛';return '🍱'}
function money(n){return Number(n||0).toLocaleString('vi-VN')+' đ'}function esc(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
if(token)start();

window.addEventListener('DOMContentLoaded',()=>start());


/* CSP_INLINE_EVENT_REFACTOR_V1 */
(function () {
    function dispatchCspAction(event) {
        const target = event.target;
        const element = target instanceof Element
            ? target.closest('[data-csp-event][data-csp-action]')
            : null;

        if (!element || element.getAttribute('data-csp-event') !== event.type) {
            return;
        }

        switch (element.getAttribute('data-csp-action')) {
            case 'tab-menu': tab('menu'); break;
            case 'tab-orders': tab('orders'); break;
            case 'tab-ai': tab('ai'); break;
            case 'tab-dashboard': if (user && ['admin','staff'].includes(user.role)) tab('dashboard'); else toast('Bạn không có quyền xem phân tích'); break;
            case 'tab-notifications': tab('notifications'); break;
            case 'read-notification': readNotification(Number(element.dataset.id)); break;
            case 'tab-manage': tab('manage'); break;
            case 'logout': logout(); break;
            case 'sidebar-toggle':
                document.body.classList.toggle('sidebar-open');
                break;
            case 'focus-search':
                document.getElementById('search').focus();
                break;
            case 'load-foods': loadFoods(); break;
            case 'order': order(); break;
            case 'load-orders': loadOrders(); break;
            case 'ai-recommend': aiRecommend(); break;
            case 'ai-forecast': aiForecast(); break;
            case 'ai-chat': aiChat(); break;
            case 'manage-foods': manageTab('foods', element); break;
            case 'manage-categories': manageTab('categories', element); break;
            case 'manage-ingredients': manageTab('ingredients', element); break;
            case 'manage-menus': manageTab('menus', element); break;
            case 'manage-users': manageTab('users', element); break;
            case 'close-category': closeCategoryModal(); break;
            case 'save-category': saveCategory(); break;
            case 'close-action': closeActionModal(); break;
            case 'submit-action': submitActionModal(); break;
            case 'close-delete-category': closeDeleteCategory(); break;
            case 'delete-category': deleteCategory(); break;
            case 'close-checkout': closeCheckout(event); break;
            case 'submit-order': submitOrder(event); break;
            /* CSP_DYNAMIC_EVENT_REFACTOR_V1 */
            case 'change-qty':
                changeQty(Number(element.dataset.id), Number(element.dataset.delta));
                break;
            case 'cart-qty':
                selected[element.dataset.id] = Math.max(
                    0,
                    Math.min(Number(element.dataset.stock), Number(element.value))
                );
                updateCart();
                break;
            case 'change-status':
                changeStatus(Number(element.dataset.id), element.value);
                break;
            case 'pay-order':
                pay(Number(element.dataset.id));
                break;
            case 'open-food-new': openFoodModal(); break;
            case 'open-category-new': openCategoryModal(); break;
            case 'open-ingredient-new': openIngredientModal(); break;
            case 'open-menu-new': openMenuModal(); break;
            case 'edit-food': openFoodModal(Number(element.dataset.id)); break;
            case 'hide-food':
                openHideFood(Number(element.dataset.id), element.dataset.name || '');
                break;
            case 'edit-category': openCategoryModal(Number(element.dataset.id)); break;
            case 'open-delete-category':
                openDeleteCategory(Number(element.dataset.id));
                break;
            case 'edit-ingredient': openIngredientModal(Number(element.dataset.id)); break;
            case 'movement-in':
                openMovementModal(Number(element.dataset.id), 'in');
                break;
            case 'movement-out':
                openMovementModal(Number(element.dataset.id), 'out');
                break;
            case 'menu-items': openMenuItemsModal(Number(element.dataset.id)); break;
            case 'remove-menu-item':
                removeMenuItem(Number(element.dataset.id), Number(element.dataset.menuId));
                break;
            case 'toggle-user':
                toggleUserConfirm(
                    Number(element.dataset.id),
                    element.dataset.status,
                    element.dataset.name || ''
                );
                break;

            /* CSP_MANAGEMENT_SEARCH_INPUTS_V1 */
            case 'load-manage-foods':
                loadManageFoods();
                break;
            case 'load-manage-categories':
                loadManageCategories();
                break;
            case 'load-ingredients':
                loadIngredients();
                break;
            case 'load-menus':
                loadMenus();
                break;
            case 'load-users':
                loadUsers();
                break;
        }
    }

    document.addEventListener('click', dispatchCspAction);
    document.addEventListener('input', dispatchCspAction);
    document.addEventListener('change', dispatchCspAction);
})();