const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const state = {
  route: 'home', user: null, books: [], shelf: [], feed: [], people: [], notifications: [],
  genres: [], genre: 'All books', query: '', shelfTab: 'All books', profile: null,
  modal: null, offline: !navigator.onLine, lang: localStorage.getItem('mb_language') || 'en',
  reviewRating: 0, comments: [],
};

const words = {
  en: {
    home: 'Home', discover: 'Discover', shelf: 'My shelf', community: 'Community', profile: 'My profile', settings: 'Settings',
    greeting: 'A little more bookish', signIn: 'Sign in', signOut: 'Sign out', createAccount: 'Create account',
    search: 'Search books by title or author', searchTitle: 'Find your next good read', browse: 'Browse the library',
    yourShelf: 'Your shelf', seeAll: 'See all', continueReading: 'Pick up where you left off',
    discoverTitle: 'A good book is closer than you think.', discoverSub: 'Wander through the library and find something that feels like you.',
    communityTitle: 'Good books travel further together.', communitySub: 'Meet readers, swap recommendations, and see what is keeping everyone up late.',
    allBooks: 'All books', toRead: 'To Read', reading: 'Reading', completed: 'Completed',
    save: 'Save to shelf', updateShelf: 'Update shelf', remove: 'Remove from shelf', rateReview: 'Rate & review',
    reviews: 'Reader notes', noReviews: 'No reviews yet. Be the first to leave a note.', writeReview: 'Write your review',
    follow: 'Follow', following: 'Following', followers: 'followers', books: 'books', readers: 'readers',
    popular: 'A few reader favourites', recent: 'From the reading circle', latest: 'Latest reader notes',
    welcome: 'Welcome back', email: 'Email address', password: 'Password', name: 'Your name',
    passwordHint: 'At least 8 characters', bio: 'A little about you', language: 'Language', saveChanges: 'Save changes',
    settingsTitle: 'Make this corner yours', settingsSub: 'Your details and reading preferences live here.',
    exportData: 'Download my data', deleteAccount: 'Delete my account', dataPrivacy: 'Your reading life belongs to you.',
    emptyShelf: 'Your shelf is ready for its first book.', emptyShelfSub: 'Save a book for later or start reading today.',
    offline: 'Offline · showing saved books', status: 'Reading status', page: 'pages', year: 'Published', author: 'By',
    loginTitle: 'Your reading corner is waiting.', loginSub: 'Sign in to keep your shelf and share what you are reading.',
    signupTitle: 'Come on in, reader.', signupSub: 'Make a little home for all the books you love.',
    noAccount: 'New to MahinBook?', haveAccount: 'Already have an account?',
    submitReview: 'Post review', cancel: 'Cancel', signInToSave: 'Sign in to save books and write reviews.',
    activityEmpty: 'The reading circle is just getting started.', profileEmpty: 'Your story is still on page one.',
    notifications: 'Notifications', notificationEmpty: 'You are all caught up.',
    account: 'Account', privacy: 'Privacy & data', about: 'About MahinBook',
    install: 'Install app', discoverMore: 'Keep exploring', comments: 'Comments', reviewed: 'Reviewed', logout: 'Sign out',
  },
  bn: {
    home: 'হোম', discover: 'বই খুঁজুন', shelf: 'আমার তাক', community: 'পাঠক সমাজ', profile: 'আমার প্রোফাইল', settings: 'সেটিংস',
    greeting: 'বইয়ের জগতে আরেকটু', signIn: 'সাইন ইন', signOut: 'সাইন আউট', createAccount: 'অ্যাকাউন্ট খুলুন',
    search: 'বইয়ের নাম বা লেখক খুঁজুন', searchTitle: 'আপনার পরের প্রিয় বইটি খুঁজুন', browse: 'বই দেখুন',
    yourShelf: 'আপনার বইয়ের তাক', seeAll: 'সব দেখুন', continueReading: 'যেখান থেকে পড়া থেমেছিল',
    discoverTitle: 'ভালো বই আপনার কাছেই আছে।', discoverSub: 'বইয়ের সংগ্রহে ঘুরে আপনার মনের মতো কিছু খুঁজে নিন।',
    communityTitle: 'বই ভাগ করে নিলে আনন্দ বাড়ে।', communitySub: 'পাঠকদের সঙ্গে পরিচিত হন, বইয়ের কথা বলুন, আর কে কী পড়ছেন দেখুন।',
    allBooks: 'সব বই', toRead: 'পড়ব', reading: 'পড়ছি', completed: 'পড়া শেষ',
    save: 'তাকে যোগ করুন', updateShelf: 'তাকের অবস্থা বদলান', remove: 'তাক থেকে সরান', rateReview: 'রেটিং ও রিভিউ',
    reviews: 'পাঠকের মতামত', noReviews: 'এখনও কোনো রিভিউ নেই। প্রথম মতামতটি লিখুন।', writeReview: 'আপনার রিভিউ লিখুন',
    follow: 'ফলো করুন', following: 'ফলো করছেন', followers: 'অনুসারী', books: 'বই', readers: 'পাঠক',
    popular: 'পাঠকদের পছন্দের কিছু বই', recent: 'পাঠক সমাজ থেকে', latest: 'সাম্প্রতিক মতামত',
    welcome: 'আবার স্বাগতম', email: 'ইমেইল ঠিকানা', password: 'পাসওয়ার্ড', name: 'আপনার নাম',
    passwordHint: 'কমপক্ষে ৮ অক্ষর', bio: 'আপনার সম্পর্কে কিছু কথা', language: 'ভাষা', saveChanges: 'পরিবর্তন সংরক্ষণ',
    settingsTitle: 'নিজের মতো করে সাজান', settingsSub: 'আপনার তথ্য ও পড়ার পছন্দ এখানে থাকবে।',
    exportData: 'আমার তথ্য ডাউনলোড', deleteAccount: 'আমার অ্যাকাউন্ট মুছুন', dataPrivacy: 'আপনার পড়ার জীবন আপনারই।',
    emptyShelf: 'আপনার তাকে প্রথম বইটির জন্য জায়গা আছে।', emptyShelfSub: 'পরে পড়ার জন্য বই রাখুন অথবা আজই শুরু করুন।',
    offline: 'অফলাইন · সংরক্ষিত বই দেখানো হচ্ছে', status: 'পড়ার অবস্থা', page: 'পৃষ্ঠা', year: 'প্রকাশকাল', author: 'লেখক',
    loginTitle: 'আপনার পড়ার কোণাটি অপেক্ষায় আছে।', loginSub: 'তাক সংরক্ষণ করুন এবং কী পড়ছেন তা ভাগ করে নিন।',
    signupTitle: 'চলে আসুন, পাঠক।', signupSub: 'প্রিয় বইগুলোর জন্য ছোট্ট একটি ঘর বানান।',
    noAccount: 'MahinBook-এ নতুন?', haveAccount: 'আগে থেকেই অ্যাকাউন্ট আছে?',
    submitReview: 'রিভিউ প্রকাশ', cancel: 'বাতিল', signInToSave: 'বই সংরক্ষণ ও রিভিউ দিতে সাইন ইন করুন।',
    activityEmpty: 'পাঠক সমাজের পথচলা সবে শুরু।', profileEmpty: 'আপনার গল্পের প্রথম পাতা এখনও খালি।',
    notifications: 'বিজ্ঞপ্তি', notificationEmpty: 'সব আপডেট দেখা হয়েছে।',
    account: 'অ্যাকাউন্ট', privacy: 'গোপনীয়তা ও তথ্য', about: 'MahinBook পরিচিতি',
    install: 'অ্যাপ ইনস্টল', discoverMore: 'আরও বই দেখুন', comments: 'মন্তব্য', reviewed: 'রিভিউ দিয়েছেন', logout: 'সাইন আউট',
  },
};
const t = key => words[state.lang]?.[key] || words.en[key] || key;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const initials = person => person?.initials || (person?.name || '?').split(/\s+/).slice(0,2).map(part => part[0]).join('').toUpperCase();
const avatar = person => `<span class="avatar" style="--avatar:${esc(person?.color || '#d27659')}">${esc(initials(person))}</span>`;
const dateText = timestamp => new Intl.DateTimeFormat(state.lang === 'bn' ? 'bn-BD' : 'en', {month:'short',day:'numeric'}).format(new Date(Number(timestamp) * 1000));
const starText = (rating, size = '') => `<span class="stars ${size}" aria-label="${esc(rating)} out of 5">${'★'.repeat(Math.max(0,Math.min(5,Math.round(Number(rating)||0))))}<span>${'☆'.repeat(5-Math.max(0,Math.min(5,Math.round(Number(rating)||0))))}</span></span>`;

