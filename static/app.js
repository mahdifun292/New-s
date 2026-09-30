// ============================================================
// پیام‌رسان v2 — کلاینت
// ============================================================

const socket = io({ transports: ['websocket', 'polling'] });
const $ = (id) => document.getElementById(id);

// ------- عناصر -------
const loginScreen = $('login');
const appEl = $('app');
const nameInput = $('nameInput');
const joinBtn = $('joinBtn');
const roomPicker = $('roomPicker');

const myAvatar = $('myAvatar');
const myName = $('myName');
const myNameTop = $('myNameTop');
const roomsList = $('roomsList');
const userList = $('userList');
const userCount = $('userCount');
const headerCount = $('headerCount');

const roomTitle = $('roomTitle');
const roomAvatar = $('roomAvatar');

const messagesEl = $('messages');
const msgInput = $('msgInput');
const sendBtn = $('sendBtn');
const fileInput = $('fileInput');
const attachBtn = $('attachBtn');
const micBtn = $('micBtn');

const composerMain = $('composerMain');
const composerRec = $('composerRec');
const recTime = $('recTime');
const sendRec = $('sendRec');
const cancelRec = $('cancelRec');

// جستجو
const searchBar = $('searchBar');
const searchInput = $('searchInput');

// تنظیمات
const settingsDrawer = $('settingsDrawer');
const settingsBtn = $('settingsBtn');
const settingsBtnTop = $('settingsBtnTop');
const closeSettings = $('closeSettings');

// تماس
const callModal = $('callModal');
const callAvatar = $('callAvatar');
const callName = $('callName');
const callStatus = $('callStatus');
const acceptCallBtn = $('acceptCall');
const rejectCallBtn = $('rejectCall');

const activeCall = $('activeCall');
const activeAvatar = $('activeAvatar');
const activeName = $('activeName');
const activeStatus = $('activeStatus');
const muteBtn = $('muteBtn');
const endCallBtn = $('endCallBtn');

const remoteAudio = $('remoteAudio');
const toastEl = $('toast');

// تغییر نام
const renameModal = $('renameModal');
const newNameInput = $('newNameInput');

// ------- وضعیت -------
let me = { id: null, name: '', room: 'general' };
let allUsers = [];
let roomsData = {};     // از data attributes
let currentFilter = '';

// ضبط صدا
let mediaRecorder = null;
let recordedChunks = [];
let recTimer = null;
let recSeconds = 0;
let stream = null;

// تماس
let currentCall = {
  peer: null, name: '', isCaller: false,
  pc: null, localStream: null, iceQueue: [],
  timer: null, seconds: 0, muted: false,
};

// تنظیمات
const settings = {
  theme: 'dark',
  font: 'medium',
  sound: true,
  notify: false,
  compact: false,
  volume: 100,
};

// ============================================================
//  تنظیمات
// ============================================================
function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem('messenger_settings') || '{}');
    Object.assign(settings, saved);
  } catch {}
  applySettings();
}
function saveSettings() {
  localStorage.setItem('messenger_settings', JSON.stringify(settings));
}
function applySettings() {
  document.body.dataset.theme = settings.theme;
  document.body.dataset.font = settings.font;
  document.body.dataset.compact = settings.compact ? 'true' : 'false';
  remoteAudio.volume = settings.volume / 100;

  // سگمنت‌ها
  document.querySelectorAll('.segmented').forEach(seg => {
    const key = seg.dataset.setting;
    seg.querySelectorAll('button').forEach(b => {
      b.classList.toggle('active', b.dataset.value === settings[key]);
    });
  });
  // سوییچ‌ها
  document.querySelectorAll('input[type="checkbox"][data-setting]').forEach(inp => {
    inp.checked = !!settings[inp.dataset.setting];
  });
  const volSlider = $('volumeSlider');
  if (volSlider) volSlider.value = settings.volume;
}

document.querySelectorAll('.segmented').forEach(seg => {
  seg.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const key = seg.dataset.setting;
    settings[key] = btn.dataset.value;
    saveSettings(); applySettings();
  });
});
document.querySelectorAll('input[type="checkbox"][data-setting]').forEach(inp => {
  inp.addEventListener('change', () => {
    const key = inp.dataset.setting;
    if (key === 'notify' && inp.checked) {
      if ('Notification' in window && Notification.permission !== 'granted') {
        Notification.requestPermission();
      }
    }
    settings[key] = inp.checked;
    saveSettings(); applySettings();
  });
});
$('volumeSlider')?.addEventListener('input', (e) => {
  settings.volume = parseInt(e.target.value);
  saveSettings();
  remoteAudio.volume = settings.volume / 100;
});

