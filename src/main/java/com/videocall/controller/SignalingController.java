package com.videocall.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.annotation.SendToUser;
import org.springframework.stereotype.Controller;

import com.videocall.model.SignalingMessage;
import com.videocall.service.UserSessionService;

import java.security.Principal;

@Controller
public class SignalingController {

    private final SimpMessagingTemplate messagingTemplate;
    private final UserSessionService userSessionService;

    @Autowired
    public SignalingController(SimpMessagingTemplate messagingTemplate, UserSessionService userSessionService) {
        this.messagingTemplate = messagingTemplate;
        this.userSessionService = userSessionService;
    }

    @MessageMapping("/signal")
    public void handleSignal(@Payload SignalingMessage message, Principal principal) {
        messagingTemplate.convertAndSend("/topic/signaling", message);
    }

    @MessageMapping("/private")
    public void handlePrivateSignal(@Payload SignalingMessage message, Principal principal) {
        System.out.println("Handling private signal: " + message.getType() + " from " + message.getFrom() + " to " + message.getTo());
        
        // Validate message
        if (message.getTo() == null || message.getTo().trim().isEmpty()) {
            System.err.println("Invalid message - no recipient specified");
            return;
        }
        
        // Add usernames to message
        if (message.getFrom() != null) {
            var fromUser = userSessionService.getUser(message.getFrom());
            if (fromUser != null) {
                message.setFromUsername(fromUser.getUsername());
                System.out.println("Set fromUsername: " + fromUser.getUsername());
            }
        }
        if (message.getTo() != null) {
            var toUser = userSessionService.getUser(message.getTo());
            if (toUser != null) {
                message.setToUsername(toUser.getUsername());
                System.out.println("Set toUsername: " + toUser.getUsername());
            } else {
                System.err.println("Target user not found: " + message.getTo());
            }
        }
        
        // Send to specific user using the correct destination
        try {
            messagingTemplate.convertAndSendToUser(message.getTo(), "/queue/private", message);
            System.out.println("Message sent successfully to user: " + message.getTo());
        } catch (Exception e) {
            System.err.println("Error sending message to user " + message.getTo() + ": " + e.getMessage());
        }
    }

    @MessageMapping("/users/refresh")
    public void refreshUsersList(Principal principal) {
        System.out.println("Refreshing users list. Total users: " + userSessionService.getUserCount());
        
        // Send updated user list to all connected users
        var users = userSessionService.getAllUsers();
        messagingTemplate.convertAndSend("/topic/users", users);
        
        System.out.println("Users list sent: " + users);
    }
    
    @MessageMapping("/user/info")
    public void getUserInfo(Principal principal) {
        if (principal != null) {
            String sessionUserId = principal.getName();
            var user = userSessionService.getUser(sessionUserId);
            if (user != null) {
                messagingTemplate.convertAndSendToUser(sessionUserId, "/queue/userinfo", user);
            }
        }
    }
}