function cover(book, extra = '') {
  return `<div class="book-cover ${extra}" style="--cover:${esc(book.color || book.book_color || '#bd765c')}"><span class="cover-mark">M<span>·</span>B</span><span class="cover-title">${esc(book.title)}</span><span class="cover-author">${esc(book.author)}</span><span class="cover-lines"></span></div>`;
}
function bookCard(book, compact = false) {
  return `<article class="book-card ${compact?'compact':''}" data-action="open-book" data-id="${esc(book.id)}" tabindex="0" role="button" aria-label="Open ${esc(book.title)}">
    <div class="cover-wrap">${cover(book)}${book.status ? `<span class="cover-status">${esc(t(book.status === 'To Read' ? 'toRead' : book.status.toLowerCase()))}</span>` : ''}</div>
    <div class="book-meta"><div class="book-title">${esc(book.title)}</div><div class="book-author">${esc(book.author)}</div>
    ${Number(book.rating) ? `<div class="card-rating">${starText(book.rating)} <span>${Number(book.rating).toFixed(1)}</span></div>` : ''}</div>
  </article>`;
}
function userCard(person) {
  return `<article class="reader-card"><button class="reader-identity" data-action="view-profile" data-id="${esc(person.id)}">${avatar(person)}<span><b>${esc(person.name)}</b><small>${esc(person.bio || 'MahinBook reader')}</small></span></button>
    <div class="reader-bottom"><span>${esc(person.review_count||0)} ${t('reviews').toLowerCase()}</span>${state.user ? `<button class="button button-small ${person.is_following?'button-soft':''}" data-action="follow" data-id="${esc(person.id)}">${person.is_following?t('following'):t('follow')}</button>` : `<button class="button button-small button-soft" data-action="auth">${t('follow')}</button>`}</div>
  </article>`;
}
function reviewCard(review, feed = false) {
  const name = review.name || review.user_name || 'Reader';
  const user = {name, initials:review.initials, color:review.color};
  const title = review.title || review.book_title;
  const actionLine = feed ? `<div class="review-bookline">On <button data-action="open-book" data-id="${esc(review.book_id)}">${esc(title)}</button></div>` : '';
  return `<article class="review-card">
    <div class="review-head">${avatar(user)}<div class="review-by"><button data-action="view-profile" data-id="${esc(review.user_id)}">${esc(name)}</button><small>${feed ? dateText(review.created_at) : `${t('reviewed')} · ${dateText(review.created_at)}`}</small></div>${starText(review.rating)}</div>
    ${actionLine}<p class="review-copy">${esc(review.text)}</p>
    <div class="review-actions"><button data-action="like" data-id="${esc(review.review_id || review.id)}" class="subtle-button ${review.liked?'liked':''}">${review.liked?'♥':'♡'} <span>${review.likes||0}</span></button><button data-action="comments" data-id="${esc(review.review_id || review.id)}" class="subtle-button">◯ ${t('comments') || 'Comments'}</button></div>
  </article>`;
}
function header() {
  return `<header class="topbar"><button class="brand" data-action="navigate" data-route="home"><span class="brand-icon">m<span>·</span>b</span><span>mahinbook<small>your reading corner</small></span></button>
    <form class="top-search" id="global-search"><span>⌕</span><input name="q" value="${esc(state.route==='discover'?state.query:'')}" placeholder="${esc(t('search'))}" aria-label="${esc(t('search'))}"><kbd>↵</kbd></form>
    <div class="top-actions"><span class="offline-badge ${state.offline?'show':''}">${esc(t('offline'))}</span>
      ${state.user?`<button class="icon-button notification-trigger" data-action="notifications" aria-label="${esc(t('notifications'))}">♧${state.notifications.some(n=>!n.read_at)?'<i></i>':''}</button><button class="top-user" data-action="navigate" data-route="profile">${avatar(state.user)}<span>${esc(state.user.name.split(' ')[0])}</span></button>`:`<button class="button button-light" data-action="auth">${t('signIn')}</button><button class="button" data-action="auth" data-mode="signup">${t('createAccount')}</button>`}
    </div></header>`;
}
function sidebar() {
  const nav = [['home','⌂'],['discover','⌕'],['shelf','▤'],['community','♧'],['profile','◉']];
  return `<aside class="sidebar"><div class="sidebar-label">YOUR CORNER</div><nav>${nav.map(([route,icon])=>`<button class="nav-item ${state.route===route?'active':''}" data-action="navigate" data-route="${route}"><span class="nav-icon">${icon}</span>${t(route)}</button>`).join('')}</nav>
    <div class="sidebar-bottom"><div class="daily-note"><span class="note-flower">✳</span><p>“A reader lives a thousand lives before he dies.”</p><small>— George R. R. Martin</small></div>
      <button class="nav-item ${state.route==='settings'?'active':''}" data-action="navigate" data-route="settings"><span class="nav-icon">⚙</span>${t('settings')}</button>
      <div class="sidebar-foot">MAHINBOOK <span>·</span> A PLACE TO READ</div></div></aside>`;
}
function shell(content) {
  return `${header()}<div class="layout">${sidebar()}<main class="main-content">${content}</main></div><nav class="mobile-nav">${[['home','⌂'],['discover','⌕'],['shelf','▤'],['community','♧'],['profile','◉']].map(([route,icon])=>`<button class="${state.route===route?'active':''}" data-action="navigate" data-route="${route}"><span>${icon}</span>${t(route)}</button>`).join('')}</nav><div id="modal-root">${modalMarkup()}</div>`;
}
function greetingName() { return state.user ? state.user.name.split(' ')[0] : 'Reader'; }
function homePage() {
  const reading = state.shelf.filter(book=>book.status==='Reading');
  const featured = state.books.filter(book=>book.id==='little-women'||book.id==='the-secret-garden'||book.id==='pride-and-prejudice');
  return `<section class="welcome-row"><div><div class="eyebrow">${new Intl.DateTimeFormat(state.lang==='bn'?'bn-BD':'en',{weekday:'long',month:'long',day:'numeric'}).format(new Date()).toUpperCase()}</div><h1>${state.user?`${t('welcome')}, ${esc(greetingName())}.`:'A nice day for a new chapter.'}</h1><p class="lede">${state.user?'A good book, a little quiet, and you. What sounds right today?':'Find a book that stays with you, and a few readers to talk about it with.'}</p></div><div class="welcome-doodle"><span>✳</span><i></i><b></b><small>take it<br>one page<br>at a time</small></div></section>
    <section class="hero-panel"><div class="hero-copy"><span class="eyebrow light">${t('greeting')}</span><h2>${t('searchTitle')}</h2><p>Thoughtful picks, old favourites, and little surprises from our library.</p><button class="button button-cream" data-action="navigate" data-route="discover">${t('browse')} <span>↗</span></button></div><div class="hero-books">${featured.map((book,i)=>cover(book,`hero-cover hero-cover-${i+1}`)).join('')}</div><span class="hero-sparkle">✳</span></section>
    ${reading.length?`<section class="section-block"><div class="section-heading"><div><span class="eyebrow">A BOOK IN PROGRESS</span><h2>${t('continueReading')}</h2></div><button class="text-link" data-action="navigate" data-route="shelf">${t('seeAll')} ↗</button></div><div class="reading-strip">${reading.slice(0,3).map(book=>`<button class="reading-book" data-action="open-book" data-id="${esc(book.id)}">${cover(book,'reading-cover')}<span><b>${esc(book.title)}</b><small>${esc(book.author)}</small><i class="reading-progress"><span style="width:${35+(book.id.length*7)%53}%"></span></i><em>${t('reading')}</em></span></button>`).join('')}</div></section>`:''}
    <section class="section-block"><div class="section-heading"><div><span class="eyebrow">A LITTLE SOMETHING FOR YOU</span><h2>${t('popular')}</h2></div><button class="text-link" data-action="navigate" data-route="discover">${t('seeAll')} ↗</button></div><div class="book-row">${(state.books.length?state.books.slice(4,10):[]).map(book=>bookCard(book,true)).join('')}</div></section>
    <section class="section-block"><div class="section-heading"><div><span class="eyebrow">${t('community')}</span><h2>${t('recent')}</h2></div><button class="text-link" data-action="navigate" data-route="community">${t('seeAll')} ↗</button></div>${state.feed.length?`<div class="review-grid">${state.feed.slice(0,2).map(item=>reviewCard(item,true)).join('')}</div>`:`<div class="soft-empty">${t('activityEmpty')}</div>`}</section>`;
}
function discoverPage() {
  const visible = state.books.filter(book=>(!state.query || `${book.title} ${book.author} ${book.summary}`.toLowerCase().includes(state.query.toLowerCase())) && (state.genre==='All books'||book.genre===state.genre));
  return `<section class="page-intro"><div class="eyebrow">A LIBRARY FOR CURIOUS MINDS</div><h1>${t('discoverTitle')}</h1><p class="lede">${t('discoverSub')}</p></section>
    <div class="discover-controls"><label class="search-large"><span>⌕</span><input id="catalog-search" value="${esc(state.query)}" placeholder="${esc(t('search'))}"><button data-action="clear-search" aria-label="Clear search">×</button></label><span class="result-count">${visible.length} BOOKS TO WANDER THROUGH</span></div>
    <div class="genre-pills">${[t('allBooks'),...state.genres].map(genre=>`<button class="pill ${state.genre===(genre===t('allBooks')?'All books':genre)?'selected':''}" data-action="genre" data-genre="${esc(genre===t('allBooks')?'All books':genre)}">${esc(genre)}</button>`).join('')}</div>
    ${visible.length?`<div class="book-grid">${visible.map(book=>bookCard(book)).join('')}</div>`:`<div class="empty-state"><span>⌕</span><h2>No books on this shelf</h2><p>Try another title, author, or genre.</p></div>`}`;
}
function shelfPage() {
  const tabs = ['All books','To Read','Reading','Completed'];
  const visible = state.shelf.filter(book=>state.shelfTab==='All books'||book.status===state.shelfTab);
  return `<section class="page-intro"><div class="eyebrow">YOUR LITTLE LIBRARY</div><h1>${t('yourShelf')}</h1><p class="lede">Every book you have met, every one you still hope to.</p></section>
    <div class="shelf-tabs">${tabs.map(tab=>`<button class="shelf-tab ${state.shelfTab===tab?'selected':''}" data-action="shelf-tab" data-tab="${esc(tab)}">${esc(t(tab==='All books'?'allBooks':tab==='To Read'?'toRead':tab.toLowerCase()))}<span>${tab==='All books'?state.shelf.length:state.shelf.filter(b=>b.status===tab).length}</span></button>`).join('')}</div>
    ${visible.length?`<div class="book-grid">${visible.map(book=>bookCard(book)).join('')}</div>`:`<div class="empty-state"><span>✳</span><h2>${state.shelf.length?t('emptyShelf'):t('emptyShelf')}</h2><p>${t('emptyShelfSub')}</p><button class="button" data-action="navigate" data-route="discover">${t('discoverMore')} ↗</button></div>`}`;
}
function communityPage() {
  return `<section class="page-intro"><div class="eyebrow">BOOKS ARE BETTER SHARED</div><h1>${t('communityTitle')}</h1><p class="lede">${t('communitySub')}</p></section>
    <div class="community-columns"><section><div class="section-heading compact-heading"><div><span class="eyebrow">FIND YOUR PEOPLE</span><h2>${t('readers')}</h2></div></div><label class="search-large people-search"><span>⌕</span><input id="people-search" placeholder="Search readers"><button data-action="clear-people" aria-label="Clear search">×</button></label><div class="reader-grid">${state.people.length?state.people.map(userCard).join(''):`<div class="soft-empty">${t('activityEmpty')}</div>`}</div></section>
    <section><div class="section-heading compact-heading"><div><span class="eyebrow">${t('latest')}</span><h2>${t('recent')}</h2></div></div><div class="community-feed">${state.feed.length?state.feed.map(item=>reviewCard(item,true)).join(''):`<div class="soft-empty">${t('activityEmpty')}</div>`}</div></section></div>`;
}
function profilePage() {
  const profile = state.profile || state.user;
  if (!profile) return `<div class="guest-panel"><span class="guest-icon">◉</span><h1>Your reading story</h1><p>${t('signInToSave')}</p><button class="button" data-action="auth">${t('signIn')}</button></div>`;
  const own = profile.id===state.user?.id;
  return `<section class="profile-hero"><div class="profile-identity">${avatar(profile)}<div><div class="eyebrow">${own?'YOUR READING CORNER':'A READER IN THE CIRCLE'}</div><h1>${esc(profile.name)}</h1><p>${esc(profile.bio||'Still finding the words.')}</p></div></div>${own?`<button class="button button-light" data-action="navigate" data-route="settings">Edit profile</button>`:`<button class="button ${profile.is_following?'button-soft':''}" data-action="follow" data-id="${esc(profile.id)}">${profile.is_following?t('following'):t('follow')}</button>`}</section>
    <div class="profile-stats"><div><b>${profile.books_count||0}</b><span>${t('books')}</span></div><div><b>${profile.review_count||0}</b><span>${t('reviews')}</span></div><div><b>${profile.followers||0}</b><span>${t('followers')}</span></div><div><b>${profile.following||0}</b><span>following</span></div></div>
    <section class="section-block profile-section"><div class="section-heading"><div><span class="eyebrow">WORDS BETWEEN THE PAGES</span><h2>${t('latest')}</h2></div></div>${profile.reviews?.length?`<div class="review-grid">${profile.reviews.map(item=>reviewCard({...item,user_id:profile.id,name:profile.name,initials:profile.initials,color:profile.color})).join('')}</div>`:`<div class="soft-empty">${t('profileEmpty')}</div>`}</section>
    <section class="section-block profile-section"><div class="section-heading"><div><span class="eyebrow">BOOKS KEPT CLOSE</span><h2>${t('yourShelf')}</h2></div></div>${profile.shelves?.length?`<div class="book-row">${profile.shelves.slice(0,6).map(book=>bookCard(book,true)).join('')}</div>`:`<div class="soft-empty">No saved books yet.</div>`}</section>`;
}
function settingsPage() {
  const user = state.user;
  if (!user) return `<div class="guest-panel"><span class="guest-icon">⚙</span><h1>${t('settingsTitle')}</h1><p>Sign in to manage your account and reading preferences.</p><button class="button" data-action="auth">${t('signIn')}</button></div>`;
  return `<section class="page-intro"><div class="eyebrow">A FEW LITTLE DETAILS</div><h1>${t('settingsTitle')}</h1><p class="lede">${t('settingsSub')}</p></section>
    <div class="settings-layout"><form class="settings-card" id="settings-form"><h2>${t('account')}</h2><label>${t('name')}<input name="name" required minlength="2" maxlength="60" value="${esc(user.name)}"></label><label>${t('email')}<input type="email" value="${esc(user.email)}" disabled></label><label>${t('bio')}<textarea name="bio" maxlength="280" rows="3" placeholder="What do you love to read?">${esc(user.bio||'')}</textarea></label><label>${t('language')}<select name="language"><option value="en" ${state.lang==='en'?'selected':''}>English</option><option value="bn" ${state.lang==='bn'?'selected':''}>বাংলা</option></select></label><button class="button" type="submit">${t('saveChanges')}</button></form>
    <section class="settings-card privacy-card"><span class="privacy-icon">♡</span><h2>${t('privacy')}</h2><p>${t('dataPrivacy')} Download a copy of your profile, shelf, and reviews at any time.</p><button class="button button-light full-button" data-action="export">↓ &nbsp;${t('exportData')}</button><button class="button button-light full-button" data-action="logout">${t('logout')}</button><div class="danger-zone"><span>ACCOUNT</span><p>Ready to leave? Your profile and reading activity will be removed.</p><button class="text-danger" data-action="delete-account">${t('deleteAccount')} →</button></div></section></div>
    <section class="about-card"><div><span class="eyebrow">${t('about')}</span><p>MahinBook is a small place for big stories: discover books, keep your reading life in one place, and share a note with fellow readers.</p></div><span class="about-mark">m·b</span></section>`;
}
function pageContent() {
  if (state.route==='discover') return discoverPage();
  if (state.route==='shelf') return shelfPage();
  if (state.route==='community') return communityPage();
  if (state.route==='profile') return profilePage();
  if (state.route==='settings') return settingsPage();
  return homePage();
}

