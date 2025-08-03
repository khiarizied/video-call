// src/main/resources/static/js/signaling.js
class SignalingManager {
    constructor() {
        this.stompClient = null;
        this.userId = null;
        this.username = 'Guest';
        this.currentCall = null;
        this.initializeUI();
        this.connect();
    }

    connect() {
        const socket = new SockJS('/websocket');
        this.stompClient = Stomp.over(socket);
        
        // Set connection headers
        const headers = {
            'userId': this.userId || 'user_' + Date.now(),
            'username': this.username
        };
        
        this.stompClient.connect(headers, (frame) => {
            console.log('Connected: ' + frame);
            
            // Subscribe to private messages
            this.stompClient.subscribe('/app/queue/private', (message) => {
                this.handleSignalingMessage(JSON.parse(message.body));
            });
            
            // Subscribe to user list updates
            this.stompClient.subscribe('/app/topic/users', (message) => {
                try {
                    const users = JSON.parse(message.body);
                    console.log('Received users list:', users);
                    this.updateUsersList(users);
                } catch (error) {
                    console.error('Error parsing users list:', error);
                }
            });
            
            // Request initial user list
            setTimeout(() => this.requestUsersList(), 1000);
            
            document.getElementById('status').textContent = 'Connected';
        }, (error) => {
            console.error('WebSocket connection error:', error);
            document.getElementById('status').textContent = 'Connection error. Please refresh.';
        });
    }

    sendMessage(message) {
        if (this.stompClient && this.stompClient.connected) {
            message.from = this.userId;
            message.fromUsername = this.username;
            this.stompClient.send("/app/signal", {}, JSON.stringify(message));
        }
    }

    sendPrivateMessage(message, toUserId) {
        if (this.stompClient && this.stompClient.connected) {
            message.from = this.userId;
            message.fromUsername = this.username;
            message.to = toUserId;
            this.stompClient.send("/app/private", {}, JSON.stringify(message));
        }
    }

    requestUsersList() {
        if (this.stompClient && this.stompClient.connected) {
            console.log('Requesting users list...');
            this.stompClient.send("/app/users/refresh", {}, JSON.stringify({}));
        } else {
            console.log('Cannot request users list - not connected');
        }
    }

    async handleSignalingMessage(message) {
        console.log('Received message:', message);
        
        switch (message.type) {
            case 'offer':
                await this.handleOffer(message);
                break;
            case 'answer':
                await this.handleAnswer(message);
                break;
            case 'ice-candidate':
                await this.handleIceCandidate(message);
                break;
            case 'call-request':
                this.handleCallRequest(message);
                break;
            case 'call-accepted':
                this.handleCallAccepted(message);
                break;
            case 'call-rejected':
                this.handleCallRejected(message);
                break;
            case 'call-ended':
                this.handleCallEnded(message);
                break;
            case 'chat-message':
                this.displayMessage(`${message.fromUsername || message.from}: ${message.data}`, 'received');
                break;
        }
    }

    async handleOffer(message) {
        const callerName = message.fromUsername || message.from;
        if (confirm(`Incoming call from ${callerName}. Accept?`)) {
            this.sendPrivateMessage({
                type: 'call-accepted'
            }, message.from);
            
            const offer = JSON.parse(message.data);
            const answer = await webRTC.handleOffer(offer);
            
            if (answer) {
                this.sendPrivateMessage({
                    type: 'answer',
                    data: JSON.stringify(answer)
                }, message.from);
                
                this.currentCall = message.from;
                document.getElementById('status').textContent = `In call with ${callerName}`;
                this.updateCallButtons(true);
            }
        } else {
            this.sendPrivateMessage({
                type: 'call-rejected'
            }, message.from);
        }
    }

    async handleAnswer(message) {
        const answer = JSON.parse(message.data);
        await webRTC.handleAnswer(answer);
        this.currentCall = message.from;
        const calleeName = message.fromUsername || message.from;
        document.getElementById('status').textContent = `In call with ${calleeName}`;
        this.updateCallButtons(true);
    }

    async handleIceCandidate(message) {
        const candidate = JSON.parse(message.data);
        await webRTC.handleIceCandidate(candidate);
    }

    handleCallAccepted(message) {
        const calleeName = message.fromUsername || message.from;
        document.getElementById('status').textContent = `Call accepted by ${calleeName}`;
        this.updateCallButtons(true);
    }

    handleCallRejected(message) {
        const calleeName = message.fromUsername || message.from;
        alert(`Call rejected by ${calleeName}`);
        document.getElementById('status').textContent = 'Call rejected';
        this.updateCallButtons(false);
        this.currentCall = null;
    }

    handleCallEnded(message) {
        webRTC.closeConnection();
        this.currentCall = null;
        const userName = message.fromUsername || message.from || 'Remote user';
        document.getElementById('status').textContent = `Call ended by ${userName}`;
        this.updateCallButtons(false);
    }

