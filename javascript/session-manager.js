const BACKEND_URL = "https://physics-ai-tutor.onrender.com";

class SessionManager {
  constructor() {
    this.currentSession = null;
    this.isHost = false;
    this.userName = localStorage.getItem("tutorUserName") || null;
    this.participants = new Map();
    this.sessionMessages = [];
    this.ws = null;
    this.sessionId = null;
    this.currentSessionTitle = null;
    this.initializeSessionUI();
    this.selectedAvatar = "👨‍🎓";
    this.selectedColor = "#3498db";
    this.wakeUpBackend();
    window.addEventListener("resize", () => this.handleResize());
    window.addEventListener("orientationchange", () => {
      setTimeout(() => this.handleResize(), 100);
    });
  }

  wakeUpBackend() {
    fetch(`${BACKEND_URL}/health`).catch(() => {});
  }

  initializeSessionUI() {
    this.createSessionButton();
    this.createSessionModal();
    this.createParticipantsList();
    this.createPublicSessionsList(); 

    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get("session");
    if (sessionId) {
      this.joinSessionFromURL(sessionId);
    }
  }

  createSessionButton() {
    const chatHeader = document.querySelector(".chat-container");
    if (!chatHeader) return;

    const sessionControls = document.createElement("div");
    sessionControls.className = "session-controls";
    sessionControls.innerHTML = `
            <div class="drag-handle" id="dragHandle">
                <div class="drag-indicator">↕️</div>
            </div>
            <div class="session-content-wrapper" id="sessionWrapper">
                <div class="session-dropdown">
                    <button class="session-dropdown-btn" id="sessionDropdownBtn">
                        <span id="sessionDropdownText">💬 Sessions</span>
                        <span>▼</span>
                    </button>
                    <div class="session-dropdown-content" id="sessionDropdownContent">
                        <div class="participants-container" id="participantsContainer">
                            <div style="padding: 8px; text-align: center; color: #666; font-size: 12px;">
                                No active session
                            </div>
                        </div>
                    </div>
                </div>
                <div class="session-actions">
                    <button id="createSessionBtn" class="session-btn create-session">
                        👥 Create
                    </button>
                    <button id="joinSessionBtn" class="session-btn join-session">
                        🔗 Join
                    </button>
                    <button id="publicSessionsBtn" class="session-btn browse-public">
                        🌐 Browse
                    </button>
                    <button id="customizeProfileBtn" class="session-btn customize-profile">
                        🎨 Profile
                    </button>
                    <button id="leaveSessionBtn" class="session-btn leave-session" style="display: none !important;">
                        🚪 Leave
                    </button>
                    <button id="shareSessionBtn" class="session-btn share-session" style="display: none !important;">
                        📤 Share
                    </button>
                    <button id="downloadSessionBtn" class="session-btn download-session" style="display: none !important;">
                        💾 Save
                    </button>
                </div>
            </div>
        `;

    chatHeader.insertBefore(sessionControls, chatHeader.firstChild);


    this.setupSessionDropdown();
    this.setupVoiceControls();
    this.setupDragHandle();

    document.getElementById("createSessionBtn").addEventListener("click", () => this.createSession());
    document.getElementById("customizeProfileBtn").addEventListener("click", () => this.showCustomizationModal());
    document.getElementById("joinSessionBtn").addEventListener("click", () => this.showJoinModal());
    document.getElementById("publicSessionsBtn").addEventListener("click", () => this.showPublicSessions());
    document.getElementById("leaveSessionBtn").addEventListener("click", () => this.leaveSession());
    document.getElementById("shareSessionBtn").addEventListener("click", () => this.shareSession());
    document.getElementById("downloadSessionBtn").addEventListener("click", () => this.downloadSession());
  }

