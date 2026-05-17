package com.xbc.backend.config;

import com.xbc.backend.model.User;
import com.xbc.backend.repository.UserRepository;
import com.xbc.backend.util.JwtUtil;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.stereotype.Component;

@Component
public class WebSocketAuthInterceptor implements ChannelInterceptor {

    private final JwtUtil jwtUtil;
    private final UserDetailsService userDetailsService;
    private final UserRepository userRepository;

    public WebSocketAuthInterceptor(JwtUtil jwtUtil,
                                    UserDetailsService userDetailsService,
                                    UserRepository userRepository) {
        this.jwtUtil = jwtUtil;
        this.userDetailsService = userDetailsService;
        this.userRepository = userRepository;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor =
                MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);

        if (accessor != null && StompCommand.CONNECT.equals(accessor.getCommand())) {
            String authHeader = accessor.getFirstNativeHeader("Authorization");
            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                String token = authHeader.substring(7);
                try {
                    String username = jwtUtil.extractUsername(token);
                    UserDetails userDetails = userDetailsService.loadUserByUsername(username);
                    if (jwtUtil.validateToken(token, userDetails)) {
                        // Use MongoDB userId as the STOMP principal name so that
                        // convertAndSendToUser(userId, ...) routes to this session.
                        String userId = userRepository.findByUsername(username)
                                .map(User::getId)
                                .orElseThrow();
                        accessor.setUser(() -> userId);
                    }
                } catch (Exception ignored) {
                    // Invalid token — no principal set; broker will reject subscriptions
                }
            }
        }
        return message;
    }
}
