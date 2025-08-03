package com.videocall.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;

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
        System.out.println("Handling private signal from " + message.getFrom() + " to " + message.getTo());
        
        // Add usernames to message
        if (message.getFrom() != null) {
            var fromUser = userSessionService.getUser(message.getFrom());
            if (fromUser != null) {
                message.setFromUsername(fromUser.getUsername());
            }
        }
        if (message.getTo() != null) {
            var toUser = userSessionService.getUser(message.getTo());
            if (toUser != null) {
                message.setToUsername(toUser.getUsername());
            }
        }
        
        // Send to specific user using the correct destination
        messagingTemplate.convertAndSendToUser(message.getTo(), "/queue/private", message);
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