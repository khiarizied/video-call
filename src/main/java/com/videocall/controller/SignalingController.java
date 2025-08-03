package com.videocall.controller;



//src/main/java/com/example/videocall/controller/SignalingController.java

//src/main/java/com/example/videocall/controller/SignalingController.java

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;

import com.videocall.model.SignalingMessage;
import com.videocall.service.UserSessionService;

import java.security.Principal;

@Controller
@RequestMapping("/app")
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
     messagingTemplate.convertAndSend("/app/topic/signaling", message);
 }

 @MessageMapping("/private")
 public void handlePrivateSignal(@Payload SignalingMessage message, Principal principal) {
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
     
     messagingTemplate.convertAndSendToUser(message.getTo(), "/app/queue/private", message);
 }

 @MessageMapping("/users/refresh")
 public void refreshUsersList() {
     // Send updated user list to all connected users
     messagingTemplate.convertAndSend("/app/topic/users", userSessionService.getAllUsers());
     System.out.println("Users list refreshed. Total users: " + userSessionService.getUserCount());
 }
}