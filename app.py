import os
from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit, join_room, leave_room
from datetime import datetime

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret-key-change-me'
socketio = SocketIO(
    app,
    cors_allowed_origins='*',
    max_http_buffer_size=50 * 1024 * 1024,
    async_mode='threading',
)

# ============ اتاق‌های عمومی ============
ROOMS = {
    'general': {'name': 'عمومی', 'icon': '💬', 'desc': 'گفتگوی آزاد'},
    'tech':    {'name': 'فنی',   'icon': '💻', 'desc': 'برنامه‌نویسی و تکنولوژی'},
    'fun':     {'name': 'سرگرمی','icon': '🎮', 'desc': 'بازی و تفریح'},
    'random':  {'name': 'تصادفی','icon': '🎲', 'desc': 'هر موضوعی'},
}

users = {}                              # sid -> {id, name, room}
messages = {r: [] for r in ROOMS}       # room -> list of messages
MAX_HISTORY = 200


def now_time():
    return datetime.now().strftime('%H:%M')


def room_users(room):
    return [u for u in users.values() if u['room'] == room]


def broadcast_users(room):
    emit('users_list', room_users(room), to=room)


@app.route('/')
def index():
    return render_template('index.html', rooms=ROOMS)


# ================= اتصال =================
@socketio.on('join')
def on_join(data):
    sid = request.sid
    name = (data.get('name') or 'کاربر').strip()[:24]
    room = data.get('room', 'general')
    if room not in ROOMS:
        room = 'general'

    users[sid] = {'id': sid, 'name': name, 'room': room}
    join_room(room)

    emit('history', messages[room], to=sid)
    emit('user_joined',
         {'id': sid, 'name': name, 'time': now_time()},
         to=room, include_self=False)
    broadcast_users(room)


@socketio.on('disconnect')
def on_disconnect():
    sid = request.sid
    if sid not in users:
        return
    room = users[sid]['room']
    name = users[sid]['name']
    del users[sid]
    emit('user_left', {'id': sid, 'name': name, 'time': now_time()}, to=room)
    broadcast_users(room)


# ================= تغییر اتاق =================
@socketio.on('switch_room')
def on_switch_room(data):
    sid = request.sid
    if sid not in users:
        return
    new_room = data.get('room')
    if new_room not in ROOMS:
        return
    old_room = users[sid]['room']
    if old_room == new_room:
        return

    leave_room(old_room)
    emit('user_left',
         {'id': sid, 'name': users[sid]['name'], 'time': now_time()},
         to=old_room)

    users[sid]['room'] = new_room
    join_room(new_room)

    emit('history', messages[new_room], to=sid)
    emit('user_joined',
         {'id': sid, 'name': users[sid]['name'], 'time': now_time()},
         to=new_room, include_self=False)

    broadcast_users(old_room)
    broadcast_users(new_room)


# ================= ذخیره پیام =================
def store(room, msg):
    messages[room].append(msg)
    if len(messages[room]) > MAX_HISTORY:
        messages[room].pop(0)


# ================= پیام‌ها =================
@socketio.on('message')
def on_message(data):
    sid = request.sid
    if sid not in users:
        return
    room = users[sid]['room']
    msg = {
        'type': 'text', 'id': sid,
        'name': users[sid]['name'],
        'text': (data.get('text') or '')[:2000],
        'time': now_time(),
    }
    store(room, msg)
    emit('message', msg, to=room)


@socketio.on('file')
def on_file(data):
    sid = request.sid
    if sid not in users:
        return
    room = users[sid]['room']
    msg = {
        'type': 'file', 'id': sid,
        'name': users[sid]['name'],
        'filename': data.get('filename', 'file'),
        'filetype': data.get('filetype', ''),
        'filesize': data.get('filesize', 0),
        'data': data.get('data', ''),
        'time': now_time(),
    }
    store(room, msg)
    emit('message', msg, to=room)


@socketio.on('voice')
def on_voice(data):
    sid = request.sid
    if sid not in users:
        return
    room = users[sid]['room']
    msg = {
        'type': 'voice', 'id': sid,
        'name': users[sid]['name'],
        'data': data.get('data', ''),
        'duration': data.get('duration', 0),
        'time': now_time(),
    }
    store(room, msg)
    emit('message', msg, to=room)


# ================= WebRTC =================
@socketio.on('call_user')
def call_user(data):
    target = data.get('to')
    if target in users and request.sid in users:
        emit('incoming_call', {
            'from': request.sid,
            'name': users[request.sid]['name'],
        }, to=target)


@socketio.on('accept_call')
def accept_call(data):
    if data.get('to') in users:
        emit('call_accepted', {'from': request.sid}, to=data['to'])


@socketio.on('reject_call')
def reject_call(data):
    if data.get('to') in users:
        emit('call_rejected', {'from': request.sid}, to=data['to'])


@socketio.on('end_call')
def end_call(data):
    if data.get('to') in users:
        emit('call_ended', {'from': request.sid}, to=data['to'])


@socketio.on('webrtc_offer')
def webrtc_offer(data):
    if data.get('to') in users:
        emit('webrtc_offer',
             {'from': request.sid, 'sdp': data.get('sdp')}, to=data['to'])


@socketio.on('webrtc_answer')
def webrtc_answer(data):
    if data.get('to') in users:
        emit('webrtc_answer',
             {'from': request.sid, 'sdp': data.get('sdp')}, to=data['to'])


@socketio.on('webrtc_ice')
def webrtc_ice(data):
    if data.get('to') in users:
        emit('webrtc_ice',
             {'from': request.sid, 'candidate': data.get('candidate')},
             to=data['to'])


if __name__ == '__main__':
    print('🚀 http://localhost:5000')
    socketio.run(app, host='0.0.0.0', port=5000,
                 allow_unsafe_werkzeug=True, debug=False)