function modalMarkup() {
  if (!state.modal) return '';
  if (state.modal.type==='auth') return `<div class="modal-backdrop" data-action="backdrop"><section class="auth-modal" role="dialog" aria-modal="true"><button class="modal-close" data-action="close-modal" aria-label="Close">×</button><div class="modal-brand">m<span>·</span>b</div><div class="eyebrow">MAHINBOOK</div><h2>${state.modal.mode==='signup'?t('signupTitle'):t('loginTitle')}</h2><p>${state.modal.mode==='signup'?t('signupSub'):t('loginSub')}</p><form id="auth-form"><input type="hidden" name="mode" value="${state.modal.mode}">${state.modal.mode==='signup'?`<label>${t('name')}<input name="name" minlength="2" required autocomplete="name" placeholder="Samira Ahmed"></label>`:''}<label>${t('email')}<input name="email" type="email" required autocomplete="email" placeholder="you@example.com"></label><label>${t('password')}<input name="password" type="password" minlength="8" required autocomplete="${state.modal.mode==='signup'?'new-password':'current-password'}" placeholder="${t('passwordHint')}"></label><button class="button full-button" type="submit">${state.modal.mode==='signup'?t('createAccount'):t('signIn')} <span>↗</span></button></form><div class="auth-switch">${state.modal.mode==='signup'?t('haveAccount'):t('noAccount')} <button data-action="auth-mode" data-mode="${state.modal.mode==='signup'?'login':'signup'}">${state.modal.mode==='signup'?t('signIn'):t('createAccount')}</button></div><small class="auth-note">Public books are open to everyone. A free account keeps your shelf in sync on this device.</small></section></div>`;
  if (state.modal.type==='book') {
    const book=state.modal.book; if(!book) return '';
    return `<div class="modal-backdrop" data-action="backdrop"><section class="book-modal" role="dialog" aria-modal="true" aria-label="${esc(book.title)}"><button class="modal-close" data-action="close-modal" aria-label="Close">×</button><div class="book-detail-head">${cover(book,'detail-cover')}<div class="book-detail-info"><span class="eyebrow">${esc(book.genre)} · ${book.year>0?esc(book.year):`${esc(Math.abs(book.year))} BCE`}</span><h2>${esc(book.title)}</h2><p class="detail-author">${t('author')} <b>${esc(book.author)}</b></p><div class="detail-rating">${Number(book.rating)?`${starText(book.rating)} <span>${Number(book.rating).toFixed(1)} · ${book.review_count} ${t('reviews').toLowerCase()}</span>`:`<span>No reader rating yet</span>`}</div><p class="detail-summary">${esc(book.summary)}</p><div class="detail-facts"><span><b>${esc(book.pages)}</b>${t('page')}</span><span><b>${book.year>0?esc(book.year):`${esc(Math.abs(book.year))} BCE`}</b>${t('year')}</span></div>
      <div class="detail-actions">${state.user?`<select id="book-status" aria-label="${t('status')}"><option value="">${t('status')}…</option>${[['To Read','toRead'],['Reading','reading'],['Completed','completed']].map(([v,k])=>`<option value="${v}" ${book.status===v?'selected':''}>${t(k)}</option>`).join('')}</select><button class="button" data-action="save-status" data-id="${esc(book.id)}">${book.status?t('updateShelf'):t('save')}</button>${book.status?`<button class="icon-button remove-button" data-action="remove-book" data-id="${esc(book.id)}" title="${t('remove')}">×</button>`:''}`:`<button class="button" data-action="auth">${t('signIn')}</button>`}</div></div></div>
      <div class="modal-reviews"><div class="section-heading"><div><span class="eyebrow">A LITTLE WORD FROM READERS</span><h3>${t('reviews')}</h3></div>${state.user?`<button class="text-link" data-action="toggle-review">${t('writeReview')} +</button>`:''}</div>
      ${state.user&&state.modal.showReview?`<form id="review-form" class="review-form"><div class="rating-picker" aria-label="Choose a rating">${[1,2,3,4,5].map(n=>`<button type="button" data-action="rate" data-rating="${n}" class="${n<=state.reviewRating?'on':''}" aria-label="${n} stars">★</button>`).join('')}</div><textarea name="text" minlength="3" maxlength="2000" required placeholder="What stayed with you about this book?">${esc(state.modal.myReview||'')}</textarea><div class="review-form-bottom"><span>Keep it kind, keep it yours.</span><button class="button button-small" type="submit">${t('submitReview')}</button></div></form>`:''}
      <div class="modal-review-list">${state.modal.reviews?.length?state.modal.reviews.map(r=>reviewCard({...r,book_id:book.id,title:book.title})).join(''):`<div class="soft-empty">${t('noReviews')}</div>`}</div></div></section></div>`;
  }
  if (state.modal.type==='comments') return `<div class="modal-backdrop" data-action="backdrop"><section class="comments-modal" role="dialog" aria-modal="true"><button class="modal-close" data-action="close-modal" aria-label="Close">×</button><div class="eyebrow">A CONVERSATION ABOUT A BOOK</div><h2>Reader comments</h2><div class="comments-list">${state.comments.length?state.comments.map(c=>`<div class="comment-row">${avatar(c)}<div><b>${esc(c.name||'Reader')}</b><p>${esc(c.text)}</p></div></div>`).join(''):`<div class="soft-empty">No comments yet. Start a kind conversation.</div>`}</div>${state.user?`<form id="comment-form" data-review="${esc(state.modal.reviewId)}"><input name="text" maxlength="1000" required placeholder="Add a kind thought…"><button class="button" type="submit">Send ↗</button></form>`:`<button class="button" data-action="auth">${t('signIn')}</button>`}</section></div>`;
  if (state.modal.type==='notifications') return `<div class="modal-backdrop" data-action="backdrop"><section class="notification-modal" role="dialog" aria-modal="true"><button class="modal-close" data-action="close-modal" aria-label="Close">×</button><div class="eyebrow">YOUR READING CIRCLE</div><h2>${t('notifications')}</h2>${state.notifications.length?`<div class="notification-list">${state.notifications.map(n=>`<button class="notification-row ${n.read_at?'':'unread'}" data-action="notification-open" data-kind="${esc(n.kind)}" data-id="${esc(n.actor_id)}">${avatar({name:n.actor_name,initials:n.initials,color:n.color})}<span><b>${esc(n.actor_name)}</b> ${n.kind==='follow'?'started following you':n.kind==='like'?'liked your review':n.kind==='comment'?'left a comment on your review':'posted a new review'}<small>${dateText(n.created_at)}</small></span></button>`).join('')}</div>`:`<div class="soft-empty">${t('notificationEmpty')}</div>`}</section></div>`;
  return '';
}

