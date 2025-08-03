package com.videocall.model;



//src/main/java/com/example/videocall/model/SignalingMessage.java


import java.time.LocalDateTime;

public class SignalingMessage {
 private String type;
 private String data;
 private String from;
 private String to;
 private String fromUsername;
 private String toUsername;
 private LocalDateTime timestamp;

 // Constructors
 public SignalingMessage() {
     this.timestamp = LocalDateTime.now();
 }

 public SignalingMessage(String type, String data, String from, String to) {
     this.type = type;
     this.data = data;
     this.from = from;
     this.to = to;
     this.timestamp = LocalDateTime.now();
 }

 // Getters and Setters
 public String getType() { return type; }
 public void setType(String type) { this.type = type; }

 public String getData() { return data; }
 public void setData(String data) { this.data = data; }

 public String getFrom() { return from; }
 public void setFrom(String from) { this.from = from; }

 public String getTo() { return to; }
 public void setTo(String to) { this.to = to; }

 public String getFromUsername() { return fromUsername; }
 public void setFromUsername(String fromUsername) { this.fromUsername = fromUsername; }

 public String getToUsername() { return toUsername; }
 public void setToUsername(String toUsername) { this.toUsername = toUsername; }

 public LocalDateTime getTimestamp() { return timestamp; }
 public void setTimestamp(LocalDateTime timestamp) { this.timestamp = timestamp; }
}