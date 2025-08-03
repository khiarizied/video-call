package com.videocall.service;

//src/main/java/com/example/videocall/service/UserSessionService.java



//src/main/java/com/example/videocall/service/UserSessionService.java

import org.springframework.stereotype.Service;

import com.videocall.model.UserSession;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.List;
import java.util.ArrayList;
import java.util.stream.Collectors;

@Service
public class UserSessionService {
 
 private final Map<String, UserSession> userSessions = new ConcurrentHashMap<>();
 
 public void addUser(String userId, String username) {
     userSessions.put(userId, new UserSession(userId, username));
     System.out.println("User added: " + userId + " - " + username);
 }
 
 public void removeUser(String userId) {
     UserSession removed = userSessions.remove(userId);
     if (removed != null) {
         System.out.println("User removed: " + userId);
     }
 }
 
 public UserSession getUser(String userId) {
     return userSessions.get(userId);
 }
 
 public List<UserSession> getAllUsers() {
     return new ArrayList<>(userSessions.values());
 }
 
 public List<UserSession> getAvailableUsers() {
     return userSessions.values().stream()
             .collect(Collectors.toList());
 }
 
 public boolean isUserOnline(String userId) {
     return userSessions.containsKey(userId);
 }
 
 public void setUserInCall(String userId, boolean inCall) {
     UserSession user = userSessions.get(userId);
     if (user != null) {
         user.setInCall(inCall);
     }
 }
 
 public int getUserCount() {
     return userSessions.size();
 }
}