function render() {
  document.documentElement.lang=state.lang;
  $('#app').innerHTML=shell(pageContent());
}
function toast(message, kind='') {
  const node=$('#toast'); node.textContent=message; node.className=`toast show ${kind}`;
  clearTimeout(toast.timer); toast.timer=setTimeout(()=>node.className='toast',3200);
}
async function api(path, options={}) {
  const response=await fetch(path,{credentials:'same-origin',...options,headers:{...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})}});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(payload.error||`Request failed (${response.status})`);
  return payload;
}
function saveUser(user) {
  state.user=user;
  if(user) localStorage.setItem('mb_cached_user',JSON.stringify(user));
  else localStorage.removeItem('mb_cached_user');
}
async function loadUser() {
  let cached=null; try{cached=JSON.parse(localStorage.getItem('mb_cached_user')||'null')}catch{}
  try {
    const result=await api('/api/me'); state.offline=false;
    if(result.user){saveUser(result.user);state.lang=result.user.language||state.lang;localStorage.setItem('mb_language',state.lang)}
    else saveUser(null);
  } catch {state.offline=true;state.user=cached;}
}
async function loadBooks() {
  try {
    const result=await api('/api/books'); state.books=result.books;state.genres=result.genres;state.offline=false;
    localStorage.setItem('mb_cached_books',JSON.stringify({books:state.books,genres:state.genres}));
  } catch {try{const saved=JSON.parse(localStorage.getItem('mb_cached_books')||'{}');state.books=saved.books||[];state.genres=saved.genres||[];}catch{state.books=[];state.genres=[]}state.offline=true;}
}
async function loadShelf() {
  if(!state.user){state.shelf=[];return}
  const cacheKey=`mb_shelf_${state.user.id}`;
  try{const result=await api('/api/lists');state.shelf=result.books;localStorage.setItem(cacheKey,JSON.stringify(result.books));}
  catch{try{state.shelf=JSON.parse(localStorage.getItem(cacheKey)||'[]')}catch{state.shelf=[]}state.offline=true;}
}
async function loadFeed() {try{const r=await api('/api/feed');state.feed=r.items;}catch{state.feed=[]}}
async function loadPeople(q='') {try{const r=await api(`/api/users?q=${encodeURIComponent(q)}`);state.people=r.users;}catch{state.people=[]}}
async function loadNotifications() {if(!state.user)return;try{const r=await api('/api/notifications');state.notifications=r.items;}catch{state.notifications=[]}}
async function boot() {
  await loadUser(); await loadBooks();
  await Promise.all([loadShelf(),loadFeed(),loadPeople(),loadNotifications()]);
  if(!navigator.onLine)state.offline=true;
  render();
}
function navigate(route) {
  state.route=route;state.profile=null;state.modal=null;
  if(route==='profile'&&state.user) loadProfile(state.user.id);
  render();window.scrollTo({top:0,behavior:'smooth'});
}
async function loadProfile(id) {
  try{const r=await api(`/api/users/${encodeURIComponent(id)}`);state.profile=r.profile;render();}
  catch(error){if(state.user&&id===state.user.id){state.profile={...state.user,reviews:[],shelves:[]};render()}else toast(error.message,'error')}
}
async function openBook(id) {
  const cached=state.books.find(b=>b.id===id)||state.shelf.find(b=>b.id===id);
  state.modal={type:'book',book:cached,reviews:[],showReview:false};state.reviewRating=0;render();
  try{const result=await api(`/api/books/${encodeURIComponent(id)}`);state.modal={...state.modal,book:result.book,reviews:result.reviews};}
  catch{if(!cached){toast('This book is not available offline.','error');state.modal=null;}}
  render();
}
function openAuth(mode='login') {state.modal={type:'auth',mode};render()}
function requireLogin() {if(state.user)return true;toast(t('signInToSave'));openAuth('signup');return false}
async function saveBookStatus(id) {
  if(!requireLogin())return;
  const status=$('#book-status')?.value;
  if(!status){toast('Choose a reading status first.','error');return}
  try{await api(`/api/lists/${encodeURIComponent(id)}`,{method:'POST',body:JSON.stringify({status})});await loadShelf();await loadBooks();toast('Saved to your shelf.');if(state.modal?.book?.id===id)state.modal.book=state.books.find(b=>b.id===id);render();}
  catch(e){toast(e.message==='Failed to fetch'?'You are offline. Changes will need a connection.':e.message,'error')}
}
async function removeBook(id) {try{await api(`/api/lists/${encodeURIComponent(id)}`,{method:'DELETE'});await loadShelf();await loadBooks();state.modal.book=state.books.find(b=>b.id===id);render();toast('Removed from your shelf.')}catch(e){toast(e.message,'error')}}
async function toggleFollow(id) {if(!requireLogin())return;const person=state.people.find(p=>p.id===id);const profile=state.profile?.id===id?state.profile:person;const method=profile?.is_following?'DELETE':'POST';try{await api(`/api/users/${encodeURIComponent(id)}/follow`,{method});if(person)person.is_following=method==='POST';if(state.profile?.id===id){state.profile.is_following=method==='POST';state.profile.followers=Math.max(0,(state.profile.followers||0)+(method==='POST'?1:-1))}await loadPeople();render();toast(method==='POST'?'You are now following this reader.':'You unfollowed this reader.')}catch(e){toast(e.message,'error')}}