    initializeUI() {
        document.getElementById('setUsernameBtn').addEventListener('click', () => this.setUsername());
        document.getElementById('startCallBtn').addEventListener('click', () => this.startCall());
        document.getElementById('endCallBtn').addEventListener('click', () => this.endCall());
        document.getElementById('refreshUsersBtn').addEventListener('click', () => this.requestUsersList());
        document.getElementById('sendBtn').addEventListener('click', () => this.sendMessageToUser());
        document.getElementById('messageInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessageToUser();
        });
        
        // Auto-refresh users list every 10 seconds
        setInterval(() => {
            if (this.stompClient && this.stompClient.connected) {
                this.requestUsersList();
            }
        }, 10000);
    }

    setUsername() {
        const usernameInput = document.getElementById('username');
        const newUsername = usernameInput.value.trim();
        
        if (!newUsername) {
            alert('Please enter a username');
            return;
        }
        
        this.username = newUsername;
        localStorage.setItem('videoCallUsername', newUsername);
        
        if (!this.userId) {
            this.userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        }
        
        document.getElementById('currentUserId').textContent = `${this.username} (${this.userId})`;
        document.getElementById('status').textContent = `Username set to: ${this.username}`;
        
        // Reconnect with new username
        if (this.stompClient) {
            this.stompClient.disconnect();
        }
        setTimeout(() => this.connect(), 1000);
    }

    async startCall() {
        if (!this.userId) {
            this.userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        }
        
        const success = await webRTC.startLocalStream();
        if (success) {
            document.getElementById('startCallBtn').disabled = true;
            document.getElementById('endCallBtn').disabled = false;
            document.getElementById('status').textContent = 'Camera started. Select a user to call.';
            this.requestUsersList(); // Refresh user list
        }
    }

    endCall() {
        webRTC.stopLocalStream();
        webRTC.closeConnection();
        
        if (this.currentCall) {
            this.sendPrivateMessage({
                type: 'call-ended'
            }, this.currentCall);
            this.currentCall = null;
        }
        
        document.getElementById('startCallBtn').disabled = false;
        document.getElementById('endCallBtn').disabled = true;
        document.getElementById('status').textContent = 'Call ended';
        this.updateCallButtons(false);
        this.requestUsersList(); // Refresh user list
    }

    callUser(userId, username) {
        if (!this.userId) {
            alert('Please set your username first');
            return;
        }
        
        if (this.currentCall) {
            alert('You are already in a call');
            return;
        }

        webRTC.createPeerConnection();
        webRTC.createOffer().then(offer => {
            if (offer) {
                this.sendPrivateMessage({
                    type: 'offer',
                    data: JSON.stringify(offer)
                }, userId);
                
                this.currentCall = userId;
                document.getElementById('status').textContent = `Calling ${username}...`;
            }
        });
    }

    sendMessageToUser() {
        const messageInput = document.getElementById('messageInput');
        const message = messageInput.value.trim();
        const remoteUserId = this.currentCall;
        
        if (!message || !remoteUserId) {
            alert('Select a user to chat with first');
            return;
        }
        
        this.sendPrivateMessage({
            type: 'chat-message',
            data: message
        }, remoteUserId);
        
        this.displayMessage(`You: ${message}`, 'sent');
        messageInput.value = '';
    }

    displayMessage(message, type) {
        const messagesDiv = document.getElementById('messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.textContent = message;
        messagesDiv.appendChild(messageDiv);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    updateCallButtons(inCall) {
        document.getElementById('startCallBtn').disabled = inCall;
        document.getElementById('endCallBtn').disabled = !inCall;
    }

    updateUsersList(users) {
        const usersListDiv = document.getElementById('usersList');
        usersListDiv.innerHTML = '';
        
        // Filter out current user
        const filteredUsers = users.filter(user => user.userId !== this.userId);
        
        console.log('Displaying users:', filteredUsers);
        
        if (filteredUsers.length === 0) {
            usersListDiv.innerHTML = '<p class="no-users">No other users online</p>';
            return;
        }
        
        filteredUsers.forEach(user => {
            const userDiv = document.createElement('div');
            userDiv.className = 'user-item';
            
            const statusClass = user.inCall ? 'in-call' : 'online';
            const statusText = user.inCall ? 'In Call' : 'Online';
            
            userDiv.innerHTML = `
                <div class="user-info-text">
                    <div><strong>${user.username || user.userId}</strong></div>
                    <div class="user-status ${statusClass}">${statusText}</div>
                </div>
                <div class="user-actions">
                    <button onclick="window.signaling.callUser('${user.userId}', '${user.username || user.userId}')" 
                            ${this.currentCall || !webRTC || !webRTC.localStream ? 'disabled' : ''}>
                        Call
                    </button>
                </div>
            `;
            
            usersListDiv.appendChild(userDiv);
        });
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    window.signaling = new SignalingManager();
});