// باز/بسته کردن drawer
function openDrawer() { settingsDrawer.classList.add('open'); }
function closeDrawer() { settingsDrawer.classList.remove('open'); }
settingsBtn?.addEventListener('click', openDrawer);
settingsBtnTop?.addEventListener('click', openDrawer);
closeSettings?.addEventListener('click', closeDrawer);
settingsDrawer.addEventListener('click', (e) => {
  if (e.target === settingsDrawer) closeDrawer();
});

// ============================================================
//  تست میکروفون
// ============================================================
let micTestStream = null, micTestAnim = null;
$('testMicBtn')?.addEventListener('click', async () => {
  const btn = $('testMicBtn');
  const level = $('micLevel').firstElementChild;

  if (micTestStream) {
    micTestStream.getTracks().forEach(t => t.stop());
    micTestStream = null;
    cancelAnimationFrame(micTestAnim);
    level.style.width = '0%';
    btn.textContent = 'شروع تست میکروفون';
    return;
  }

  try {
    micTestStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    btn.textContent = 'توقف تست';
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const src = ctx.createMediaStreamSource(micTestStream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    src.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      const avg = sum / data.length;
      level.style.width = Math.min(100, avg * 1.8) + '%';
      micTestAnim = requestAnimationFrame(tick);
    };
    tick();
    showToast('🎤 میکروفون فعال است. صحبت کنید');
  } catch (e) {
    showToast('❌ دسترسی به میکروفون داده نشد');
  }
});

$('clearChatBtn')?.addEventListener('click', () => {
  messagesEl.innerHTML = '';
  showToast('صفحه چت پاک شد');
});

// ============================================================
//  کمکی
// ============================================================
function initial(name) { return (name || '?').trim().charAt(0).toUpperCase(); }
function hashColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h) % 360;
}
function gradFor(name) {
  const h1 = hashColor(name);
  const h2 = (h1 + 45) % 360;
  return `linear-gradient(135deg, hsl(${h1},65%,58%), hsl(${h2},65%,48%))`;
}
function showToast(text) {
  toastEl.textContent = text;
  toastEl.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toastEl.classList.remove('show'), 2600);
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}
function scrollBottom() { messagesEl.scrollTop = messagesEl.scrollHeight; }
function fmtDur(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, '0');
  const s = String(Math.floor(sec % 60)).padStart(2, '0');
  return `${m}:${s}`;
}
function fmtSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024*1024) return (bytes/1024).toFixed(1) + ' KB';
  return (bytes/1024/1024).toFixed(1) + ' MB';
}

// صدای اعلان با Web Audio (بدون فایل خارجی)
function playNotificationSound() {
  if (!settings.sound) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.connect(gain).connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.25);
  } catch {}
}

function browserNotify(title, body) {
  if (!settings.notify) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (document.visibilityState === 'visible') return;
  try { new Notification(title, { body, icon: '/static/favicon.ico' }); } catch {}
}

// ============================================================
//  ورود
// ============================================================
let selectedRoom = 'general';
roomPicker?.addEventListener('click', (e) => {
  const tile = e.target.closest('.room-tile');
  if (!tile) return;
  roomPicker.querySelectorAll('.room-tile').forEach(t => t.classList.remove('active'));
  tile.classList.add('active');
  selectedRoom = tile.dataset.room;
});

joinBtn.addEventListener('click', doJoin);
nameInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') doJoin(); });

function doJoin() {
  const name = nameInput.value.trim();
  if (!name) { nameInput.focus(); showToast('لطفاً نام خود را وارد کنید'); return; }
  me.name = name;
  me.room = selectedRoom;

  myName.textContent = name;
  myNameTop.textContent = name;
  myAvatar.textContent = initial(name);
  myAvatar.style.background = gradFor(name);

  socket.emit('join', { name, room: selectedRoom });

  loginScreen.classList.add('hidden');
  appEl.classList.remove('hidden');
  setTimeout(() => msgInput.focus(), 300);
}

