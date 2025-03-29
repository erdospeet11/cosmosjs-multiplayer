class Game {
    constructor() {
        this.initialized = false;
        this.playerName = '';
        
        this.setupLoginUI();
    }
    
    setupLoginUI() {
        const joinButton = document.getElementById('join-button');
        const playerNameInput = document.getElementById('player-name');
        
        playerNameInput.focus();
        
        playerNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.startGame();
            }
        });
        
        joinButton.addEventListener('click', () => {
            this.startGame();
        });
    }
    
    startGame() {
        const playerNameInput = document.getElementById('player-name');
        this.playerName = playerNameInput.value.trim() || 'Player';
        
        const loginOverlay = document.getElementById('login-overlay');
        loginOverlay.style.display = 'none';
        
        this.initializeGame();
        
        this.setupWebSocket();
    }
    
    initializeGame() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87ceeb);
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
        directionalLight.position.set(0, 1, 0);
        this.scene.add(directionalLight);

        const groundGeometry = new THREE.PlaneGeometry(20, 20);
        const groundMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x808080,
            side: THREE.DoubleSide
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        this.scene.add(ground);

        this.players = new Map();
        this.localPlayer = null;
        this.playerId = null;
        this.nameTags = new Map();

        this.moveSpeed = 0.1;
        this.keys = {
            w: false,
            a: false,
            s: false,
            d: false
        };

        window.addEventListener('keydown', this.onKeyDown.bind(this));
        window.addEventListener('keyup', this.onKeyUp.bind(this));
        window.addEventListener('resize', this.onWindowResize.bind(this));

        this.animate();
        
        this.initialized = true;
        console.log("Game initialized");
    }

    setupWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            console.log("WebSocket connection established");

            this.ws.send(JSON.stringify({
                type: 'join',
                name: this.playerName
            }));
        };

        this.ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            console.log("Received message:", message.type);
            this.handleWebSocketMessage(message);
        };
        
        this.ws.onerror = (error) => {
            console.error("WebSocket error:", error);
        };
        
        this.ws.onclose = () => {
            console.log("WebSocket connection closed");
        };
    }

    handleWebSocketMessage(message) {
        switch (message.type) {
            case 'init':
                console.log("Init message received. Player ID:", message.id);
                this.playerId = message.id;
                this.createLocalPlayer(message.players[message.id]);
                
                for (const [id, data] of Object.entries(message.players)) {
                    if (id !== this.playerId) {
                        console.log("Creating existing player:", id, data.name);
                        this.createOtherPlayer(id, data);
                    }
                }
                break;
                
            case 'player_joined':
                console.log("Player joined:", message.id, message.name);
                if (message.id !== this.playerId) {
                    const playerData = {
                        name: message.name,
                        position: message.position
                    };
                    this.createOtherPlayer(message.id, playerData);
                }
                break;
                
            case 'player_left':
                console.log("Player left:", message.id);
                this.removePlayer(message.id);
                break;
                
            case 'positions':
                this.updateOtherPlayers(message.players);
                break;
        }
    }

    createNameTag(name) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 64;
        
        context.fillStyle = 'rgba(0, 0, 0, 0.5)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        context.font = 'bold 24px Arial';
        context.fillStyle = 'white';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(name, canvas.width / 2, canvas.height / 2);
        
        const texture = new THREE.CanvasTexture(canvas);
        
        const material = new THREE.SpriteMaterial({ 
            map: texture, 
            transparent: true 
        });
        
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(2, 0.5, 1);
        sprite.position.set(0, 1.2, 0);
        
        return sprite;
    }

    createLocalPlayer(playerData) {
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
        this.localPlayer = new THREE.Mesh(geometry, material);
        this.localPlayer.position.set(0, 0.5, 0);
        this.scene.add(this.localPlayer);
        
        const nameTag = this.createNameTag(this.playerName);
        this.localPlayer.add(nameTag);
        
        this.players.set(this.playerId, this.localPlayer);
        this.camera.position.set(0, 5, 10);
        this.camera.lookAt(this.localPlayer.position);
        this.updatePlayerCount();
        console.log("Local player created");
    }

    createOtherPlayer(id, playerData) {
        if (this.players.has(id)) {
            console.log("Player already exists:", id);
            return;
        }
        
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
        const player = new THREE.Mesh(geometry, material);
        player.position.set(
            playerData.position.x, 
            playerData.position.y, 
            playerData.position.z
        );
        this.scene.add(player);
        
        const nameTag = this.createNameTag(playerData.name);
        player.add(nameTag);
        
        this.players.set(id, player);
        this.updatePlayerCount();
        console.log("Other player created:", id, "Name:", playerData.name, "Total players:", this.players.size);
    }

    updateOtherPlayers(playersData) {
        for (const [id, data] of Object.entries(playersData)) {
            if (id !== this.playerId) {
                if (this.players.has(id)) {
                    const player = this.players.get(id);
                    player.position.set(
                        data.position.x, 
                        data.position.y, 
                        data.position.z
                    );
                } else {
                    console.log("Creating player from position update:", id);
                    this.createOtherPlayer(id, data);
                }
            }
        }
    }

    removePlayer(id) {
        if (this.players.has(id)) {
            const player = this.players.get(id);
            this.scene.remove(player);
            this.players.delete(id);
            this.updatePlayerCount();
            console.log("Player removed:", id, "Total players:", this.players.size);
        }
    }

    updatePlayerCount() {
        document.getElementById('player-count').textContent = this.players.size;
        console.log("Player count updated:", this.players.size);
    }

    onKeyDown(event) {
        if (!this.initialized) return;
        if (this.keys.hasOwnProperty(event.key)) {
            this.keys[event.key] = true;
        }
    }

    onKeyUp(event) {
        if (!this.initialized) return;
        if (this.keys.hasOwnProperty(event.key)) {
            this.keys[event.key] = false;
        }
    }

    onWindowResize() {
        if (!this.initialized) return;
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    updateMovement() {
        if (!this.initialized || !this.localPlayer) return;

        const moveVector = new THREE.Vector3();
        if (this.keys.w) moveVector.z -= this.moveSpeed;
        if (this.keys.s) moveVector.z += this.moveSpeed;
        if (this.keys.a) moveVector.x -= this.moveSpeed;
        if (this.keys.d) moveVector.x += this.moveSpeed;

        this.localPlayer.position.add(moveVector);

        this.camera.position.x = this.localPlayer.position.x;
        this.camera.position.z = this.localPlayer.position.z + 10;
        this.camera.lookAt(this.localPlayer.position);

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'position',
                position: {
                    x: this.localPlayer.position.x,
                    y: this.localPlayer.position.y,
                    z: this.localPlayer.position.z
                }
            }));
        }
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));
        if (this.initialized) {
            this.updateMovement();
            this.renderer.render(this.scene, this.camera);
        }
    }
}

new Game(); 