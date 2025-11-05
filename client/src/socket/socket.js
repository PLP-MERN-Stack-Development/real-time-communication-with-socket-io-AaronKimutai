import { io } from 'socket.io-client';
import { useEffect, useState } from 'react';

const SOCKET_URL = 'https://real-time-communication-with-socket-io-6qa6.onrender.com';



export const socket = io(SOCKET_URL, {
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
});

export const useSocket = () => {
    const [isConnected, setIsConnected] = useState(socket.connected);
    const [messages, setMessages] = useState([]);
    const [users, setUsers] = useState([]);
    const [typingUsers, setTypingUsers] = useState([]);
    const [currentRoom, setCurrentRoom] = useState(null); 
    
   
    const [sentMessages, setSentMessages] = useState({}); 

  
    const connect = (username, room) => {
        socket.connect();
        if (username && room) {
            socket.emit('user_join_room', { username, room });
            setCurrentRoom(room);
        }
    };

  
    const disconnect = () => {
        socket.disconnect();
        setMessages([]);
        setUsers([]);
        setTypingUsers([]);
        setIsConnected(false);
        setCurrentRoom(null); 
        setSentMessages({});
    };

    const sendMessage = (message) => {
        const tempId = `temp-${Date.now()}`; 
        setSentMessages(prev => ({ ...prev, [tempId]: 'pending' }));

        socket.emit('send_message', { message, tempId }, (response) => {
            if (response.status === 'OK') {
                setMessages(prev => prev.map(msg => 
                    msg.id === tempId ? { ...msg, id: response.id, timestamp: response.timestamp } : msg
                ));
                

                setSentMessages(prev => {
                    const newState = { ...prev, [response.id]: 'acknowledged' };
                    delete newState[tempId];
                    return newState;
                });
            } else {
                setSentMessages(prev => ({ ...prev, [tempId]: 'failed' }));
            }
        });
        
        
        const tempMessage = { id: tempId, sender: 'You', message, timestamp: new Date().toISOString(), room: currentRoom, isPrivate: false, reactions: {} };
        setMessages((prev) => [...prev, tempMessage]);
    };

    const sendPrivateMessage = (to, message) => {
        socket.emit('private_message', { to, message });
    };

  
    const sendReaction = (messageId, reactionType) => {
        socket.emit('react_message', { messageId, reactionType });
    };
    

    const setTyping = (isTyping) => {
        socket.emit('typing', isTyping);
    };

    // Socket event listeners
    useEffect(() => {
        // connection events
        const onConnect = () => { setIsConnected(true); };
        const onDisconnect = () => { setIsConnected(false); };

        // message events
        const onReceiveMessage = (message) => {
            setMessages((prev) => [...prev, message]);
        };

        const onPrivateMessage = (message) => {
            setMessages((prev) => [...prev, message]);
        };
        
  
        const onMessageReacted = ({ messageId, newReactions }) => {
            setMessages(prev => prev.map(msg => 
                msg.id === messageId ? { ...msg, reactions: newReactions } : msg
            ));
        };

        // User events
        const onUserList = (userList) => { setUsers(userList); };

        const onUserJoined = (user) => {
            setMessages((prev) => [...prev, { id: Date.now() + 1, system: true, message: `${user.username} joined the room: ${user.room}`, timestamp: new Date().toISOString() }]);
        };

        const onUserLeft = (user) => {
            setMessages((prev) => [...prev, { id: Date.now() + 2, system: true, message: `${user.username} left the room: ${user.room}`, timestamp: new Date().toISOString() }]);
        };


        const onTypingUsers = (users) => { setTypingUsers(users); };

        // Register event listeners
        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        socket.on('receive_message', onReceiveMessage);
        socket.on('private_message', onPrivateMessage);
        socket.on('message_reacted', onMessageReacted);
        socket.on('user_list', onUserList);
        socket.on('user_joined', onUserJoined);
        socket.on('user_left', onUserLeft);
        socket.on('typing_users', onTypingUsers);

        // Clean up event listeners
        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
            socket.off('receive_message', onReceiveMessage);
            socket.off('private_message', onPrivateMessage);
            socket.off('message_reacted', onMessageReacted);
            socket.off('user_list', onUserList);
            socket.off('user_joined', onUserJoined);
            socket.off('user_left', onUserLeft);
            socket.off('typing_users', onTypingUsers);
        };
    }, []);

    return {
        socket,
        isConnected,
        messages,
        users,
        typingUsers,
        currentRoom,
        sentMessages, 
        connect,
        disconnect,
        sendMessage,
        sendPrivateMessage,
        sendReaction, 
        setTyping,
    };
};

export default socket;