// ============================================================
//  لیست کاربران
// ============================================================
socket.on('users_list', (users) => {
  allUsers = users;
  userCount.textContent = users.length;
  headerCount.textContent = users.length;
  renderUsers(users);
  renderRoomsSidebar();
});

function renderUsers(users) {
  userList.innerHTML = '';
  users.forEach(u => {
    const isMe = (u.id === socket.id);
    const li = document.createElement('li');
    if (isMe) li.classList.add('me');
    li.innerHTML = `
      <div class="avatar" style="background:${gradFor(u.name)}">${initial(u.name)}</div>
      <div style="flex:1;min-width:0">
        <div class="u-name">${escapeHtml(u.name)}${isMe ? ' (شما)' : ''}</div>
        <div class="u-hint">${isMe ? 'خودتان' : 'برای تماس کلیک کنید'}</div>
      </div>
      ${!isMe ? '<div class="call-icon">📞</div>' : ''}
    `;
    if (!isMe) li.addEventListener('click', () => startCall(u.id, u.name));
    userList.appendChild(li);
  });
}

// سایدبار اتاق‌ها
function renderRoomsSidebar() {
  if (!roomsList) return;
  const rooms = Object.entries(roomsData);
  roomsList.innerHTML = '';
  rooms.forEach(([key, r]) => {
    const count = allUsers.filter(u => u.room === key).length;
    const div = document.createElement('div');
    div.className = 'room-item' + (key === me.room ? ' active' : '');
    div.innerHTML = `
      <span class="r-emoji">${r.icon}</span>
      <span class="r-name">${r.name}</span>
      <span class="r-count">${count}</span>
    `;
    div.addEventListener('click', () => switchRoom(key));
    roomsList.appendChild(div);
  });
}

function switchRoom(roomKey) {
  if (roomKey === me.room) return;
  me.room = roomKey;
  socket.emit('switch_room', { room: roomKey });
  const r = roomsData[roomKey];
  if (r) {
    roomTitle.textContent = r.name;
    roomAvatar.textContent = r.icon;
  }
  showToast(`به اتاق ${r?.name || ''} منتقل شدید`);
}

// ============================================================
//  پیام متنی
// ============================================================
sendBtn.addEventListener('click', sendMessage);
msgInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});
msgInput.addEventListener('input', () => {
  msgInput.style.height = 'auto';
  msgInput.style.height = Math.min(msgInput.scrollHeight, 130) + 'px';
});
function sendMessage() {
  const text = msgInput.value.trim();
  if (!text) return;
  socket.emit('message', { text });
  msgInput.value = '';
  msgInput.style.height = 'auto';
}

// ============================================================
//  تاریخچه و پیام‌های دریافتی
// ============================================================
socket.on('history', (msgs) => {
  messagesEl.innerHTML = '';
  msgs.forEach(addMessage);
  scrollBottom();
});

socket.on('message', (msg) => {
  addMessage(msg);
  scrollBottom();
  if (msg.id !== socket.id) {
    playNotificationSound();
    browserNotify(msg.name, msg.type === 'text' ? msg.text :
                  msg.type === 'voice' ? '🎙️ پیام صوتی' : '📎 فایل');
  }
});

socket.on('user_joined', (u) => addSysMsg(`${u.name} وارد چت شد`));
socket.on('user_left',   (u) => addSysMsg(`${u.name} چت را ترک کرد`));

function addSysMsg(text) {
  const div = document.createElement('div');
  div.className = 'sys-msg';
  div.textContent = text;
  messagesEl.appendChild(div);
  scrollBottom();
}

