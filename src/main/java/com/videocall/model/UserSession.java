package com.videocall.model;



import java.time.LocalDateTime;

public class UserSession {
 private String userId;
 private String username;
 private LocalDateTime connectedAt;
 private boolean inCall;

 public UserSession() {}

 public UserSession(String userId, String username) {
     this.userId = userId;
     this.username = username;
     this.connectedAt = LocalDateTime.now();
     this.inCall = false;
 }

 // Getters and Setters
 public String getUserId() { return userId; }
 public void setUserId(String userId) { this.userId = userId; }

 public String getUsername() { return username; }
 public void setUsername(String username) { this.username = username; }

 public LocalDateTime getConnectedAt() { return connectedAt; }
 public void setConnectedAt(LocalDateTime connectedAt) { this.connectedAt = connectedAt; }

 public boolean isInCall() { return inCall; }
 public void setInCall(boolean inCall) { this.inCall = inCall; }
}