$('#app').addEventListener('click', async event => {
  const target=event.target.closest('[data-action]');if(!target)return;
  const action=target.dataset.action;
  if(action==='backdrop'&&event.target!==target)return;
  if(action==='navigate')return navigate(target.dataset.route);
  if(action==='auth')return openAuth(target.dataset.mode||'login');
  if(action==='auth-mode'){state.modal={type:'auth',mode:target.dataset.mode};return render()}
  if(action==='close-modal'||action==='backdrop'){state.modal=null;return render()}
  if(action==='open-book')return openBook(target.dataset.id);
  if(action==='genre'){state.genre=target.dataset.genre;return render()}
  if(action==='shelf-tab'){state.shelfTab=target.dataset.tab;return render()}
  if(action==='clear-search'){state.query='';const input=$('#catalog-search');if(input)input.value='';return render()}
  if(action==='clear-people'){const input=$('#people-search');if(input)input.value='';await loadPeople();return render()}
  if(action==='save-status')return saveBookStatus(target.dataset.id);
  if(action==='remove-book')return removeBook(target.dataset.id);
  if(action==='toggle-review'){state.modal.showReview=!state.modal.showReview;const own=state.modal.reviews.find(r=>r.user_id===state.user?.id);if(own){state.modal.myReview=own.text;state.reviewRating=own.rating}return render()}
  if(action==='rate'){state.modal.myReview=$('#review-form textarea')?.value||state.modal.myReview||'';state.reviewRating=Number(target.dataset.rating);return render()}
  if(action==='follow')return toggleFollow(target.dataset.id);
  if(action==='view-profile'){state.route='profile';state.modal=null;state.profile=null;render();return loadProfile(target.dataset.id)}
  if(action==='like'){
    if(!requireLogin())return;
    try{const result=await api(`/api/reviews/${target.dataset.id}/like`,{method:'POST'});const card=target.closest('.review-card');const count=$('span',target);target.classList.toggle('liked',result.liked);target.firstChild.textContent=result.liked?'♥':'♡';if(count)count.textContent=result.likes;}
    catch(e){toast(e.message,'error')}return;
  }
  if(action==='comments'){
    try{const r=await api(`/api/reviews/${target.dataset.id}/comments`);state.comments=r.comments;state.modal={type:'comments',reviewId:target.dataset.id};render();}
    catch(e){toast(e.message,'error')}return;
  }
  if(action==='notifications'){
    if(!requireLogin())return;
    await loadNotifications();state.modal={type:'notifications'};render();api('/api/notifications/read',{method:'POST'}).then(()=>{state.notifications.forEach(n=>n.read_at=n.read_at||Date.now()/1000)}).catch(()=>{});return;
  }
  if(action==='notification-open'){state.modal=null;if(target.dataset.kind==='follow'){state.route='profile';render();return loadProfile(target.dataset.id)}const id=state.notifications.find(n=>n.actor_id===target.dataset.id)?.entity_id;if(id){const review=state.feed.find(r=>String(r.review_id)===id);return review?openBook(review.book_id):navigate('community')}return navigate('community')}
  if(action==='export'){try{const data=await api('/api/export');const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='mahinbook-my-data.json';a.click();URL.revokeObjectURL(a.href);toast('Your data export is ready.')}catch(e){toast(e.message,'error')}return}
  if(action==='logout'){
    try{await api('/api/auth/logout',{method:'POST'});if(state.user)localStorage.removeItem(`mb_shelf_${state.user.id}`);saveUser(null);state.shelf=[];state.notifications=[];state.profile=null;state.route='home';await loadBooks();render();toast('You are signed out.')}catch(e){toast(e.message,'error')}return;
  }
  if(action==='delete-account'){
    if(!confirm('Delete your account, reviews, and shelf? This cannot be undone.'))return;
    try{await api('/api/me',{method:'DELETE'});saveUser(null);state.shelf=[];await boot();navigate('home');toast('Your account was deleted.')}catch(e){toast(e.message,'error')}return;
  }
});

