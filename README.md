 # Week 5: Real-Time Chat Application with Socket.io  

## Project Overview  

This is a full-stack, real-time chat application built using React (Client) and Node.js/Express (Server), leveraging Socket.io for fast, bidirectional communication.  
 The application fully implements all features across the five tasks, focusing on modern UX, performance optimization (Task 5), and advanced real-time functionality (Task 3).  

### Key Technologies  

Frontend: React (Vite)  

Styling: Tailwind CSS (Assumed via environment)  

Real-Time: Socket.io Client  

Backend: Node.js, Express, Socket.io Server  

Sound: Tone.js (for custom sound notifications)  

### Setup and Installation  

Follow these steps to run the application locally:  

Prerequisites  

Node.js (v18+) and npm installed.  

The project assumes two separate directories: server and client.  

1. Backend Setup (server directory)  

Navigate to the server directory.  

Install dependencies:  

`npm install`
 


Create a .env file for configuration:  


`CLIENT_URL=http://localhost:5173`  
`PORT=5000`
  


Start the server using Nodemon (for development):  

`npm run dev`


2. Frontend Setup (client directory)  

Navigate to the client directory.  

Install dependencies:  

`npm install`  


Start the React application:  

`npm run dev`  


### ✅ Features Implemented    

This application successfully implements all features across the five tasks, demonstrating a mastery of real-time communication patterns.  

| Feature            | Implementation Detail                                                                                                                                    |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication     | Simple username-based authentication on join.                                                                                                            |
| Multiple Channels  | Users can select and join specific rooms (`General`, `Tech Talk`, `Random`) using `socket.join(room)`.                                                   |
| Typing Indicator   | Implemented on a per-room basis using `socket.emit('typing', ...)`.                                                                                      |
| Private Messaging  | Uses `socket.to(recipientId).emit('private_message', ...)` for targeted delivery.                                                                        |
| Message Reactions  | Users can react (👍, ❤️, 😂). State is managed on the server and broadcasted via `message_reacted`.                                                      |
| File/Image Sharing | Implemented using a secure URL placeholder pattern (`socket.emit('file_share', fileURL)`) to handle file transfer signaling without actual file uploads. |
| Read Receipts      | Uses the Intersection Observer on the client to detect when a message is scrolled into view, sending a `read_receipt` event to the server.               |


| Feature                   | Implementation Detail                                                                                                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Delivery Acknowledgment   | Uses Socket.io callbacks (`(response) => { ... }`) on `send_message` to confirm server processing and display `[✓]` status on the client.                                                  |
| Message Pagination        | Implements a dedicated API route (`GET /api/messages?room=...`) on the server. The client uses an Intersection Observer to trigger `loadOlderMessages()` when the user scrolls to the top. |
| Custom Sound Notification | Replaced the default sound with a pleasant electronic "blip" generated using Tone.js.                                                                                                      |
| Browser Notifications     | Uses the Web Notifications API and updates the tab title with unread message count when the window is blurred.                                                                             |
| Reconnection Logic        | Socket configuration is set for automatic reconnection attempts.                                                                                                                           |

 ### Screenshots and Demonstration  

Below are screenshots demonstrating key functionality, including multi-user chat, private messaging, and file sharing.  



### Deployment Information  
  

Chat Server (Backend)  


Chat Client (Frontend)  
