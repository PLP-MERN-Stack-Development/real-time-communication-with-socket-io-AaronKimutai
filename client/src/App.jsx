import { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import * as Tone from "tone";

// configuration 
const SOCKET_URL = "http://localhost:5000";
const CHANNELS = ["General", "Tech Talk", "Random"]; 

// initialize the socket connection outside the component 
const socket = io(SOCKET_URL, {
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
});

export default function App() {
    // State Management 
    const [username, setUsername] = useState("");
    const [message, setMessage] = useState("");
    const [room, setRoom] = useState(CHANNELS[0]);
    const [privateRecipientId, setPrivateRecipientId] = useState(null);
    const [chatStarted, setChatStarted] = useState(false);
    
  
    const [messages, setMessages] = useState([]);
    const [users, setUsers] = useState([]);
    const [typingUsers, setTypingUsers] = useState([]);
    const [sentMessages, setSentMessages] = useState({});
    

    const [hasMoreMessages, setHasMoreMessages] = useState(true);
    const [loadingHistory, setLoadingHistory] = useState(false);
    
 
    const [selectedFile, setSelectedFile] = useState(null);
    
 
    const messageWindowRef = useRef(null);
    const observer = useRef(null);
    const synthRef = useRef(null); 
    
 
    const typingTimeoutRef = useRef(null);
    const isTypingRef = useRef(false);


    useEffect(() => {
        try {
            const synth = new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: "sine" },
                envelope: { attack: 0.01, decay: 0.3, sustain: 0.1, release: 0.5 }
            }).toDestination();
            synthRef.current = synth;
            console.log("Tone.js Synth Initialized.");
        } catch (e) {
            console.error("Failed to initialize Tone.js:", e);
        }
    }, []);

   // message pagination
    const loadOlderMessages = async () => {
        if (loadingHistory || !hasMoreMessages || !socket.connected) return;

        setLoadingHistory(true);
        const limit = 20;
        const offset = messages.filter(m => !m.system).length;
        
        try {
            const response = await fetch(`${SOCKET_URL}/api/messages?room=${room}&limit=${limit}&offset=${offset}`);
            const olderMessages = await response.json();

            if (olderMessages.length > 0) {
                
                setMessages(prev => {
                    const systemMessages = prev.filter(m => m.system);
                    const currentActualMessages = prev.filter(m => !m.system);
                    const newUniqueMessages = olderMessages.filter(
                        (om) => !currentActualMessages.some((cam) => cam.id === om.id)
                    );
                    return [...systemMessages, ...newUniqueMessages, ...currentActualMessages];
                });
            } else {
                setHasMoreMessages(false);
            }
        } catch (error) {
            console.error("Failed to fetch older messages:", error);
        } finally {
            setLoadingHistory(false);
        }
    };


    useEffect(() => {
        const target = messageWindowRef.current;
        if (!target) return;

        observer.current = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting && hasMoreMessages && !loadingHistory && messages.length > 0) {
                loadOlderMessages();
            }
        }, { threshold: 0.1 });

        const firstMessage = target.firstChild;
        if (firstMessage) {
            observer.current.observe(firstMessage);
        }

        return () => {
            if (observer.current) observer.current.disconnect();
        };
    }, [messages.length, loadingHistory, hasMoreMessages, room]);



    useEffect(() => {
        if (typeof window !== 'undefined' && "Notification" in window) Notification.requestPermission();

        const handleVisibilityChange = () => {
            if (!document.hidden) {
                document.title = `Real-Time Chat (${room})`;
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [room, messages.length]);


    //  Socket Event Handlers 
    useEffect(() => {

        socket.on("connect", () => console.log("Connected:", socket.id));
        socket.on("disconnect", () => console.log("Disconnected"));

      
        socket.on("receive_message", (msg) => {
            setMessages(prev => {
                const newMessages = [...prev, msg];
                
                if (document.hidden) {
                    // Custom Tone.js Sound notification
                    if (synthRef.current) {
                        try {
                            Tone.start();
                            synthRef.current.triggerAttackRelease(["C5"], 0.1);
                        } catch (e) {
                            console.error("Tone.js playback error:", e);
                        }
                    }

                    if (Notification.permission === "granted") {
                        new Notification(`${msg.sender} in #${msg.room}`, {
                            body: msg.message,
                            icon: 'https://placehold.co/50x50/333/fff?text=C',
                        });
                    }
                    document.title = `(${newMessages.filter(m => document.hidden).length}) Real-Time Chat (${msg.room})`;
                }
                return newMessages;
            });
        });


        socket.on("private_message", (msg) => setMessages(prev => [...prev, { ...msg, isPrivate: true }]));

 
        socket.on('message_reacted', ({ messageId, newReactions }) => {
            setMessages(prev => prev.map(msg => msg.id === messageId ? { ...msg, reactions: newReactions } : msg));
        });


        socket.on('message_read', ({ messageId, readerId }) => {
            setMessages(prev => prev.map(msg => 
                msg.id === messageId ? { ...msg, readBy: [...new Set([...(msg.readBy || []), readerId])] } : msg
            ));
        });

   
        socket.on("user_list", (userList) => setUsers(userList));
        socket.on("typing_users", (users) => setTypingUsers(users));
        
        return () => {
            socket.off("connect");
            socket.off("disconnect");
            socket.off("receive_message");
            socket.off("private_message");
            socket.off("message_reacted");
            socket.off("user_list");
            socket.off("typing_users");
            socket.off("message_read");
        };
    }, []);

  
    useEffect(() => {
        if (messageWindowRef.current) messageWindowRef.current.scrollTop = messageWindowRef.current.scrollHeight;
    }, [messages.length]);

    
    useEffect(() => {
        const messageWindow = messageWindowRef.current;
        if (!messageWindow) return;

        const handleScroll = () => {
            const messagesArray = Array.from(messageWindow.children).filter(el => el.dataset.id); 
            if (!messagesArray.length) return;

            
            const lastMessageElement = messagesArray[messagesArray.length - 1];
            const lastMsgId = lastMessageElement?.dataset?.id; 

            
            if (messageWindow.scrollHeight - messageWindow.scrollTop <= messageWindow.clientHeight + 1 && lastMsgId) {
                 socket.emit('read_receipt', { room, lastMessageId: Number(lastMsgId) });
            }
        };

        messageWindow.addEventListener('scroll', handleScroll);
        handleScroll(); 

        return () => messageWindow.removeEventListener('scroll', handleScroll);
    }, [messages.length, room]);


    // client Handlers 

 
    const handleConnect = () => {
        if (!username.trim()) return;
        socket.connect();
        socket.emit("user_join_room", { username, room });
        setChatStarted(true);
        setHasMoreMessages(true); 
        setMessages([]); 
        loadOlderMessages();
    };

   
    const handleLeave = () => {
        socket.disconnect();
        setChatStarted(false);
        setMessages([]);
        setUsers([]);
        setPrivateRecipientId(null);
    };

   
    const handleSendMessage = (e) => {
        e.preventDefault();
        
        if (!message.trim() && !selectedFile) return;

        const tempId = Date.now();
        const sender = users.find(u => u.id === socket.id)?.username || username;

        let msgData = {
            id: tempId,
            message: message,
            timestamp: new Date().toISOString(),
            senderId: socket.id,
            sender: sender,
        };

        if (selectedFile) {

            const fileURL = `https://placehold.co/200x150/1e40af/ffffff/png?text=${selectedFile.name.substring(0, 10)}`;
            msgData = { 
                ...msgData, 
                message: message || `[Shared ${selectedFile.type.split('/')[0]}]`,
                fileURL: fileURL,
                fileName: selectedFile.name,
                fileType: selectedFile.type,
            };
        }

  
        setMessages(prev => [...prev, msgData]);
        setSentMessages(prev => ({ ...prev, [tempId]: 'pending' }));

        const eventData = privateRecipientId 
            ? { to: privateRecipientId, ...msgData } 
            : { room: room, ...msgData };
            
        const eventName = privateRecipientId ? "private_message" : (selectedFile ? "file_share" : "send_message");

        socket.emit(eventName, eventData, (response) => {
            if (response.status === 'OK') {
                setSentMessages(prev => {
                    const newState = { ...prev, [response.id]: 'acknowledged' };
                    delete newState[tempId];
                    return newState;
                });
            } else {
                setSentMessages(prev => ({ ...prev, [tempId]: 'failed' }));
            }
        });

        // Cleanup
        setMessage("");
        setSelectedFile(null);
        

        if (isTypingRef.current) {
            socket.emit("typing", false);
            isTypingRef.current = false;
            clearTimeout(typingTimeoutRef.current);
        }
    };
    
 
    const handleInput = (e) => {
        const value = e.target.value;
        setMessage(value);

        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

  
        if (value.length > 0 && !isTypingRef.current) {
            socket.emit("typing", true);
            isTypingRef.current = true;
        }

        
        typingTimeoutRef.current = setTimeout(() => {
            if (isTypingRef.current) {
                socket.emit("typing", false);
                isTypingRef.current = false;
            }
        }, 1000); 

        if (value.length === 0 && isTypingRef.current) {
            socket.emit("typing", false);
            isTypingRef.current = false;
            clearTimeout(typingTimeoutRef.current);
        }
    };

 
    const handleReaction = (messageId, reactionType) => socket.emit("react_message", { messageId, reactionType });


    const togglePrivateRecipient = (recipientId) => { 
        setPrivateRecipientId(prevId => (prevId === recipientId ? null : recipientId)); 
        setMessage(""); 
        setSelectedFile(null); 
    };


    const userId = socket.id;
    const usersInCurrentRoom = users.filter(user => user.room === room);
    
    const messagesInCurrentContext = messages.filter(msg => {
        const isPublicInRoom = msg.room === room && !msg.isPrivate;
        const isPrivateToMe = msg.isPrivate && (msg.to === userId || msg.senderId === userId);
        const isOptimistic = msg.senderId === userId && msg.id > Date.now() - 60000; 

        return msg.system || isPublicInRoom || isPrivateToMe || isOptimistic;
    });

    const currentRoomTypingUsers = typingUsers.filter(u => users.find(user => user.username === u)?.room === room);
    const pmRecipientUser = users.find(u => u.id === privateRecipientId);

  
    if (!chatStarted) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
                <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-sm">
                    <h2 className="text-3xl font-extrabold mb-6 text-indigo-600">Join Real-Time Chat</h2>
                    <input
                        type="text"
                        placeholder="Choose your username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full p-3 mb-4 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition"
                    />
                    <select
                        value={room}
                        onChange={(e) => setRoom(e.target.value)}
                        className="w-full p-3 mb-6 border border-gray-300 rounded-lg bg-white appearance-none transition"
                    >
                        {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <button 
                        onClick={handleConnect}
                        className="w-full p-3 font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition shadow-lg"
                        disabled={!username.trim()}
                    >
                        Enter Chat
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen bg-gray-50 p-6 font-sans">
            <div className="grow flex flex-col max-w-4xl mx-auto bg-white rounded-xl shadow-2xl overflow-hidden">
                <header className="p-4 bg-indigo-600 text-white flex justify-between items-center shadow-lg">
                    <h2 className="text-xl font-semibold">#{room} Chat Room</h2>
                    <button 
                        onClick={handleLeave} 
                        className="px-4 py-2 bg-red-500 rounded-lg hover:bg-red-600 transition font-medium"
                    >
                        Leave
                    </button>
                </header>

                <div className="flex grow overflow-hidden">
                    <div className="grow flex flex-col p-4 overflow-y-auto" style={{ flexBasis: '75%' }}>
                        

                        {loadingHistory && <div className="text-center py-2 text-gray-500">Loading history...</div>}
                        {hasMoreMessages && !loadingHistory && (
                            <div className="text-center py-2 text-indigo-500 cursor-pointer" onClick={loadOlderMessages}>
                                Click to load older messages
                            </div>
                        )}

                        <div ref={messageWindowRef} className="flex flex-col grow">
                            {messagesInCurrentContext.map((msg) => (
                                <div 
                                    key={msg.id} 
                                    data-id={msg.id} 
                                    className={`p-3 mb-3 rounded-xl max-w-xs transition shadow-md ${
                                        msg.senderId === userId ? 'ml-auto bg-indigo-100' : 'mr-auto bg-gray-100'
                                    } ${msg.isPrivate ? 'border-2 border-red-500 bg-yellow-50' : ''}`}
                                >
                                    <div className="flex items-center justify-between text-sm font-semibold mb-1">
                                        <span className={msg.isPrivate ? 'text-red-600' : 'text-indigo-600'}>
                                            {msg.system ? "[System]" : (msg.isPrivate ? `PM from ${msg.sender}` : msg.sender)}
                                        </span>
                                        <span className="text-xs text-gray-500 ml-4">{msg.timestamp.substring(11, 16)}</span>
                                    </div>
                                    

                                    {msg.fileURL && (
                                        <div className="my-2 border border-gray-300 rounded-lg overflow-hidden">
                                            {msg.fileType?.startsWith('image/') ? (
                                                <img src={msg.fileURL} alt={msg.fileName} className="w-full object-cover max-h-40" />
                                            ) : (
                                                <div className="p-3 bg-white text-center">
                                                    <span className="text-sm font-medium text-gray-700">📄 {msg.fileName}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <p className="text-gray-800">{msg.message}</p>

   
                                    <div className="flex items-center mt-2 space-x-2">
                                        {["👍", "❤️", "😂"].map(emoji => {
                                            const count = msg.reactions?.[emoji]?.length || 0;
                                            return (
                                                <button
                                                    key={emoji}
                                                    onClick={() => handleReaction(msg.id, emoji)}
                                                    className="text-sm p-1 rounded-full hover:bg-gray-200 transition"
                                                >
                                                    {emoji}{count>0 && <span className="text-xs ml-1">{count}</span>}
                                                </button>
                                            );
                                        })}
                                     
                                        {msg.senderId === userId && sentMessages[msg.id] && (
                                            <span className={`text-xs ml-2 ${sentMessages[msg.id]==='acknowledged'?'text-green-600':'text-red-500'}`}>
                                                [{sentMessages[msg.id]==='acknowledged'?'✓':(sentMessages[msg.id]==='pending'?'...':'❌')}]
                                            </span>
                                        )}
                                        
  
                                        {msg.senderId === userId && msg.readBy && msg.readBy.length > 0 && 
                                            <span className="text-xs ml-2 text-blue-600">✓✓ {msg.readBy.length} read</span>
                                        }
                                    </div>
                                </div>
                            ))}
                            

                            {currentRoomTypingUsers.length > 0 && (
                                <p className="mt-2 text-sm text-gray-500 italic">
                                    {currentRoomTypingUsers.join(", ")} {currentRoomTypingUsers.length > 1 ? "are" : "is"} typing...
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="p-4 bg-gray-100 border-l border-gray-200 overflow-y-auto" style={{ flexBasis: '25%' }}>
                        <h3 className="text-lg font-semibold mb-3">Users in #{room}</h3>
                        <ul className="space-y-2">
                            {usersInCurrentRoom.map(user => (
                                <li key={user.id} className="flex justify-between items-center text-sm">
                                    <span className={user.id===userId?'text-indigo-600 font-bold':'text-gray-800'}>{user.username}</span>
                                    {user.id!==userId && 
                                        <button 
                                            onClick={() => togglePrivateRecipient(user.id)} 
                                            className={`text-xs px-2 py-1 rounded-full transition ${privateRecipientId===user.id?'bg-red-500 text-white':'bg-green-500 text-white hover:bg-green-600'}`}
                                        >
                                            {privateRecipientId===user.id?'Stop PM':'PM'}
                                        </button>
                                    }
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
                <div className="p-4 border-t border-gray-200 bg-white">
                    {selectedFile && <div className="flex items-center justify-between p-2 mb-2 bg-indigo-50 rounded-lg border border-indigo-200"><span className="text-sm font-medium truncate text-indigo-700">{selectedFile.name} ready.</span><button type="button" onClick={()=>setSelectedFile(null)} className="text-red-500 hover:text-red-700 text-sm font-bold">Remove</button></div>}

                    {privateRecipientId && <div className="p-2 mb-2 bg-yellow-100 rounded-lg text-sm text-yellow-800">Sending private message to: {pmRecipientUser?.username||'Unknown User'}</div>}

                    <form onSubmit={handleSendMessage} className="flex gap-2 items-stretch">
                        <input
                            type="text"
                            placeholder="Type your message..."
                            value={message}
                            onChange={handleInput}
                            className="grow p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition"
                        />
                        <input
                            type="file"
                            id="file-upload"
                            className="hidden" 
                            onChange={e=>setSelectedFile(e.target.files[0])} 
                            accept="image/*, application/pdf" 
                        />
                        
                        <label htmlFor="file-upload" 
                            className={`px-4 py-3 rounded-lg font-bold transition shadow-md text-white flex items-center justify-center ${selectedFile?'bg-orange-500 hover:bg-orange-600':'bg-gray-500 hover:bg-gray-600'}`}
                            title="Attach File/Image"
                        >
                            🔗
                        </label>

                        <button 
                            type="submit"
                            className="px-6 py-3 font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition shadow-lg"
                            disabled={message.trim()==="" && !selectedFile}
                        >
                            Send
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
