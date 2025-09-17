# 🎨 CollaborativeLiveDrawingApp  

## 📖 Overview  
The **Collaborative Live Drawing App** is a **Django-based web application** where users can draw on a shared canvas in real-time.  
All drawing actions are **broadcast instantly to everyone** connected via WebSockets, creating a truly collaborative art experience.  

To keep things fun and fair, each drawing action consumes **ink**. Users must register and log in to start drawing, and they can **purchase more ink** using **Stripe Checkout**.  

---

## ✨ Features  

### 🔐 User Authentication  
- Register and log in to join the collaborative canvas.  

### 🖌️ Real-Time Collaborative Drawing  
- Draw on a shared canvas using different colors.  
- Live updates are broadcast instantly to all users via WebSockets.  

### 💧 Ink System  
- Each drawing action reduces the user's ink balance.  
- Encourages efficient and creative drawing.  

### 💳 Stripe Payment Integration  
- Buy more ink through a secure **Stripe Checkout** flow.  

### 🌐 Shared Experience  
- Every user contributes to the same canvas in real-time.  