  setupSessionDropdown() {
    const dropdownBtn = document.getElementById("sessionDropdownBtn");
    const dropdownContent = document.getElementById("sessionDropdownContent");
    
    dropdownBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      dropdownContent.classList.toggle("show");
      const arrow = dropdownBtn.querySelector("span:last-child");
      arrow.textContent = dropdownContent.classList.contains("show") ? "▲" : "▼";
    });


    document.addEventListener("click", (e) => {
      if (!dropdownBtn.contains(e.target) && !dropdownContent.contains(e.target)) {
        dropdownContent.classList.remove("show");
        const arrow = dropdownBtn.querySelector("span:last-child");
        arrow.textContent = "▼";
      }
    });
  }

  setupVoiceControls() {
    const voiceInputBtn = document.getElementById("voiceInputBtn");

    voiceInputBtn?.addEventListener("click", () => {
      if (window.voiceTutor) {
        window.voiceTutor.toggleVoiceInput();
      }
    });
  }

  setupSessionToggle() {
    const toggleBtn = document.getElementById("sessionToggleBtn");
    const content = document.getElementById("sessionContent");
    
    toggleBtn?.addEventListener("click", () => {
      const isVisible = content.style.display !== 'none';
      content.style.display = isVisible ? 'none' : 'block';
      toggleBtn.innerHTML = isVisible ? '⚙️ Functions ▼' : '⚙️ Functions ▲';
    });
  }

  setupDragHandle() {
    const dragHandle = document.getElementById("dragHandle");
    const sessionWrapper = document.getElementById("sessionWrapper");
    let isDragging = false;
    let startY = 0;
    let isCollapsed = false;

    dragHandle.addEventListener("mousedown", (e) => {
      isDragging = true;
      startY = e.clientY;
      dragHandle.style.cursor = "grabbing";
    });

    document.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      const deltaY = e.clientY - startY;
      if (Math.abs(deltaY) > 20) {
        if (deltaY < 0 && !isCollapsed) {
          sessionWrapper.style.display = "none";
          dragHandle.querySelector(".drag-indicator").textContent = "▲";
          isCollapsed = true;
        } else if (deltaY > 0 && isCollapsed) {
          sessionWrapper.style.display = "block";
          dragHandle.querySelector(".drag-indicator").textContent = "↕️";
          isCollapsed = false;
        }
      }
    });

    document.addEventListener("mouseup", () => {
      isDragging = false;
      dragHandle.style.cursor = "grab";
    });

    dragHandle.addEventListener("click", () => {
      if (isCollapsed) {
        sessionWrapper.style.display = "block";
        dragHandle.querySelector(".drag-indicator").textContent = "↕️";
        isCollapsed = false;
      } else {
        sessionWrapper.style.display = "none";
        dragHandle.querySelector(".drag-indicator").textContent = "▲";
        isCollapsed = true;
      }
    });
  }

  createPublicSessionsList() {

  }
  
  async showPublicSessions() {
    try {
      const response = await fetch(`${BACKEND_URL}/api/sessions/public`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const publicSessions = await response.json();
      
      if (publicSessions.length === 0) {
        this.showNotification("No public sessions available right now.", "info");
        return;
      }
      
      this.showPublicSessionsModal(publicSessions);
      
    } catch (error) {
      console.error("Error fetching public sessions:", error);
      this.showNotification("Failed to load public sessions. Please try again later.", "error");
    }
  }

  showPublicSessionsModal(publicSessions) {
    const modalHTML = `
      <div id="publicSessionsModal" class="session-modal" style="display: flex;">
        <div class="modal-content">
          <div class="modal-header">
            <h3>Public Sessions</h3>
            <button class="close-modal" onclick="document.getElementById('publicSessionsModal').remove()">×</button>
          </div>
          <div class="modal-body">
            <div class="public-sessions-list">
              ${publicSessions.map(session => `
                <div class="public-session-item" data-session-id="${session.sessionId}">
                  <div class="session-details">
                    <div class="session-title">${session.sessionTitle || 'Untitled Session'}</div>
                    <div class="session-meta">
                      <span class="host-name">Host: ${session.hostName}</span>
                      <span class="participant-count">${session.participantCount} participants</span>
                    </div>
                  </div>
                  <div class="join-arrow">→</div>
                </div>
              `).join('')}
            </div>
            ${!this.userName ? '<p class="join-note">Click any session to join!</p>' : ''}
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    const sessionItems = document.querySelectorAll('.public-session-item');
    sessionItems.forEach(item => {
      item.addEventListener('click', () => {
        const sessionId = item.dataset.sessionId;
        document.getElementById('publicSessionsModal').remove();
        
        // Update URL
        const url = new URL(window.location);
        url.searchParams.set('session', sessionId);
        window.history.pushState({}, '', url);
        
        if (!this.userName) {
          this.showNameModal("join");
          setTimeout(() => {
            document.getElementById("sessionIdInput").value = sessionId;
          }, 100);
        } else {
          this.joinSession(sessionId);
        }
      });
    });
  }

  createSessionModal() {
    const modal = document.createElement("div");
    modal.id = "sessionModal";
    modal.className = "session-modal";
    modal.innerHTML = `
    <div class="modal-content">
        <div class="modal-header">
            <h3 id="modalTitle">Join Session</h3>
            <button class="close-modal" onclick="this.closest('.session-modal').style.display='none'">×</button>
        </div>
        <div class="modal-body">
            <input type="text" id="userNameInput" placeholder="Your name..." maxlength="20">
            <input type="text" id="sessionIdInput" placeholder="Session ID (optional)" style="display: none;">
            <input type="text" id="sessionTitleInput" placeholder="Session title (e.g., 'Physics Basics')" maxlength="50" style="display: none;" required>
            <div class="session-privacy" id="sessionPrivacy" style="display: none;">
                <h4>Session Privacy</h4>
                <div class="privacy-options">
                    <label class="privacy-option">
                        <input type="radio" name="sessionPrivacy" value="public" checked> 
                        <span class="privacy-label">🌐 Public Session</span>
                        <small>Anyone can find and join this session</small>
                    </label>
                    <label class="privacy-option">
                        <input type="radio" name="sessionPrivacy" value="private"> 
                        <span class="privacy-label">🔒 Private Session</span>
                        <small>Only people with the session ID can join</small>
                    </label>
                </div>
            </div>
            
            <div class="customization-section">
                <h4>Choose Your Avatar</h4>
                <div class="avatar-selection" id="avatarSelection">
                    <div class="avatar-option" data-avatar="🥑 ">🥑</div>
                    <div class="avatar-option" data-avatar="🍩">🍩</div>
                    <div class="avatar-option" data-avatar="🧑‍💻">🧑‍💻</div>
                    <div class="avatar-option" data-avatar="🐢">🐢</div>
                    <div class="avatar-option" data-avatar="👩‍💻">👩‍💻</div>
                    <div class="avatar-option" data-avatar="🎲">🎲</div>
                    <div class="avatar-option" data-avatar="🍵">🍵</div>
                    <div class="avatar-option" data-avatar="🧋">🧋</div>
                    <div class="avatar-option" data-avatar="☕">☕</div>
                    <div class="avatar-option" data-avatar="🧠">🧠</div>
                    <div class="avatar-option" data-avatar="🥧">🥧</div>
                    <div class="avatar-option" data-avatar="🤓">🤓</div>
                </div>
                
                <h4>Choose Your Color</h4>
                <div class="color-selection" id="colorSelection">
                    <div class="color-option" data-color="#e74c3c" style="background: #e74c3c;"></div>
                    <div class="color-option" data-color="#3498db" style="background: #3498db;"></div>
                    <div class="color-option" data-color="#2ecc71" style="background: #2ecc71;"></div>
                    <div class="color-option" data-color="#9b59b6" style="background: #9b59b6;"></div>
                    <div class="color-option" data-color="#f39c12" style="background: #f39c12;"></div>
                    <div class="color-option" data-color="#e91e63" style="background: #e91e63;"></div>
                    <div class="color-option" data-color="#1abc9c" style="background: #1abc9c;"></div>
                    <div class="color-option" data-color="#6c5ce7" style="background: #6c5ce7;"></div>
                </div>
                
                <div class="preview-section">
                    <div class="preview-avatar" id="previewAvatar" style="background: #3498db;">👨‍🎓</div>
                    <div class="preview-text">Preview: This is how you'll appear to others</div>
                </div>
            </div>
            
            <div class="modal-buttons">
                <button id="confirmSessionBtn" class="session-btn">Join Session</button>
                <button onclick="this.closest('.session-modal').style.display='none'" class="session-btn cancel">Cancel</button>
            </div>
        </div>
    </div>
    `;

    document.body.appendChild(modal);

    const originalSessionHandler = () => {
      const userName = document.getElementById("userNameInput").value.trim();
      const sessionId = document.getElementById("sessionIdInput").value.trim();
      const sessionTitle = document.getElementById("sessionTitleInput").value.trim();     
      const privacyRadio = document.querySelector('input[name="sessionPrivacy"]:checked');
      const isPublic = privacyRadio ? privacyRadio.value === 'public' : true;
      
      if (!userName) {
        this.showNotification("Please enter your name", "error");
        return;
      }

      this.userName = userName;
      localStorage.setItem("tutorUserName", userName);

      if (sessionId) {
        this.joinSession(sessionId);
      } else {
        this.createNewSessionWithParams(sessionTitle, isPublic);
      }

      modal.style.display = "none";
    };

    document.getElementById("confirmSessionBtn").onclick =
      originalSessionHandler;
  }

  setupCustomization() {
    const avatarOptions = document.querySelectorAll(".avatar-option");
    const colorOptions = document.querySelectorAll(".color-option");
    const previewAvatar = document.getElementById("previewAvatar");

    avatarOptions[0].classList.add("selected");
    colorOptions[1].classList.add("selected");

    avatarOptions.forEach((option) => {
      option.addEventListener("click", () => {
        avatarOptions.forEach((opt) => opt.classList.remove("selected"));
        option.classList.add("selected");
        this.selectedAvatar = option.dataset.avatar;
        previewAvatar.textContent = this.selectedAvatar;
      });
    });

    colorOptions.forEach((option) => {
      option.addEventListener("click", () => {
        colorOptions.forEach((opt) => opt.classList.remove("selected"));
        option.classList.add("selected");
        this.selectedColor = option.dataset.color;
        previewAvatar.style.background = this.selectedColor;
      });
    });
  }

  createParticipantsList() {
    // Participants list is now integrated into the dropdown
  }

  async createSession() {
    if (!this.userName) {
      this.showNameModal("create");
      return;
    }
    this.showSessionCreationModal();
  }

  async createNewSession() {
    try {
      const sessionTitle = document.getElementById("sessionTitleInput").value.trim();     
      const isPublic = document.getElementById("publicSessionCheckbox").checked;         
      
      const response = await fetch(
        `${BACKEND_URL}/api/sessions/create`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hostName: this.userName,
            avatar: this.selectedAvatar,
            color: this.selectedColor,
            isPublic: isPublic,              
            sessionTitle: sessionTitle,      
            timestamp: new Date().toISOString(),
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      this.sessionId = data.sessionId;
      this.isHost = true;
      this.connectToSession();
      this.currentSessionTitle = sessionTitle || null;
      this.updateSessionUI();

      this.addSystemMessage(
        `Session created! Share this link with others: ${window.location.origin}${window.location.pathname}?session=${this.sessionId}`,
      );
    } catch (error) {
      console.error("Error creating session:", error);
      this.showNotification("Failed to create session. Please try again.", "error");
    }
  }

  async createNewSessionWithParams(sessionTitle, isPublic) {
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/sessions/create`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hostName: this.userName,
            avatar: this.selectedAvatar,
            color: this.selectedColor,
            isPublic: isPublic,              
            sessionTitle: sessionTitle,      
            timestamp: new Date().toISOString(),
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
  
      const data = await response.json();
      this.sessionId = data.sessionId;
      this.isHost = true;
      this.connectToSession();
      this.updateSessionUI();
  
      this.addSystemMessage(
        `Session created! Share this link with others: ${window.location.origin}${window.location.pathname}?session=${this.sessionId}`,
      );
    } catch (error) {
      console.error("Error creating session:", error);
      this.showNotification("Failed to create session. Please try again.", "error");
    }
  }

  showJoinModal() {
    if (!this.userName) {
      this.showNameModal("join");
      return;
    }

    this.showSessionIdModal();
  }

  showSessionIdModal() {
    const modal = document.createElement("div");
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;
    
    modal.innerHTML = `
      <div style="
        background: white;
        padding: 24px;
        border-radius: 12px;
        max-width: 400px;
        width: 90%;
        box-shadow: 0 8px 32px rgba(0,0,0,0.2);
      ">
        <h3 style="margin: 0 0 16px 0; color: #333; font-size: 18px;">Join Session</h3>
        <p style="margin: 0 0 16px 0; color: #666;">Enter the Session ID to join:</p>
        <input type="text" id="sessionIdPrompt" placeholder="Session ID" style="
          width: 100%;
          padding: 12px;
          border: 2px solid #e9ecef;
          border-radius: 8px;
          font-size: 14px;
          margin-bottom: 20px;
          box-sizing: border-box;
          outline: none;
        " autofocus>
        <div style="display: flex; gap: 12px; justify-content: flex-end;">
          <button onclick="this.closest('div').parentElement.remove()" style="
            background: #6c757d;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
          ">Cancel</button>
          <button id="joinSessionConfirm" style="
            background: #007bff;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
          ">Join</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    const input = modal.querySelector('#sessionIdPrompt');
    const joinBtn = modal.querySelector('#joinSessionConfirm');
    
    const handleJoin = () => {
      const sessionId = input.value.trim();
      if (sessionId) {
        this.joinSession(sessionId);
        modal.remove();
      } else {
        this.showNotification("Please enter a Session ID", "error");
      }
    };
    
    joinBtn.onclick = handleJoin;
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleJoin();
    });
    
    modal.onclick = (e) => {
      if (e.target === modal) modal.remove();
    };
    
    setTimeout(() => input.focus(), 100);
  }

  showNameModal(action) {
    const modal = document.getElementById("sessionModal");
    const title = document.getElementById("modalTitle");
    const confirmBtn = document.getElementById("confirmSessionBtn");
    const sessionInput = document.getElementById("sessionIdInput");
    const titleInput = document.getElementById("sessionTitleInput");     
    const privacyDiv = document.getElementById("sessionPrivacy");

    if (action === "join") {
      title.textContent = "Join Session";
      confirmBtn.textContent = "Join Session";
      sessionInput.style.display = "block";
      titleInput.style.display = "none";           
      privacyDiv.style.display = "none"; 
      sessionInput.setAttribute("placeholder", "Enter Session ID");
    } else {
      title.textContent = "Create Session";
      confirmBtn.textContent = "Create Session";
      sessionInput.style.display = "none";
      titleInput.style.display = "block";         
      privacyDiv.style.display = "block";          
    }

    modal.style.display = "flex";
    document.getElementById("userNameInput").focus();
    this.setupCustomization();
  }

  showSessionCreationModal() {
    const modal = document.getElementById("sessionModal");
    const title = document.getElementById("modalTitle");
    const confirmBtn = document.getElementById("confirmSessionBtn");
    const sessionInput = document.getElementById("sessionIdInput");
    const titleInput = document.getElementById("sessionTitleInput");
    const privacyDiv = document.getElementById("sessionPrivacy");
    const nameInput = document.getElementById("userNameInput");

    title.textContent = "Create New Session";
    confirmBtn.textContent = "Create Session";
    sessionInput.style.display = "none";
    titleInput.style.display = "block";
    privacyDiv.style.display = "block";
    
    nameInput.value = this.userName;
    nameInput.style.display = "none";
    titleInput.focus();
    
    modal.style.display = "flex";
    this.setupCustomization();

    confirmBtn.onclick = () => {
      const sessionTitle = titleInput.value.trim();
      const privacyRadio = document.querySelector('input[name="sessionPrivacy"]:checked');
      const isPublic = privacyRadio ? privacyRadio.value === 'public' : true;
      
      if (!sessionTitle) {
        this.showNotification("Please enter a session title", "error");
        return;
      }
      
      this.createNewSessionWithParams(sessionTitle, isPublic);
      modal.style.display = "none";
    };
  }

  async joinSession(sessionId) {
    if (!this.userName || this.userName.trim().length === 0) {
      this.showNotification("Please enter your name first", "error");
      this.showNameModal("join");
      return;
    }
    
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/sessions/${sessionId}/join`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userName: this.userName.trim(),
            avatar: this.selectedAvatar || "👤",
            color: this.selectedColor || "#6c757d",
            timestamp: new Date().toISOString(),
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      this.sessionId = sessionId;
      this.isHost = false;
      this.sessionMessages = data.messages || [];
      this.currentSessionTitle = data.session?.sessionTitle || null;
      this.connectToSession();
      this.updateSessionUI();
      this.loadSessionHistory();

      this.addSystemMessage(`${this.userName} joined the session`);
    } catch (error) {
      console.error("Error joining session:", error);
      this.showNotification("Failed to join session. Please check the session ID.", "error");
    }
  }

  joinSessionFromURL(sessionId) {
    console.log('Attempting to join session from URL:', sessionId);
    console.log('Current userName:', this.userName);
    if (!this.userName) {
      console.log('No username, showing name modal');
      setTimeout(() => {
        this.showNameModal("join");
        document.getElementById("sessionIdInput").value = sessionId;
        document.getElementById("sessionIdInput").style.display = "none";
      }, 500);
    } else {
      console.log('Username exists, joining session directly');
      this.joinSession(sessionId);
    }
  }

  connectToSession() {
    if (this.ws) {
      this.ws.close();
    }

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.ws = new WebSocket(`wss://physics-ai-tutor.onrender.com/sessions/${this.sessionId}`);
    this.lastPingTime = Date.now();

    this.ws.onopen = () => {
      this.ws.send(
        JSON.stringify({
          type: "join",
          userName: this.userName,
          avatar: this.selectedAvatar,
          color: this.selectedColor,
          isHost: this.isHost,
        }),
      );
      
      // Start heartbeat
      this.startHeartbeat();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.lastPingTime = Date.now();
        this.handleSessionMessage(data);
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    };

    this.ws.onclose = () => {
      this.stopHeartbeat();
      if (this.sessionId) {
        setTimeout(() => this.connectToSession(), 3000); 
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.showNotification("Connection failed. Reconnecting...", "error");
    };
  }
  
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        // Check if connection is stale
        if (Date.now() - this.lastPingTime > 60000) { // 1 minute
          this.ws.close();
          return;
        }
        
        // Send ping
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000); // Every 30 seconds
  }
  
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  handleSessionMessage(data) {
    switch (data.type) {
      case "message":
        this.addSharedMessage(
          data.message,
          data.sender,
          data.timestamp,
          data.userName,
          data.files,
        );
        break;
      case "participant_joined":
        const participant = this.participants.get(data.userName);
        this.addParticipant(data.userName, participant);

        this.addSystemMessage(`${data.userName} joined the session`);
        break;
      case "participant_left":
        this.removeParticipant(data.userName);
        this.addSystemMessage(`${data.userName} left the session`);
        break;
      case "participants_update":
        this.updateParticipants(data.participants);
        break;
      case "whiteboard_action":
        this.handleSharedWhiteboardAction(data);
        break;
      case "diagram_generated":
        this.handleSharedDiagram(data);
        break;
      case "whiteboard_draw":
        const canvas = data.boardType === "teacher" ? window.teacherCanvas : window.studentCanvas;
        const ctx = data.boardType === "teacher" ? window.teacherCtx : window.studentCtx;
      
        if (canvas && ctx) {
          const rect = canvas.getBoundingClientRect();
          const scaleX = canvas.width / rect.width;
          const scaleY = canvas.height / rect.height;
      
          const x = data.x * scaleX;
          const y = data.y * scaleY;
      
          ctx.lineTo(x, y);
          ctx.stroke();
        }
        break;        
      case "whiteboard_clear":
        this.handleSharedWhiteboardClear(data);
        break;
      case "profile_update":
        if (data.userName && this.participants.has(data.userName)) {
          const participant = this.participants.get(data.userName);

          participant.avatar = data.avatar || participant.avatar;
          participant.color = data.color || participant.color;

          this.renderParticipants();
        }
        break;
      case "session_info":
        this.currentSessionTitle = data.sessionTitle;
        this.updateSessionUI();
        this.updateParticipants(data.participants);
        break;
    }
  }

  shareMessage(message, sender = "user", files = []) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: "message",
          message: message,
          sender: sender,
          userName: this.userName,
          timestamp: new Date().toISOString(),
          files: files,
        }),
      );
    }
  }

  addSharedMessage(message, sender, timestamp, userName, files = []) {
    const chatMessages = document.getElementById("chatMessages");
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${sender}-message shared-message slide-in`;

    const participant = this.participants.get(userName);

    const avatar = document.createElement("div");
    avatar.className = "message-avatar";

    if (sender === "bot") {
      avatar.innerHTML = "🤖";
      avatar.style.background = "#6c757d";
    } else {
      avatar.innerHTML = participant?.avatar || "👤";
      avatar.style.background = participant?.color || "#6c757d";
    }

    const content = document.createElement("div");
    content.className = "message-content";

    const time = new Date(timestamp).toLocaleTimeString();
    
    // Convert LaTeX to Unicode for bot messages
    let displayText = message;
    if (sender === 'bot' && window.convertLatexToUnicode) {
      displayText = window.convertLatexToUnicode(message);
    }

    let filesHtml = '';
    if (files && files.length > 0) {
      filesHtml = '<div class="message-files" style="margin-top: 8px; display: flex; flex-wrap: wrap; gap: 4px;">';
      files.forEach(file => {
        const icon = this.getFileIcon(file.type);
        filesHtml += `<span class="message-file" style="background: #e3f2fd; padding: 4px 8px; border-radius: 12px; font-size: 12px; cursor: pointer; color: #1976d2;" onclick="window.sessionManager.viewSharedFile('${file.name}', '${file.type}', '${file.data}')">${icon} ${file.name}</span>`;
      });
      filesHtml += '</div>';
    }

    content.innerHTML = `
            <div class="message-header">
                <span class="message-author">${userName}</span>
                <span class="message-time">${time}</span>
            </div>
            <div class="message-text">${displayText.replace(/\n/g, "<br>").replace(/<https?:\/\/[^>]+>/g, (match) => {
              const url = match.slice(1, -1);
              return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
            })}</div>
            ${filesHtml}
        `;

    messageDiv.appendChild(avatar);
    messageDiv.appendChild(content);
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  getFileIcon(fileType) {
    if (fileType === 'application/pdf') return '📄';
    if (fileType && fileType.startsWith('image/')) return '🖼️';
    return '📎';
  }

  viewSharedFile(name, type, data) {
    const modal = document.createElement('div');
    modal.className = 'file-viewer-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.8);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
      background: white;
      border-radius: 8px;
      max-width: 90%;
      max-height: 90%;
      overflow: auto;
      position: relative;
    `;

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '×';
    closeBtn.style.cssText = `
      position: absolute;
      top: 10px;
      right: 15px;
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      z-index: 1;
    `;
    closeBtn.onclick = () => modal.remove();

    if (type && type.startsWith('image/')) {
      const img = document.createElement('img');
      img.src = data;
      img.style.cssText = 'max-width: 100%; max-height: 100%; display: block;';
      content.appendChild(img);
    } else if (type === 'application/pdf') {
      const iframe = document.createElement('iframe');
      iframe.src = data;
      iframe.style.cssText = 'width: 80vw; height: 80vh; border: none;';
      content.appendChild(iframe);
    }

    content.appendChild(closeBtn);
    modal.appendChild(content);
    document.body.appendChild(modal);

    modal.onclick = (e) => {
      if (e.target === modal) modal.remove();
    };
  }

  addSystemMessage(message) {
    const chatMessages = document.getElementById("chatMessages");
    const messageDiv = document.createElement("div");
    messageDiv.className = "message system-message";
    messageDiv.innerHTML = `<div class="system-content">📢 ${message}</div>`;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  updateParticipants(participants) {
    this.participants.clear();
    participants.forEach((p) => this.participants.set(p.userName, p));
    this.renderParticipants();
  }

  addParticipant(userName, participantData = null) {
    if (participantData) {
      this.participants.set(userName, participantData);
    } else if (!this.participants.has(userName)) {
      this.participants.set(userName, {
        userName,
        avatar: "👤",
        color: "#6c757d",
        joinedAt: new Date().toISOString(),
      });
    }
    this.renderParticipants();
  }

  removeParticipant(userName) {
    this.participants.delete(userName);
    this.renderParticipants();
  }

  renderParticipants() {
    const container = document.getElementById("participantsContainer");
    const dropdownText = document.getElementById("sessionDropdownText");

    if (!this.sessionId || this.participants.size === 0) {
      container.innerHTML = `
        <div style="padding: 12px; text-align: center; color: #666; font-size: 12px;">
          No active session
        </div>
      `;
      dropdownText.textContent = "💬 No Active Session";
      return;
    }

    const sessionTitle = this.currentSessionTitle || `Session ${this.sessionId.substring(0, 8)}`;
    const participantCount = this.participants.size;
    dropdownText.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: flex-start; line-height: 1.2;">
        <span style="font-weight: 600; font-size: 12px;">${sessionTitle}</span>
        <span style="font-size: 10px; opacity: 0.8;">${participantCount} participant${participantCount !== 1 ? 's' : ''}</span>
      </div>
    `;

    container.innerHTML = "";
    
    // Add session info header
    const sessionInfo = document.createElement("div");
    sessionInfo.style.cssText = `
      padding: 12px 16px 8px;
      background: linear-gradient(135deg, #f8f9fa, #e9ecef);
      border-bottom: 1px solid #dee2e6;
      font-size: 11px;
      color: #495057;
    `;
    sessionInfo.innerHTML = `
      <div style="font-weight: 600; margin-bottom: 4px;">${sessionTitle}</div>
      <div style="opacity: 0.7;">ID: ${this.sessionId}</div>
    `;
    container.appendChild(sessionInfo);

    this.participants.forEach((participant, userName) => {
      const participantDiv = document.createElement("div");
      participantDiv.className = "participant-item";
      participantDiv.style.cssText = `
        display: flex;
        align-items: center;
        padding: 8px 16px;
        border-bottom: 1px solid #f1f3f4;
        transition: background 0.2s ease;
      `;
      participantDiv.innerHTML = `
        <div class="participant-avatar" style="
          background: ${participant.color || "#6c757d"};
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          color: white;
          margin-right: 10px;
          flex-shrink: 0;
        ">
          ${participant.avatar || "👤"}
        </div>
        <div style="flex: 1; min-width: 0;">
          <div style="font-weight: 500; font-size: 12px; color: #333; margin-bottom: 2px;">
            ${userName}${userName === this.userName ? ' (You)' : ''}
          </div>
          <div style="font-size: 10px; color: #666; opacity: 0.8;">
            ${userName === this.userName && this.isHost ? 'Host' : 'Participant'}
          </div>
        </div>
      `;
      
      participantDiv.addEventListener("mouseenter", () => {
        participantDiv.style.background = "#f8f9fa";
      });
      
      participantDiv.addEventListener("mouseleave", () => {
        participantDiv.style.background = "transparent";
      });
      
      container.appendChild(participantDiv);
    });
  }
  handleResize() {
    const sessionControls = document.querySelector(".session-controls");
    const participantsList = document.querySelector(".participants-list");

    if (sessionControls) {
      const chatContainer = document.querySelector(".chat-container");
      if (chatContainer) {
        const containerWidth = chatContainer.offsetWidth;
        sessionControls.style.flexDirection = "column";
      }
    }

    if (participantsList) {
      const windowHeight = window.innerHeight;
      const maxHeight = Math.max(120, windowHeight * 0.2);
      const container = participantsList.querySelector(
        ".participants-container",
      );
      if (container) {
        container.style.maxHeight = `${maxHeight}px`;
      }
    }
  }
  updateSessionUI() {
    const createBtn = document.getElementById("createSessionBtn");
    const joinBtn = document.getElementById("joinSessionBtn");
    const browseBtn = document.getElementById("publicSessionsBtn");
    const leaveBtn = document.getElementById("leaveSessionBtn");
    const shareBtn = document.getElementById("shareSessionBtn");
    const downloadBtn = document.getElementById("downloadSessionBtn");
    
    if (this.sessionId) {
      createBtn.style.display = "none";
      joinBtn.style.display = "none";
      browseBtn.style.display = "none";
      leaveBtn.style.display = "block";
      shareBtn.style.display = "block";
      downloadBtn.style.display = "block";
    } else {
      createBtn.style.display = "block";
      joinBtn.style.display = "block";
      browseBtn.style.display = "block";
      leaveBtn.style.display = "none";
      shareBtn.style.display = "none";
      downloadBtn.style.display = "none";
    }
    
    this.renderParticipants();
    setTimeout(() => this.setupVoiceControls(), 100);
  }

  shareSession() {
    const link = `${window.location.origin}${window.location.pathname}?session=${this.sessionId}`;
    navigator.clipboard
      .writeText(link)
      .then(() => {
        this.showNotification("✅ Session link copied to clipboard!", "success");
      })
      .catch(() => {
        this.showCopyModal(link);
      });
  }

  showNotification(message, type = "info") {
    const notification = document.createElement("div");
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === "success" ? "#28a745" : type === "error" ? "#dc3545" : "#007bff"};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      font-size: 14px;
      font-weight: 500;
      max-width: 300px;
      animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;
    
    const style = document.createElement("style");
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = "slideIn 0.3s ease reverse";
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  showCopyModal(link) {
    const modal = document.createElement("div");
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;
    
    modal.innerHTML = `
      <div style="
        background: white;
        padding: 24px;
        border-radius: 12px;
        max-width: 500px;
        width: 90%;
        box-shadow: 0 8px 32px rgba(0,0,0,0.2);
      ">
        <h3 style="margin: 0 0 16px 0; color: #333;">Share Session</h3>
        <p style="margin: 0 0 16px 0; color: #666;">Copy this link to share:</p>
        <input type="text" value="${link}" readonly style="
          width: 100%;
          padding: 12px;
          border: 2px solid #e9ecef;
          border-radius: 6px;
          font-family: monospace;
          font-size: 12px;
          margin-bottom: 16px;
          box-sizing: border-box;
        " onclick="this.select()">
        <div style="text-align: right;">
          <button onclick="this.closest('div').parentElement.remove()" style="
            background: #007bff;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
          ">Close</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    modal.onclick = (e) => {
      if (e.target === modal) modal.remove();
    };
  }

  async downloadSession() {
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/sessions/${this.sessionId}/download`,
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      await this.generateSessionPDF(data);
    } catch (error) {
      console.error("Error downloading session:", error);
      this.showNotification("Failed to download session. Please try again.", "error");
    }
  }

  async generateSessionPDF(sessionData) {
    // Create PDF content
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    let yPosition = 20;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 20;
    
    // Title
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text(`Session Notes: ${sessionData.sessionTitle || sessionData.sessionId}`, margin, yPosition);
    yPosition += 10;
    
    // Session info
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Host: ${sessionData.hostName}`, margin, yPosition);
    yPosition += 6;
    doc.text(`Date: ${new Date(sessionData.createdAt).toLocaleDateString()}`, margin, yPosition);
    yPosition += 6;
    doc.text(`Participants: ${sessionData.participants.map(p => p.userName).join(', ')}`, margin, yPosition);
    yPosition += 15;
    
    // Generate and add session summary
    const summary = await this.generateSessionSummary(sessionData);
    if (summary) {
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text('Session Summary:', margin, yPosition);
      yPosition += 10;
      
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      
      // Convert LaTeX and strip HTML tags from summary
      let cleanSummary = summary;
      if (window.convertLatexToUnicode) {
        cleanSummary = window.convertLatexToUnicode(summary);
      }
      
      // Strip HTML tags
      cleanSummary = cleanSummary
        .replace(/<[^>]*>/g, '')
        .replace(/&gt;/g, '>')
        .replace(/&lt;/g, '<')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
      
      const summaryLines = doc.splitTextToSize(cleanSummary, 170);
      doc.text(summaryLines, margin, yPosition);
      yPosition += summaryLines.length * 4 + 15;
    }
    
    // Messages
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Session Messages:', margin, yPosition);
    yPosition += 10;
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    
    for (const message of sessionData.messages) {
      if (yPosition > pageHeight - 30) {
        doc.addPage();
        yPosition = 20;
      }
      
      const timestamp = new Date(message.timestamp).toLocaleTimeString();
      const sender = message.sender === 'bot' ? 'AI Tutor' : message.userName;
      
      doc.setFont(undefined, 'bold');
      doc.text(`[${timestamp}] ${sender}:`, margin, yPosition);
      yPosition += 6;
      
      doc.setFont(undefined, 'normal');
      // Convert LaTeX and clean message text
      let cleanMessage = message.message;
      if (message.sender === 'bot' && window.convertLatexToUnicode) {
        cleanMessage = window.convertLatexToUnicode(cleanMessage);
      }
      
      cleanMessage = cleanMessage
        .replace(/&gt;/g, '>')
        .replace(/&lt;/g, '<')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '');
      
      const lines = doc.splitTextToSize(cleanMessage, 170);
      doc.text(lines, margin + 5, yPosition);
      yPosition += lines.length * 4 + 5;
    }
    
    // Whiteboard content
    if (sessionData.whiteboardActions && sessionData.whiteboardActions.length > 0) {
      if (yPosition > pageHeight - 50) {
        doc.addPage();
        yPosition = 20;
      }
      
      yPosition += 10;
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text('Whiteboard Actions:', margin, yPosition);
      yPosition += 10;
      
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      
      for (const action of sessionData.whiteboardActions) {
        if (yPosition > pageHeight - 20) {
          doc.addPage();
          yPosition = 20;
        }
        
        const timestamp = new Date(action.timestamp).toLocaleTimeString();
        doc.text(`[${timestamp}] ${action.userName}: ${action.action} on ${action.targetBoard}`, margin, yPosition);
        yPosition += 6;
      }
    }
    
    // Capture canvas content if available
    await this.addCanvasesToPDF(doc);
    
    // Save PDF
    const filename = `session-notes-${this.sessionId}-${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
    
    this.showNotification("Session notes downloaded as PDF!", "success");
  }
  
  async generateSessionSummary(sessionData) {
    try {
      if (!sessionData.messages || sessionData.messages.length === 0) {
        return "No messages in this session.";
      }
      
      let chatContent = '';
      sessionData.messages.forEach(msg => {
        const sender = msg.sender === 'bot' ? 'AI Tutor' : msg.userName;
        chatContent += `${sender}: ${msg.message}\n`;
      });
      
      const summaryPrompt = `Please provide a concise summary of this tutoring session, highlighting the main topics discussed, key concepts learned, participants' contributions, and any problems solved:\n\n${chatContent}`;
      
      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: [
            { role: 'system', content: 'You are summarizing a collaborative tutoring session. Be concise and focus on learning outcomes and participant contributions.' },
            { role: 'user', content: summaryPrompt }
          ]
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.response || "Unable to generate summary.";
      }
      
      return "Summary generation unavailable.";
    } catch (error) {
      return "Error generating session summary.";
    }
  }
  
  async addCanvasesToPDF(doc) {
    const canvases = ['teacherCanvas', 'studentCanvas'];
    
    for (const canvasId of canvases) {
      const canvas = document.getElementById(canvasId);
      if (canvas && canvas.width > 0 && canvas.height > 0) {
        // Check if canvas has content
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const hasContent = imageData.data.some((channel, index) => 
          index % 4 !== 3 && channel !== 0
        );
        
        if (hasContent) {
          doc.addPage();
          doc.setFontSize(14);
          doc.setFont(undefined, 'bold');
          doc.text(`${canvasId === 'teacherCanvas' ? 'Teacher' : 'Student'} Whiteboard:`, 20, 20);
          
          const imgData = canvas.toDataURL('image/png');
          const imgWidth = 170;
          const imgHeight = (canvas.height * imgWidth) / canvas.width;
          
          doc.addImage(imgData, 'PNG', 20, 30, imgWidth, Math.min(imgHeight, 250));
        }
      }
    }
  }

  leaveSession() {
    if (this.ws) {
      this.ws.send(
        JSON.stringify({
          type: "leave",
          userName: this.userName,
        }),
      );
      this.ws.close();
    }

    this.stopHeartbeat();
    this.currentSession = null;
    this.sessionId = null;
    this.currentSessionTitle = null;
    this.isHost = false;
    this.participants.clear();
    this.sessionMessages = [];

    this.updateSessionUI();
    this.addSystemMessage("You left the session");

    const url = new URL(window.location);
    url.searchParams.delete("session");
    window.history.replaceState({}, "", url);
  }

  showCustomizationModal() {
    const modal = document.getElementById("sessionModal");
    const title = document.getElementById("modalTitle");
    const confirmBtn = document.getElementById("confirmSessionBtn");
    const sessionInput = document.getElementById("sessionIdInput");
    const nameInput = document.getElementById("userNameInput");

    title.textContent = "Customize Your Profile";
    confirmBtn.textContent = "Save Changes";
    sessionInput.style.display = "none";

    if (this.userName) {
      nameInput.value = this.userName;
    }

    modal.style.display = "flex";
    this.setupCustomization();

    confirmBtn.onclick = () => {
      const enteredName = nameInput.value.trim();

      if (enteredName && enteredName !== this.userName) {
        this.userName = enteredName;
        localStorage.setItem("tutorUserName", enteredName);
      }

      const selectedAvatarEl = document.querySelector(
        ".avatar-option.selected",
      );
      const selectedColorEl = document.querySelector(".color-option.selected");

      this.selectedAvatar =
        selectedAvatarEl?.dataset.avatar || this.selectedAvatar;
      this.selectedColor = selectedColorEl?.dataset.color || this.selectedColor;

      const current = this.participants.get(this.userName);
      if (current) {
        current.avatar = this.selectedAvatar;
        current.color = this.selectedColor;
      }

      this.renderParticipants();

      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(
          JSON.stringify({
            type: "profile_update",
            userName: this.userName,
            avatar: this.selectedAvatar,
            color: this.selectedColor,
          }),
        );
      }

      modal.style.display = "none";
    };
  }

  loadSessionHistory() {
    const chatMessages = document.getElementById("chatMessages");
    chatMessages.innerHTML = ""; 

    this.sessionMessages.forEach((msg) => {
      this.addSharedMessage(msg.message, msg.sender, msg.timestamp);
    });
  }

  broadcastMessage(message, sender, files = []) {
    if (this.sessionId) {
      this.shareMessage(message, sender, files);
    }
  }

  handleSharedWhiteboardAction(data) {

    if (window.tutorWhiteboard && data.action && data.targetBoard) {
      setTimeout(() => {
        if (window.switchWhiteboard) {
          window.switchWhiteboard(data.targetBoard);
        }
        
        switch (data.action) {
          case 'probability_scale':
            if (window.tutorWhiteboard.drawProbabilityScale) {
              window.tutorWhiteboard.drawProbabilityScale(data.targetBoard);
            }
            break;
          case 'distribution':
            if (window.tutorWhiteboard.drawSampleDistribution) {
              window.tutorWhiteboard.drawSampleDistribution(data.targetBoard);
            }
            break;
          case 'normal_curve':
            if (window.tutorWhiteboard.drawNormalCurve) {
              window.tutorWhiteboard.drawNormalCurve(data.targetBoard);
            }
            break;
          case 'tree_diagram':
            if (window.tutorWhiteboard.drawTreeDiagram) {
              window.tutorWhiteboard.drawTreeDiagram(data.targetBoard);
            }
            break;
          case 'clear_board':
            if (window.tutorWhiteboard.clearWhiteboard) {
              window.tutorWhiteboard.clearWhiteboard(data.targetBoard);
            }
            break;
        }
      }, 100);
    }
  }

  handleSharedDiagram(data) {


    if (window.diagramRenderer && data.description && data.targetBoard) {
      setTimeout(async () => {

        if (window.switchWhiteboard) {
          window.switchWhiteboard(data.targetBoard);
        }
        
        try {
          await window.diagramRenderer.generateDiagram(data.description, data.targetBoard);

        } catch (error) {

        }
      }, 100);
    }
  }

  handleSharedWhiteboardClear(data) {
    // Clear the whiteboard for other participants
    if (window.tutorWhiteboard && data.targetBoard) {
      setTimeout(() => {
        if (window.tutorWhiteboard.clearWhiteboard) {
          window.tutorWhiteboard.clearWhiteboard(data.targetBoard);
        }
      }, 100);
    }
  }
}
window.sessionManager = new SessionManager();