// ============================================================
//  نمایش پیام
// ============================================================
function addMessage(msg) {
  const own = (msg.id === socket.id);
  const wrap = document.createElement('div');
  wrap.className = 'msg' + (own ? ' own' : '');

  const av = document.createElement('div');
  av.className = 'avatar';
  av.textContent = initial(msg.name);
  av.style.background = gradFor(msg.name);

  const bubble = document.createElement('div');
  bubble.className = 'bubble';

  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.innerHTML = `<span class="name">${escapeHtml(msg.name)}</span><span>${msg.time || ''}</span>`;
  bubble.appendChild(meta);

  if (msg.type === 'text') {
    const p = document.createElement('div');
    p.className = 'text';
    p.textContent = msg.text;
    bubble.appendChild(p);
  } else if (msg.type === 'file') {
    if ((msg.filetype || '').startsWith('image/')) {
      const img = document.createElement('img');
      img.src = msg.data;
      img.alt = msg.filename;
      img.addEventListener('click', () => window.open(msg.data, '_blank'));
      bubble.appendChild(img);
    } else {
      const a = document.createElement('a');
      a.className = 'file-link';
      a.href = msg.data;
      a.download = msg.filename;
      a.innerHTML = `
        <div class="file-icon">📎</div>
        <div class="file-info">
          <div class="file-name">${escapeHtml(msg.filename)}</div>
          <div class="file-size">${fmtSize(msg.filesize)}</div>
        </div>
      `;
      bubble.appendChild(a);
    }
  } else if (msg.type === 'voice') {
    const audio = document.createElement('audio');
    audio.controls = true;
    audio.src = msg.data;
    audio.volume = settings.volume / 100;
    audio.style.display = 'block';
    audio.style.maxWidth = '260px';
    audio.style.width = '100%';
    bubble.appendChild(audio);
  }

  wrap.appendChild(av);
  wrap.appendChild(bubble);
  messagesEl.appendChild(wrap);

  applyFilter();
}

// ============================================================
//  جستجو
// ============================================================
$('searchBtn')?.addEventListener('click', () => {
  searchBar.classList.toggle('hidden');
  if (!searchBar.classList.contains('hidden')) searchInput.focus();
  else { currentFilter = ''; searchInput.value = ''; applyFilter(); }
});
$('closeSearch')?.addEventListener('click', () => {
  searchBar.classList.add('hidden');
  searchInput.value = '';
  currentFilter = '';
  applyFilter();
});
searchInput?.addEventListener('input', () => {
  currentFilter = searchInput.value.trim().toLowerCase();
  applyFilter();
});
function applyFilter() {
  if (!currentFilter) {
    messagesEl.querySelectorAll('.msg').forEach(m => m.style.display = '');
    return;
  }
  messagesEl.querySelectorAll('.msg').forEach(m => {
    const t = m.textContent.toLowerCase();
    m.style.display = t.includes(currentFilter) ? '' : 'none';
  });
}

// ============================================================
//  ارسال فایل
// ============================================================
attachBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
  const f = fileInput.files[0];
  if (f) sendFile(f);
  fileInput.value = '';
});
['dragover','drop'].forEach(ev =>
  messagesEl.addEventListener(ev, e => e.preventDefault())
);
messagesEl.addEventListener('drop', (e) => {
  const f = e.dataTransfer.files[0];
  if (f) sendFile(f);
});

const MAX_FILE = 40 * 1024 * 1024;
function sendFile(file) {
  if (file.size > MAX_FILE) {
    showToast('حجم فایل نباید بیشتر از ۴۰ مگابایت باشد');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    socket.emit('file', {
      filename: file.name,
      filetype: file.type,
      filesize: file.size,
      data: reader.result,
    });
    showToast('✅ فایل ارسال شد');
  };
  reader.readAsDataURL(file);
}

// ============================================================
//  ضبط پیام صوتی
// ============================================================
micBtn.addEventListener('click', startRecording);
sendRec.addEventListener('click', stopAndSend);
cancelRec.addEventListener('click', cancelRecording);

async function startRecording() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showToast('❌ مرورگر از ضبط صدا پشتیبانی نمی‌کند');
    return;
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (e) {
    console.error(e);
    showToast('❌ دسترسی به میکروفون داده نشد. از تنظیمات مرورگر اجازه دهید.');
    return;
  }

  recordedChunks = [];
  let mimeType = 'audio/webm';
  if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = '';

  mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) recordedChunks.push(e.data);
  };
  mediaRecorder.onstop = () => stream.getTracks().forEach(t => t.stop());
  mediaRecorder.start();

  composerMain.classList.add('hidden');
  composerRec.classList.remove('hidden');
  micBtn.classList.add('recording');

  recSeconds = 0;
  recTime.textContent = '00:00';
  recTimer = setInterval(() => {
    recSeconds++;
    recTime.textContent = fmtDur(recSeconds);
    if (recSeconds >= 120) stopAndSend();
  }, 1000);
}

function stopAndSend() {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') return;
  mediaRecorder.onstop = () => {
    stream.getTracks().forEach(t => t.stop());
    const blob = new Blob(recordedChunks, { type: 'audio/webm' });
    if (blob.size === 0) { cleanupRecording(); return; }
    const reader = new FileReader();
    reader.onload = () => {
      socket.emit('voice', { data: reader.result, duration: recSeconds });
      showToast('🎙️ پیام صوتی ارسال شد');
    };
    reader.readAsDataURL(blob);
  };
  mediaRecorder.stop();
  cleanupRecording();
}

function cancelRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.onstop = () => stream.getTracks().forEach(t => t.stop());
    mediaRecorder.stop();
  }
  cleanupRecording();
}

function cleanupRecording() {
  clearInterval(recTimer);
  micBtn.classList.remove('recording');
  composerMain.classList.remove('hidden');
  composerRec.classList.add('hidden');
}

// ============================================================
//  WebRTC — تماس صوتی
// ============================================================
const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 10,
};

function createPeerConnection(peerId) {
  const pc = new RTCPeerConnection(RTC_CONFIG);
  currentCall.pc = pc;
  currentCall.iceQueue = [];

  pc.onicecandidate = (e) => {
    if (e.candidate) socket.emit('webrtc_ice', { to: peerId, candidate: e.candidate });
  };
  pc.ontrack = (e) => {
    if (remoteAudio.srcObject !== e.streams[0]) {
      remoteAudio.srcObject = e.streams[0];
    }
  };
  pc.onconnectionstatechange = () => {
    if (['failed','disconnected','closed'].includes(pc.connectionState)) {
      if (currentCall.peer) endCall(true);
    }
  };
  return pc;
}

async function getMicStream() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('WebRTC پشتیبانی نمی‌شود');
  }
  return await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    }
  });
}

// من زنگ می‌زنم
async function startCall(peerId, peerName) {
  if (currentCall.peer) { showToast('شما در تماس دیگری هستید'); return; }
  currentCall.peer = peerId;
  currentCall.name = peerName;
  currentCall.isCaller = true;
  currentCall.muted = false;

  showActiveCallModal(peerName, 'در حال زنگ زدن...');
  socket.emit('call_user', { to: peerId });
}

// دریافت تماس
socket.on('incoming_call', ({ from, name }) => {
  if (currentCall.peer) {
    socket.emit('reject_call', { to: from });
    return;
  }
  currentCall.peer = from;
  currentCall.name = name;
  currentCall.isCaller = false;

  callAvatar.textContent = initial(name);
  callAvatar.style.background = gradFor(name);
  callName.textContent = name;
  callStatus.textContent = 'در حال تماس...';
  callModal.classList.remove('hidden');
  playNotificationSound();

  // اگر تب فعال نیست نوتیفیکیشن
  browserNotify('تماس ورودی', `${name} با شما تماس می‌گیرد`);
});

rejectCallBtn.addEventListener('click', () => {
  if (currentCall.peer) socket.emit('reject_call', { to: currentCall.peer });
  callModal.classList.add('hidden');
  resetCall();
});

socket.on('call_rejected', () => {
  showToast('تماس رد شد');
  resetCall();
});

// پذیرش
acceptCallBtn.addEventListener('click', async () => {
  callModal.classList.add('hidden');
  try {
    const local = await getMicStream();
    currentCall.localStream = local;
    const pc = createPeerConnection(currentCall.peer);
    local.getTracks().forEach(t => pc.addTrack(t, local));
    socket.emit('accept_call', { to: currentCall.peer });
    showActiveCallModal(currentCall.name, 'در حال اتصال...');
  } catch (e) {
    showToast('❌ دسترسی به میکروفون داده نشد');
    socket.emit('reject_call', { to: currentCall.peer });
    resetCall();
  }
});

// زنگ‌زننده — پاسخ پذیرفته شد
socket.on('call_accepted', async ({ from }) => {
  try {
    const local = await getMicStream();
    currentCall.localStream = local;
    const pc = createPeerConnection(from);
    local.getTracks().forEach(t => pc.addTrack(t, local));

    const offer = await pc.createOffer({ offerToReceiveAudio: true });
    await pc.setLocalDescription(offer);
    socket.emit('webrtc_offer', { to: from, sdp: offer });
    updateActiveStatus('در حال اتصال...');
  } catch (e) {
    showToast('❌ خطا در شروع تماس');
    endCall(true);
  }
});

