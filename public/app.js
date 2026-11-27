const $ = s => document.querySelector(s);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const initial = name => (name || 'Reader').trim().split(/\s+/).map(x => x[0]).slice(0,2).join('').toUpperCase();
const state = { token: localStorage.getItem('mb-token') || '', user: null, page: location.hash.slice(1) || 'discover', books: [], list: [], people: [], genre: 'All', query: '', listStatus: 'All', authMode: 'login', selectedBook: null, rating: 5, readerObjectUrl: '' };
const genres = ['All','Fiction','Fantasy','Science Fiction','Classic','Memoir','History','Self-help','Art'];
const authHeaders = () => state.token ? { Authorization: `Bearer ${state.token}` } : {};
async function api(url, options = {}) {
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers = { ...authHeaders(), ...(options.body && !isFormData ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) };
  const response = await fetch(`/api${url}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { if (response.status === 401 && state.token) logout(false); throw new Error(data.error || 'Could not complete that request.'); }
  return data;
}
function toast(message) { const node = $('#toast'); node.textContent = message; node.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => node.classList.remove('show'), 2600); }
function timeAgo(date) { const minutes = Math.max(1, Math.floor((Date.now() - new Date(date).getTime()) / 60000)); return minutes < 60 ? `${minutes}m ago` : minutes < 1440 ? `${Math.floor(minutes / 60)}h ago` : `${Math.floor(minutes / 1440)}d ago`; }
function cover(book, className = '') { return `<div class="cover-wrap ${className}"><img loading="lazy" src="${esc(book.coverUrl)}" alt="Cover of ${esc(book.title)}" onerror="this.style.display='none'"><div class="cover-fallback">${esc(book.title)}</div>${book.genre ? `<span class="cover-tag">${esc(book.genre.toUpperCase())}</span>` : ''}</div>`; }
function renderBook(book) { return `<article class="book-card" data-book="${esc(book.id)}">${cover(book)}<div class="card-meta"><h3 title="${esc(book.title)}">${esc(book.title)}</h3><p>${esc(book.author)}</p><div class="rating-line"><b>★</b>${book.averageRating ? `${book.averageRating} <span style="color:#a2a49b">· ${book.reviewCount} ${book.reviewCount === 1 ? 'review' : 'reviews'}</span>` : 'New to the shelf'}</div></div></article>`; }
function setPage(page) { state.page = ['discover','community','library','my-list','profile'].includes(page) ? page : 'discover'; history.replaceState(null, '', `#${state.page}`); document.querySelectorAll('[data-page]').forEach(n => n.classList.toggle('active', n.dataset.page === state.page)); document.querySelectorAll('.mobile-nav button').forEach(n => n.classList.toggle('active', n.dataset.page === state.page)); renderPage(); }
function installMobileNav() { if ($('.mobile-nav')) return; document.body.insertAdjacentHTML('beforeend', `<nav class="mobile-nav" aria-label="Mobile navigation"><button data-page="discover"><span>⌕</span>Discover</button><button data-page="community"><span>◉</span>People</button><button data-page="library"><span>▣</span>Library</button><button data-page="my-list"><span>▤</span>My shelf</button><button data-page="profile"><span>◎</span>Profile</button></nav>`); }
function updateAccount() {
  const topAuth = $('#top-auth'); const avatar = $('#avatar-shortcut'); const mini = $('#account-mini');
  topAuth.textContent = state.user ? 'Log out' : 'Log in'; avatar.textContent = initial(state.user?.name || 'Guest');
  mini.innerHTML = state.user ? `<div class="mini-avatar">${esc(initial(state.user.name))}</div><div class="mini-text"><strong>${esc(state.user.name)}</strong><small>${esc(state.user.email)}</small></div><button class="mini-action" data-logout>Log out</button>` : `<div class="mini-avatar">G</div><div class="mini-text"><strong>Browsing as guest</strong><small>Save your reading life</small></div><button class="mini-action" data-open-auth>Create</button>`;
  $('#people-count').textContent = state.user?.stats?.following || '';
}
async function refreshBooks() {
  try { state.books = await api(`/books?q=${encodeURIComponent(state.query)}&genre=${encodeURIComponent(state.genre)}`); localStorage.setItem('mb-books-cache', JSON.stringify(state.books)); }
  catch (err) { try { state.books = JSON.parse(localStorage.getItem('mb-books-cache') || '[]'); } catch {} if (!state.books.length) toast(err.message); }
  if (state.page === 'discover') renderDiscover();
}
async function refreshUser() {
  if (!state.token) { state.user = null; state.list = []; updateAccount(); return; }
  try { state.user = await api('/me'); state.list = await api('/lists'); localStorage.setItem('mb-list-cache', JSON.stringify(state.list)); }
  catch { state.user = null; try { state.list = JSON.parse(localStorage.getItem('mb-list-cache') || '[]'); } catch { state.list = []; } }
  updateAccount();
}
function renderDiscover() {
  const list = state.list;
  const counts = ['To Read','Reading','Completed'].map(s => list.filter(x => x.status === s).length);
  $('#page-content').innerHTML = `<div class="hero"><div class="hero-copy"><p class="eyebrow">A GOOD BOOK CHANGES EVERYTHING</p><h1>Find your next <em>favorite.</em></h1><p>Discover stories, keep your reading close, and share the books that stay with you.</p></div><div class="hero-mark">m</div></div>
    <div class="search-row"><div class="search-wrap"><span>⌕</span><input id="book-search" placeholder="Search books or authors…" value="${esc(state.query)}" aria-label="Search books or authors"></div><button class="search-clear" id="clear-search">Clear</button></div>
    <div class="section-row"><div><h2>Books worth knowing</h2><p>A few good places to start.</p></div><button class="button button-light small" id="surprise">Surprise me ↗</button></div>
    <div class="filter-row">${genres.map(g => `<button class="chip ${g === state.genre ? 'active' : ''}" data-genre="${esc(g)}">${esc(g)}</button>`).join('')}</div>
    ${state.books.length ? `<div class="book-grid">${state.books.map(renderBook).join('')}</div>` : `<div class="empty-state"><b>No books found just yet.</b>Try another title, author, or genre.</div>`}
    <hr class="section-divider"><div class="section-row"><div><h2>Your bookshelf</h2><p>Small steps make a lovely reading life.</p></div></div><div class="shelf-strip">${['To Read','Reading','Completed'].map((s,i)=>`<div class="shelf-card" data-list-shortcut><span>${esc(s.toUpperCase())}</span><b>${counts[i]} <i>book${counts[i]===1?'':'s'}</i></b></div>`).join('')}</div>`;
  $('#book-search').addEventListener('input', debounce(e => { state.query = e.target.value.trim(); refreshBooks(); }, 250));
  $('#clear-search').onclick = () => { state.query=''; state.genre='All'; refreshBooks(); };
  $('#surprise').onclick = () => { if (state.books.length) openBook(state.books[Math.floor(Math.random()*state.books.length)].id); };
  document.querySelectorAll('[data-genre]').forEach(b => b.onclick = () => { state.genre=b.dataset.genre; renderDiscover(); refreshBooks(); });
  document.querySelectorAll('[data-list-shortcut]').forEach(b => b.onclick = () => setPage('my-list'));
  document.querySelectorAll('[data-book]').forEach(b => b.onclick = () => openBook(b.dataset.book));
}
function renderCommunity() {
  const root = $('#page-content'); root.innerHTML = `<div class="page-head"><p class="eyebrow">READING IS BETTER SHARED</p><h1 class="page-title">Find your people.</h1><p>Follow readers whose shelves make you curious.</p></div><div class="toolbar"><div><strong>Readers on MahinBook</strong></div><span class="muted">${state.people.length} readers</span></div><div class="community-grid" id="community-grid"><div class="loading">Finding your people…</div></div>`;
  api('/people').then(people => { state.people=people; $('#community-grid').innerHTML = people.length ? people.map(p=>`<article class="person-card"><div class="person-avatar">${esc(initial(p.name))}</div><div class="person-info"><h3>${esc(p.name)}</h3><p>${p.stats.books} books · ${p.stats.reviews} reviews</p></div>${state.user && p.id !== state.user.id ? `<button class="button ${p.followed?'button-light':'button-dark'} small" data-follow="${esc(p.id)}" data-following="${p.followed}">${p.followed?'Following':'Follow +'}</button>`:''}</article>`).join('') : `<div class="empty-state">You're the first reader here. Invite a friend along.</div>`; document.querySelectorAll('[data-follow]').forEach(b=>b.onclick=()=>toggleFollow(b.dataset.follow,b.dataset.following==='true')); }).catch(e=>$('#community-grid').innerHTML=`<div class="error-box">${esc(e.message)}</div>`);
}
function renderList() {
  const items = state.list.filter(x => state.listStatus === 'All' || x.status === state.listStatus);
  $('#page-content').innerHTML=`<div class="page-head"><p class="eyebrow">YOUR PERSONAL COLLECTION</p><h1 class="page-title">A shelf of your own.</h1><p>Keep the books you want to read, are reading, and remember.</p></div><div class="toolbar"><div class="tabs">${['All','To Read','Reading','Completed'].map(s=>`<button class="tab ${state.listStatus===s?'active':''}" data-list-status="${esc(s)}">${s==='All'?'Everything':esc(s)}</button>`).join('')}</div><span class="muted">${items.length} book${items.length===1?'':'s'}</span></div>${items.length ? items.map(row=>`<article class="list-row"><img class="list-cover" src="${esc(row.book.coverUrl)}" alt="" onerror="this.style.opacity='.15'"><div><h3 data-book="${esc(row.book.id)}" style="cursor:pointer">${esc(row.book.title)}</h3><p>${esc(row.book.author)} · added ${timeAgo(row.addedAt)}</p></div><select class="select-status" data-status-book="${esc(row.book.id)}" aria-label="Reading status">${['To Read','Reading','Completed'].map(s=>`<option ${s===row.status?'selected':''}>${s}</option>`).join('')}<option value="Remove">Remove</option></select></article>`).join('') : `<div class="empty-state"><b>Your shelf is waiting.</b>Add a book you want to remember, and it’ll live here.<br><button class="button button-dark" style="margin-top:15px" data-goto-discover>Explore books <span>→</span></button></div>`}`;
  document.querySelectorAll('[data-list-status]').forEach(b=>b.onclick=()=>{state.listStatus=b.dataset.listStatus;renderList();});
  document.querySelectorAll('[data-status-book]').forEach(s=>s.onchange=async()=>{try { if(s.value==='Remove') await api(`/lists/${s.dataset.statusBook}`,{method:'DELETE'}); else await api(`/lists/${s.dataset.statusBook}`,{method:'PUT',body:JSON.stringify({status:s.value})}); state.list=await api('/lists'); renderList(); toast(s.value==='Remove'?'Removed from your shelf':'Shelf updated'); }catch(e){toast(e.message);}});
  document.querySelectorAll('[data-book]').forEach(b=>b.onclick=()=>openBook(b.dataset.book)); const go=$('[data-goto-discover]'); if(go)go.onclick=()=>setPage('discover');
}
async function renderLibrary() {
  const root=$('#page-content');
  root.innerHTML=`<div class="library-intro"><div class="page-head"><p class="eyebrow">YOUR BOOKS, YOUR SPACE</p><h1 class="page-title">Your reading room.</h1><p>Keep your own PDFs and book file links together.</p></div><button class="button button-dark" data-open-upload>Add a book <span>＋</span></button></div><div id="library-content"><div class="loading">Opening your library…</div></div>`;
  if(!state.user){$('#library-content').innerHTML=`<div class="empty-state"><b>Your private reading room.</b>Log in to upload a PDF or save a book file link. Your uploads stay private to your account.<br><button class="button button-dark" style="margin-top:15px" data-open-auth>Log in to continue <span>→</span></button></div>`;return;}
  try{
    const books=await api('/library');
    $('#library-content').innerHTML=books.length?`<div class="section-row"><div><h2>Your books</h2><p>${books.length} private ${books.length===1?'book':'books'}</p></div></div><div class="library-grid">${books.map(book=>`<article class="library-card"><div class="library-filemark">${book.sourceType==='upload'?'PDF':'LINK'}</div><div class="library-card-info"><h3 title="${esc(book.title)}">${esc(book.title)}</h3><p>${esc(book.author)} · ${book.sourceType==='upload'?`${(book.size/1024/1024).toFixed(1)} MB`:'File link'}</p></div><div class="library-card-actions"><button class="button button-light small" data-read-book="${esc(book.id)}">Read</button><button class="button button-light small" data-remove-book="${esc(book.id)}" aria-label="Remove ${esc(book.title)}">×</button></div></article>`).join('')}</div>`:`<div class="empty-state library-empty"><b>Your reading room is ready.</b>Add a PDF or a direct HTTPS file link to start reading here.<br><button class="button button-dark" style="margin-top:15px" data-open-upload>Add your first book <span>＋</span></button></div>`;
    document.querySelectorAll('[data-read-book]').forEach(button=>button.onclick=()=>openReader(button.dataset.readBook));
    document.querySelectorAll('[data-remove-book]').forEach(button=>button.onclick=async()=>{if(!confirm('Remove this book from your library?'))return;try{await api(`/library/${button.dataset.removeBook}`,{method:'DELETE'});renderLibrary();toast('Removed from your library');}catch(error){toast(error.message);}});
  }catch(error){$('#library-content').innerHTML=`<div class="error-box">${esc(error.message)}</div>`;}
}
async function renderProfile() {
  $('#page-content').innerHTML=`<div class="page-head"><p class="eyebrow">A LITTLE ABOUT YOU</p><h1 class="page-title">Your reader profile.</h1></div><div class="loading">Loading your profile…</div>`;
  if (!state.user) { $('#page-content').innerHTML=`<div class="page-head"><p class="eyebrow">A LITTLE ABOUT YOU</p><h1 class="page-title">Your reader profile.</h1><p>Sign in to make this space yours.</p></div><div class="empty-state"><b>Every reader has a story.</b>Create an account to keep your books, reviews, and reading life together.<br><button class="button button-dark" style="margin-top:15px" data-open-auth>Create your account <span>→</span></button></div>`; $('[data-open-auth]').onclick=()=>openAuth('signup'); return; }
  const {stats}=state.user;
  $('#page-content').innerHTML=`<div class="page-head"><p class="eyebrow">A LITTLE ABOUT YOU</p><h1 class="page-title">Your reader profile.</h1><p>Make this corner of MahinBook feel like you.</p></div><section class="profile-card"><div class="person-avatar">${esc(initial(state.user.name))}</div><div><h2>${esc(state.user.name)}</h2><p>${esc(state.user.bio || 'A curious reader, one page at a time.')}</p></div><div class="profile-stats"><div><strong>${stats.books}</strong><span>BOOKS</span></div><div><strong>${stats.reviews}</strong><span>REVIEWS</span></div><div><strong>${stats.followers}</strong><span>FOLLOWERS</span></div></div></section><div class="section-row"><div><h2>Edit your details</h2><p>Your profile can change as often as your reading list.</p></div></div><form class="edit-form" id="profile-form"><div class="field"><label for="profile-name">Name</label><input id="profile-name" value="${esc(state.user.name)}" maxlength="48" required></div><div class="field"><label for="profile-bio">A line about you</label><textarea id="profile-bio" maxlength="240" placeholder="The books, ideas, or little things you love…">${esc(state.user.bio)}</textarea></div><button class="button button-dark" type="submit">Save profile <span>→</span></button></form>`;
  $('#profile-form').onsubmit=async e=>{e.preventDefault();try{state.user=await api('/me',{method:'PATCH',body:JSON.stringify({name:$('#profile-name').value,bio:$('#profile-bio').value})});updateAccount();renderProfile();toast('Profile saved');}catch(err){toast(err.message);}};
}
async function renderFeed() {
  const root=$('#page-content'); root.innerHTML=`<div class="page-head"><p class="eyebrow">WHAT YOUR PEOPLE ARE READING</p><h1 class="page-title">From the community.</h1><p>Fresh notes from readers you follow.</p></div><div class="feed-list" id="feed-list"><div class="loading">Fetching the latest reads…</div></div>`;
  try { const items=await api('/feed'); $('#feed-list').innerHTML=items.length?items.map(a=>`<article class="feed-item"><div class="person-avatar">${esc(initial(a.user.name))}</div><div class="feed-copy"><p><strong>${esc(a.user.name)}</strong> ${a.kind==='review'?'left a review':a.kind==='list'?`added a book to <strong>${esc(a.status)}</strong>`:`started following <strong>${esc(a.followee?.name)}</strong>`}.</p>${a.book?`<div class="feed-book"><img src="${esc(a.book.coverUrl)}" alt=""><span>${esc(a.book.title)}<br><small style="color:#96998f;font-weight:400">${esc(a.book.author)}</small></span></div>`:''}${a.comment?`<p style="margin-top:10px;font-family:var(--serif)">“${esc(a.comment)}” <span style="color:#bf8b53">${'★'.repeat(a.rating||0)}</span></p>`:''}<small>${timeAgo(a.createdAt)}</small></div></article>`).join(''):`<div class="empty-state"><b>Your feed is quiet for now.</b>Follow a few readers and their latest discoveries will show up here.<br><button class="button button-light" style="margin-top:15px" data-find-people>Find readers <span>→</span></button></div>`;const b=$('[data-find-people]');if(b)b.onclick=()=>setPage('community'); }
  catch(e){$('#feed-list').innerHTML=`<div class="empty-state"><b>Nothing in your feed yet.</b>${state.user?'Follow readers to see what they’re reading.':'Log in and follow readers to make this feed your own.'}<br><button class="button button-light" style="margin-top:15px" data-find-people>Explore community <span>→</span></button></div>`;const b=$('[data-find-people]');if(b)b.onclick=()=>setPage('community');}
}
function renderPage() {
  const labels={discover:'Your reading life, together',community:'Readers worth following',library:'Your private reading room','my-list':'Your personal bookshelf',profile:'Your reader profile'};$('#breadcrumb').textContent=labels[state.page]||labels.discover;document.querySelectorAll('[data-page]').forEach(n=>n.classList.toggle('active',n.dataset.page===state.page));
  if(state.page==='discover')renderDiscover(); else if(state.page==='community')renderCommunity(); else if(state.page==='library')renderLibrary(); else if(state.page==='my-list')renderList(); else renderProfile();
}
function debounce(fn,ms){let t;return(...args)=>{clearTimeout(t);t=setTimeout(()=>fn(...args),ms);};}
function openAuth(mode='login') { state.authMode=mode; $('#auth-error').textContent=''; const signup=mode==='signup'; $('#name-field').hidden=!signup; $('#auth-name').required=signup; $('#auth-title').textContent=signup?'Find your people.':'Welcome back.'; $('#auth-copy').textContent=signup?'Start a little home for your reading life.':'Your next favorite is waiting.'; $('#auth-submit').innerHTML=signup?'Create account <span>→</span>':'Log in <span>→</span>'; $('#auth-switch-text').textContent=signup?'Already have an account?':'New to MahinBook?'; $('#auth-switch').textContent=signup?'Log in':'Create an account'; $('#auth-password').autocomplete=signup?'new-password':'current-password'; $('#auth-dialog').showModal(); }
function logout(showToast=true) { localStorage.removeItem('mb-token'); state.token='';state.user=null;state.list=[];updateAccount();renderPage();if(showToast)toast('You’re logged out.'); }
async function toggleFollow(id, following) { if(!state.user){openAuth();return;}try{await api(`/people/${id}/follow`,{method:following?'DELETE':'PUT'});state.people=await api('/people');renderCommunity();state.user=await api('/me');updateAccount();toast(following?'Removed from following':'You’re following a reader');}catch(e){toast(e.message);} }
async function openBook(id) {
  const dialog=$('#book-dialog');$('#book-detail').innerHTML='<div class="loading">Opening book…</div>';dialog.showModal();
  try { const book=await api(`/books/${id}`);state.selectedBook=book;state.rating=5;renderBookDetail(book); }
  catch(e){$('#book-detail').innerHTML=`<div class="error-box">${esc(e.message)}</div>`;}
}
function renderBookDetail(book) {
  const inList=state.list.find(i=>i.book.id===book.id);const reviews=book.reviews.length?book.reviews.map(r=>`<div class="review-box"><small><strong>${esc(r.user.name)}</strong> · <span style="color:#bc874e">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</span> · ${timeAgo(r.createdAt)}</small><p>${esc(r.comment)}</p></div>`).join(''):'<p class="muted" style="font-size:11px">No reviews yet. You could be the first.</p>';
  $('#book-detail').innerHTML=`<div class="detail-layout"><div class="detail-cover"><img src="${esc(book.coverUrl)}" alt="Cover of ${esc(book.title)}" onerror="this.style.opacity='.08'"></div><div><p class="eyebrow">${esc(book.genre||'ON THE SHELF')}</p><h2>${esc(book.title)}</h2><p class="detail-author">by ${esc(book.author)}</p><div class="detail-rating"><b>★ ${book.averageRating||'—'}</b> <span style="color:#989b92">· ${book.reviewCount} reviews</span></div><div class="detail-actions"><button class="button button-dark small" id="add-book">${inList?`On your shelf · ${esc(inList.status)}`:'Add to my shelf'} <span>＋</span></button>${inList?`<button class="button button-light small" id="remove-book">Remove</button>`:''}</div></div><p class="detail-desc">${esc(book.description || 'A good story is always worth making time for.')}</p></div><h3 class="reviews-heading">Reader notes <span style="color:#999;font:11px var(--sans)">(${book.reviewCount})</span></h3><div>${reviews}</div>${state.user?`<form class="review-form" id="review-form"><label>Your rating</label><div class="stars" role="radiogroup" aria-label="Choose a rating">${[1,2,3,4,5].map(n=>`<button type="button" class="star ${n<=state.rating?'selected':''}" data-rating="${n}" aria-label="${n} star${n===1?'':'s'}">★</button>`).join('')}</div><div class="field" style="margin:0"><label for="review-text">Your review</label><textarea id="review-text" maxlength="1400" placeholder="What stayed with you after the last page?" required></textarea></div><button class="button button-dark small" style="margin-top:10px">Share your note <span>→</span></button></form>`:`<div class="review-form"><p style="font-size:11px;color:#737a70;margin:0">Want to leave a note? <button id="review-login" style="border:0;background:none;color:#31533f;font-weight:700;font-size:11px">Log in</button></p></div>`}`;
  $('#add-book').onclick=async()=>{if(!state.user){openAuth();return;}const current=state.list.find(i=>i.book.id===book.id);const status=current?.status||'To Read';try{await api(`/lists/${book.id}`,{method:'PUT',body:JSON.stringify({status})});state.list=await api('/lists');renderBookDetail(book);toast('Added to your bookshelf');}catch(e){toast(e.message);}};
  const remove=$('#remove-book');if(remove)remove.onclick=async()=>{try{await api(`/lists/${book.id}`,{method:'DELETE'});state.list=await api('/lists');renderBookDetail(book);toast('Removed from your shelf');}catch(e){toast(e.message);}};
  document.querySelectorAll('[data-rating]').forEach(b=>b.onclick=()=>{state.rating=Number(b.dataset.rating);document.querySelectorAll('[data-rating]').forEach(s=>s.classList.toggle('selected',Number(s.dataset.rating)<=state.rating));});
  const form=$('#review-form');if(form)form.onsubmit=async e=>{e.preventDefault();const submit=form.querySelector('button[type="submit"],button:not([type])');submit.disabled=true;try{await api(`/books/${book.id}/reviews`,{method:'POST',body:JSON.stringify({rating:state.rating,comment:$('#review-text').value})});const updated=await api(`/books/${book.id}`);state.selectedBook=updated;renderBookDetail(updated);state.books=await api(`/books?q=${encodeURIComponent(state.query)}&genre=${encodeURIComponent(state.genre)}`);toast('Your review is on the shelf');}catch(err){toast(err.message);submit.disabled=false;}};
  const login=$('#review-login');if(login)login.onclick=()=>openAuth();
}
function openUpload() {
  if(!state.user){openAuth();return;}
  state.uploadSource='file';$('#upload-form').reset();$('#upload-error').textContent='';
  $('#upload-file-field').hidden=false;$('#upload-link-field').hidden=true;
  document.querySelectorAll('[data-source]').forEach(button=>button.classList.toggle('active',button.dataset.source==='file'));
  $('#upload-dialog').showModal();
}
async function openReader(id) {
  const dialog=$('#reader-dialog');
  if(state.readerObjectUrl){URL.revokeObjectURL(state.readerObjectUrl);state.readerObjectUrl='';}
  $('#reader-title').textContent='Opening book…';$('#reader-author').textContent='';
  $('#reader-external').hidden=true;$('#reader-frame-wrap').innerHTML='<div class="reader-note"><div>Getting your book ready…</div></div>';
  dialog.showModal();
  try{
    const book=await api(`/library/${id}`);
    $('#reader-title').textContent=book.title;$('#reader-author').textContent=book.author;
    const frame=document.createElement('iframe');frame.title=`Read ${book.title}`;frame.referrerPolicy='no-referrer';
    if(book.sourceType==='upload'){
      const response=await fetch(`/api/library/${encodeURIComponent(book.id)}/file`,{headers:authHeaders()});
      if(!response.ok){const error=await response.json().catch(()=>({}));throw new Error(error.error||'Could not open this PDF.');}
      state.readerObjectUrl=URL.createObjectURL(await response.blob());frame.src=state.readerObjectUrl;
    }else{
      frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-forms');
      frame.src=book.sourceUrl;
      const external=$('#reader-external');external.href=book.sourceUrl;external.hidden=false;
    }
    $('#reader-frame-wrap').replaceChildren(frame);
  }catch(error){$('#reader-frame-wrap').innerHTML=`<div class="reader-note"><div><strong>We couldn’t open this book.</strong>${esc(error.message)}</div></div>`;}
}
document.querySelectorAll('[data-source]').forEach(button=>button.onclick=()=>{
  state.uploadSource=button.dataset.source;
  document.querySelectorAll('[data-source]').forEach(tab=>tab.classList.toggle('active',tab===button));
  $('#upload-file-field').hidden=state.uploadSource!=='file';
  $('#upload-link-field').hidden=state.uploadSource!=='link';
  $('#upload-error').textContent='';
});
$('#upload-form').onsubmit=async event=>{
  event.preventDefault();$('#upload-error').textContent='';
  const file=$('#upload-file').files[0];const url=$('#upload-link').value.trim();
  if(state.uploadSource==='file'&&!file){$('#upload-error').textContent='Choose a PDF file to upload.';return;}
  if(state.uploadSource==='link'&&!url){$('#upload-error').textContent='Paste a direct HTTPS book file link.';return;}
  const formData=new FormData(event.currentTarget);
  if(!file)formData.delete('file');
  if(state.uploadSource==='file')formData.delete('url');
  const submit=$('#upload-submit');submit.disabled=true;
  try{await api('/library',{method:'POST',body:formData});$('#upload-dialog').close();setPage('library');toast('Added to your private library');}
  catch(error){$('#upload-error').textContent=error.message;}
  finally{submit.disabled=false;}
};
$('#reader-dialog').addEventListener('close',()=>{if(state.readerObjectUrl){URL.revokeObjectURL(state.readerObjectUrl);state.readerObjectUrl='';}$('#reader-frame-wrap').replaceChildren();});
$('#auth-switch').onclick=()=>openAuth(state.authMode==='login'?'signup':'login');
$('#auth-form').onsubmit=async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.currentTarget));const submit=$('#auth-submit');submit.disabled=true;$('#auth-error').textContent='';try{const result=await api(`/auth/${state.authMode}`,{method:'POST',body:JSON.stringify(data)});state.token=result.token;localStorage.setItem('mb-token',state.token);await refreshUser();$('#auth-dialog').close();if(state.page==='profile')renderProfile();else renderPage();if(state.selectedBook&&$('#book-dialog').open)renderBookDetail(state.selectedBook);toast(state.authMode==='signup'?'Welcome to MahinBook!':'Welcome back');}catch(err){$('#auth-error').textContent=err.message;}finally{submit.disabled=false;};};
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
document.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',()=>setPage(b.dataset.page)));
$('#top-auth').onclick=()=>state.user?logout():openAuth();$('#avatar-shortcut').onclick=()=>setPage('profile');$('#search-shortcut').onclick=()=>{setPage('discover');setTimeout(()=>$('#book-search')?.focus(),0);};
document.body.addEventListener('click',e=>{if(e.target.closest('[data-open-auth]'))openAuth('signup');if(e.target.closest('[data-open-upload]'))openUpload();if(e.target.closest('[data-logout]'))logout();});
async function boot(){installMobileNav();try{await refreshBooks();await refreshUser();}catch{}if(!state.token){try{state.list=JSON.parse(localStorage.getItem('mb-list-cache')||'[]');}catch{}}renderPage();if(state.page==='profile')renderProfile();if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});}
boot();
