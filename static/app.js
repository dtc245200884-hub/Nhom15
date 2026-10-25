let token=localStorage.token||'',user=null,selected={},foodCache={};
const $=id=>document.getElementById(id);
function makeElement(tag,className='',text=''){
  const element=document.createElement(tag);
  if(className) element.className=className;
  if(text!=='') element.textContent=String(text);
  return element;
}
function appendEmptyState(container,icon,title,message){
  const state=makeElement('div','empty-state');
  if(icon) state.append(makeElement('div','',icon));
  state.append(makeElement('h3','',title),makeElement('p','',message));
  container.replaceChildren(state);
}

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
    $('usersTab').hidden=user.role!=='admin';
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
async function loadCategories(){
  try{
    const categories=await api('/api/categories');
    if(!Array.isArray(categories)) throw Error('Dữ liệu danh mục không hợp lệ.');
    const options=[makeElement('option','','Tất cả danh mục'),...categories.map(category=>{
      const option=makeElement('option','',category.name);
      option.value=category.id;
      return option;
    })];
    options[0].value='';
    $('catFilter').replaceChildren(...options);
  }catch(e){
    notifyLoadError('danh mục',e);
  }
}
async function loadFoods(){
  try{
    const query=new URLSearchParams({search:$('search')?.value||'',in_stock:'false'});
    if($('catFilter')?.value) query.set('category_id',$('catFilter').value);
    if($('maxPrice')?.value) query.set('max_price',$('maxPrice').value);
    const foods=await api('/api/foods?'+query);
    if(!Array.isArray(foods)) throw Error('Dữ liệu món ăn không hợp lệ.');
    const nextFoodCache={};
    foods.forEach(food=>nextFoodCache[food.id]=food);
    const container=$('foods');
    if(!foods.length){
      const emptyState=makeElement('div','content-card','');
      emptyState.append(makeElement('p','','Không có món phù hợp.'));
      container.replaceChildren(emptyState);
      foodCache=nextFoodCache;
      updateCart();
      return;
    }
    const cards=foods.map(food=>{
      const card=makeElement('article','food');
      const visual=makeElement('div','food-visual');
      visual.append(makeElement('span','',foodEmoji(food.name)));
      visual.append(makeElement('span',`stock ${food.stock<10?'low':''}`,food.stock<10?'Sắp hết':`Còn ${food.stock}`));
      const body=makeElement('div','food-body');
      const heading=makeElement('div','foodhead');
      heading.append(makeElement('h3','',food.name));
      const description=makeElement('p','',food.description||'Món ăn tươi ngon được phục vụ tại căng tin trường.');
      const price=makeElement('div','food-price');
      price.append(makeElement('b','',money(food.price)),makeElement('small','muted',`${food.stock} phần`));
      const quantity=makeElement('div','qty-control');
      const decrement=makeElement('button','','−');
      decrement.addEventListener('click',()=>changeQty(food.id,-1));
      const input=makeElement('input');
      input.type='number';
      input.min='0';
      input.max=food.stock;
      input.value=selected[food.id]||0;
      input.addEventListener('change',()=>{
        selected[food.id]=Math.max(0,Math.min(food.stock,Number(input.value)));
        updateCart();
      });
      const increment=makeElement('button','','+');
      increment.addEventListener('click',()=>changeQty(food.id,1));
      quantity.append(decrement,input,increment);
      body.append(heading,description,price,quantity);
      card.append(visual,body);
      return card;
    });
    container.replaceChildren(...cards);
    foodCache=nextFoodCache;
    updateCart();
  }catch(e){
    notifyLoadError('món ăn',e);
  }
}
function changeQty(id,delta){const f=foodCache[id];if(!f)return;selected[id]=Math.max(0,Math.min(f.stock,(selected[id]||0)+delta));loadFoods()}
function updateCart(){let count=0,total=0;for(const [id,q] of Object.entries(selected)){const f=foodCache[id];count+=Number(q)||0;if(f)total+=f.price*(Number(q)||0)}$('cartTotal').textContent=`${count} món · ${money(total)}`}
function order(){
  if(!token||!user) return showAuthNotice('Bạn cần đăng nhập để đặt món.');
  const items=Object.entries(selected).filter(([,q])=>Number(q)>0);
  if(!items.length) return toast('Hãy chọn ít nhất một món trước nhé.');
  const invalid=items.find(([id,q])=>!foodCache[id] || Number(q)>Number(foodCache[id].stock));
  if(invalid) return toast('Một món trong giỏ đã thay đổi tồn kho. Vui lòng kiểm tra lại.');
  const summary=$('checkoutSummary');
  const rows=items.map(([id,quantity])=>{
    const food=foodCache[id];
    const row=makeElement('div','checkout-row');
    row.append(makeElement('span','',`${food.name} × ${quantity}`),makeElement('b','',money(food.price*quantity)));
    return row;
  });
  const total=items.reduce((sum,[id,quantity])=>sum+(foodCache[id]?.price||0)*quantity,0);
  const totalRow=makeElement('div','checkout-row checkout-total');
  totalRow.append(makeElement('span','','Tổng cộng'),makeElement('b','',money(total)));
  summary.replaceChildren(...rows,totalRow);
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

async function loadOrders(){
  try{
    const statusFilter=$('statusFilter')?.value||'';
    const orders=await api('/api/orders?status_filter='+encodeURIComponent(statusFilter));
    if(!Array.isArray(orders)) throw Error('Dữ liệu đơn hàng không hợp lệ.');
    if(orders.some(order=>!order||!Array.isArray(order.items)||order.id==null||order.created_at==null||
      order.payment_method==null||order.payment_status==null||order.status==null||order.total==null||
      order.items.some(item=>!item||item.name==null||item.quantity==null))) throw Error('Dữ liệu đơn hàng không đầy đủ.');
    const cards=orders.length?orders.map(order=>{
      const card=makeElement('div','order');
      const heading=makeElement('div');
      heading.append(makeElement('b','',`Đơn #${order.id}`));
      heading.append(makeElement('small','',`${new Date(order.created_at).toLocaleString('vi-VN')} · ${order.payment_method} · ${order.payment_status}`));
      const status=makeElement('span','pill',order.status);
      const total=makeElement('strong','',money(order.total));
      const items=makeElement('div','orderitems',order.items.map(item=>`${item.name} × ${item.quantity}`).join(' · '));
      card.append(heading,status,total,items);
      if(['admin','staff'].includes(user.role)){
        const actions=makeElement('div','orderactions');
        const select=makeElement('select');
        const placeholder=makeElement('option','','Cập nhật trạng thái');
        placeholder.value='';
        select.append(placeholder);
        ['pending','confirmed','preparing','ready','completed','cancelled'].forEach(value=>{
          const option=makeElement('option','',value);
          option.value=value;
          option.selected=value===order.status;
          select.append(option);
        });
        select.addEventListener('change',()=>changeStatus(order.id,select.value));
        const payment=makeElement('button','','Thanh toán');
        payment.addEventListener('click',()=>pay(order.id));
        actions.append(select,payment);
        card.append(actions);
      }
      return card;
    }):[makeElement('p','','Chưa có đơn hàng.')];
    const container=$('orderList');
    if(!container) throw Error('Không tìm thấy danh sách đơn hàng.');
    container.replaceChildren(...cards);
  }catch(e){
    notifyLoadError('đơn hàng',e);
  }
}
async function changeStatus(id,status){if(!status)return;try{await api('/api/orders/'+id+'/status',{method:'PATCH',body:JSON.stringify({status})});toast('Đã cập nhật trạng thái đơn hàng');loadOrders();loadFoods();loadNotifications()}catch(e){toast(e.message)}}
function pay(id){openActionModal({title:'Cập nhật thanh toán',eyebrow:'PAYMENT',icon:'💳',message:'Chọn trạng thái và phương thức thanh toán cho đơn hàng.',submit:'Lưu thanh toán',fields:`<label>Trạng thái thanh toán</label><select id="payStatus" class="modal-input"><option value="paid">Đã thanh toán</option><option value="unpaid">Chưa thanh toán</option><option value="refunded">Đã hoàn tiền</option></select><label>Phương thức</label><select id="payMethod" class="modal-input"><option value="cash">Tiền mặt</option><option value="transfer">Chuyển khoản</option></select>`,submitFn:async()=>{await api('/api/orders/'+id+'/payment',{method:'POST',body:JSON.stringify({status:$('payStatus').value,method:$('payMethod').value})});closeActionModal();toast('Đã cập nhật thanh toán');loadOrders();loadNotifications()}})}
async function aiRecommend(){await runAI('/api/ai/recommend',null)}
async function aiForecast(){await runAI('/api/ai/forecast',null)}
async function aiChat(){let q=$('question').value.trim();if(!q){toast('Vui lòng nhập câu hỏi cho AI');$('question').focus();return}await runAI('/api/ai/chat',{question:q})}
async function runAI(url,body){$('answer').textContent='AI đang phân tích...';try{$('answer').textContent=(await api(url,{method:'POST',body:body?JSON.stringify(body):JSON.stringify({})})).answer}catch(e){$('answer').textContent=e.message}}
async function loadDashboard(){
  try{
    const dashboard=await api('/api/dashboard');
    const statLabels=[['today_orders','Đơn hôm nay'],['today_revenue','Doanh thu hôm nay'],['total_orders','Tổng đơn'],['revenue','Tổng doanh thu'],['low_stock','Món sắp hết'],['low_ingredients','Nguyên liệu sắp hết']];
    if(!dashboard||typeof dashboard!=='object'||Array.isArray(dashboard)||
      statLabels.some(([key])=>dashboard[key]===undefined||dashboard[key]===null)||
      !dashboard.order_statuses||typeof dashboard.order_statuses!=='object'||Array.isArray(dashboard.order_statuses)||
      !Array.isArray(dashboard.top_foods)||
      dashboard.top_foods.some(food=>!food||food.name==null||food.quantity==null)) throw Error('Dữ liệu tổng quan không hợp lệ.');
    const report=await api('/api/reports/sales?days=7');
    if(!Array.isArray(report)||report.some(day=>!day||day.date==null||day.orders==null||day.revenue==null)){
      throw Error('Dữ liệu báo cáo doanh thu không hợp lệ.');
    }
    const statsContent=statLabels.map(([key,label])=>{
      const item=makeElement('div');
      item.append(makeElement('b','',key.includes('revenue')?money(dashboard[key]):dashboard[key]),makeElement('span','',label));
      return item;
    });
    const statusContent=Object.entries(dashboard.order_statuses).map(([status,count])=>{
      const item=makeElement('div');
      item.append(makeElement('b','',count),makeElement('span','',status));
      return item;
    });
    const topFoodContent=dashboard.top_foods.length
      ?dashboard.top_foods.map(food=>{
        const row=makeElement('div','barrow');
        row.append(makeElement('span','',food.name),makeElement('b','',food.quantity));
        return row;
      })
      :[makeElement('span','','Chưa có dữ liệu')];
    const reportContent=report.map(day=>{
      const row=makeElement('div','barrow');
      row.append(makeElement('span','',day.date),makeElement('b','',`${day.orders} đơn · ${money(day.revenue)}`));
      return row;
    });
    const stats=$('stats'),statusStats=$('statusStats'),topFoods=$('topFoods'),salesReport=$('salesReport');
    if(!stats||!statusStats||!topFoods||!salesReport) throw Error('Không tìm thấy đầy đủ vùng hiển thị tổng quan.');
    stats.replaceChildren(...statsContent);
    statusStats.replaceChildren(...statusContent);
    topFoods.replaceChildren(...topFoodContent);
    salesReport.replaceChildren(...reportContent);
  }catch(e){
    notifyLoadError('bảng điều khiển',e);
  }
}
function manageTab(type,btn){
  let c=$('manageContent');
  document.querySelectorAll('.manage-tab').forEach(x=>x.classList.remove('active')); if(btn)btn.classList.add('active');
  if(type==='foods') c.innerHTML=`<div class="management-head"><div><span class="eyebrow dark">FOOD MANAGEMENT</span><h2>Quản lý món ăn</h2><p>Thêm món, cập nhật giá bán, tồn kho và trạng thái phục vụ trong căng tin.</p></div><button class="primary-btn" onclick="openFoodModal()">＋ Thêm món</button></div><div class="management-toolbar"><div class="search-box">⌕<input id="foodManageSearch" placeholder="Tìm tên món..." oninput="loadManageFoods()"></div><div class="management-stats"><span id="foodCount">0 món</span><span id="foodLowCount">0 sắp hết</span></div></div><div id="manageFoods" class="management-grid"></div>`;
  if(type==='categories') c.innerHTML=`<div class="management-head"><div><span class="eyebrow dark">CATEGORY MANAGEMENT</span><h2>Danh mục món ăn</h2><p>Phân loại món ăn để khách hàng tìm kiếm nhanh và giúp nhân viên quản lý thực đơn dễ dàng.</p></div><button class="primary-btn" onclick="openCategoryModal()">＋ Thêm danh mục</button></div><div class="category-toolbar"><div class="search-box">⌕<input id="categorySearch" placeholder="Tìm tên danh mục..." oninput="loadManageCategories()"></div><div class="category-summary"><span id="categoryCount">0 danh mục</span><span id="categoryFoodCount">0 món ăn</span></div></div><div id="manageCategories" class="category-grid"></div>`;
  if(type==='ingredients') c.innerHTML=`<div class="management-head"><div><span class="eyebrow dark">INVENTORY MANAGEMENT</span><h2>Kho nguyên liệu</h2><p>Theo dõi tồn kho, mức tối thiểu và thực hiện nhập — xuất nguyên liệu cho căng tin.</p></div><button class="primary-btn" onclick="openIngredientModal()">＋ Thêm nguyên liệu</button></div><div class="management-toolbar"><div class="search-box">⌕<input id="ingredientSearch" placeholder="Tìm nguyên liệu..." oninput="loadIngredients()"></div><div class="management-stats"><span id="ingredientCount">0 nguyên liệu</span><span id="ingredientLowCount">0 sắp hết</span></div></div><div id="ingredientsList" class="management-grid"></div>`;
  if(type==='menus') c.innerHTML=`<div class="management-head"><div><span class="eyebrow dark">DAILY MENU</span><h2>Thực đơn theo ngày</h2><p>Tạo thực đơn, theo dõi món đang phục vụ và tổ chức món ăn theo từng ngày.</p></div><button class="primary-btn" onclick="openMenuModal()">＋ Tạo thực đơn</button></div><div class="management-toolbar"><div class="search-box">⌕<input id="menuSearch" placeholder="Tìm tên thực đơn..." oninput="loadMenus()"></div><div class="management-stats"><span id="menuCount">0 thực đơn</span></div></div><div id="menusList" class="management-grid"></div>`;
  if(type==='users') c.innerHTML=`<div class="management-head"><div><span class="eyebrow dark">USER MANAGEMENT</span><h2>Quản lý người dùng</h2><p>Kiểm tra vai trò và trạng thái tài khoản đang sử dụng hệ thống.</p></div><div class="management-note">🔐 Chỉ quản trị viên có quyền thay đổi trạng thái</div></div><div class="management-toolbar"><div class="search-box">⌕<input id="userSearch" placeholder="Tìm tên hoặc email..." oninput="loadUsers()"></div><div class="management-stats"><span id="userCount">0 người dùng</span></div></div><div id="usersList" class="management-grid"></div>`;
  if(type==='foods')loadManageFoods(); if(type==='categories')loadManageCategories(); if(type==='ingredients')loadIngredients(); if(type==='menus')loadMenus(); if(type==='users')loadUsers();
}

let categoryCache=[];let categoryModalMode='add';let categoryModalId=null;
async function loadManageFoods(){
  try{
    const categories=await api('/api/categories');
    const query=($('foodManageSearch')?.value||'').trim();
    const foods=await api('/api/foods?search='+encodeURIComponent(query));
    if(!Array.isArray(categories)||!Array.isArray(foods)) throw Error('Dữ liệu món ăn không hợp lệ.');
    const container=$('manageFoods');
    let cards;
    if(!foods.length){
      const emptyState=makeElement('div','empty-state');
      emptyState.append(makeElement('div','','🍽️'),makeElement('h3','','Chưa có món ăn'),makeElement('p','','Hãy thêm món ăn đầu tiên cho căng tin.'));
      cards=[emptyState];
    }else{
      cards=foods.map(food=>{
        const card=makeElement('article','manage-card food-manage-card');
        const icon=makeElement('div','manage-card-icon',foodEmoji(food.name));
        const body=makeElement('div','manage-card-main');
        const top=makeElement('div','manage-card-top');
        const low=food.stock<10;
        top.append(makeElement('span','manage-code',`MÓN #${String(food.id).padStart(3,'0')}`));
        top.append(makeElement('span',`status-badge ${low?'warning':'success'}`,low?'Sắp hết':'Đang bán'));
        body.append(top,makeElement('h3','',food.name),makeElement('p','',food.description||'Chưa có mô tả cho món ăn.'));
        const metadata=makeElement('div','manage-meta');
        const category=categories.find(item=>item.id===food.category_id)?.name||'Chưa phân loại';
        metadata.append(
          makeElement('span','',`💰 ${money(food.price)}`),
          makeElement('span','',`📦 ${food.stock} phần`),
          makeElement('span','',`🏷️ ${category}`)
        );
        const actions=makeElement('div','manage-actions');
        const edit=makeElement('button','ghost-btn small-btn','✎ Sửa');
        edit.addEventListener('click',()=>openFoodModal(food.id));
        const hide=makeElement('button','danger-btn','🗑 Ẩn món');
        hide.addEventListener('click',()=>openHideFood(food.id,food.name));
        actions.append(edit,hide);
        body.append(metadata,actions);
        card.append(icon,body);
        return card;
      });
    }
    container.replaceChildren(...cards);
    if($('foodCount')) $('foodCount').textContent=`${foods.length} món`;
    if($('foodLowCount')) $('foodLowCount').textContent=`${foods.filter(food=>food.stock<10).length} sắp hết`;
  }catch(e){
    notifyLoadError('món ăn quản lý',e);
  }
}
async function openFoodModal(id=null){
  try{
  const categories=await api('/api/categories');
  const foods=await api('/api/foods');
  if(!Array.isArray(categories)||!Array.isArray(foods)) throw Error('Dữ liệu món ăn không hợp lệ.');
  const food=id?foods.find(item=>item.id===id):null;
  openActionModal({
    type:'food',
    title:id?'Chỉnh sửa món ăn':'Thêm món ăn mới',
    eyebrow:'FOOD MANAGEMENT',
    icon:'🍽️',
    message:id?'Cập nhật thông tin món ăn và tồn kho.':'Nhập thông tin món ăn để hiển thị trên thực đơn.',
    submit:id?'Lưu thay đổi':'Thêm món',
    renderFields(container){
      const grid=makeElement('div','modal-form-grid');
      const nameGroup=makeElement('div');
      nameGroup.append(makeElement('label','','Tên món'));
      const nameInput=makeElement('input','modal-input');
      nameInput.id='af_name'; nameInput.placeholder='Ví dụ: Cơm gà sốt tiêu'; nameInput.value=food?.name||'';
      nameGroup.append(nameInput);
      const categoryGroup=makeElement('div');
      categoryGroup.append(makeElement('label','','Danh mục'));
      const categorySelect=makeElement('select','modal-input');
      categorySelect.id='af_cat';
      const noCategory=makeElement('option','','Không chọn'); noCategory.value='';
      categorySelect.append(noCategory);
      categories.forEach(category=>{
        const option=makeElement('option','',category.name);
        option.value=category.id;
        option.selected=food?.category_id===category.id;
        categorySelect.append(option);
      });
      categoryGroup.append(categorySelect);
      const priceGroup=makeElement('div');
      priceGroup.append(makeElement('label','','Giá bán (VNĐ)'));
      const priceInput=makeElement('input','modal-input');
      priceInput.id='af_price'; priceInput.type='number'; priceInput.min='0'; priceInput.placeholder='25000';
      priceInput.value=food?.price??'';
      priceGroup.append(priceInput);
      const stockGroup=makeElement('div');
      stockGroup.append(makeElement('label','','Tồn kho (phần)'));
      const stockInput=makeElement('input','modal-input');
      stockInput.id='af_stock'; stockInput.type='number'; stockInput.min='0'; stockInput.value=food?.stock??0;
      stockGroup.append(stockInput);
      grid.append(nameGroup,categoryGroup,priceGroup,stockGroup);
      const descriptionLabel=makeElement('label','','Mô tả món ăn');
      const description=makeElement('textarea','modal-textarea');
      description.id='af_desc'; description.placeholder='Mô tả ngắn về món ăn'; description.value=food?.description||'';
      container.replaceChildren(grid,descriptionLabel,description);
    },
    submitFn:async()=>{
      const data={name:$('af_name').value.trim(),description:$('af_desc').value.trim(),price:+$('af_price').value,stock:+$('af_stock').value,category_id:$('af_cat').value?+$('af_cat').value:null};
      if(!data.name||data.price<0||data.stock<0) throw Error('Vui lòng nhập thông tin món ăn hợp lệ');
      await api(id?'/api/foods/'+id:'/api/foods',{method:id?'PUT':'POST',body:JSON.stringify(data)});
      closeActionModal(); toast(id?'Đã cập nhật món ăn':'Đã thêm món ăn'); loadFoods(); loadManageFoods();
    }
  });
  }catch(e){
    notifyLoadError('món ăn',e);
  }
}
async function openHideFood(id,name){
  openActionModal({
    title:'Ẩn món ăn?',eyebrow:'XÁC NHẬN THAO TÁC',icon:'🗑️',
    messageParts:['Bạn có chắc muốn ẩn món ',name,'? Món sẽ không còn hiển thị cho khách hàng.'],
    submit:'Ẩn món',danger:true,
    submitFn:async()=>{await api('/api/foods/'+id,{method:'DELETE'});closeActionModal();toast('Đã ẩn món ăn');loadFoods();loadManageFoods()}
  });
}

async function loadManageCategories(){
  try{
    const categories=await api('/api/categories');
    const foods=await api('/api/foods');
    if(!Array.isArray(categories)||!Array.isArray(foods)) throw Error('Dữ liệu danh mục không hợp lệ.');
    const query=($('categorySearch')?.value||'').trim().toLowerCase();
    const filtered=categories.filter(category=>!query||category.name.toLowerCase().includes(query)||(category.description||'').toLowerCase().includes(query));
    const container=$('manageCategories');
    if(!container) return;
    let cards;
    if(!filtered.length){
      const emptyState=makeElement('div','empty-state');
      emptyState.append(makeElement('div','','🗂️'),makeElement('h3','','Chưa có danh mục phù hợp'),makeElement('p','','Hãy thêm danh mục mới hoặc thử từ khóa khác.'));
      cards=[emptyState];
    }else{
      const icons=['🍚','🥤','🍜','🍱','🍰','🥗','🍔','🍎'];
      cards=filtered.map((category,index)=>{
        const count=foods.filter(food=>food.category_id===category.id).length;
        const card=makeElement('article','category-card');
        const body=makeElement('div','category-card-body');
        const top=makeElement('div','category-card-top');
        top.append(makeElement('span','category-index',`DANH MỤC ${String(index+1).padStart(2,'0')}`));
        top.append(makeElement('span','category-count',`${count} món`));
        body.append(top,makeElement('h3','',category.name),makeElement('p','',category.description||'Chưa có mô tả cho danh mục này.'));
        const actions=makeElement('div','category-card-actions');
        const edit=makeElement('button','ghost-btn small-btn','✎ Sửa');
        edit.addEventListener('click',()=>openCategoryModal(category.id));
        const remove=makeElement('button','danger-btn','🗑 Xóa');
        remove.addEventListener('click',()=>openDeleteCategory(category.id));
        actions.append(edit,remove);
        body.append(actions);
        card.append(makeElement('div','category-icon',icons[index%icons.length]),body);
        return card;
      });
    }
    container.replaceChildren(...cards);
    categoryCache=categories;
    if($('categoryCount')) $('categoryCount').textContent=`${categories.length} danh mục`;
    if($('categoryFoodCount')) $('categoryFoodCount').textContent=`${foods.length} món ăn`;
  }catch(e){
    notifyLoadError('danh mục',e);
  }
}
function openCategoryModal(id=null){categoryModalMode=id?'edit':'add';categoryModalId=id;let c=id?categoryCache.find(x=>x.id===id):null;$('categoryModalTitle').textContent=id?'Chỉnh sửa danh mục':'Thêm danh mục mới';$('categoryNameInput').value=c?.name||'';$('categoryDescInput').value=c?.description||'';$('categoryModalSubmit').textContent=id?'Lưu thay đổi':'Thêm danh mục';$('categoryModal').hidden=false;setTimeout(()=>$('categoryNameInput').focus(),30)}
function closeCategoryModal(){$('categoryModal').hidden=true}
async function saveCategory(){let name=$('categoryNameInput').value.trim(),description=$('categoryDescInput').value.trim();if(!name){toast('Vui lòng nhập tên danh mục');return}try{await api(categoryModalMode==='edit'?'/api/categories/'+categoryModalId:'/api/categories',{method:categoryModalMode==='edit'?'PUT':'POST',body:JSON.stringify({name,description})});closeCategoryModal();toast(categoryModalMode==='edit'?'Đã cập nhật danh mục':'Đã thêm danh mục');loadCategories();loadManageCategories()}catch(e){toast(e.message)}}
function openDeleteCategory(id){let c=categoryCache.find(x=>x.id===id);if(!c)return;categoryModalId=id;$('deleteCategoryName').textContent=c.name;$('deleteCategoryModal').hidden=false}
function closeDeleteCategory(){$('deleteCategoryModal').hidden=true}
async function deleteCategory(){try{await api('/api/categories/'+categoryModalId,{method:'DELETE'});closeDeleteCategory();toast('Đã xóa danh mục');loadCategories();loadManageCategories()}catch(e){closeDeleteCategory();toast(e.message)}}
async function loadIngredients(){
  try{
    const ingredients=await api('/api/ingredients');
    if(!Array.isArray(ingredients)) throw Error('Dữ liệu nguyên liệu không hợp lệ.');
    const query=($('ingredientSearch')?.value||'').trim().toLowerCase();
    const filtered=ingredients.filter(ingredient=>ingredient.name.toLowerCase().includes(query));
    const container=$('ingredientsList');
    let cards;
    if(!filtered.length){
      const emptyState=makeElement('div','empty-state');
      emptyState.append(makeElement('div','','📦'),makeElement('h3','','Kho chưa có nguyên liệu'),makeElement('p','','Thêm nguyên liệu để bắt đầu theo dõi tồn kho.'));
      cards=[emptyState];
    }else{
      cards=filtered.map(ingredient=>{
        const low=ingredient.quantity<=ingredient.min_quantity;
        const percentage=ingredient.min_quantity?Math.min(100,Math.round(ingredient.quantity/(ingredient.min_quantity*3)*100)):100;
        const card=makeElement('article','manage-card ingredient-card');
        const body=makeElement('div','manage-card-main');
        const top=makeElement('div','manage-card-top');
        top.append(makeElement('span','manage-code',`NGUYÊN LIỆU #${String(ingredient.id).padStart(3,'0')}`));
        top.append(makeElement('span',`status-badge ${low?'warning':'success'}`,low?'Sắp hết':'Ổn định'));
        const quantity=makeElement('div','inventory-number');
        quantity.append(makeElement('b','',ingredient.quantity),makeElement('span','',ingredient.unit));
        const bar=makeElement('div','inventory-bar');
        const fill=makeElement('span');
        fill.style.width=`${percentage}%`;
        bar.append(fill);
        const metadata=makeElement('div','manage-meta');
        metadata.append(
          makeElement('span','',`Ngưỡng tối thiểu: ${ingredient.min_quantity} ${ingredient.unit}`),
          makeElement('span','',`Giá/đơn vị: ${money(ingredient.cost_per_unit)}`)
        );
        const actions=makeElement('div','manage-actions');
        const edit=makeElement('button','ghost-btn small-btn','✎ Sửa');
        edit.addEventListener('click',()=>openIngredientModal(ingredient.id));
        const stockIn=makeElement('button','stock-in-btn','＋ Nhập kho');
        stockIn.addEventListener('click',()=>openMovementModal(ingredient.id,'in'));
        const stockOut=makeElement('button','stock-out-btn','− Xuất kho');
        stockOut.addEventListener('click',()=>openMovementModal(ingredient.id,'out'));
        actions.append(edit,stockIn,stockOut);
        body.append(top,makeElement('h3','',ingredient.name),quantity,bar,metadata,actions);
        card.append(makeElement('div','manage-card-icon',low?'⚠️':'📦'),body);
        return card;
      });
    }
    container.replaceChildren(...cards);
    if($('ingredientCount')) $('ingredientCount').textContent=`${ingredients.length} nguyên liệu`;
    if($('ingredientLowCount')) $('ingredientLowCount').textContent=`${ingredients.filter(item=>item.quantity<=item.min_quantity).length} sắp hết`;
  }catch(e){
    notifyLoadError('nguyên liệu',e);
  }
}
async function openIngredientModal(id=null){
  try{
  const ingredients=await api('/api/ingredients');
  if(!Array.isArray(ingredients)) throw Error('Dữ liệu nguyên liệu không hợp lệ.');
  const ingredient=id?ingredients.find(item=>item.id===id):null;
  openActionModal({
    title:id?'Chỉnh sửa nguyên liệu':'Thêm nguyên liệu mới',
    eyebrow:'INVENTORY MANAGEMENT',
    icon:'📦',
    message:id?'Cập nhật thông tin và mức tồn kho.':'Nhập thông tin nguyên liệu sử dụng trong căng tin.',
    submit:id?'Lưu thay đổi':'Thêm nguyên liệu',
    renderFields(container){
      const grid=makeElement('div','modal-form-grid');
      const fields=[
        ['ai_name','Tên nguyên liệu','text',ingredient?.name||''],
        ['ai_unit','Đơn vị tính','text',ingredient?.unit||'kg'],
        ['ai_q','Số lượng tồn','number',ingredient?.quantity??0],
        ['ai_min','Mức tối thiểu','number',ingredient?.min_quantity??0]
      ];
      fields.forEach(([id,label,type,value])=>{
        const group=makeElement('div');
        group.append(makeElement('label','',label));
        const input=makeElement('input','modal-input');
        input.id=id; input.type=type; input.value=value;
        if(type==='number') input.min='0';
        group.append(input);
        grid.append(group);
      });
      const costLabel=makeElement('label','','Giá nhập / đơn vị');
      const cost=makeElement('input','modal-input');
      cost.id='ai_cost'; cost.type='number'; cost.min='0'; cost.value=ingredient?.cost_per_unit??0;
      container.replaceChildren(grid,costLabel,cost);
    },
    submitFn:async()=>{
      const data={name:$('ai_name').value.trim(),unit:$('ai_unit').value.trim(),quantity:+$('ai_q').value,min_quantity:+$('ai_min').value,cost_per_unit:+$('ai_cost').value};
      if(!data.name||!data.unit||data.quantity<0||data.min_quantity<0) throw Error('Vui lòng nhập thông tin hợp lệ');
      await api(id?'/api/ingredients/'+id:'/api/ingredients',{method:id?'PUT':'POST',body:JSON.stringify(data)});
      closeActionModal(); toast(id?'Đã cập nhật nguyên liệu':'Đã thêm nguyên liệu'); loadIngredients();
    }
  });
  }catch(e){
    notifyLoadError('nguyên liệu',e);
  }
}
function openMovementModal(id,type){let label=type==='in'?'Nhập kho':'Xuất kho';openActionModal({title:label+' nguyên liệu',eyebrow:'INVENTORY MOVEMENT',icon:type==='in'?'📥':'📤',message:'Nhập số lượng cần cập nhật. Hệ thống sẽ kiểm tra tồn kho trước khi ghi nhận.',submit:label,fields:`<label>Số lượng</label><input id="moveQty" class="modal-input" type="number" min="0.1" step="0.1" placeholder="Nhập số lượng"><label>Ghi chú</label><textarea id="moveNote" class="modal-textarea" placeholder="Ví dụ: Nhập hàng buổi sáng..."></textarea>`,submitFn:async()=>{let q=Number($('moveQty').value);if(!(q>0))throw Error('Số lượng phải lớn hơn 0');await api('/api/inventory/movement',{method:'POST',body:JSON.stringify({ingredient_id:id,movement_type:type,quantity:q,note:$('moveNote').value.trim()||'Cập nhật từ giao diện'})});closeActionModal();toast(type==='in'?'Đã nhập kho':'Đã xuất kho');loadIngredients();loadDashboard()}})}
async function loadMenus(){
  try{
    const menus=await api('/api/menus');
    if(!Array.isArray(menus)) throw Error('Dữ liệu thực đơn không hợp lệ.');
    const query=($('menuSearch')?.value||'').trim().toLowerCase();
    const filtered=menus.filter(menu=>!query||menu.title.toLowerCase().includes(query));
    const container=$('menusList');
    let cards;
    if(!filtered.length){
      const emptyState=makeElement('div','empty-state');
      emptyState.append(makeElement('div','','📅'),makeElement('h3','','Chưa có thực đơn'),makeElement('p','','Tạo thực đơn để bắt đầu tổ chức món theo ngày.'));
      cards=[emptyState];
    }else{
      cards=filtered.map(menu=>{
        const date=new Date(menu.menu_date+'T00:00:00');
        const card=makeElement('article','manage-card menu-card');
        const dateBlock=makeElement('div','menu-date');
        dateBlock.append(makeElement('b','',date.getDate()),makeElement('span','',date.toLocaleDateString('vi-VN',{month:'short'})));
        const body=makeElement('div','manage-card-main');
        const top=makeElement('div','manage-card-top');
        top.append(makeElement('span','manage-code',`THỰC ĐƠN #${String(menu.id).padStart(3,'0')}`),makeElement('span','status-badge success','Đang áp dụng'));
        const itemNames=menu.items.length?menu.items.map(item=>item.name).join(' · '):'Chưa có món trong thực đơn.';
        const metadata=makeElement('div','manage-meta');
        metadata.append(makeElement('span','',`📅 ${date.toLocaleDateString('vi-VN')}`),makeElement('span','',`🍽️ ${menu.items.length} món`));
        const actions=makeElement('div','manage-actions');
        const manage=makeElement('button','ghost-btn small-btn','🍽 Quản lý món');
        manage.addEventListener('click',()=>openMenuItemsModal(menu.id));
        actions.append(manage);
        body.append(top,makeElement('h3','',menu.title),makeElement('p','',itemNames),metadata,actions);
        card.append(dateBlock,body);
        return card;
      });
    }
    container.replaceChildren(...cards);
    if($('menuCount')) $('menuCount').textContent=`${menus.length} thực đơn`;
  }catch(e){
    notifyLoadError('thực đơn',e);
  }
}
async function openMenuModal(){
  openActionModal({
    title:'Tạo thực đơn mới',eyebrow:'DAILY MENU',icon:'📅',
    message:'Tạo thực đơn theo ngày để nhân viên dễ dàng tổ chức món phục vụ.',
    submit:'Tạo thực đơn',
    renderFields(container){
      const dateLabel=makeElement('label','','Ngày áp dụng');
      const date=makeElement('input','modal-input');
      date.id='am_date'; date.type='date'; date.value=new Date().toISOString().slice(0,10);
      const titleLabel=makeElement('label','','Tên thực đơn');
      const title=makeElement('input','modal-input');
      title.id='am_title'; title.placeholder='Ví dụ: Thực đơn thứ Hai';
      container.replaceChildren(dateLabel,date,titleLabel,title);
    },
    submitFn:async()=>{
      const date=$('am_date').value;
      const title=$('am_title').value.trim();
      if(!date||!title) throw Error('Vui lòng nhập đầy đủ ngày và tên thực đơn');
      await api('/api/menus',{method:'POST',body:JSON.stringify({menu_date:date,title})});
      closeActionModal(); toast('Đã tạo thực đơn'); loadMenus();
    }
  });
}
async function openMenuItemsModal(menuId){
  try{
  const menus=await api('/api/menus');
  if(!Array.isArray(menus)) throw Error('Dữ liệu thực đơn không hợp lệ.');
  const menu=menus.find(item=>item.id===menuId);
  const foods=await api('/api/foods');
  if(!Array.isArray(foods)) throw Error('Dữ liệu món ăn không hợp lệ.');
  openActionModal({
    title:'Quản lý món trong thực đơn',eyebrow:'MENU ITEMS',icon:'🍽️',
    message:`${menu?.title||'Thực đơn'} · ${menu?.menu_date||''}`,
    submit:'Thêm món',
    renderFields(container){
      const label=makeElement('label','','Chọn món ăn');
      const select=makeElement('select','modal-input');
      select.id='menuFood';
      const placeholder=makeElement('option','','Chọn món...');
      placeholder.value='';
      select.append(placeholder);
      foods.forEach(food=>{
        const option=makeElement('option','',`${food.name} — ${money(food.price)}`);
        option.value=food.id;
        select.append(option);
      });
      const current=makeElement('div','menu-items-current');
      const items=menu?.items||[];
      if(items.length){
        items.forEach(item=>{
          const row=makeElement('div');
          row.append(makeElement('span','',item.name));
          const remove=makeElement('button','danger-text-btn','Xóa');
          remove.type='button';
          remove.addEventListener('click',()=>removeMenuItem(item.id,menuId));
          row.append(remove);
          current.append(row);
        });
      }else current.append(makeElement('small','','Chưa có món trong thực đơn.'));
      container.replaceChildren(label,select,current);
    },
    submitFn:async()=>{
      const foodId=$('menuFood').value;
      if(!foodId) throw Error('Hãy chọn một món');
      await api('/api/menus/'+menuId+'/items/'+foodId,{method:'POST'});
      closeActionModal(); toast('Đã thêm món vào thực đơn'); loadMenus();
    }
  });
  }catch(e){
    notifyLoadError('món trong thực đơn',e);
  }
}
async function removeMenuItem(itemId,menuId){try{await api('/api/menus/items/'+itemId,{method:'DELETE'});toast('Đã xóa món khỏi thực đơn');closeActionModal();loadMenus()}catch(e){toast(e.message)}}
async function loadUsers(){
  try{
    const users=await api('/api/users');
    if(!Array.isArray(users)) throw Error('Dữ liệu người dùng không hợp lệ.');
    const query=($('userSearch')?.value||'').trim().toLowerCase();
    const filtered=users.filter(item=>!query||item.full_name.toLowerCase().includes(query)||item.email.toLowerCase().includes(query));
    const container=$('usersList');
    let cards;
    if(!filtered.length){
      const emptyState=makeElement('div','empty-state');
      emptyState.append(makeElement('div','','👥'),makeElement('h3','','Không tìm thấy người dùng'),makeElement('p','','Thử tìm bằng tên hoặc email khác.'));
      cards=[emptyState];
    }else{
      cards=filtered.map(account=>{
        const active=account.status==='active';
        const card=makeElement('article','manage-card user-card');
        const body=makeElement('div','manage-card-main');
        const top=makeElement('div','manage-card-top');
        top.append(makeElement('span','manage-code',`USER #${String(account.id).padStart(3,'0')}`));
        top.append(makeElement('span',`status-badge ${active?'success':'danger'}`,active?'Đang hoạt động':'Đã khóa'));
        const metadata=makeElement('div','manage-meta');
        metadata.append(
          makeElement('span','',`👤 Vai trò: ${account.role}`),
          makeElement('span','',`📅 ${account.created_at?new Date(account.created_at).toLocaleDateString('vi-VN'):''}`)
        );
        const actions=makeElement('div','manage-actions');
        const toggle=makeElement('button',active?'danger-btn':'stock-in-btn',active?'🔒 Khóa tài khoản':'🔓 Mở khóa');
        toggle.addEventListener('click',()=>toggleUserConfirm(account.id,active?'blocked':'active',account.full_name));
        actions.append(toggle);
        body.append(top,makeElement('h3','',account.full_name),makeElement('p','',account.email),metadata,actions);
        card.append(makeElement('div','user-avatar-large',(account.full_name||'U').slice(0,1).toUpperCase()),body);
        return card;
      });
    }
    container.replaceChildren(...cards);
    if($('userCount')) $('userCount').textContent=`${users.length} người dùng`;
  }catch(e){
    notifyLoadError('người dùng',e);
  }
}
async function toggleUserConfirm(id,status,name){
  const action=status==='blocked'?'khóa':'mở khóa';
  openActionModal({
    title:status==='blocked'?'Khóa tài khoản?':'Mở khóa tài khoản?',
    eyebrow:'USER MANAGEMENT',icon:status==='blocked'?'🔒':'🔓',
    messageParts:[`Bạn có chắc muốn ${action} tài khoản `,name,'?'],
    submit:status==='blocked'?'Khóa tài khoản':'Mở khóa',
    danger:status==='blocked',
    submitFn:async()=>{await api('/api/users/'+id+'/status',{method:'PATCH',body:JSON.stringify({status})});closeActionModal();toast(status==='blocked'?'Đã khóa tài khoản':'Đã mở khóa tài khoản');loadUsers()}
  });
}
function openActionModal(cfg){
  window.__action=cfg;
  $('actionTitle').textContent=cfg.title||'Xác nhận';
  $('actionEyebrow').textContent=cfg.eyebrow||'THAO TÁC';
  $('actionIcon').textContent=cfg.icon||'✦';
  const message=$('actionMessage');
  message.replaceChildren();
  if(cfg.messageParts){
    message.append(document.createTextNode(cfg.messageParts[0]));
    message.append(makeElement('strong','',cfg.messageParts[1]));
    message.append(document.createTextNode(cfg.messageParts[2]));
  }else message.textContent=cfg.message||'';
  const fields=$('actionFields');
  fields.replaceChildren();
  if(cfg.renderFields) cfg.renderFields(fields);
  else if(cfg.fields) fields.innerHTML=cfg.fields;
  $('actionSubmit').textContent=cfg.submit||'Xác nhận';
  $('actionSubmit').className=cfg.danger?'danger-btn danger-large':'primary-btn';
  $('actionModal').hidden=false;
  setTimeout(()=>{const input=fields.querySelector('input,select,textarea');if(input)input.focus()},30);
}
function closeActionModal(){$('actionModal').hidden=true;window.__action=null}
async function submitActionModal(){let cfg=window.__action;if(!cfg?.submitFn)return;let b=$('actionSubmit');b.disabled=true;try{await cfg.submitFn()}catch(e){toast(e.message||'Có lỗi xảy ra')}finally{b.disabled=false}}

async function loadNotifications(){
  const container=$('notificationList');
  const badge=$('badge');
  const topBadge=$('topBadge');
  try{
    const notifications=await api('/api/notifications');
    if(!Array.isArray(notifications)) throw Error('Dữ liệu thông báo không hợp lệ.');
    if(notifications.some(notification=>!notification||typeof notification!=='object'||Array.isArray(notification)||typeof notification.is_read!=='boolean')){
      throw Error('Trạng thái đã đọc của thông báo không hợp lệ.');
    }
    const unreadCount=notifications.filter(notification=>!notification.is_read).length;
    const cards=notifications.map(notification=>{
      const card=makeElement('div','order');
      const heading=makeElement('div');
      const createdAt=typeof notification.created_at==='string'?new Date(notification.created_at):null;
      const createdAtLabel=createdAt && Number.isFinite(createdAt.getTime())?createdAt.toLocaleString('vi-VN'):'Thời gian không xác định';
      const isRead=typeof notification.is_read==='boolean' && notification.is_read;
      const validId=Number.isSafeInteger(notification.id) && notification.id>0;
      heading.append(makeElement('b','',typeof notification.title==='string' && notification.title.trim()?notification.title:'Thông báo'));
      heading.append(makeElement('small','',createdAtLabel));
      card.append(heading,makeElement('span','pill',isRead?'Đã đọc':'Chưa đọc'));
      card.append(makeElement('div','orderitems',typeof notification.message==='string' && notification.message.trim()?notification.message:'Không có nội dung thông báo.'));
      if(!isRead && validId){
        const actions=makeElement('div','orderactions');
        const button=makeElement('button','ghost-btn small-btn','Đánh dấu đã đọc');
        button.type='button';
        button.addEventListener('click',()=>readNotification(notification.id));
        actions.append(button);
        card.append(actions);
      }
      return card;
    });
    const emptyState=makeElement('div','empty-state');
    emptyState.append(makeElement('div','','🔔'),makeElement('h3','','Chưa có thông báo'),makeElement('p','','Thông báo mới sẽ hiển thị tại đây.'));
    const content=cards.length?cards:[emptyState];
    badge.textContent=unreadCount?String(unreadCount):'';
    topBadge.textContent=unreadCount?String(unreadCount):'';
    container.replaceChildren(...content);
  }catch(e){
    if(typeof toast==='function' && $('toast')) toast(e?.message||'Không thể tải thông báo.');
  }
}
async function readNotification(id){
  if(!Number.isSafeInteger(id) || id<=0){
    if(typeof toast==='function' && $('toast')) toast('ID thông báo không hợp lệ.');
    return;
  }
  try{
    await api('/api/notifications/'+id+'/read',{method:'PATCH'});
    await loadNotifications();
  }catch(e){
    toast(e.message);
  }
}
function notifyLoadError(resource,error){
  if(typeof toast==='function' && $('toast')){
    toast(`Không thể tải ${resource}: ${error?.message||'Vui lòng thử lại.'}`);
  }
}
function toast(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>t.classList.remove('show'),3000)}
function foodEmoji(name){const n=String(name).toLowerCase();if(n.includes('phở'))return '🍜';if(n.includes('cơm'))return '🍛';if(n.includes('mì'))return '🍝';if(n.includes('cam'))return '🍊';if(n.includes('bánh'))return '🥐';if(n.includes('sữa'))return '🥛';return '🍱'}
function money(n){return Number(n||0).toLocaleString('vi-VN')+' đ'}
if(document.readyState==='loading') window.addEventListener('DOMContentLoaded',()=>start(),{once:true});
else start();