$('#app').addEventListener('submit', async event => {
  event.preventDefault();const form=event.target;const data=new FormData(form);
  if(form.id==='global-search'){state.query=String(data.get('q')||'').trim();state.genre='All books';navigate('discover');return}
  if(form.id==='auth-form'){
    const mode=data.get('mode');const path=mode==='signup'?'/api/auth/signup':'/api/auth/login';
    try{const result=await api(path,{method:'POST',body:JSON.stringify({name:data.get('name'),email:data.get('email'),password:data.get('password')})});saveUser(result.user);state.lang=result.user.language||state.lang;state.modal=null;await Promise.all([loadBooks(),loadShelf(),loadFeed(),loadNotifications()]);render();toast(mode==='signup'?'Your reading corner is ready.':'Welcome back.');}
    catch(e){toast(e.message,'error')}return;
  }
  if(form.id==='review-form'){
    if(state.reviewRating<1){toast('Tap a star to choose your rating.','error');return}
    try{await api(`/api/books/${encodeURIComponent(state.modal.book.id)}/reviews`,{method:'POST',body:JSON.stringify({rating:state.reviewRating,text:data.get('text')})});await Promise.all([loadBooks(),loadShelf(),loadFeed()]);const result=await api(`/api/books/${encodeURIComponent(state.modal.book.id)}`);state.modal={...state.modal,book:result.book,reviews:result.reviews,showReview:false};render();toast('Your review is on the shelf.');}
    catch(e){toast(e.message,'error')}return;
  }
  if(form.id==='comment-form'){
    try{await api(`/api/reviews/${encodeURIComponent(form.dataset.review)}/comments`,{method:'POST',body:JSON.stringify({text:data.get('text')})});const r=await api(`/api/reviews/${encodeURIComponent(form.dataset.review)}/comments`);state.comments=r.comments;render();toast('Comment added.');}
    catch(e){toast(e.message,'error')}return;
  }
  if(form.id==='settings-form'){
    try{const result=await api('/api/me',{method:'PATCH',body:JSON.stringify({name:data.get('name'),bio:data.get('bio'),language:data.get('language')})});saveUser(result.user);state.lang=result.user.language;localStorage.setItem('mb_language',state.lang);render();toast('Your details are saved.');}
    catch(e){toast(e.message,'error')}return;
  }
});

$('#app').addEventListener('keydown', event=>{
  const card=event.target.closest('.book-card');if(card&&(event.key==='Enter'||event.key===' ')){event.preventDefault();openBook(card.dataset.id)}
});
let searchTimer;
$('#app').addEventListener('input', event=>{
  if(event.target.id==='catalog-search'){state.query=event.target.value;clearTimeout(searchTimer);searchTimer=setTimeout(render,120)}
  if(event.target.id==='people-search'){clearTimeout(searchTimer);searchTimer=setTimeout(async()=>{await loadPeople(event.target.value);render();const replacement=$('#people-search');if(replacement){replacement.focus();replacement.setSelectionRange(replacement.value.length,replacement.value.length)}},250)}
});
window.addEventListener('online',async()=>{state.offline=false;await loadUser();await loadBooks();await Promise.all([loadShelf(),loadFeed(),loadPeople(),loadNotifications()]);render();toast('You are back online.')});
window.addEventListener('offline',()=>{state.offline=true;render()});
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/service-worker.js').catch(()=>{}));
boot();
