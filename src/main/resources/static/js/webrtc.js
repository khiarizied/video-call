// src/main/resources/static/js/webrtc.js
class WebRTCManager {
    constructor() {
        this.localVideo = document.getElementById('localVideo');
        this.remoteVideo = document.getElementById('remoteVideo');
        this.localStream = null;
        this.remoteStream = null;
        this.peerConnection = null;
        this.configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' }
            ]
        };
    }

    async startLocalStream() {
        try {
            console.log('Starting local media stream...');
            this.localStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });
            this.localVideo.srcObject = this.localStream;
            console.log('Local stream started successfully');
            document.getElementById('status').textContent = 'Camera started - Ready to make calls';
            return true;
        } catch (error) {
            console.error('Error accessing media devices:', error);
            document.getElementById('status').textContent = 'Error accessing camera/microphone: ' + error.message;
            return false;
        }
    }

    stopLocalStream() {
        console.log('Stopping local stream...');
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                console.log('Stopping track:', track.kind);
                track.stop();
            });
            this.localStream = null;
        }
        if (this.localVideo) {
            this.localVideo.srcObject = null;
        }
    }

    createPeerConnection() {
        console.log('Creating peer connection...');
        
        // Close existing connection if any
        if (this.peerConnection) {
            this.closePeerConnection();
        }
        
        this.peerConnection = new RTCPeerConnection(this.configuration);
        console.log('Peer connection created');

        // Add local stream tracks to peer connection
        if (this.localStream) {
            console.log('Adding local stream tracks to peer connection');
            this.localStream.getTracks().forEach(track => {
                console.log('Adding track:', track.kind);
                this.peerConnection.addTrack(track, this.localStream);
            });
        } else {
            console.warn('No local stream available to add to peer connection');
        }

        // Handle remote stream
        this.peerConnection.ontrack = (event) => {
            console.log('Received remote track:', event.track.kind);
            if (event.streams && event.streams[0]) {
                this.remoteStream = event.streams[0];
                this.remoteVideo.srcObject = this.remoteStream;
                console.log('Remote video stream set');
                document.getElementById('status').textContent = 'Connected - Video call active';
            } else {
                console.warn('No remote stream in track event');
            }
        };

        // Handle ICE candidates
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('Sending ICE candidate:', event.candidate);
                if (window.signaling) {
                    window.signaling.sendPrivateMessage({
                        type: 'ice-candidate',
                        data: JSON.stringify(event.candidate)
                    }, window.signaling.currentCall);
                } else {
                    console.error('Signaling not available to send ICE candidate');
                }
            } else {
                console.log('ICE candidate gathering complete');
            }
        };

        // Handle connection state changes
        this.peerConnection.onconnectionstatechange = () => {
            console.log('Connection state changed:', this.peerConnection.connectionState);
            switch(this.peerConnection.connectionState) {
                case 'connected':
                    document.getElementById('status').textContent = 'Video call connected';
                    break;
                case 'disconnected':
                    document.getElementById('status').textContent = 'Call disconnected';
                    break;
                case 'failed':
                    document.getElementById('status').textContent = 'Call connection failed';
                    break;
                case 'closed':
                    document.getElementById('status').textContent = 'Call ended';
                    break;
            }
        };

        this.peerConnection.oniceconnectionstatechange = () => {
            console.log('ICE connection state changed:', this.peerConnection.iceConnectionState);
        };

        this.peerConnection.onicegatheringstatechange = () => {
            console.log('ICE gathering state changed:', this.peerConnection.iceGatheringState);
        };
    }

    async createOffer() {
        console.log('=== CREATE OFFER DEBUG ===');
        console.log('PeerConnection exists:', !!this.peerConnection);
        
        if (!this.peerConnection) {
            console.log('Creating peer connection for offer');
            this.createPeerConnection();
        }

        console.log('PeerConnection state:', this.peerConnection.connectionState);
        console.log('PeerConnection signaling state:', this.peerConnection.signalingState);
        console.log('Local stream available:', !!this.localStream);
        
        if (this.localStream) {
            console.log('Local stream tracks:', this.localStream.getTracks().map(t => t.kind));
        }

        try {
            console.log('Creating offer...');
            const offer = await this.peerConnection.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true
            });
            
            console.log('Offer created:', offer);
            console.log('Setting local description with offer');
            await this.peerConnection.setLocalDescription(offer);
            console.log('Local description set successfully');
            console.log('Final offer to return:', offer);
            console.log('========================');
            return offer;
        } catch (error) {
            console.error('Error creating offer:', error);
            console.log('Error details:', error.name, error.message);
            console.log('========================');
            return null;
        }
    }

    async handleOffer(offer) {
        console.log('Handling incoming offer:', offer);
        
        if (!this.peerConnection) {
            console.log('Creating peer connection for answer');
            this.createPeerConnection();
        }

        try {
            console.log('Setting remote description with offer');
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            
            console.log('Creating answer...');
            const answer = await this.peerConnection.createAnswer();
            
            console.log('Setting local description with answer');
            await this.peerConnection.setLocalDescription(answer);
            
            console.log('Answer created successfully:', answer);
            return answer;
        } catch (error) {
            console.error('Error handling offer:', error);
            return null;
        }
    }

    async handleAnswer(answer) {
        console.log('Handling incoming answer:', answer);
        
        if (!this.peerConnection) {
            console.error('No peer connection available to handle answer');
            return;
        }
        
        try {
            console.log('Setting remote description with answer');
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
            console.log('Answer handled successfully');
        } catch (error) {
            console.error('Error handling answer:', error);
        }
    }

    async handleIceCandidate(candidate) {
        console.log('Handling ICE candidate:', candidate);
        
        if (!this.peerConnection) {
            console.error('No peer connection available to handle ICE candidate');
            return;
        }
        
        try {
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            console.log('ICE candidate added successfully');
        } catch (error) {
            console.error('Error adding ICE candidate:', error);
        }
    }

    closePeerConnection() {
        console.log('Closing peer connection...');
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
    }

    closeConnection() {
        console.log('Closing WebRTC connection...');
        this.closePeerConnection();
        
        if (this.remoteVideo) {
            this.remoteVideo.srcObject = null;
        }
        this.remoteStream = null;
        document.getElementById('status').textContent = 'Call ended';
    }
}

// Create global instance
const webRTC = new WebRTCManager();

// Make sure it's available globally
window.webRTC = webRTC;

// Add some debugging
console.log('WebRTC Manager initialized:', webRTC);
console.log('WebRTC available globally:', !!window.webRTC);