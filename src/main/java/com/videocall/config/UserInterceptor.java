package com.videocall.config;

//src/main/java/com/example/videocall/config/UserInterceptor.java


//src/main/java/com/example/videocall/config/UserInterceptor.java



import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.stereotype.Component;

import com.videocall.service.UserSessionService;

@Component
public class UserInterceptor implements ChannelInterceptor {

 @Autowired
 @Lazy
 private UserSessionService userSessionService;

 @Override
 public Message<?> preSend(Message<?> message, MessageChannel channel) {
     StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
     
     if (StompCommand.CONNECT.equals(accessor.getCommand())) {
         // Generate user ID and username
         String userId = "user_" + System.currentTimeMillis() + "_" + (int)(Math.random() * 1000);
         String username = "User" + userId.substring(userId.length() - 4);
         
         // Store user session
         userSessionService.addUser(userId, username);
         
         // Add user to session attributes
         accessor.getSessionAttributes().put("userId", userId);
         accessor.getSessionAttributes().put("username", username);
         
         System.out.println("User connected: " + userId + " - " + username);
     }
     else if (StompCommand.DISCONNECT.equals(accessor.getCommand())) {
         String userId = (String) accessor.getSessionAttributes().get("userId");
         if (userId != null) {
             userSessionService.removeUser(userId);
             System.out.println("User disconnected: " + userId);
         }
     }
     
     return message;
 }
}