// WebRTC signaling
socket.on('webrtc_offer', async ({ from, sdp }) => {
  if (!currentCall.pc) return;
  await currentCall.pc.setRemoteDescription(new RTCSessionDescription(sdp));
  for (const c of currentCall.iceQueue) {
    try { await currentCall.pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
  }
  currentCall.iceQueue = [];
  const answer = await currentCall.pc.createAnswer();
  await currentCall.pc.setLocalDescription(answer);
  socket.emit('webrtc_answer', { to: from, sdp: answer });
});

socket.on('webrtc_answer', async ({ sdp }) => {
  if (!currentCall.pc) return;
  await currentCall.pc.setRemoteDescription(new RTCSessionDescription(sdp));
  for (const c of currentCall.iceQueue) {
    try { await currentCall.pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
  }
  currentCall.iceQueue = [];
  startCallTimer();
  updateActiveStatus('در حال مکالمه');
});

socket.on('webrtc_ice', async ({ candidate }) => {
  if (!currentCall.pc) return;
  if (currentCall.pc.remoteDescription && currentCall.pc.remoteDescription.type) {
    try { await currentCall.pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
  } else {
    currentCall.iceQueue.push(candidate);
  }
});

socket.on('call_ended', () => endCall(true));

endCallBtn.addEventListener('click', () => {
  if (currentCall.peer) socket.emit('end_call', { to: currentCall.peer });
  endCall(false);
});

function endCall() {
  if (currentCall.pc) try { currentCall.pc.close(); } catch {}
  if (currentCall.localStream) currentCall.localStream.getTracks().forEach(t => t.stop());
  if (currentCall.timer) clearInterval(currentCall.timer);
  remoteAudio.srcObject = null;
  activeCall.classList.add('hidden');
  callModal.classList.add('hidden');
  resetCall();
}

function resetCall() {
  currentCall = {
    peer: null, name: '', isCaller: false,
    pc: null, localStream: null, iceQueue: [],
    timer: null, seconds: 0, muted: false,
  };
  muteBtn.classList.remove('muted');
}

function showActiveCallModal(name, status) {
  activeAvatar.textContent = initial(name);
  activeAvatar.style.background = gradFor(name);
  activeName.textContent = name;
  activeStatus.textContent = status;
  activeCall.classList.remove('hidden');
}
function updateActiveStatus(text) { activeStatus.textContent = text; }

function startCallTimer() {
  clearInterval(currentCall.timer);
  currentCall.seconds = 0;
  currentCall.timer = setInterval(() => {
    currentCall.seconds++;
    activeStatus.textContent = fmtDur(currentCall.seconds);
  }, 1000);
}

muteBtn.addEventListener('click', () => {
  if (!currentCall.localStream) return;
  const track = currentCall.localStream.getAudioTracks()[0];
  if (!track) return;
  track.enabled = !track.enabled;
  currentCall.muted = !track.enabled;
  muteBtn.classList.toggle('muted', currentCall.muted);
});

// ============================================================
//  سایدبار موبایل
// ============================================================
$('openSide').addEventListener('click', () => $('sidebar').classList.add('open'));
$('closeSide').addEventListener('click', () => $('sidebar').classList.remove('open'));

// ============================================================
//  تغییر نام
// ============================================================
$('changeName')?.addEventListener('click', () => {
  newNameInput.value = me.name;
  renameModal.classList.remove('hidden');
  setTimeout(() => newNameInput.focus(), 100);
});
$('cancelRename')?.addEventListener('click', () => renameModal.classList.add('hidden'));
$('confirmRename')?.addEventListener('click', () => {
  const n = newNameInput.value.trim();
  if (!n) return;
  me.name = n;
  myName.textContent = n;
  myNameTop.textContent = n;
  myAvatar.textContent = initial(n);
  myAvatar.style.background = gradFor(n);
  // با یک رویداد جدا نام را به سرور می‌فرستیم (بدون خروج)
  socket.emit('join', { name: n, room: me.room });
  renameModal.classList.add('hidden');
  showToast('نام تغییر کرد');
});
newNameInput?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') $('confirmRename').click();
});

// ============================================================
//  راه‌اندازی
// ============================================================
loadSettings();

// قبل از خروج
window.addEventListener('beforeunload', () => {
  if (currentCall.peer) socket.emit('end_call', { to: currentCall.peer });
});

// پر کردن roomsData از DOM
document.querySelectorAll('#roomPicker .room-tile').forEach(t => {
  roomsData[t.dataset.room] = {
    icon: t.querySelector('.room-emoji').textContent,
    name: t.querySelector('.room-name').textContent,
  };
});
