// src/main/resources/static/js/signaling.js
class SignalingManager {
    constructor() {
        this.stompClient = null;
        this.userId = null;
        this.username = 'Guest';
        this.currentCall = null;
        this.incomingCall = null;
        this.initializeUI();
        this.connect();
    }

    connect() {
        const socket = new SockJS('/websocket');
        this.stompClient = Stomp.over(socket);
        
        // Generate userId if not exists
        if (!this.userId) {
            this.userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        }
        
        // Set connection headers
        const headers = {
            'username': this.username,
            'userId': this.userId
        };
        
        console.log('Connecting with userId:', this.userId, 'username:', this.username);
        
        this.stompClient.connect(headers, (frame) => {
            console.log('Connected: ' + frame);
            console.log('Current userId after connection:', this.userId);
            
            // Update UI immediately
            document.getElementById('currentUserId').textContent = `${this.username} (${this.userId})`;
            
            // Subscribe to private messages
            this.stompClient.subscribe('/user/queue/private', (message) => {
                console.log('Received private message:', message.body);
                this.handleSignalingMessage(JSON.parse(message.body));
            });
            
            // Subscribe to user list updates
            this.stompClient.subscribe('/topic/users', (message) => {
                try {
                    const users = JSON.parse(message.body);
                    console.log('Received users list:', users);
                    this.updateUsersList(users);
                } catch (error) {
                    console.error('Error parsing users list:', error);
                    console.log('Raw message:', message.body);
                }
            });
            
            // Subscribe to user info updates
            this.stompClient.subscribe('/user/queue/userinfo', (message) => {
                try {
                    const userInfo = JSON.parse(message.body);
                    console.log('Received user info:', userInfo);
                    this.userId = userInfo.userId;
                    this.username = userInfo.username;
                    document.getElementById('currentUserId').textContent = `${this.username} (${this.userId})`;
                } catch (error) {
                    console.error('Error parsing user info:', error);
                }
            });
            
            // Request initial user list and user info after a short delay
            setTimeout(() => {
                this.requestUsersList();
                this.stompClient.send("/app/user/info", {}, JSON.stringify({}));
            }, 1000);
            
            document.getElementById('status').textContent = 'Connected - Loading user information...';
        }, (error) => {
            console.error('WebSocket connection error:', error);
            document.getElementById('status').textContent = 'Connection error. Please refresh.';
        });
    }
    
