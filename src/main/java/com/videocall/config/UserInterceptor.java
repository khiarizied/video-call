package com.videocall.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.SimpMessagingTemplate;
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
    
    @Autowired
    @Lazy
    private SimpMessagingTemplate messagingTemplate;

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        
        if (StompCommand.CONNECT.equals(accessor.getCommand())) {
            // Check if userId was provided in headers, otherwise generate one
            String userId = accessor.getFirstNativeHeader("userId");
            if (userId == null || userId.trim().isEmpty()) {
                userId = "user_" + System.currentTimeMillis() + "_" + (int)(Math.random() * 1000);
            }
            
            // Check if username was provided in headers
            String username = accessor.getFirstNativeHeader("username");
            if (username == null || username.trim().isEmpty()) {
                username = "User" + userId.substring(userId.length() - 4);
            } else {
                username = username.trim();
            }
            
            // Store user session
            userSessionService.addUser(userId, username);
            
            // Add user to session attributes
            accessor.getSessionAttributes().put("userId", userId);
            accessor.getSessionAttributes().put("username", username);
            
            System.out.println("User connected: " + userId + " - " + username);
            
            // Broadcast updated user list after a short delay
            new Thread(() -> {
                try {
                    Thread.sleep(500); // Small delay to ensure connection is established
                    var users = userSessionService.getAllUsers();
                    messagingTemplate.convertAndSend("/topic/users", users);
                    System.out.println("Broadcasted user list after connection: " + users.size() + " users");
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            }).start();
        }
        else if (StompCommand.DISCONNECT.equals(accessor.getCommand())) {
            String userId = (String) accessor.getSessionAttributes().get("userId");
            if (userId != null) {
                userSessionService.removeUser(userId);
                System.out.println("User disconnected: " + userId);
                
                // Broadcast updated user list after disconnect
                new Thread(() -> {
                    try {
                        Thread.sleep(100);
                        var users = userSessionService.getAllUsers();
                        messagingTemplate.convertAndSend("/topic/users", users);
                        System.out.println("Broadcasted user list after disconnect: " + users.size() + " users");
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                    }
                }).start();
            }
        }
        
        return message;
    }
}