    createIncomingCallUI() {
        // Create incoming call modal
        const modal = document.createElement('div');
        modal.id = 'incomingCallModal';
        modal.style.cssText = `
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.8);
            z-index: 1000;
            justify-content: center;
            align-items: center;
        `;
        
        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background: white;
            padding: 30px;
            border-radius: 10px;
            text-align: center;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            max-width: 400px;
            width: 90%;
        `;
        
        modalContent.innerHTML = `
            <h2 style="margin-top: 0; color: #333;">📞 Incoming Call</h2>
            <p id="callerName" style="font-size: 18px; margin: 20px 0; color: #666; font-weight: bold;"></p>
            <div style="display: flex; gap: 15px; justify-content: center; margin-top: 30px;">
                <button id="acceptCallBtn" style="
                    background: #28a745;
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 5px;
                    cursor: pointer;
                    font-size: 16px;
                    min-width: 100px;
                    transition: background-color 0.3s;
                " onmouseover="this.style.backgroundColor='#218838'" 
                   onmouseout="this.style.backgroundColor='#28a745'">✅ Accept</button>
                <button id="rejectCallBtn" style="
                    background: #dc3545;
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 5px;
                    cursor: pointer;
                    font-size: 16px;
                    min-width: 100px;
                    transition: background-color 0.3s;
                " onmouseover="this.style.backgroundColor='#c82333'" 
                   onmouseout="this.style.backgroundColor='#dc3545'">❌ Reject</button>
            </div>
            <p style="font-size: 12px; color: #999; margin-top: 15px;">Call will auto-reject in 30 seconds</p>
        `;
        
        modal.appendChild(modalContent);
        document.body.appendChild(modal);
        
        // Add event listeners
        document.getElementById('acceptCallBtn').addEventListener('click', () => this.acceptIncomingCall());
        document.getElementById('rejectCallBtn').addEventListener('click', () => this.rejectIncomingCall());
    }
    
    showIncomingCallUI(callerName) {
        const modal = document.getElementById('incomingCallModal');
        const callerNameElement = document.getElementById('callerName');
        
        callerNameElement.textContent = `${callerName} is calling...`;
        modal.style.display = 'flex';
        
        // Auto-reject after 30 seconds
        setTimeout(() => {
            if (modal.style.display === 'flex') {
                this.rejectIncomingCall();
            }
        }, 30000);
    }
    
    hideIncomingCallUI() {
        const modal = document.getElementById('incomingCallModal');
        modal.style.display = 'none';
    }
    
    async acceptIncomingCall() {
        if (!this.incomingCall) {
            console.error('No incoming call to accept');
            return;
        }
        
        this.hideIncomingCallUI();
        
        try {
            // Start local stream first if not already started
            if (!webRTC.localStream) {
                const streamStarted = await webRTC.startLocalStream();
                if (!streamStarted) {
                    console.error('Failed to start local stream for incoming call');
                    this.sendPrivateMessage({
                        type: 'call-rejected'
                    }, this.incomingCall.from);
                    this.incomingCall = null;
                    return;
                }
            }
            
            // Send call accepted message
            this.sendPrivateMessage({
                type: 'call-accepted'
            }, this.incomingCall.from);
            
            // Process the offer
            console.log('Processing offer:', this.incomingCall.offer);
            const answer = await webRTC.handleOffer(this.incomingCall.offer);
            console.log('Created answer:', answer);
            
            if (answer) {
                // Send the answer
                this.sendPrivateMessage({
                    type: 'answer',
                    data: JSON.stringify(answer)
                }, this.incomingCall.from);
                
                // Update call state
                this.currentCall = this.incomingCall.from;
                document.getElementById('status').textContent = `In call with ${this.incomingCall.fromUsername}`;
                this.updateCallButtons(true);
                
                console.log('Call accepted successfully');
            } else {
                console.error('Failed to create answer');
                this.sendPrivateMessage({
                    type: 'call-rejected'
                }, this.incomingCall.from);
            }
        } catch (error) {
            console.error('Error accepting call:', error);
            this.sendPrivateMessage({
                type: 'call-rejected'
            }, this.incomingCall.from);
        }
        
        this.incomingCall = null;
    }
    
    rejectIncomingCall() {
        if (!this.incomingCall) {
            console.error('No incoming call to reject');
            return;
        }
        
        this.hideIncomingCallUI();
        
        // Send rejection message
        this.sendPrivateMessage({
            type: 'call-rejected'
        }, this.incomingCall.from);
        
        console.log('Call rejected');
        this.incomingCall = null;
    }

    sendMessage(message) {
        if (this.stompClient && this.stompClient.connected) {
            message.from = this.userId;
            message.fromUsername = this.username;
            this.stompClient.send("/app/signal", {}, JSON.stringify(message));
        }
    }

    sendPrivateMessage(message, toUserId) {
        console.log('=== SEND PRIVATE MESSAGE DEBUG ===');
        console.log('Sending private message:', message);
        console.log('To user:', toUserId);
        console.log('From user:', this.userId);
        console.log('WebSocket connected:', this.stompClient ? this.stompClient.connected : false);
        
        if (this.stompClient && this.stompClient.connected) {
            message.from = this.userId;
            message.fromUsername = this.username;
            message.to = toUserId;
            
            const messageToSend = JSON.stringify(message);
            console.log('Final message being sent:', messageToSend);
            
            try {
                this.stompClient.send("/app/private", {}, messageToSend);
                console.log('Message sent successfully via WebSocket');
            } catch (error) {
                console.error('Error sending WebSocket message:', error);
            }
        } else {
            console.error('Cannot send private message - WebSocket not connected');
            console.log('StompClient exists:', !!this.stompClient);
            console.log('StompClient connected:', this.stompClient ? this.stompClient.connected : 'N/A');
        }
        console.log('=================================');
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
        console.log('Handling incoming offer from:', message.from);
        const callerName = message.fromUsername || message.from;
        
        // Store the incoming call information
        this.incomingCall = {
            from: message.from,
            fromUsername: callerName,
            offer: JSON.parse(message.data)
        };
        
        // Show incoming call UI
        this.showIncomingCallUI(callerName);
    }

    async handleAnswer(message) {
        console.log('Handling answer from:', message.from);
        try {
            const answer = JSON.parse(message.data);
            console.log('Processing answer:', answer);
            
            await webRTC.handleAnswer(answer);
            this.currentCall = message.from;
            const calleeName = message.fromUsername || message.from;
            document.getElementById('status').textContent = `Connected to ${calleeName}`;
            this.updateCallButtons(true);
        } catch (error) {
            console.error('Error handling answer:', error);
            document.getElementById('status').textContent = 'Call connection failed';
        }
    }

    async handleIceCandidate(message) {
        console.log('Handling ICE candidate from:', message.from);
        try {
            const candidate = JSON.parse(message.data);
            console.log('Processing ICE candidate:', candidate);
            await webRTC.handleIceCandidate(candidate);
        } catch (error) {
            console.error('Error handling ICE candidate:', error);
        }
    }

    handleCallAccepted(message) {
        const calleeName = message.fromUsername || message.from;
        document.getElementById('status').textContent = `Call accepted by ${calleeName}`;
        this.updateCallButtons(true);
    }

    handleCallRejected(message) {
        const calleeName = message.fromUsername || message.from;
        console.log('Call rejected by:', calleeName);
        alert(`Call rejected by ${calleeName}`);
        document.getElementById('status').textContent = 'Call rejected';
        this.updateCallButtons(false);
        this.currentCall = null;
        this.incomingCall = null;
        
        // Clean up WebRTC connection
        webRTC.closeConnection();
    }

    handleCallEnded(message) {
        console.log('Call ended by remote user:', message.from);
        
        // Hide incoming call UI if it's showing
        this.hideIncomingCallUI();
        
        webRTC.closeConnection();
        this.currentCall = null;
        this.incomingCall = null;
        const userName = message.fromUsername || message.from || 'Remote user';
        document.getElementById('status').textContent = `Call ended by ${userName}`;
        this.updateCallButtons(false);
    }

    initializeUI() {
        // Load saved username
        const savedUsername = localStorage.getItem('videoCallUsername');
        if (savedUsername) {
            document.getElementById('username').value = savedUsername;
            this.username = savedUsername;
        }
        
        // Generate initial userId
        if (!this.userId) {
            this.userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        }
        
        document.getElementById('setUsernameBtn').addEventListener('click', () => this.setUsername());
        document.getElementById('startCallBtn').addEventListener('click', () => this.startCall());
        document.getElementById('endCallBtn').addEventListener('click', () => this.endCall());
        document.getElementById('refreshUsersBtn').addEventListener('click', () => this.requestUsersList());
        document.getElementById('sendBtn').addEventListener('click', () => this.sendMessageToUser());
        document.getElementById('messageInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessageToUser();
        });
        
        // Create incoming call UI
        this.createIncomingCallUI();
        
        // Add debug button (temporary)
        const debugBtn = document.createElement('button');
        debugBtn.textContent = 'Debug Info';
        debugBtn.onclick = () => {
            console.log('=== DEBUG INFO ===');
            console.log('UserId:', this.userId);
            console.log('Username:', this.username);
            console.log('Connected:', this.stompClient ? this.stompClient.connected : false);
            console.log('Current call:', this.currentCall);
            console.log('Incoming call:', this.incomingCall);
            console.log('Local stream:', webRTC ? !!webRTC.localStream : false);
            console.log('WebRTC object:', webRTC);
            if (webRTC && webRTC.localStream) {
                console.log('Local stream tracks:', webRTC.localStream.getTracks());
            }
            console.log('==================');
            alert(`UserId: ${this.userId}\nUsername: ${this.username}\nConnected: ${this.stompClient ? this.stompClient.connected : false}\nLocal Stream: ${webRTC ? !!webRTC.localStream : false}`);
        };
        document.querySelector('.controls').appendChild(debugBtn);
        
        // Add test call button
        const testBtn = document.createElement('button');
        testBtn.textContent = 'Test Call Function';
        testBtn.onclick = () => {
            console.log('Testing call function...');
            this.callUser('test-user-123', 'Test User');
        };
        document.querySelector('.controls').appendChild(testBtn);
        
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
        
        // Generate new userId if not exists
        if (!this.userId) {
            this.userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        }
        
        document.getElementById('currentUserId').textContent = `${this.username} (${this.userId})`;
        document.getElementById('status').textContent = `Setting username to: ${this.username}`;
        
        // Reconnect with new username
        if (this.stompClient && this.stompClient.connected) {
            this.stompClient.disconnect();
        }
        setTimeout(() => this.connect(), 1000);
    }

    async startCall() {        
        const success = await webRTC.startLocalStream();
        if (success) {
            document.getElementById('startCallBtn').disabled = true;
            document.getElementById('endCallBtn').disabled = false;
            document.getElementById('status').textContent = 'Camera started. Select a user to call.';
            this.requestUsersList(); // Refresh user list
        }
    }

    endCall() {
        // Hide incoming call UI if it's showing
        this.hideIncomingCallUI();
        
        webRTC.stopLocalStream();
        webRTC.closeConnection();
        
        if (this.currentCall) {
            this.sendPrivateMessage({
                type: 'call-ended'
            }, this.currentCall);
            this.currentCall = null;
        }
        
        if (this.incomingCall) {
            this.sendPrivateMessage({
                type: 'call-rejected'
            }, this.incomingCall.from);
            this.incomingCall = null;
        }
        
        document.getElementById('startCallBtn').disabled = false;
        document.getElementById('endCallBtn').disabled = true;
        document.getElementById('status').textContent = 'Call ended';
        this.updateCallButtons(false);
        this.requestUsersList(); // Refresh user list
    }

    callUser(userId, username) {
        console.log('=== CALL USER DEBUG ===');
        console.log('Attempting to call user:', userId, 'username:', username);
        console.log('Current userId:', this.userId);
        console.log('WebSocket connected:', this.stompClient ? this.stompClient.connected : false);
        console.log('Current call:', this.currentCall);
        console.log('Local stream available:', webRTC ? !!webRTC.localStream : false);
        console.log('=====================');
        
        if (!this.userId) {
            console.error('UserId not set!');
            alert('Connection not established yet. Please wait a moment and try again.');
            return;
        }
        
        if (!this.stompClient || !this.stompClient.connected) {
            console.error('WebSocket not connected!');
            alert('WebSocket connection not established. Please refresh the page.');
            return;
        }
        
        if (this.currentCall) {
            console.log('Already in call with:', this.currentCall);
            alert('You are already in a call');
            return;
        }

        if (!webRTC || !webRTC.localStream) {
            console.error('Local stream not available');
            alert('Please start your camera first by clicking "Start Camera"');
            return;
        }

        console.log('All checks passed, initiating call...');
        console.log('Initiating call from', this.userId, 'to', userId);
        
        // Set current call immediately to prevent multiple calls
        this.currentCall = userId;
        document.getElementById('status').textContent = `Calling ${username}...`;
        this.updateCallButtons(true);
        
        try {
            console.log('Creating peer connection...');
            webRTC.createPeerConnection();
            
            console.log('Creating offer...');
            webRTC.createOffer().then(offer => {
                if (offer) {
                    console.log('Offer created successfully, sending to', userId);
                    console.log('Offer details:', offer);
                    
                    this.sendPrivateMessage({
                        type: 'offer',
                        data: JSON.stringify(offer)
                    }, userId);
                    
                    console.log('Offer sent successfully');
                    document.getElementById('status').textContent = `Calling ${username}... (offer sent)`;
                } else {
                    console.error('Failed to create offer - offer is null');
                    this.currentCall = null;
                    this.updateCallButtons(false);
                    document.getElementById('status').textContent = 'Failed to create call offer';
                    alert('Failed to create call offer. Please try again.');
                }
            }).catch(error => {
                console.error('Error in createOffer promise:', error);
                this.currentCall = null;
                this.updateCallButtons(false);
                document.getElementById('status').textContent = 'Failed to create call offer';
                alert('Failed to create call offer: ' + error.message);
            });
        } catch (error) {
            console.error('Error in callUser:', error);
            this.currentCall = null;
            this.updateCallButtons(false);
            document.getElementById('status').textContent = 'Failed to initiate call';
            alert('Failed to initiate call: ' + error.message);
        }
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
        
        // Update user list call buttons
        const callButtons = document.querySelectorAll('.user-actions button');
        callButtons.forEach(button => {
            button.disabled = inCall || !webRTC.localStream;
        });
    }

    updateUsersList(users) {
        const usersListDiv = document.getElementById('usersList');
        console.log('Updating users list with:', users);
        console.log('Current userId:', this.userId);
        
        usersListDiv.innerHTML = '';
        
        if (!users || users.length === 0) {
            usersListDiv.innerHTML = '<p class="no-users">No users online</p>';
            document.getElementById('status').textContent = 'Connected - No other users online';
            return;
        }
        
        // Filter out current user
        const filteredUsers = users.filter(user => user.userId !== this.userId);
        
        console.log('Filtered users (excluding self):', filteredUsers);
        
        if (filteredUsers.length === 0) {
            usersListDiv.innerHTML = '<p class="no-users">No other users online</p>';
            document.getElementById('status').textContent = 'Connected - No other users online';
            
            // Update current user display
            if (users.length > 0) {
                const currentUser = users.find(user => user.userId === this.userId);
                if (currentUser) {
                    document.getElementById('currentUserId').textContent = `${currentUser.username} (${currentUser.userId})`;
                    this.userId = currentUser.userId;
                    this.username = currentUser.username;
                } else if (users.length === 1) {
                    // If there's only one user and it's not matching our userId, it might be us
                    const user = users[0];
                    document.getElementById('currentUserId').textContent = `${user.username} (${user.userId})`;
                    this.userId = user.userId;
                    this.username = user.username;
                }
            }
            return;
        }
        
        // Update current user display if not set
        if (!this.userId) {
            const possibleCurrentUser = users.find(user => !filteredUsers.includes(user));
            if (possibleCurrentUser) {
                this.userId = possibleCurrentUser.userId;
                this.username = possibleCurrentUser.username;
                document.getElementById('currentUserId').textContent = `${this.username} (${this.userId})`;
            }
        }
        
        document.getElementById('status').textContent = `Connected - ${filteredUsers.length} other user(s) online`;
        
        filteredUsers.forEach(user => {
            const userDiv = document.createElement('div');
            userDiv.className = 'user-item';
            
            const statusClass = user.inCall ? 'in-call' : 'online';
            const statusText = user.inCall ? 'In Call' : 'Online';
            const isCurrentlyInCall = this.currentCall !== null;
            const callButtonDisabled = isCurrentlyInCall || !webRTC || !webRTC.localStream;
            
            const userInfoDiv = document.createElement('div');
            userInfoDiv.className = 'user-info-text';
            userInfoDiv.innerHTML = `
                <div><strong>${user.username || user.userId}</strong></div>
                <div class="user-status ${statusClass}">${statusText}</div>
            `;
            
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'user-actions';
            
            const callButton = document.createElement('button');
            callButton.textContent = isCurrentlyInCall ? '📞 Busy' : '📞 Call';
            callButton.disabled = callButtonDisabled;
            if (callButtonDisabled) {
                callButton.style.opacity = '0.5';
                callButton.style.cursor = 'not-allowed';
            }
            
            // Add click event listener directly
            callButton.addEventListener('click', () => {
                console.log('Call button clicked for user:', user.userId, user.username);
                this.callUser(user.userId, user.username || user.userId);
            });
            
            actionsDiv.appendChild(callButton);
            userDiv.appendChild(userInfoDiv);
            userDiv.appendChild(actionsDiv);
            usersListDiv.appendChild(userDiv);
        });
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    window.signaling = new SignalingManager();
});